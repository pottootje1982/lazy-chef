import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { listIndex } from "@/lib/paprika";

// Fetching every recipe's details from Paprika can take a while.
export const maxDuration = 60;

const normUrl = (u: string | null) =>
  (u || "")
    .toLowerCase()
    .split("#")[0]
    .split("?")[0]
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/print\/\d+\/?$/, "/")
    .replace(/\/$/, "");

export async function GET() {
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

  // Existing recipes — for dedup by uid OR source URL OR title.
  const existing = await prisma.recipe.findMany({
    where: { userId: session.user.id },
    select: { paprikaUid: true, sourceUrl: true, title: true },
  });
  const haveUid = new Set(existing.map((r) => r.paprikaUid).filter(Boolean) as string[]);
  const haveUrl = new Set(existing.map((r) => normUrl(r.sourceUrl)).filter(Boolean));
  const haveTitle = new Set(existing.map((r) => r.title.trim().toLowerCase()));

  let index;
  try {
    index = await listIndex(user.paprikaEmail, decrypt(user.paprikaPassword));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load Paprika recipes.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const items = index
    .map((r) => ({
      uid: r.uid,
      name: r.name,
      sourceUrl: r.sourceUrl,
      alreadyImported:
        haveUid.has(r.uid) ||
        (Boolean(r.sourceUrl) && haveUrl.has(normUrl(r.sourceUrl))) ||
        haveTitle.has(r.name.trim().toLowerCase()),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    items,
    total: items.length,
    importedCount: items.filter((i) => i.alreadyImported).length,
    newCount: items.filter((i) => !i.alreadyImported).length,
  });
}
