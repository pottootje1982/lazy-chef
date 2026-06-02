// Classify each recipe into categories (vegetarian/vegan/fish/meat/dessert)
// from its title + ingredients, and store them on Recipe.categories.
// Heuristic + re-runnable: `npm run classify`. Approximate by design
// (e.g. "chicken stock" in a veg dish flags it meat) — easily re-tuned.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FISH = [
  "fish", "salmon", "cod", "tuna", "prawn", "shrimp", "hake", "mackerel", "trout",
  "tilapia", "sea bass", "seabass", "crab", "clam", "squid", "haddock", "anchov",
  "sardine", "scallop", "mussel", "calamari", "octopus",
  "zalm", "kabeljauw", "garnal", "vis", "makreel", "forel", "tonijn", "schelvis",
  "mossel", "heilbot", "zeebaars", "gamba", "inktvis", "heek", "poon", "dorade",
  "griet", "coquille", "sint-jakob", "pangasius",
];
const MEAT = [
  "beef", "pork", "chicken", "lamb", "sausage", "bacon", "mince", "ham", "turkey",
  "duck", "veal", "chorizo", "pancetta", "prosciutto", "venison", "guanciale",
  "rundvlees", "varken", "kip", "lams", "worst", "spek", "gehakt", "kalkoen",
  "eend", "kalfs", "rookworst", "schouderkarbonade", "sucade", "biefstuk",
  "speklap", "hachee", "rund", "karbonade", "salami", "ribeye", "draadjesvlees",
];
const ANIMAL = [
  "milk", "butter", "cheese", "egg", "yogurt", "yoghurt", "cream", "honey",
  "parmesan", "parmezaan", "mozzarella", "feta", "ricotta", "mascarpone", "ghee",
  "paneer", "burrata", "pecorino", "scamorza", "creme fraiche", "crème fraîche",
  "melk", "boter", "kaas", "eieren", "room", "honing", "slagroom", "karnemelk",
  "geitenkaas", "gelatin", "gelatine",
];
const SWEET = [
  "cake", "dessert", "brownie", "cheesecake", "cookie", "biscuit", "chocolate",
  "chocolade", "koek", "taart", "makronen", "cantuccini", "pudding", "ice cream",
  "ijs", "mousse", "amandelkoek", "pie crust", "frosting", "custard", "tiramisu",
];

// Match keywords at a word boundary (as a word prefix), so "poon" no longer
// hits "spoon"/"teaspoon", "room" no longer hits "mushroom", "ham" no longer
// hits "graham", etc. Stems like "anchov"/"garnal"/"varken" still match
// "anchovy"/"garnalen"/"varkensvlees" because they sit at a word start.
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rx = (words) => new RegExp("\\b(" + words.map(esc).join("|") + ")", "i");
const wordHit = (text, re) => re.test(text);
const eggHit = (text) => /\begg\b|\beggs\b|\beieren\b|\bei\b|eidooier|eigeel|eiwit/.test(text);

const RE_FISH = rx(FISH);
const RE_MEAT = rx(MEAT);
const RE_ANIMAL = rx(ANIMAL);
const RE_SWEET = rx(SWEET);

function classify(title, ingredients) {
  const text = (" " + title + " ; " + ingredients.join(" ; ") + " ").toLowerCase();
  const cats = new Set();
  const fish = wordHit(text, RE_FISH);
  const meat = wordHit(text, RE_MEAT);
  if (fish) cats.add("fish");
  if (meat) cats.add("meat");
  if (!fish && !meat) {
    cats.add("vegetarian");
    if (!wordHit(text, RE_ANIMAL) && !eggHit(text)) cats.add("vegan");
  }
  if (wordHit(text, RE_SWEET)) cats.add("dessert");
  return [...cats];
}

const recipes = await prisma.recipe.findMany({
  select: { id: true, title: true, ingredients: true },
});
const counts = {};
for (const r of recipes) {
  const categories = classify(r.title, r.ingredients);
  for (const c of categories) counts[c] = (counts[c] || 0) + 1;
  await prisma.recipe.update({ where: { id: r.id }, data: { categories } });
}
console.log(`classified ${recipes.length} recipes`);
console.log(counts);
await prisma.$disconnect();
