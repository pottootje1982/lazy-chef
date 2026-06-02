// Word-level EN→NL dictionary for common ingredient terms, used to turn
// English ingredient words into Dutch Picnic search terms (the Google
// Translate key is unavailable). Unknown / already-Dutch words pass through.
const NL: Record<string, string> = {
  // vegetables & fruit
  onion: "ui", onions: "uien", garlic: "knoflook", tomato: "tomaat",
  tomatoes: "tomaten", potato: "aardappel", potatoes: "aardappel",
  carrot: "wortel", carrots: "wortels", cabbage: "kool", cauliflower: "bloemkool",
  broccoli: "broccoli", spinach: "spinazie", kale: "boerenkool", leek: "prei",
  leeks: "prei", celery: "bleekselderij", cucumber: "komkommer",
  courgette: "courgette", zucchini: "courgette", aubergine: "aubergine",
  eggplant: "aubergine", pumpkin: "pompoen", squash: "pompoen", fennel: "venkel",
  mushroom: "champignons", mushrooms: "champignons", peas: "doperwten",
  beans: "bonen", lentils: "linzen", chickpeas: "kikkererwten",
  parsnip: "pastinaak", parsnips: "pastinaak", corn: "mais", sweetcorn: "mais",
  shallot: "sjalot", shallots: "sjalotten", arugula: "rucola", rocket: "rucola",
  olive: "olijf", olives: "olijven", avocado: "avocado", apple: "appel",
  apples: "appels", lemon: "citroen", lime: "limoen", apricot: "abrikoos",
  apricots: "abrikozen", figs: "vijgen", vegetable: "groente",
  vegetables: "groenten", ginger: "gember",
  // proteins
  chicken: "kip", beef: "rundvlees", pork: "varkensvlees", lamb: "lamsvlees",
  salmon: "zalm", cod: "kabeljauw", tuna: "tonijn", prawn: "garnalen",
  prawns: "garnalen", shrimp: "garnalen", bacon: "spek", sausage: "worst",
  sausages: "worst", mince: "gehakt", tofu: "tofu", egg: "ei", eggs: "eieren",
  // dairy & pantry
  butter: "boter", cheese: "kaas", milk: "melk", cream: "room", yogurt: "yoghurt",
  flour: "bloem", sugar: "suiker", oil: "olie", vinegar: "azijn", honey: "honing",
  mustard: "mosterd", rice: "rijst", bread: "brood", noodles: "noedels",
  stock: "bouillon", broth: "bouillon", walnuts: "walnoten", almonds: "amandelen",
  raisins: "rozijnen", feta: "feta", parmesan: "parmezaan", mozzarella: "mozzarella",
  // herbs & spices
  parsley: "peterselie", coriander: "koriander", cilantro: "koriander",
  mint: "munt", basil: "basilicum", thyme: "tijm", rosemary: "rozemarijn",
  sage: "salie", dill: "dille", oregano: "oregano", chilli: "peper",
  chili: "peper", pepper: "peper", salt: "zout", cumin: "komijn",
  turmeric: "kurkuma", paprika: "paprikapoeder", cinnamon: "kaneel",
  nutmeg: "nootmuskaat", cardamom: "kardemom", saffron: "saffraan",
  // colours / qualifiers kept as adjectives
  red: "rode", green: "groene", yellow: "gele", white: "witte", black: "zwarte",
  sweet: "zoete", spring: "bos",
};

export function translateWord(word: string): string {
  return NL[word] ?? word;
}
