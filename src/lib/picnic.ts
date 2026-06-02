import PicnicClient from "picnic-api";

// SellingUnit shape we care about (from picnic-api catalog.search()).
export type PicnicProduct = {
  picnicId: string;
  name: string;
  imageId: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
  imageUrl: string | null;
};

const IMAGE_HOST = "https://storefront-prod.nl.picnicinternational.com";

// Public static image URL (no auth needed) for a product image id.
export function productImageUrl(
  imageId: string | null | undefined,
  size: "tiny" | "small" | "medium" | "large" = "medium",
): string | null {
  if (!imageId) return null;
  return `${IMAGE_HOST}/static/images/${imageId}/${size}.png`;
}

export function createClient(authKey?: string) {
  return new PicnicClient({ countryCode: "NL", ...(authKey ? { authKey } : {}) });
}

// ---- Login + 2FA (stateless / serverless-safe) ----
// The 2FA flow spans two requests (login -> verify). Rather than holding the
// client in memory, we surface the interim auth key from the login step; the
// caller persists it (encrypted) and passes it back to verify2FA, which
// reconstructs the client. Picnic authenticates every call via the authKey
// header and deviceId/agent are fixed defaults, so reconstruction is sufficient.
export type LoginOutcome =
  | { status: "linked"; authKey: string }
  | { status: "2fa_required"; pendingKey: string }
  | { status: "error"; message: string };

export async function startLogin(email: string, password: string): Promise<LoginOutcome> {
  const client = createClient();
  try {
    const result = await client.auth.login(email, password);
    if (result?.second_factor_authentication_required) {
      if (!client.authKey) {
        return { status: "error", message: "Login did not return a session key." };
      }
      // Send the SMS code; the interim key identifies this login session.
      await client.auth.generate2FACode("SMS");
      return { status: "2fa_required", pendingKey: client.authKey };
    }
    if (client.authKey) return { status: "linked", authKey: client.authKey };
    return { status: "error", message: "Login did not return an auth key." };
  } catch {
    return { status: "error", message: "Invalid Picnic email or password." };
  }
}

export async function verify2FA(pendingKey: string, code: string): Promise<LoginOutcome> {
  const client = createClient(pendingKey);
  try {
    await client.auth.verify2FACode(code);
    if (client.authKey) return { status: "linked", authKey: client.authKey };
    return { status: "error", message: "Verification did not return an auth key." };
  } catch {
    return { status: "error", message: "Invalid or expired verification code." };
  }
}

// ---- Search ----
export async function searchProducts(
  authKey: string,
  query: string,
  limit = 8,
): Promise<PicnicProduct[]> {
  const client = createClient(authKey);
  const results = await client.catalog.search(query);
  const units = Array.isArray(results) ? results : [];

  // Picnic can return the same selling unit more than once (promos/variants).
  const seen = new Set<string>();

  return units
    .filter((u) => u && u.id && u.name)
    .filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)))
    .slice(0, limit)
    .map((u) => ({
      picnicId: u.id,
      name: u.name,
      imageId: u.image_id ?? null,
      priceCents: typeof u.display_price === "number" ? u.display_price : null,
      unitQuantity: u.unit_quantity ?? null,
      imageUrl: productImageUrl(u.image_id),
    }));
}

// ---- Cart ----
export async function addToCart(
  authKey: string,
  items: { picnicId: string; quantity: number }[],
): Promise<void> {
  if (items.length === 0) return;
  const client = createClient(authKey);
  await client.cart.addProductsToCart(
    items.map((i) => ({ productId: i.picnicId, quantity: i.quantity })),
  );
}
