import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { searchProducts } from "@/lib/picnic";
import { normalizeIngredient, translateToDutch } from "@/lib/translate";

// Translate + Picnic search can take a few seconds; allow headroom where possible.
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.picnicAuthKey) {
    return NextResponse.json({ error: "picnic_not_linked" }, { status: 409 });
  }

  let body: { ingredient?: string; query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ingredient = body.ingredient?.trim();
  const manualQuery = body.query?.trim();
  if (!ingredient && !manualQuery) {
    return NextResponse.json({ error: "Missing ingredient" }, { status: 400 });
  }

  try {
    let searchTerm: string;
    let translated: string;
    if (manualQuery) {
      // User-supplied search term: use it verbatim, skip normalize/translate.
      searchTerm = manualQuery;
      translated = manualQuery;
    } else {
      const key = normalizeIngredient(ingredient!);
      translated = await translateToDutch(key);
      searchTerm = translated;
    }

    const authKey = decrypt(user.picnicAuthKey);
    const products = await searchProducts(authKey, searchTerm);
    // ingredientKey always derives from the original line so the saved mapping
    // stays consistent regardless of how the search was phrased.
    const ingredientKey = ingredient ? normalizeIngredient(ingredient) : translated;
    return NextResponse.json({ ingredientKey, translated, products });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
