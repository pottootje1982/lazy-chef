// Grocer abstraction: dispatches search / cart / product-detail / image-url to
// the active grocer (Picnic or Albert Heijn). Keeps routes + UI grocer-agnostic.
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import {
  searchProducts as picnicSearch,
  getProductDetail as picnicDetail,
  addToCart as picnicAddToCart,
  productImageUrl as picnicImageUrl,
  type PicnicProduct,
  type ProductDetail,
} from "@/lib/picnic";
import { ahSearch, ahAddToCart } from "@/lib/ah";
import { jumboSearch } from "@/lib/jumbo";

export type Grocer = "picnic" | "ah" | "jumbo";
export const GROCERS: Grocer[] = ["picnic", "ah", "jumbo"];
export type GrocerProduct = PicnicProduct;

export function asGrocer(value: string | null | undefined): Grocer {
  return value === "ah" ? "ah" : value === "jumbo" ? "jumbo" : "picnic";
}

// Minimal slice of the User row the dispatcher needs.
type GrocerUser = {
  id: string;
  grocer: string;
  picnicAuthKey: string | null;
  ahAuthKey: string | null;
};

// Thrown when the active grocer requires a linked account but none is present.
export class GrocerNotLinkedError extends Error {
  constructor(public grocer: Grocer) {
    super(`${grocer} account not linked`);
  }
}

export function isLinked(grocer: Grocer, user: GrocerUser): boolean {
  // Jumbo search needs no server credential, and ordering happens browser-side
  // (the extension uses the user's jumbo.com session), so it's always "linked".
  if (grocer === "jumbo") return true;
  return grocer === "ah" ? Boolean(user.ahAuthKey) : Boolean(user.picnicAuthKey);
}

// Search the active grocer. AH search is anonymous; Picnic needs a linked key.
export async function search(
  grocer: Grocer,
  user: GrocerUser,
  query: string,
): Promise<GrocerProduct[]> {
  if (grocer === "ah") return ahSearch(query);
  if (grocer === "jumbo") return jumboSearch(query);
  if (!user.picnicAuthKey) throw new GrocerNotLinkedError("picnic");
  return picnicSearch(decrypt(user.picnicAuthKey), query);
}

export async function productDetail(
  grocer: Grocer,
  user: GrocerUser,
  productId: string,
): Promise<ProductDetail | null> {
  if (grocer === "ah" || grocer === "jumbo") return null; // no product-detail endpoint wired
  if (!user.picnicAuthKey) return null;
  return picnicDetail(decrypt(user.picnicAuthKey), productId);
}

// Resolve a stored image reference to a URL. AH stores a full URL; Picnic stores
// an image id (CDN url built on the fly).
export function imageUrl(grocer: Grocer, imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  if (grocer === "ah" || grocer === "jumbo" || imageRef.startsWith("http")) return imageRef;
  return picnicImageUrl(imageRef);
}

// Add products to the active grocer's basket. For AH this refreshes the token
// (which may rotate), so we re-persist the refresh token afterwards.
export async function addToCart(
  grocer: Grocer,
  user: GrocerUser,
  items: { picnicId: string; quantity: number }[],
): Promise<void> {
  if (items.length === 0) return;
  if (grocer === "jumbo") {
    // Jumbo ordering is browser-side (extension fires AddBasketItems in the
    // user's logged-in jumbo.com session); there is no server-side basket call.
    throw new Error("Jumbo ordering happens in the browser, not server-side.");
  }
  if (grocer === "ah") {
    if (!user.ahAuthKey) throw new GrocerNotLinkedError("ah");
    const { refreshToken } = await ahAddToCart(decrypt(user.ahAuthKey), items);
    await prisma.user.update({ where: { id: user.id }, data: { ahAuthKey: encrypt(refreshToken) } });
    return;
  }
  if (!user.picnicAuthKey) throw new GrocerNotLinkedError("picnic");
  await picnicAddToCart(decrypt(user.picnicAuthKey), items);
}
