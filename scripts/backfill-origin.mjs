// One-time backfill: mark recipes that have a saved source-scan image as
// origin="scan" (best-effort — misses scans where the user didn't save the
// original photo). Run with:  node --env-file=.env scripts/backfill-origin.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const res = await prisma.recipe.updateMany({
  where: { sourceImageUrl: { not: null }, origin: null },
  data: { origin: "scan" },
});
console.log(`Marked ${res.count} recipe(s) as scanned.`);
await prisma.$disconnect();
