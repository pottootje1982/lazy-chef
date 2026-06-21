import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeIngredient } from "@/lib/translate";
import { asGrocer } from "@/lib/grocer";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.isGuest) {
    return NextResponse.json({ error: "Guest account is read-only." }, { status: 403 });
  }

  let body: {
    rawIngredient?: string;
    translated?: string;
    product?: {
      picnicId?: string;
      name?: string;
      imageId?: string | null;
      priceCents?: number | null;
      unitQuantity?: string | null;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = body.rawIngredient?.trim();
  const product = body.product;
  if (!raw || !product?.picnicId || !product.name) {
    return NextResponse.json({ error: "Missing ingredient or product" }, { status: 400 });
  }

  const ingredientKey = normalizeIngredient(raw);
  // Mappings are stored per active grocer, so switching grocers keeps both sets.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { grocer: true },
  });
  const grocer = asGrocer(dbUser?.grocer);

  const mapping = await prisma.productMapping.upsert({
    where: {
      userId_ingredientKey_grocer: { userId: session.user.id, ingredientKey, grocer },
    },
    create: {
      userId: session.user.id,
      ingredientKey,
      grocer,
      rawIngredient: raw,
      translated: body.translated?.trim() || ingredientKey,
      picnicId: product.picnicId,
      productName: product.name,
      imageId: product.imageId ?? null,
      priceCents: product.priceCents ?? null,
      unitQuantity: product.unitQuantity ?? null,
    },
    update: {
      rawIngredient: raw,
      translated: body.translated?.trim() || ingredientKey,
      picnicId: product.picnicId,
      productName: product.name,
      imageId: product.imageId ?? null,
      priceCents: product.priceCents ?? null,
      unitQuantity: product.unitQuantity ?? null,
    },
  });

  return NextResponse.json({ mapping });
}
