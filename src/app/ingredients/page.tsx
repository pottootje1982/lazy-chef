import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productImageUrl } from "@/lib/picnic";
import { normalizeIngredient, translateMany } from "@/lib/translate";
import BulkLinkClient, {
  type UnlinkedItem,
  type LinkedItem,
  type IgnoredItem,
} from "./BulkLinkClient";

// Descriptors/units the (English-centric) normalizer doesn't strip but which
// aren't useful as search chips — mostly Dutch units, qualifiers and glue.
const CHIP_DROP_EXTRA = new Set([
  // English descriptors normalize misses
  "low-salt", "low-sodium", "reduced-salt", "reduced-sodium", "no-added-sugar",
  "fat-free", "sugar-free", "full-fat", "semi-skimmed", "skimmed", "free-from",
  // Dutch units / measures
  "el", "tl", "dl", "eetlepel", "eetlepels", "theelepel", "theelepels", "gram",
  "gr", "kilo", "ons", "stuks", "stuk", "stukje", "stukjes", "plak", "plakje",
  "plakjes", "blik", "pot", "zak", "bosje", "bos", "snufje", "scheut", "scheutje",
  "mespunt", "klontje", "handje", "beetje", "takje", "takjes", "teen", "teentje",
  "teentjes", "tenen", "stengel", "stengels", "bol", "bolletje", "krop", "struik",
  // Dutch qualifiers / prep
  "verse", "vers", "grote", "groot", "kleine", "klein", "fijne", "fijn", "grove",
  "grof", "jonge", "jong", "oude", "oud", "gedroogde", "gerookte", "gekookte",
  "rauwe", "fijngesneden", "grofgesneden", "fijngehakte", "fijngehakt", "gehakte",
  "geraspte", "geraspt", "gesneden", "gepelde", "geschilde", "panklare", "halve",
  "hele", "heel", "flinke", "flink", "biologische", "magere", "volle", "zonder",
  "met", "naar", "smaak", "eventueel", "ongeveer", "circa",
  // Dutch glue words
  "de", "het", "een", "en", "of", "op", "te", "voor", "deze", "die", "mijn",
  "zet", "uit", "aan", "je",
]);

// Cleaned English core words (normalizer keeps the meaningful words; drop the
// extras above + junk). This is the phrase we translate to Dutch.
function cleanEnglishWords(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of normalizeIngredient(raw).split(/\s+/)) {
    if (w.length < 2 || !/\p{L}/u.test(w) || CHIP_DROP_EXTRA.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 8) break;
  }
  return out;
}

// Dutch glue words to drop from translated chips.
const DUTCH_GLUE = new Set([
  "de", "het", "een", "en", "of", "op", "te", "voor", "met", "naar", "in", "uit",
  "aan", "per", "à", "van", "bij", "zonder", "ter",
]);

// Chips from a translated Dutch phrase: meaningful words only, deduped.
function dutchChips(phrase: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of phrase.toLowerCase().split(/\s+/)) {
    const t = w.replace(/[^\p{L}-]/gu, "");
    if (t.length < 2 || DUTCH_GLUE.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

export default async function IngredientsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const isGuest = Boolean(session.user.isGuest);

  const [user, recipes, mappings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { picnicAuthKey: true, ignoredIngredients: true },
    }),
    prisma.recipe.findMany({
      where: { userId: session.user.id },
      select: { id: true, title: true, ingredients: true },
    }),
    prisma.productMapping.findMany({
      where: { userId: session.user.id },
      select: {
        ingredientKey: true,
        productName: true,
        imageId: true,
        priceCents: true,
        unitQuantity: true,
      },
    }),
  ]);
  const picnicLinked = Boolean(user?.picnicAuthKey);
  const mapByKey = new Map(mappings.map((m) => [m.ingredientKey, m]));
  const ignoredSet = new Set(user?.ignoredIngredients ?? []);

  // Deduped set of every recipe ingredient, tracking which recipes use each.
  const byKey = new Map<string, { raw: string; recipes: Map<string, string> }>();
  for (const r of recipes) {
    for (const raw of r.ingredients) {
      const key = normalizeIngredient(raw);
      if (key.length < 2) continue;
      const cur = byKey.get(key);
      if (cur) cur.recipes.set(r.id, r.title);
      else byKey.set(key, { raw: raw.trim(), recipes: new Map([[r.id, r.title]]) });
    }
  }
  const entries = [...byKey.entries()];
  const recipesOf = (v: { recipes: Map<string, string> }) =>
    [...v.recipes].map(([id, title]) => ({ id, title }));

  // Ignored ingredients (junk lines the user hid) take precedence over linking.
  const ignored: IgnoredItem[] = entries
    .filter(([key]) => ignoredSet.has(key))
    .map(([key, v]) => ({ key, raw: v.raw, count: v.recipes.size, recipes: recipesOf(v) }))
    .sort((a, b) => a.raw.localeCompare(b.raw));

  // Linked ingredients: recipe ingredients that already have a product mapping.
  const linked: LinkedItem[] = entries
    .filter(([key]) => !ignoredSet.has(key) && mapByKey.has(key))
    .map(([key, v]) => {
      const m = mapByKey.get(key)!;
      const recipes = recipesOf(v);
      return {
        key,
        raw: v.raw,
        count: recipes.length,
        recipes,
        product: {
          name: m.productName,
          imageUrl: productImageUrl(m.imageId),
          priceCents: m.priceCents,
          unitQuantity: m.unitQuantity,
        },
      };
    })
    .sort((a, b) => a.raw.localeCompare(b.raw));

  // Unlinked ingredients: translate the cleaned core to Dutch (batched + cached).
  const unlinkedEntries = entries.filter(([key]) => !ignoredSet.has(key) && !mapByKey.has(key));
  const phraseByKey = new Map(
    unlinkedEntries.map(([key, v]) => [key, cleanEnglishWords(v.raw).join(" ")]),
  );
  const dutchMap = await translateMany([...new Set([...phraseByKey.values()].filter(Boolean))]);

  const unlinked: UnlinkedItem[] = unlinkedEntries
    .map(([key, v]) => {
      const phrase = phraseByKey.get(key) ?? "";
      const dutch = (phrase && dutchMap.get(phrase.toLowerCase())) || phrase;
      const recipes = recipesOf(v);
      return {
        key,
        raw: v.raw,
        count: recipes.length,
        recipes,
        words: dutchChips(dutch),
        prefill: dutch,
      };
    })
    .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/recipes" className="text-sm text-stone-500 hover:text-stone-900">
        ← Back to recipes
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Link ingredients to Picnic</h1>
      <p className="mt-1 text-sm text-stone-500">
        Match recipe ingredients to Picnic products. Click a word to search, or type your own
        term. Linking one applies it to every recipe that uses that ingredient.
      </p>

      <div className="mt-6">
        {isGuest ? (
          <div className="card p-6 text-sm text-stone-500">
            The guest account is read-only.
          </div>
        ) : !picnicLinked ? (
          <div className="card p-6 text-sm text-stone-500">
            <Link href="/settings" className="text-brand-600 hover:underline">
              Connect your Picnic account
            </Link>{" "}
            first to search for products.
          </div>
        ) : linked.length === 0 && unlinked.length === 0 && ignored.length === 0 ? (
          <div className="card p-8 text-center text-sm text-stone-500">
            No recipe ingredients yet.
          </div>
        ) : (
          <BulkLinkClient unlinked={unlinked} linked={linked} ignored={ignored} />
        )}
      </div>
    </div>
  );
}
