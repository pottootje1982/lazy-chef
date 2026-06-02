// Heuristic recipe classifier shared by the bulk script
// (scripts/classify-categories.mjs — keep keyword lists in sync) and the
// Paprika import, so newly imported recipes are categorized immediately.
// Approximate by design and easily re-tuned.

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

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rx = (words: string[]) => new RegExp("\\b(" + words.map(esc).join("|") + ")", "i");
const RE_FISH = rx(FISH);
const RE_MEAT = rx(MEAT);
const RE_ANIMAL = rx(ANIMAL);
const RE_SWEET = rx(SWEET);
const eggHit = (text: string) =>
  /\begg\b|\beggs\b|\beieren\b|\bei\b|eidooier|eigeel|eiwit/.test(text);

export function classify(title: string, ingredients: string[]): string[] {
  const text = (" " + title + " ; " + ingredients.join(" ; ") + " ").toLowerCase();
  const cats = new Set<string>();
  const fish = RE_FISH.test(text);
  const meat = RE_MEAT.test(text);
  if (fish) cats.add("fish");
  if (meat) cats.add("meat");
  if (!fish && !meat) {
    cats.add("vegetarian");
    if (!RE_ANIMAL.test(text) && !eggHit(text)) cats.add("vegan");
  }
  if (RE_SWEET.test(text)) cats.add("dessert");
  return [...cats];
}
