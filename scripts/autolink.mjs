// Auto-link unlinked ingredients to Picnic products, high-precision.
//
//   node --env-file=.env scripts/autolink.mjs --dry   # preview only
//   node --env-file=.env scripts/autolink.mjs          # apply
//   node --env-file=.env scripts/autolink.mjs --limit 50
//
// Strategy: search Picnic with the (now clean, mostly Dutch) ingredient key
// directly — no translation, which would mangle Dutch words. A match is only
// accepted when every significant key word (>= 4 chars) appears in the product
// name, so it stays precise. Falls back to a word-for-word nl-dict translation
// for English keys. Gentle: sequential with a delay between calls.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import crypto from "crypto";
import PicnicPkg from "picnic-api";

const PicnicClient = PicnicPkg?.default ?? PicnicPkg;
const dryRun = process.argv.includes("--dry");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
const DELAY_MS = 400;

// ---- replicate normalizeIngredient (parse STOPWORDS from source, no drift) ----
const tsrc = readFileSync(new URL("../src/lib/translate.ts", import.meta.url), "utf8");
const sStart = tsrc.indexOf("const STOPWORDS = new Set(");
const sEnd = tsrc.indexOf("]);", sStart) + 3;
// eslint-disable-next-line no-eval
const STOPWORDS = eval("(" + tsrc.slice(sStart, sEnd).replace("const STOPWORDS = ", "").replace(/;\s*$/, "") + ")");
function normalizeIngredient(line) {
  let s = line.toLowerCase().trim();
  s = s.split(",")[0];
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, " ");
  s = s.replace(/\b\d+([.,/-]\d+)?\s*(g|kg|mg|ml|l|oz|lb|cm|%)?\b/g, " ");
  s = s.replace(/[^\p{L}\s-]/gu, " ");
  const words = s.split(/\s+/).filter(Boolean).filter((w) => !STOPWORDS.has(w));
  return words.join(" ").trim() || line.toLowerCase().trim();
}

// ---- nl-dict word map (parse from source) for an English-key fallback ----
const dsrc = readFileSync(new URL("../src/lib/nl-dict.ts", import.meta.url), "utf8");
const dOpen = dsrc.indexOf("{", dsrc.indexOf("const NL"));
const dClose = dsrc.indexOf("};", dOpen);
// eslint-disable-next-line no-eval
const NL = eval("(" + dsrc.slice(dOpen, dClose + 1) + ")");
const translateWord = (w) => NL[w] ?? w;

// ---- decrypt (mirror of src/lib/crypto.ts) ----
function decrypt(payload) {
  const key = Buffer.from(process.env.PICNIC_ENC_KEY, "base64");
  const [iv, tag, ct] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

const deaccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s) => deaccent(s.toLowerCase());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Accept only when every significant (>=4 char) query token is in the name.
function accept(productName, query) {
  const n = norm(productName);
  const sig = norm(query).split(/\s+/).filter((t) => t.length >= 4);
  return sig.length > 0 && sig.every((t) => n.includes(t));
}

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  where: { picnicAuthKey: { not: null }, isGuest: false },
  select: { id: true, email: true, picnicAuthKey: true },
});

let linked = 0;
let attempted = 0;
let skipped = 0;

for (const user of users) {
  const client = new PicnicClient({ countryCode: "NL", authKey: decrypt(user.picnicAuthKey) });
  const [recipes, mappings] = await Promise.all([
    prisma.recipe.findMany({ where: { userId: user.id }, select: { ingredients: true } }),
    prisma.productMapping.findMany({ where: { userId: user.id }, select: { ingredientKey: true } }),
  ]);
  const mapped = new Set(mappings.map((m) => m.ingredientKey));

  const byKey = new Map();
  for (const r of recipes) {
    for (const raw of r.ingredients) {
      const key = normalizeIngredient(raw);
      if (key.length < 4 || mapped.has(key)) continue;
      if (!byKey.has(key)) byKey.set(key, raw.trim());
    }
  }

  // Highest-impact first isn't needed; sort alphabetically for readable logs.
  const keys = [...byKey.keys()].sort().slice(0, LIMIT);
  console.log(`\n${user.email}: ${keys.length} unlinked keys to try`);

  for (const key of keys) {
    attempted++;
    const tokens = key.split(/\s+/);
    // skip junk: too many words = probably a stray sentence, low confidence
    if (tokens.length > 4) { skipped++; continue; }

    const queries = [key];
    const translated = tokens.map(translateWord).join(" ");
    if (translated !== key) queries.push(translated);

    let chosen = null;
    let usedQuery = null;
    for (const q of queries) {
      let results;
      try {
        results = await client.catalog.search(q);
      } catch (e) {
        await sleep(DELAY_MS * 3); // back off on error
        continue;
      }
      await sleep(DELAY_MS);
      const units = (Array.isArray(results) ? results : []).filter((u) => u && u.id && u.name);
      const hit = units.slice(0, 5).find((u) => accept(u.name, q));
      if (hit) { chosen = hit; usedQuery = q; break; }
    }

    if (!chosen) { skipped++; continue; }
    linked++;
    console.log(`  ✓ ${key.padEnd(22)} → ${chosen.name}${usedQuery !== key ? `  (via "${usedQuery}")` : ""}`);

    if (!dryRun) {
      await prisma.productMapping.upsert({
        where: { userId_ingredientKey: { userId: user.id, ingredientKey: key } },
        create: {
          userId: user.id,
          ingredientKey: key,
          rawIngredient: byKey.get(key),
          translated: usedQuery,
          picnicId: chosen.id,
          productName: chosen.name,
          imageId: chosen.image_id ?? null,
          priceCents: typeof chosen.display_price === "number" ? chosen.display_price : null,
          unitQuantity: chosen.unit_quantity ?? null,
        },
        update: {},
      });
    }
  }
}

console.log(`\n${dryRun ? "[DRY] " : ""}linked ${linked} of ${attempted} attempted (${skipped} skipped)`);
await prisma.$disconnect();
