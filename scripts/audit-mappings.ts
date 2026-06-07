// Read-only audit of ProductMappings to surface likely-wrong links.
// Flags two kinds of suspicious mappings:
//   1. HIGH COUNT  — the linked ingredient would order many product units
//      (defaultOrderCount >= threshold), often a per-piece product linked to a
//      counted line ("12 prawns" → 12× a per-stuk pack).
//   2. NO OVERLAP  — no meaningful word from the search term (translated /
//      ingredient key) appears in the product name, e.g. the translation-bug
//      class: "butternut squash" → "Conference peren".
//
//   node --experimental-strip-types scripts/audit-mappings.ts
//
// Purely diagnostic: only findMany, never writes.
import { PrismaClient } from "@prisma/client";
import {
  normalizeIngredient,
  defaultOrderCount,
} from "../src/lib/ingredient-normalize.ts";

const HIGH_COUNT = 4; // flag mappings that would order this many units or more

const prisma = new PrismaClient();
const all = await prisma.productMapping.findMany({
  orderBy: { updatedAt: "desc" },
});

// Dutch/English glue we don't require to overlap with the product name.
const STOP = new Set([
  "de", "het", "een", "van", "met", "en", "of", "the", "a", "an", "of",
  "ah", "g", "gram", "ml", "kg", "l", "stuks", "stuk", "per",
]);

// Loose stem so plurals/declensions still count as overlap ("ui"↔"uien",
// "tomaat"↔"tomaten"): compare on the first 4 chars of words length>=4.
function stems(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => (w.length >= 5 ? w.slice(0, 4) : w));
}

function overlaps(searchTerms: string, productName: string): boolean {
  const prod = " " + productName.toLowerCase() + " ";
  const prodStems = new Set(stems(productName));
  return stems(searchTerms).some(
    (s) => prod.includes(s) || prodStems.has(s),
  );
}

type Row = {
  user: string;
  ingredientKey: string;
  raw: string;
  translated: string;
  product: string;
  unit: string | null;
  count: number;
};

const highCount: Row[] = [];
const noOverlap: Row[] = [];

for (const m of all) {
  const count = defaultOrderCount(m.rawIngredient, m.unitQuantity);
  const row: Row = {
    user: m.userId.slice(-6),
    ingredientKey: m.ingredientKey,
    raw: m.rawIngredient,
    translated: m.translated,
    product: m.productName,
    unit: m.unitQuantity,
    count,
  };
  if (count >= HIGH_COUNT) highCount.push(row);
  // Search term = translated dutch term + the normalized english key.
  const terms = `${m.translated} ${m.ingredientKey}`;
  if (!overlaps(terms, m.productName)) noOverlap.push(row);
}

highCount.sort((a, b) => b.count - a.count);
noOverlap.sort((a, b) => a.ingredientKey.localeCompare(b.ingredientKey));

console.log(`\n=== ${all.length} mappings audited ===\n`);

console.log(`\n## HIGH PRODUCT COUNT (defaultOrderCount >= ${HIGH_COUNT}) — ${highCount.length}\n`);
console.log("count | unit          | ingredient → product");
console.log("------|---------------|----------------------------------------");
for (const r of highCount) {
  console.log(
    `${String(r.count).padStart(5)} | ${String(r.unit ?? "").padEnd(13)} | "${r.raw}" → "${r.product}"`,
  );
}

console.log(`\n\n## NO WORD OVERLAP (term ↮ product name) — ${noOverlap.length}\n`);
console.log("ingredientKey → product   (translated)");
console.log("----------------------------------------");
for (const r of noOverlap) {
  console.log(`"${r.ingredientKey}" → "${r.product}"   (search: "${r.translated}")`);
}

await prisma.$disconnect();
