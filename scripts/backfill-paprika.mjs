// Backfill paprikaUid + origin="paprika" for recipes that were bulk-imported
// from Paprika by a script (so they never got a paprikaUid). We recover the
// REAL uid by matching each recipe against the user's live Paprika account
// (by normalized source URL, then by title), so a future web sync dedupes.
//
// Only touches recipes with origin=null (leaves scans / web imports alone).
// Dry-run by default; pass --apply to write.
//
//   node --env-file=.env scripts/backfill-paprika.mjs          # preview
//   node --env-file=.env scripts/backfill-paprika.mjs --apply  # write
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import PaprikaPkg from "paprika-api";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

// mirror of src/lib/crypto.ts decrypt()
function decrypt(payload) {
  const key = Buffer.from(process.env.PICNIC_ENC_KEY, "base64");
  const [iv, tag, ct] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

// mirror of normUrl() in the paprika recipes route
const normUrl = (u) =>
  (u || "")
    .toLowerCase()
    .split("#")[0]
    .split("?")[0]
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/print\/\d+\/?$/, "/")
    .replace(/\/$/, "");

// paprika-api ships CommonJS; resolve the class robustly.
const PaprikaApi =
  PaprikaPkg.PaprikaApi ?? PaprikaPkg.default?.PaprikaApi ?? PaprikaPkg.default ?? PaprikaPkg;

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

const users = await prisma.user.findMany({
  where: { paprikaEmail: { not: null }, paprikaPassword: { not: null } },
  select: { id: true, name: true, paprikaEmail: true, paprikaPassword: true },
});
if (users.length === 0) console.log("No users with Paprika credentials connected.");

for (const user of users) {
  console.log(`\n=== ${user.name ?? user.paprikaEmail} (${user.id}) ===`);
  const api = new PaprikaApi(user.paprikaEmail, decrypt(user.paprikaPassword));

  const list = await api.recipes(); // [{ uid, hash }]
  const details = await pool(list, 8, async (r) => {
    try {
      const d = await api.recipe(r.uid);
      return { uid: r.uid, name: String(d?.name ?? ""), sourceUrl: String(d?.source_url ?? ""), inTrash: Boolean(d?.in_trash) };
    } catch {
      return null;
    }
  });
  const index = details.filter((d) => d && !d.inTrash);

  // Build lookup maps; mark ambiguous keys (same url/title for >1 recipe) as null.
  const byUrl = new Map();
  const byTitle = new Map();
  for (const it of index) {
    const u = normUrl(it.sourceUrl);
    if (u) byUrl.set(u, byUrl.has(u) ? null : it.uid);
    const t = it.name.trim().toLowerCase();
    if (t) byTitle.set(t, byTitle.has(t) ? null : it.uid);
  }

  const recipes = await prisma.recipe.findMany({
    where: { userId: user.id, origin: null, paprikaUid: null },
    select: { id: true, title: true, sourceUrl: true },
  });

  const used = new Set();
  const plan = []; // matched a Paprika recipe → real uid
  const dupUid = []; // matched a uid already taken (duplicate row) → paprika, no uid
  const noMatch = []; // not in Paprika → treat as a web/URL import
  for (const r of recipes) {
    const u = normUrl(r.sourceUrl);
    let uid = (u && byUrl.get(u)) || null;
    let how = "url";
    if (!uid) {
      uid = byTitle.get(r.title.trim().toLowerCase()) || null;
      how = "title";
    }
    if (!uid) { noMatch.push(r); continue; }
    if (used.has(uid)) { dupUid.push(r); continue; }
    used.add(uid);
    plan.push({ id: r.id, title: r.title, uid, how });
  }

  console.log(`Paprika recipes: ${index.length} | DB recipes to check (origin=null): ${recipes.length}`);
  console.log(`Matched → paprika + uid: ${plan.length} (by url: ${plan.filter((p) => p.how === "url").length}, by title: ${plan.filter((p) => p.how === "title").length})`);
  if (dupUid.length) console.log(`Duplicate-of-matched → paprika (no uid): ${dupUid.length}`);
  console.log(`No Paprika match → origin="url": ${noMatch.length}`);
  if (noMatch.length) console.log("  " + noMatch.slice(0, 30).map((r) => `• ${r.title}`).join("\n  "));

  if (APPLY) {
    for (const p of plan) {
      await prisma.recipe.update({ where: { id: p.id }, data: { paprikaUid: p.uid, origin: "paprika" } });
    }
    for (const r of dupUid) {
      await prisma.recipe.update({ where: { id: r.id }, data: { origin: "paprika" } });
    }
    for (const r of noMatch) {
      await prisma.recipe.update({ where: { id: r.id }, data: { origin: "url" } });
    }
    console.log(`✅ Applied: ${plan.length} paprika+uid, ${dupUid.length} paprika, ${noMatch.length} url.`);
  } else {
    console.log('DRY RUN — re-run with --apply to write.');
  }
}

await prisma.$disconnect();
