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

// English ingredient words vs their Dutch translations. Words that are spelled
// the same in both (broccoli, avocado, feta, paprika…) are ambiguous and
// ignored for language detection.
const EN_WORDS = new Set(Object.keys(NL));
const NL_WORDS = new Set(Object.values(NL));

// Best-effort: is this recipe written in English? Decided over the whole recipe
// (title + ingredients) rather than a single line, so EN/NL homographs don't
// flip the result. Used to translate ingredients to Dutch before searching the
// (Dutch) grocer for English recipes, while leaving Dutch recipes untouched.
export function isLikelyEnglish(texts: string[]): boolean {
  let en = 0;
  let nl = 0;
  for (const t of texts) {
    for (const w of t.toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean)) {
      const isEn = EN_WORDS.has(w);
      const isNl = NL_WORDS.has(w);
      if (isEn && !isNl) en++;
      else if (isNl && !isEn) nl++;
    }
  }
  return en > 0 && en > nl;
}
