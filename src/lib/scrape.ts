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

// Drop a trailing/leading site-name suffix from a page <title> / og:title,
// e.g. "Ovenschotel met prei en zalm | FOOD&YOU" → "Ovenschotel met prei en zalm".
export function cleanTitle(title: string, siteName?: string): string {
  let t = title.trim();
  if (siteName) {
    const s = siteName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t
      .replace(new RegExp(`\\s*[|\\-–—:·]\\s*${s}\\s*$`, "i"), "")
      .replace(new RegExp(`^\\s*${s}\\s*[|\\-–—:·]\\s*`, "i"), "");
  }
  return t.trim() || title.trim();
}

// Section headings that introduce the ingredient / instruction lists on recipe
// blogs that lack Recipe JSON-LD (very common on Dutch sites).
const INGREDIENT_MARKER =
  /(ingredi[eë]nt|wat (heb|je) (je )?nodig|heb je nodig|nodig voor|benodigdheden|boodschappen|nodig hebt|ingredients?|what you('ll| will)? need|you('ll| will)? need)/i;
const INSTRUCTION_MARKER =
  /(bereidingswijze|bereiding|werkwijze|zo ga je te werk|zo ga je|zo maak je|aan de slag|stappenplan|stappen|instructies?|directions?|method|preparation|how to make|steps?)/i;

// Fallback recipe extraction from the article body for pages without Recipe
// JSON-LD. Handles two common blog layouts: an "ingredients"/"directions"
// heading followed by a <ul>/<ol>, AND a single <p> whose lines are separated
// by <br> (the marker is the first line; the items are the following lines).
export function extractFromHtml($: cheerio.CheerioAPI): {
  ingredients: string[];
  instructions: string[];
  servings?: string;
} {
  // Prefer the main content container to avoid matching nav/footer lists.
  const root = $(
    '[data-widget_type="theme-post-content.default"], .entry-content, .post-content, .elementor-widget-theme-post-content, article, main',
  ).first();
  const scope = root.length ? root : $("body");

  type Sel = ReturnType<typeof $>;

  // Split an element's text into lines, treating <br> as a line break.
  const blockLines = (sel: Sel): string[] => {
    if (sel.length === 0) return [];
    const inner = sel.html() ?? "";
    if (!/<br/i.test(inner)) {
      const t = sel.text().replace(/\s+/g, " ").trim();
      return t ? [t] : [];
    }
    return inner
      .split(/<br\s*\/?>/i)
      .map((seg) => cheerio.load(`<x>${seg}</x>`)("x").text().replace(/\s+/g, " ").trim());
  };

  // Keep lines up to the first blank one (a paragraph break / next section,
  // e.g. ingredients followed by "En verder:" equipment).
  const untilBlank = (lines: string[]): string[] => {
    const out: string[] = [];
    for (const ln of lines) {
      if (!ln) break;
      out.push(ln);
    }
    return out;
  };

  const itemsFor = (marker: RegExp): string[] => {
    let found: string[] = [];
    scope.find("p, h2, h3, h4, h5, h6, strong, b").each((_, el) => {
      if (found.length) return;
      // For an inline match (e.g. <strong> in a <p>), use the block-level
      // ancestor so siblings/<br> lines resolve correctly.
      const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
      const block = ["strong", "b", "span", "em"].includes(tag)
        ? ($(el).closest("p, h2, h3, h4, h5, h6, div, li").get(0) ?? el)
        : el;
      const $block = $(block);
      const lines = blockLines($block);
      const first = lines[0] ?? "";
      if (!first || first.length > 60 || !marker.test(first)) return;

      // (a) a following <ul>/<ol> list.
      let items = $block
        .nextAll("ul, ol")
        .first()
        .children("li")
        .map((_i, li) => $(li).text().replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean);

      // (b) the remaining <br>-separated lines of this same <p>.
      if (!items.length && lines.length > 1) items = untilBlank(lines.slice(1));

      // (c) the <br>-separated lines of the following paragraph.
      if (!items.length) {
        const next = untilBlank(blockLines($block.nextAll("p").first()));
        if (next.length > 1) items = next;
      }

      if (items.length) found = items;
    });
    return found;
  };

  const ingredients = itemsFor(INGREDIENT_MARKER);
  const instructions = itemsFor(INSTRUCTION_MARKER);

  const text = scope.text().replace(/\s+/g, " ");
  const nl = text.match(/(\d+)\s*persone?n/i);
  const en = text.match(/serves?\s*(\d+)|(\d+)\s*servings?/i);
  const stuks = text.match(/(\d+)\s*stuks?\b/i);
  const servings = nl
    ? `${nl[1]} personen`
    : en
      ? (en[1] ?? en[2])
      : stuks
        ? `${stuks[1]} stuks`
        : undefined;

  return { ingredients, instructions, servings };
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

  // Some sites intermittently reset the connection; one retry makes import far
  // more reliable. The route allows up to 60s, so a 15s per-try budget is safe.
  async function fetchHtml(): Promise<Response> {
    return fetch(url, {
      headers: {
        // Some sites block requests without a browser-like UA.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  }

  let res: Response;
  try {
    res = await fetchHtml();
  } catch {
    // Transient network/TLS failure — retry once before giving up.
    try {
      res = await fetchHtml();
    } catch {
      throw new Error("Couldn't reach that page — check the link and try again.");
    }
  }

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

  const siteName = $('meta[property="og:site_name"]').attr("content") ?? undefined;
  const ogTitle =
    $('meta[property="og:title"]').attr("content") ?? $("title").first().text().trim();
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");

  // Fallback 1: parse the article body (recipe blogs without Recipe JSON-LD,
  // common on Dutch sites — ingredients/steps as headed <ul>/<ol> lists).
  const body = extractFromHtml($);
  if (body.ingredients.length || body.instructions.length) {
    return {
      title: cleanTitle(asString(node?.name) ?? ogTitle ?? "Untitled recipe", siteName),
      description: ogDesc ?? undefined,
      imageUrl: extractImage(node?.image) ?? ogImage ?? undefined,
      sourceUrl: url,
      servings: body.servings,
      ingredients: body.ingredients,
      instructions: body.instructions,
      tags: [],
    };
  }

  // Fallback 2: OpenGraph metadata only — user can fill in the rest.
  if (!ogTitle) {
    throw new Error(
      "Couldn't find structured recipe data on that page. Try entering it manually.",
    );
  }

  return {
    title: cleanTitle(ogTitle, siteName),
    description: ogDesc ?? undefined,
    imageUrl: ogImage ?? undefined,
    sourceUrl: url,
    ingredients: [],
    instructions: [],
    tags: [],
  };
}
