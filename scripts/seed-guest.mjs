// Seeds the read-only guest demo account with example recipes and a few
// pre-linked Picnic products. Idempotent: re-running refreshes the examples.
// Run with:  npm run seed:guest   (uses DATABASE_URL from .env)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const GUEST_EMAIL = "guest@lazychef.app";

// --- normalizeIngredient: keep in sync with src/lib/translate.ts so the
// seeded mapping keys match what the app computes at render time. ---
const STOPWORDS = new Set([
  "g","gr","gram","grams","kg","mg","ml","l","litre","litres","liter","liters",
  "tbsp","tbsps","tablespoon","tablespoons","tsp","tsps","teaspoon","teaspoons",
  "cup","cups","clove","cloves","can","cans","tin","tins","jar","jars",
  "pinch","pinches","handful","handfuls","slice","slices","piece","pieces",
  "bunch","bunches","sprig","sprigs","stick","sticks","pack","packs","packet",
  "packets","oz","lb","lbs","knob","dash","splash","drop","drops",
  "large","medium","small","big","fresh","freshly","ripe","raw","whole",
  "organic","free-range","skinless","boneless","lean","low-fat","reduced-fat",
  "plain","all-purpose","good-quality",
  "chopped","sliced","diced","minced","grated","shredded","crushed","peeled",
  "halved","quartered","cubed","crumbled","beaten","whisked","melted","softened",
  "drained","rinsed","washed","trimmed","deseeded","seeded","pitted","cored",
  "zested","juiced","mashed","cooked","boiled","roasted","toasted","fried",
  "grilled","steamed","blanched","ground","sifted","divided","warmed","chilled",
  "frozen","thawed","dried","cut","torn","broken","separated",
  "finely","roughly","coarsely","thinly","thickly","lightly","well",
  "to","for","of","a","an","the","and","or","plus","extra","more","very",
  "taste","garnish","serve","serving","drizzling","dusting","greasing",
  "room","temperature","about","approx","optional","x","into","in",
]);
function norm(line) {
  let s = line.toLowerCase().trim();
  s = s.split(",")[0];
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, " ");
  s = s.replace(/\b\d+([.,/-]\d+)?\s*(g|kg|mg|ml|l|oz|lb|cm|%)?\b/g, " ");
  s = s.replace(/[^\p{L}\s-]/gu, " ");
  const words = s.split(/\s+/).filter(Boolean).filter((w) => !STOPWORDS.has(w));
  return words.join(" ").trim() || line.toLowerCase().trim();
}

const recipes = [
  {
    title: "Classic Tomato Pasta",
    description: "A simple, comforting weeknight pasta with a rich tomato-garlic sauce.",
    servings: "4", prepTime: "10 min", cookTime: "20 min",
    tags: ["vegetarian", "italian", "easy"],
    ingredients: [
      "400g spaghetti", "2 tbsp olive oil", "3 garlic cloves, finely chopped",
      "800g chopped tomatoes", "1 tsp sugar", "handful fresh basil", "50g parmesan, grated",
    ],
    instructions: [
      "Cook the spaghetti in salted boiling water until al dente.",
      "Meanwhile, gently fry the garlic in the olive oil until fragrant.",
      "Add the chopped tomatoes and sugar; simmer 15 minutes.",
      "Toss the drained pasta through the sauce, then top with basil and parmesan.",
    ],
  },
  {
    title: "Chicken & Veg Stir-Fry",
    description: "Fast, fresh and colourful — ready in under 20 minutes.",
    servings: "2", prepTime: "10 min", cookTime: "10 min",
    tags: ["quick", "asian"],
    ingredients: [
      "2 chicken breasts, sliced", "1 tbsp soy sauce", "1 red pepper, sliced",
      "200g broccoli florets", "2 garlic cloves, minced", "1 tbsp sesame oil",
    ],
    instructions: [
      "Heat the sesame oil in a wok over high heat.",
      "Stir-fry the chicken until golden, then set aside.",
      "Stir-fry the pepper and broccoli with the garlic for 3-4 minutes.",
      "Return the chicken, add the soy sauce, and toss to coat.",
    ],
  },
  {
    title: "Greek Salad",
    description: "Crisp, no-cook summer salad with feta and olives.",
    servings: "4", prepTime: "15 min", cookTime: "",
    tags: ["salad", "vegetarian", "no-cook"],
    ingredients: [
      "3 tomatoes, chopped", "1 cucumber, diced", "100g feta, cubed",
      "50g black olives", "1 red onion, thinly sliced", "2 tbsp olive oil", "1 tsp dried oregano",
    ],
    instructions: [
      "Combine the tomatoes, cucumber, onion and olives in a bowl.",
      "Top with the cubed feta.",
      "Drizzle with olive oil and sprinkle with oregano.",
    ],
  },
];

// A few ingredients pre-linked to Picnic products so the demo shows the
// mapping/order features (imageId omitted -> clean cart-icon fallback).
const productLinks = [
  { raw: "3 garlic cloves, finely chopped", name: "Knoflook", translated: "knoflook", priceCents: 139, unit: "100 g", picnicId: "demo-knoflook" },
  { raw: "50g parmesan, grated", name: "Parmigiano Reggiano", translated: "parmezaan", priceCents: 399, unit: "100 g", picnicId: "demo-parmezaan" },
  { raw: "400g spaghetti", name: "De Cecco spaghetti", translated: "spaghetti", priceCents: 199, unit: "500 g", picnicId: "demo-spaghetti" },
  { raw: "100g feta, cubed", name: "Griekse feta", translated: "feta", priceCents: 249, unit: "200 g", picnicId: "demo-feta" },
  { raw: "1 cucumber, diced", name: "Komkommer", translated: "komkommer", priceCents: 89, unit: "1 st", picnicId: "demo-komkommer" },
];

const guest = await prisma.user.upsert({
  where: { email: GUEST_EMAIL },
  create: { email: GUEST_EMAIL, name: "Guest", isGuest: true },
  update: { name: "Guest", isGuest: true },
});

// Reset the guest's data so the demo is reproducible.
await prisma.productMapping.deleteMany({ where: { userId: guest.id } });
await prisma.recipe.deleteMany({ where: { userId: guest.id } });

for (const r of recipes) {
  await prisma.recipe.create({ data: { userId: guest.id, ...r } });
}

for (const link of productLinks) {
  const ingredientKey = norm(link.raw);
  await prisma.productMapping.create({
    data: {
      userId: guest.id, ingredientKey, rawIngredient: link.raw, translated: link.translated,
      picnicId: link.picnicId, productName: link.name, imageId: null,
      priceCents: link.priceCents, unitQuantity: link.unit,
    },
  });
}

// Example recurring-groceries list (read-only demo).
await prisma.groceryList.deleteMany({ where: { userId: guest.id } });
const weekly = await prisma.groceryList.create({ data: { userId: guest.id, name: "Weekly basics" } });
const groceries = [
  { picnicId: "demo-milk", name: "Halfvolle melk", priceCents: 119, unit: "1 l" },
  { picnicId: "demo-eggs", name: "Vrije uitloop eieren", priceCents: 229, unit: "10 st" },
  { picnicId: "demo-coffee", name: "Koffiebonen", priceCents: 599, unit: "500 g" },
  { picnicId: "demo-bread", name: "Volkoren brood", priceCents: 159, unit: "800 g" },
];
for (const g of groceries) {
  await prisma.groceryItem.create({
    data: { listId: weekly.id, picnicId: g.picnicId, productName: g.name, imageId: null, priceCents: g.priceCents, unitQuantity: g.unit },
  });
}

console.log(`Seeded guest (${guest.id}): ${recipes.length} recipes, ${productLinks.length} product links, 1 grocery list (${groceries.length} items).`);
console.log("Mapping keys:", productLinks.map((l) => norm(l.raw)).join(", "));
await prisma.$disconnect();
