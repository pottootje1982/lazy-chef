// Pure, dependency-free ingredient text helpers: reduce a raw recipe line to a
// core grocery search key, and parse a countable quantity. Kept separate from
// translate.ts (which imports Prisma) so they can be unit-tested in isolation.
// Re-exported from translate.ts for backwards-compatible imports.

// Words stripped when reducing an ingredient line to its core grocery name:
// units/measures, size qualifiers, and cooking directions (prep verbs/adverbs).
const STOPWORDS = new Set([
  // units & measures
  "g", "gr", "gram", "grams", "kg", "mg", "ml", "l", "litre", "litres", "liter", "liters",
  "tbsp", "tbsps", "tablespoon", "tablespoons", "tsp", "tsps", "teaspoon", "teaspoons",
  "cup", "cups", "clove", "cloves", "can", "cans", "tin", "tins", "jar", "jars",
  "pinch", "pinches", "handful", "handfuls", "slice", "slices", "piece", "pieces",
  "bunch", "bunches", "sprig", "sprigs", "stick", "sticks", "pack", "packs", "packet",
  "packets", "oz", "lb", "lbs", "knob", "dash", "splash", "drop", "drops",
  // size / quality qualifiers
  "large", "medium", "small", "big", "fresh", "freshly", "ripe", "raw", "whole",
  "organic", "free-range", "skinless", "boneless", "lean", "low-fat", "reduced-fat",
  "plain", "all-purpose", "good-quality",
  // cooking directions (prep verbs / adverbs) — the main fix for "finely chopped" etc.
  "chopped", "sliced", "diced", "minced", "grated", "shredded", "crushed", "peeled",
  "halved", "quartered", "cubed", "crumbled", "beaten", "whisked", "melted", "softened",
  "drained", "rinsed", "washed", "trimmed", "deseeded", "seeded", "pitted", "cored",
  "zested", "juiced", "mashed", "cooked", "boiled", "roasted", "toasted", "fried",
  "grilled", "steamed", "blanched", "ground", "sifted", "divided", "warmed", "chilled",
  "frozen", "thawed", "dried", "cut", "torn", "broken", "separated",
  "finely", "roughly", "coarsely", "thinly", "thickly", "lightly", "well",
  // misc filler / trailing phrases ("to taste", "for garnish", "to serve")
  "to", "for", "of", "a", "an", "the", "and", "or", "plus", "extra", "more", "very",
  "taste", "garnish", "serve", "serving", "drizzling", "dusting", "greasing",
  "room", "temperature", "about", "approx", "optional", "x", "into", "in",
  // extra English qualifiers (hyphenated descriptors stay one token after normalize)
  "low-salt", "low-sodium", "reduced-salt", "reduced-sodium", "no-added-sugar",
  "fat-free", "sugar-free", "full-fat", "semi-skimmed", "skimmed", "unsalted",
  "salted", "granulated", "caster", "artisan", "artisanal", "quality", "value",
  "tub", "tubs", "carton", "cartons", "bottle", "bottles", "block",

  // ── Dutch ──────────────────────────────────────────────────────────────
  // units & measures
  "el", "tl", "dl", "cl", "eetlepel", "eetlepels", "theelepel", "theelepels",
  "eetl", "theel", "kl", // common OCR abbreviations (eetl. / theel. / koffielepel)
  "gram", "grammen", "kilo", "kilogram", "ons", "mespunt", "mespunten", "snuf",
  "snufje", "scheut", "scheutje", "scheutjes", "klont", "klontje", "klontjes",
  "takje", "takjes", "teen", "teentje", "teentjes", "tenen", "stengel", "stengels",
  "blik", "blikje", "blikken", "pot", "potje", "zak", "zakje", "bos", "bosje",
  "krop", "struik", "plak", "plakje", "plakjes", "stuk", "stuks", "stukje",
  "stukjes", "bol", "bolletje", "reep", "repen", "bakje", "doosje", "fles",
  "flesje", "pak", "pakje", "snee", "sneetje", "sneetjes", "kop", "kopje",
  "glas", "schijf", "schijfje", "schijfjes", "handvol",
  // prep / quality qualifiers (participles & adjectives)
  "gemalen", "geraspt", "geraspte", "gesneden", "fijngesneden", "fijngehakt",
  "fijngehakte", "grofgesneden", "gehakte", "gedroogd", "gedroogde", "gerookt",
  "gerookte", "gekookt", "gekookte", "gebakken", "gestoofd", "geroosterd",
  "geroosterde", "gepofte", "geschild", "geschilde", "gepeld", "gepelde",
  "geperst", "geperste", "uitgeperst", "uitgeperste", "uitgeknepen",
  "geplet", "geplette", "geprakt", "geprakte", "geblancheerd", "geblancheerde",
  "gewassen", "ontpit", "ontpitte", "ontdooid", "ontdooide",
  "ontveld", "ontvelde", "panklaar", "panklare", "vers", "verse", "rauw", "rauwe",
  "rijp", "rijpe", "grof", "grove", "fijn", "fijne", "groot", "grote", "klein",
  "kleine", "jong", "jonge", "oud", "oude", "hele", "heel", "halve", "kwart",
  "gemengd", "gemengde", "biologisch", "biologische", "ambachtelijk",
  "ambachtelijke", "ongezouten", "gezouten", "gekruid", "gekruide", "ongebrand",
  "ongebrande", "naturel", "mager", "magere", "vol", "volle", "diepvries",
  "ingevroren", "optioneel", "optionele", "platte", "gladde",
  // filler / glue
  "van", "met", "voor", "naar", "smaak", "eventueel", "ongeveer", "circa", "ca",
  "of", "en", "het", "de", "een", "per", "à", "bij", "ter", "tot", "uit",
  "zonder", "wat", "beetje",
]);

// Reduce e.g. "2 large garlic cloves, finely chopped" -> "garlic".
export function normalizeIngredient(line: string): string {
  let s = line.toLowerCase().trim();
  s = s.split(",")[0]; // drop prep notes after the first comma
  s = s.replace(/\([^)]*\)/g, " "); // drop parentheticals
  s = s.replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, " "); // unicode fractions
  s = s.replace(/\b\d+([.,/-]\d+)?\s*(g|kg|mg|ml|l|oz|lb|cm|%)?\b/g, " "); // numbers + glued units
  s = s.replace(/[^\p{L}\s-]/gu, " "); // keep letters, spaces, hyphens

  const words = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w));

  return words.join(" ").trim() || line.toLowerCase().trim();
}

// Unit tokens that mean a leading number is a measure (weight/volume/spoon),
// not a count of whole items. "200 g flour" / "2 tbsp oil" → quantity 1.
const COUNT_UNIT_TOKENS = new Set([
  "g", "gr", "gram", "grams", "kg", "mg", "ml", "cl", "dl", "l", "litre",
  "litres", "liter", "liters", "oz", "lb", "lbs", "cm", "tbsp", "tbsps",
  "tablespoon", "tablespoons", "tsp", "tsps", "teaspoon", "teaspoons",
  "cup", "cups", "pinch", "pinches", "dash", "splash", "handful", "handfuls",
  // sub-product measures: a count of these is not a count of products
  // ("2 cloves garlic" → 1 garlic, "3 sprigs thyme" → 1 thyme).
  "clove", "cloves", "sprig", "sprigs", "stalk", "stalks", "stick", "sticks",
  "knob", "knobs",
  // Dutch measures (recipes are mixed EN/NL): weights, spoons, pinches and
  // sub-product units like garlic cloves (teen/tenen) and sprigs (takje).
  "gram", "gr", "kilo", "ons", "el", "tl", "eetlepel", "eetlepels",
  "eetl", "theel", "kl", // OCR abbreviations: eetl. / theel. / koffielepel
  "theelepel", "theelepels", "snufje", "mespunt", "scheut", "scheutje",
  "teen", "tenen", "teentje", "teentjes", "takje", "takjes", "stengel",
  "stengels", "klontje", "klontjes", "handje", "handjes",
]);

// Parse a countable amount from a raw ingredient line. Returns the leading
// whole number only when it's clearly a count of items ("3 onions" → 3); for
// measures, fractions/decimals, ranges, or no leading number, returns 1.
// Conservative on purpose — never order 200 of something.
export function parseCount(line: string): number {
  const s = line.trim().toLowerCase();
  // Require a leading whole integer followed by a space (reject "200g", "2.5",
  // "2-3", "½", "2x" → all treated as 1).
  const m = s.match(/^(\d{1,2})\s+(.+)$/);
  if (!m) return 1;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return 1;
  // A measure word anywhere in the first few following tokens means this isn't
  // a count of products ("4 garlic cloves" / "3 sprigs of thyme" → 1).
  const after = m[2].split(/\s+/).slice(0, 4).map((w) => w.replace(/[^\p{L}]/gu, ""));
  if (after.some((w) => COUNT_UNIT_TOKENS.has(w))) return 1;
  return n;
}

// A Picnic product sold by weight/volume (e.g. unitQuantity "500 gram", "1 kg",
// "330 ml") holds many of a counted item, so a recipe's item-count ("12 prawns")
// is NOT a number of packages.
const WEIGHT_PACK_RE = /\b\d[\d.,]*\s*(?:g|gr|gram|grams|kg|kilo|mg|ml|cl|dl|l|liter|litre|liters|litres)\b/i;
export function isWeightPackage(unitQuantity: string | null | undefined): boolean {
  return !!unitQuantity && WEIGHT_PACK_RE.test(unitQuantity);
}

// ── Amount-aware ordering ────────────────────────────────────────────────
// Number → grams / millilitres conversion factors for known units.
const MASS_TO_G: Record<string, number> = {
  mg: 0.001, g: 1, gr: 1, gram: 1, grams: 1, grammen: 1,
  ons: 100, pond: 500, kg: 1000, kilo: 1000, kilogram: 1000,
};
const VOL_TO_ML: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000, liter: 1000, litre: 1000, liters: 1000, litres: 1000,
};
const MASS_UNITS = Object.keys(MASS_TO_G).join("|");
const VOL_UNITS = Object.keys(VOL_TO_ML).join("|");

const num = (s: string) => parseFloat(s.replace(",", "."));

// The amount a recipe line needs: a weight, a volume, or a count of whole items.
// Weight/volume win over count so "1.5 kg spinazie" is mass, not "1".
export function parseNeededAmount(
  line: string,
): { kind: "mass" | "volume" | "count"; value: number } {
  const s = line.toLowerCase();
  const mass = s.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${MASS_UNITS})\\b`));
  if (mass) return { kind: "mass", value: num(mass[1]) * MASS_TO_G[mass[2]] };
  const vol = s.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${VOL_UNITS})\\b`));
  if (vol) return { kind: "volume", value: num(vol[1]) * VOL_TO_ML[vol[2]] };
  return { kind: "count", value: parseCount(line) };
}

// Piece words that mark a product sold as a count of items.
const PIECE_WORDS =
  "stuks?|st|blokjes?|schijfjes?|plakjes?|sneetjes?|vellen|porties?|zakjes?|" +
  "blikken|blikje|blik|kroppen|krop|bollen|bol";

// Bunch-style packs: a single "bosje" already holds many (spring onions, herbs),
// so a recipe's item count is NOT a number of bunches — always order one bunch.
const BUNCH_RE = /\b(?:bos|bosje|bosjes|bossen|bundel|bundels)\b/i;

// Parse a product's unitQuantity into the dimensions we can divide by: a piece
// count and/or a total weight (g) / volume (ml). Handles multipacks ("6 x 500 ml",
// "2 stuks à 125 gram") and parenthetical weights ("1 stuk • ca. 300 gram").
export function parsePackSize(
  unitQuantity: string | null | undefined,
): { count?: number; grams?: number; ml?: number } {
  if (!unitQuantity) return {};
  const s = unitQuantity.toLowerCase();
  const out: { count?: number; grams?: number; ml?: number } = {};

  // Multipack: "N x M <unit>" or "N stuks à M <unit>" → count N, total = N×M.
  const multi = s.match(
    new RegExp(`(\\d+)\\s*(?:x|×|stuks?\\s*à|st\\.?\\s*à)\\s*(\\d+(?:[.,]\\d+)?)\\s*(${MASS_UNITS}|${VOL_UNITS})\\b`),
  );
  if (multi) {
    const n = parseInt(multi[1], 10);
    const per = num(multi[2]);
    out.count = n;
    if (multi[3] in MASS_TO_G) out.grams = n * per * MASS_TO_G[multi[3]];
    else out.ml = n * per * VOL_TO_ML[multi[3]];
    return out;
  }

  // Single weight / volume anywhere (incl. parentheticals).
  const mass = s.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${MASS_UNITS})\\b`));
  if (mass) out.grams = num(mass[1]) * MASS_TO_G[mass[2]];
  const vol = s.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${VOL_UNITS})\\b`));
  if (vol) out.ml = num(vol[1]) * VOL_TO_ML[vol[2]];

  // Piece count: a number directly followed by a piece word (last match wins, so
  // "2 of 3 stuks" → 3). "per stuk" / a lone "stuk" → 1.
  const pieces = [...s.matchAll(new RegExp(`(\\d+)\\s*(?:${PIECE_WORDS})\\b`, "g"))];
  if (pieces.length) out.count = parseInt(pieces[pieces.length - 1][1], 10);
  else if (/\b(?:per\s+stuk|stuks?)\b/.test(s)) out.count = 1;

  return out;
}

// Default number of product units to order for an ingredient line, given the
// linked product's unit: packages = ceil(amount needed ÷ pack size), matched on
// the same dimension (count, weight, or volume). Falls back to the conservative
// old behaviour when the two can't be matched (e.g. "12 prawns" → "500 gram" → 1).
const clampPkgs = (n: number) => Math.max(1, Math.min(12, n));
export function defaultOrderCount(line: string, unitQuantity: string | null | undefined): number {
  // A bunch already contains many items → a single bunch covers the recipe.
  if (unitQuantity && BUNCH_RE.test(unitQuantity)) return 1;
  const pack = parsePackSize(unitQuantity);
  const need = parseNeededAmount(line);
  if (need.kind === "mass" && pack.grams) return clampPkgs(Math.ceil(need.value / pack.grams));
  if (need.kind === "volume" && pack.ml) return clampPkgs(Math.ceil(need.value / pack.ml));
  if (need.kind === "count" && pack.count) return clampPkgs(Math.ceil(need.value / pack.count));
  // No matchable dimension → previous behaviour.
  if (isWeightPackage(unitQuantity)) return 1;
  return parseCount(line);
}
