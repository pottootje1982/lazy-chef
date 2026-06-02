type PaprikaClient = {
  recipes(): Promise<{ uid: string; hash: string }[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recipe(uid: string): Promise<any>;
  categories(): Promise<{ uid: string; name: string }[]>;
};
type PaprikaCtor = new (email: string, password: string) => PaprikaClient;

// paprika-api ships as CommonJS `export = <class>`. A static default import
// doesn't unwrap reliably under the bundler, so resolve the constructor via a
// dynamic import (cached).
let ctorPromise: Promise<PaprikaCtor> | undefined;
function getCtor(): Promise<PaprikaCtor> {
  if (!ctorPromise) {
    ctorPromise = import("paprika-api").then((m) => {
      const mod = m as { PaprikaApi?: unknown; default?: { PaprikaApi?: unknown } | unknown };
      // The package's named export `PaprikaApi` is the class; `default` is an object.
      return (mod.PaprikaApi ??
        (mod.default as { PaprikaApi?: unknown })?.PaprikaApi ??
        mod.default ??
        mod) as PaprikaCtor;
    });
  }
  return ctorPromise;
}

export type PaprikaIndexItem = {
  uid: string;
  name: string;
  sourceUrl: string;
  inTrash: boolean;
};

export type MappedRecipe = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  servings: string | null;
  prepTime: string | null;
  cookTime: string | null;
  ingredients: string[];
  instructions: string[];
  tags: string[];
};

async function client(email: string, password: string): Promise<PaprikaClient> {
  const Ctor = await getCtor();
  return new Ctor(email, password);
}

const lines = (s: unknown): string[] =>
  typeof s === "string" ? s.split(/\r?\n+/).map((x) => x.trim()).filter(Boolean) : [];

// Run async work over items with a concurrency cap.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Validate credentials by listing recipes (throws on bad auth).
export async function verifyCredentials(email: string, password: string): Promise<number> {
  const api = await client(email, password);
  const list = await api.recipes();
  return list.length;
}

// Full index with names + source URLs (fetches each recipe's details).
export async function listIndex(email: string, password: string): Promise<PaprikaIndexItem[]> {
  const api = await client(email, password);
  const list = await api.recipes();
  const details = await pool(list, 8, async (r) => {
    try {
      const d = await api.recipe(r.uid);
      return {
        uid: r.uid,
        name: typeof d?.name === "string" ? d.name : "(untitled)",
        sourceUrl: typeof d?.source_url === "string" ? d.source_url : "",
        inTrash: Boolean(d?.in_trash),
      };
    } catch {
      return { uid: r.uid, name: "(failed to load)", sourceUrl: "", inTrash: true };
    }
  });
  return details.filter((d) => !d.inTrash);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapToRecipe(detail: any, catMap: Map<string, string>): MappedRecipe {
  const tags = Array.isArray(detail?.categories)
    ? detail.categories.map((uid: string) => catMap.get(uid)).filter(Boolean).slice(0, 8)
    : [];
  return {
    title: typeof detail?.name === "string" && detail.name.trim() ? detail.name : "Untitled (Paprika)",
    description: (detail?.notes && String(detail.notes).trim()) || detail?.description || null,
    imageUrl: detail?.image_url || null,
    sourceUrl: detail?.source_url || null,
    servings: detail?.servings || null,
    prepTime: detail?.prep_time || null,
    cookTime: detail?.cook_time || null,
    ingredients: lines(detail?.ingredients),
    instructions: lines(detail?.directions),
    tags,
  };
}

// Fetch the chosen recipes' details + the category name map, for import.
export async function fetchForImport(
  email: string,
  password: string,
  uids: string[],
): Promise<{ uid: string; mapped: MappedRecipe }[]> {
  const api = await client(email, password);
  const cats = await api.categories().catch(() => []);
  const catMap = new Map(cats.map((c) => [c.uid, c.name]));
  const results = await pool(uids, 6, async (uid) => {
    const detail = await api.recipe(uid);
    return { uid, mapped: mapToRecipe(detail, catMap) };
  });
  return results;
}
