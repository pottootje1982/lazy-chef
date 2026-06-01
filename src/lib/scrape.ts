import * as cheerio from "cheerio";

export type ScrapedRecipe = {
  title: string;
  description?: string;
  imageUrl?: string;
  sourceUrl: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients: string[];
  instructions: string[];
  tags: string[];
};

// Convert ISO-8601 durations (e.g. "PT1H30M") into "1 h 30 min".
function humanizeDuration(value?: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const m = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!m) return value;
  const [, h, min] = m;
  const parts: string[] = [];
  if (h) parts.push(`${h} h`);
  if (min) parts.push(`${min} min`);
  return parts.length ? parts.join(" ") : undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  return undefined;
}

// schema.org image can be a string, an array, or an ImageObject.
function extractImage(image: unknown): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return extractImage(image[0]);
  if (typeof image === "object" && image !== null) {
    const obj = image as Record<string, unknown>;
    return asString(obj.url) ?? asString(obj["@id"]);
  }
  return undefined;
}

// Instructions can be strings, HowToStep objects, or nested HowToSection.
function extractInstructions(instructions: unknown): string[] {
  if (!instructions) return [];
  if (typeof instructions === "string") {
    return instructions
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(instructions)) return [];
  const out: string[] = [];
  for (const step of instructions) {
    if (typeof step === "string") {
      const t = step.trim();
      if (t) out.push(t);
    } else if (step && typeof step === "object") {
      const obj = step as Record<string, unknown>;
      if (obj["@type"] === "HowToSection" && Array.isArray(obj.itemListElement)) {
        out.push(...extractInstructions(obj.itemListElement));
      } else {
        const text = asString(obj.text) ?? asString(obj.name);
        if (text) out.push(text);
      }
    }
  }
  return out;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// Walk the JSON-LD graph (handles @graph and arrays) to find a Recipe node.
function findRecipeNode(json: unknown): Record<string, unknown> | null {
  const seen: unknown[] = Array.isArray(json) ? json : [json];
  for (const node of seen) {
    if (!node || typeof node !== "object") continue;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) {
      const found = findRecipeNode(obj["@graph"]);
      if (found) return found;
    }
    const type = obj["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.includes("Recipe")) return obj;
  }
  return null;
}

function parseJsonLd($: cheerio.CheerioAPI): Record<string, unknown> | null {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const el of scripts) {
    const raw = $(el).contents().text();
    if (!raw.trim()) continue;
    try {
      const json = JSON.parse(raw);
      const recipe = findRecipeNode(json);
      if (recipe) return recipe;
    } catch {
      // Skip malformed JSON-LD blocks.
    }
  }
  return null;
}

export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }

  const res = await fetch(url, {
    headers: {
      // Some sites block requests without a browser-like UA.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    // Avoid hanging forever on slow sites.
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Could not fetch the page (HTTP ${res.status}).`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const node = parseJsonLd($);

  if (node) {
    const ingredients = toArray(node.recipeIngredient as string | string[])
      .map((s) => asString(s))
      .filter((s): s is string => Boolean(s));

    const recipe: ScrapedRecipe = {
      title: asString(node.name) ?? $("title").first().text().trim() ?? "Untitled recipe",
      description: asString(node.description),
      imageUrl: extractImage(node.image),
      sourceUrl: url,
      servings: asString(node.recipeYield) ?? asString(toArray(node.recipeYield)[0]),
      prepTime: humanizeDuration(node.prepTime),
      cookTime: humanizeDuration(node.cookTime),
      ingredients,
      instructions: extractInstructions(node.recipeInstructions),
      tags: toArray(node.keywords)
        .flatMap((k) => (typeof k === "string" ? k.split(",") : []))
        .map((t) => t.trim())
        .filter(Boolean),
    };
    if (recipe.ingredients.length || recipe.instructions.length) return recipe;
  }

  // Fallback: OpenGraph metadata only — user can fill in the rest.
  const ogTitle =
    $('meta[property="og:title"]').attr("content") ?? $("title").first().text().trim();
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");

  if (!ogTitle) {
    throw new Error(
      "Couldn't find structured recipe data on that page. Try entering it manually.",
    );
  }

  return {
    title: ogTitle,
    description: ogDesc ?? undefined,
    imageUrl: ogImage ?? undefined,
    sourceUrl: url,
    ingredients: [],
    instructions: [],
    tags: [],
  };
}
