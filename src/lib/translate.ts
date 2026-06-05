import { prisma } from "@/lib/prisma";
import { translateWord } from "@/lib/nl-dict";

// Pure text helpers live in a dependency-free module so they can be unit-tested
// without pulling in Prisma. Re-exported here so existing `@/lib/translate`
// imports keep working.
export { normalizeIngredient, parseCount } from "@/lib/ingredient-normalize";

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
