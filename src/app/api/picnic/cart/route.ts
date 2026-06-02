import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { addToCart } from "@/lib/picnic";

// Adding several products can take a moment; allow headroom where possible.
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.isGuest) {
    return NextResponse.json({ error: "Guest account is read-only." }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.picnicAuthKey) {
    return NextResponse.json({ error: "picnic_not_linked" }, { status: 409 });
  }

  let body: { items?: { picnicId?: string; quantity?: number }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate + clamp quantities.
  const items = (body.items ?? [])
    .filter((i) => typeof i.picnicId === "string" && i.picnicId)
    .map((i) => ({
      picnicId: i.picnicId as string,
      quantity: Math.max(1, Math.min(99, Math.floor(Number(i.quantity) || 1))),
    }));

  if (items.length === 0) {
    return NextResponse.json({ error: "No products to add" }, { status: 400 });
  }

  try {
    await addToCart(decrypt(user.picnicAuthKey), items);
    const total = items.reduce((sum, i) => sum + i.quantity, 0);
    return NextResponse.json({ ok: true, added: total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add to cart.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
