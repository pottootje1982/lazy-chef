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

// ---- Login + 2FA state ----
// The 2FA flow spans two requests (login -> verify) and must reuse the same
// authenticated client. Keep pending clients in memory (single-instance app),
// surviving dev hot-reloads via globalThis.
type Pending = { client: ReturnType<typeof createClient>; expires: number };
const g = globalThis as unknown as { __picnicPending?: Map<string, Pending> };
const pending: Map<string, Pending> = (g.__picnicPending ??= new Map());
const TTL_MS = 10 * 60 * 1000;

function reap() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
}

export type LoginOutcome =
  | { status: "linked"; authKey: string }
  | { status: "2fa_required" }
  | { status: "error"; message: string };

export async function startLogin(
  userId: string,
  email: string,
  password: string,
): Promise<LoginOutcome> {
  reap();
  const client = createClient();
  try {
    const result = await client.auth.login(email, password);
    if (result?.second_factor_authentication_required) {
      // Trigger an SMS code and stash the client for the verify step.
      await client.auth.generate2FACode("SMS");
      pending.set(userId, { client, expires: Date.now() + TTL_MS });
      return { status: "2fa_required" };
    }
    if (client.authKey) return { status: "linked", authKey: client.authKey };
    return { status: "error", message: "Login did not return an auth key." };
  } catch {
    return { status: "error", message: "Invalid Picnic email or password." };
  }
}

export async function verify2FA(userId: string, code: string): Promise<LoginOutcome> {
  reap();
  const entry = pending.get(userId);
  if (!entry) {
    return { status: "error", message: "Your verification session expired. Start again." };
  }
  try {
    await entry.client.auth.verify2FACode(code);
    const authKey = entry.client.authKey;
    pending.delete(userId);
    if (authKey) return { status: "linked", authKey };
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
