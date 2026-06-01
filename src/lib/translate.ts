import { prisma } from "@/lib/prisma";

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
