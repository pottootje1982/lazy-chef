import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { fetchForImport } from "@/lib/paprika";
import { classify } from "@/lib/categories";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.isGuest) {
    return NextResponse.json({ error: "Guest account is read-only." }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { paprikaEmail: true, paprikaPassword: true },
  });
  if (!user?.paprikaEmail || !user.paprikaPassword) {
    return NextResponse.json({ error: "paprika_not_connected" }, { status: 409 });
  }

  let body: { uids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const uids = (body.uids ?? []).filter((u) => typeof u === "string" && u);
  if (uids.length === 0) {
    return NextResponse.json({ error: "No recipes selected" }, { status: 400 });
  }

  // Skip uids already imported (defensive re-check against the uid).
  const existing = await prisma.recipe.findMany({
    where: { userId: session.user.id, paprikaUid: { in: uids } },
    select: { paprikaUid: true },
  });
  const have = new Set(existing.map((r) => r.paprikaUid));
  const todo = uids.filter((u) => !have.has(u));

  let imported = 0;
  try {
    const fetched = await fetchForImport(user.paprikaEmail, decrypt(user.paprikaPassword), todo);
    for (const { uid, mapped } of fetched) {
      if ((mapped.ingredients.length === 0 && mapped.instructions.length === 0) || !mapped.title) {
        continue;
      }
      await prisma.recipe.create({
        data: {
          userId: session.user.id,
          paprikaUid: uid,
          title: mapped.title,
          description: mapped.description,
          imageUrl: mapped.imageUrl,
          sourceUrl: mapped.sourceUrl,
          servings: mapped.servings,
          prepTime: mapped.prepTime,
          cookTime: mapped.cookTime,
          ingredients: mapped.ingredients,
          instructions: mapped.instructions,
          tags: mapped.tags,
          categories: classify(mapped.title, mapped.ingredients),
          origin: "paprika",
        },
      });
      imported++;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ error: message, imported }, { status: 502 });
  }

  return NextResponse.json({ imported, skipped: uids.length - imported });
}
