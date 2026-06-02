import { prisma } from "@/lib/prisma";
import { translateWord } from "@/lib/nl-dict";

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

// Translate English -> Dutch via Google Cloud Translation, cached in Postgres.
export async function translateToDutch(englishText: string): Promise<string> {
  const source = englishText.trim().toLowerCase();
  if (!source) return englishText;

  const cached = await prisma.translation.findUnique({ where: { source } });
  if (cached) return cached.target;

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey || apiKey === "your-google-translate-api-key") {
    // No key configured — fall back to the original term so search still runs.
    return englishText;
  }

  let target: string | undefined;
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: source, source: "en", target: "nl", format: "text" }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      // Don't break search on a translation outage (e.g. billing/quota issue);
      // fall back to the English term, which the user can edit in the UI.
      console.error(`Translate API ${res.status}: ${detail.slice(0, 300)}`);
      return englishText;
    }

    const data = await res.json();
    target = data?.data?.translations?.[0]?.translatedText;
  } catch (err) {
    console.error("Translate API request failed:", err);
    return englishText;
  }

  if (!target) return englishText;

  // Cache for reuse across users/recipes.
  await prisma.translation.upsert({
    where: { source },
    create: { source, target },
    update: { target },
  });

  return target;
}

// Batch translate many phrases EN→NL (auto-detect source so Dutch inputs are
// preserved), using the Postgres cache and Google's multi-`q` endpoint.
// Returns a map keyed by the lowercased source. Falls back to the dictionary
// (or the original text) when the API is unavailable.
export async function translateMany(texts: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const sources = [...new Set(texts.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (sources.length === 0) return result;

  const cached = await prisma.translation.findMany({ where: { source: { in: sources } } });
  for (const c of cached) result.set(c.source, c.target);
  const misses = sources.filter((s) => !result.has(s));
  if (misses.length === 0) return result;

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  const wordFallback = (s: string) =>
    s.split(/\s+/).map(translateWord).filter(Boolean).join(" ") || s;

  if (!apiKey || apiKey === "your-google-translate-api-key") {
    for (const s of misses) result.set(s, wordFallback(s));
    return result;
  }

  for (let i = 0; i < misses.length; i += 100) {
    const chunk = misses.slice(i, i + 100);
    try {
      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Force source=en (auto-detect mangles short phrases, e.g. "soy
          // sauce" → "Ik ben een wilg"); Dutch inputs pass through unchanged.
          body: JSON.stringify({ q: chunk, source: "en", target: "nl", format: "text" }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const translations: { translatedText?: string }[] = data?.data?.translations ?? [];
      for (let j = 0; j < chunk.length; j++) {
        const target = translations[j]?.translatedText;
        if (target) {
          result.set(chunk[j], target);
          await prisma.translation.upsert({
            where: { source: chunk[j] },
            create: { source: chunk[j], target },
            update: { target },
          });
        } else {
          result.set(chunk[j], wordFallback(chunk[j]));
        }
      }
    } catch (err) {
      console.error("translateMany chunk failed:", err);
      for (const s of chunk) result.set(s, wordFallback(s));
    }
  }
  return result;
}
