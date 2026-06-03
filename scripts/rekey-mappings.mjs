// Re-key ProductMappings after a change to normalizeIngredient's STOPWORDS.
// Recomputes ingredientKey from each mapping's stored rawIngredient and merges
// duplicates that now collapse to the same key (keeping the most recent).
//
//   node scripts/rekey-mappings.mjs --dry   # report only
//   node scripts/rekey-mappings.mjs         # apply (writes a backup first)
//
// The STOPWORDS set is parsed straight out of src/lib/translate.ts so this
// script can never drift from the app's normalization.
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "fs";

const src = readFileSync(new URL("../src/lib/translate.ts", import.meta.url), "utf8");
const start = src.indexOf("const STOPWORDS = new Set(");
const end = src.indexOf("]);", start) + 3;
const setExpr = src.slice(start, end).replace("const STOPWORDS = ", "").replace(/;\s*$/, "");
// eslint-disable-next-line no-eval
const STOPWORDS = eval("(" + setExpr + ")");

// Mirror of normalizeIngredient() in src/lib/translate.ts.
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

const dryRun = process.argv.includes("--dry");
const prisma = new PrismaClient();

const all = await prisma.productMapping.findMany();
if (!dryRun) {
  writeFileSync("/tmp/mappings-backup.json", JSON.stringify(all, null, 2));
  console.log(`backed up ${all.length} mappings to /tmp/mappings-backup.json`);
}

const users = [...new Set(all.map((m) => m.userId))];
let reKeyed = 0;
let merged = 0;

for (const userId of users) {
  const mappings = all
    .filter((m) => m.userId === userId)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  const groups = new Map();
  for (const m of mappings) {
    const nk = normalizeIngredient(m.rawIngredient);
    if (!groups.has(nk)) groups.set(nk, []);
    groups.get(nk).push(m);
  }

  const deletes = [];
  const changes = []; // { id, nk }
  for (const [nk, list] of groups) {
    const survivor = list[0]; // most recently updated
    for (const dupe of list.slice(1)) {
      deletes.push(dupe);
      merged++;
    }
    if (survivor.ingredientKey !== nk) {
      changes.push({ id: survivor.id, nk });
      reKeyed++;
    }
  }

  if (dryRun) {
    for (const d of deletes) {
      console.log(`  [merge] ${userId.slice(-6)} drop "${d.ingredientKey}" (→ kept under "${normalizeIngredient(d.rawIngredient)}")`);
    }
    for (const c of changes) {
      const m = mappings.find((x) => x.id === c.id);
      console.log(`  [rekey] ${userId.slice(-6)} "${m.ingredientKey}" → "${c.nk}"`);
    }
    continue;
  }

  // Delete duplicates first.
  for (const d of deletes) await prisma.productMapping.delete({ where: { id: d.id } });
  // Two-phase update to avoid transient unique-key collisions.
  for (const c of changes)
    await prisma.productMapping.update({ where: { id: c.id }, data: { ingredientKey: `tmp:${c.id}` } });
  for (const c of changes)
    await prisma.productMapping.update({ where: { id: c.id }, data: { ingredientKey: c.nk } });
}

console.log(`${dryRun ? "[DRY] " : ""}re-keyed ${reKeyed} mappings, merged/removed ${merged} duplicates across ${users.length} users`);
await prisma.$disconnect();
