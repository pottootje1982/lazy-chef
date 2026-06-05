// One-time backfill of the `origin` field for pre-existing recipes:
//   - Paprika imports are identified reliably by paprikaUid.
//   - Scans are best-effort via a saved source image (misses scans where the
//     user didn't save the original photo).
// Run with:  node --env-file=.env scripts/backfill-origin.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const paprika = await prisma.recipe.updateMany({
  where: { paprikaUid: { not: null }, origin: null },
  data: { origin: "paprika" },
});
console.log(`Marked ${paprika.count} recipe(s) as imported from Paprika.`);

const scan = await prisma.recipe.updateMany({
  where: { sourceImageUrl: { not: null }, origin: null },
  data: { origin: "scan" },
});
console.log(`Marked ${scan.count} recipe(s) as scanned.`);

await prisma.$disconnect();
