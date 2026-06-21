import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asGrocer, productDetail } from "@/lib/grocer";

// Lazy-loaded on hover, so allow a little headroom (the PDP parse can be slow).
export const maxDuration = 30;

const EMPTY = { description: null, brand: null, unitPrice: null, highlights: [] };

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Always 200 with a (possibly empty) detail; the hover card degrades gracefully.
  const detail = await productDetail(asGrocer(user.grocer), user, id);
  return NextResponse.json(detail ?? EMPTY);
}
