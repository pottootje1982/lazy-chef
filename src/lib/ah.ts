// Albert Heijn (ah.nl) unofficial mobile-API client.
//
// - Product SEARCH works with an anonymous token (no login).
// - ORDERING needs a member token obtained via AH's OAuth code flow: the user
//   logs in at login.ah.nl and we exchange the returned `code` for an
//   access+refresh token. AH has no username/password grant. We persist the
//   refresh token (encrypted) and mint short-lived access tokens on demand.
import type { PicnicProduct } from "@/lib/picnic";

const API = "https://api.ah.nl";
const CLIENT_ID = "appie";

// AH's app login redirect — used to build the authorize URL the user opens.
export const AH_AUTH_URL =
  `https://login.ah.nl/secure/oauth/authorize?client_id=${CLIENT_ID}` +
  `&redirect_uri=appie://login-exit&response_type=code`;

// Authorize URL carrying a signed `state` (round-trips on the final redirect) so
// the /api/ah/callback handler knows which user is connecting.
export function ahAuthUrl(state?: string): string {
  return state ? `${AH_AUTH_URL}&state=${encodeURIComponent(state)}` : AH_AUTH_URL;
}

function headers(token?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": "Appie/8.22.3",
    "X-Application": "AHWEBSHOP",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number };

// ---- Anonymous token (for search), cached until shortly before expiry ----
let anon: { token: string; expiresAt: number } | null = null;

async function anonToken(): Promise<string> {
  if (anon && Date.now() < anon.expiresAt) return anon.token;
  const res = await fetch(`${API}/mobile-auth/v1/auth/token/anonymous`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ clientId: CLIENT_ID }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`AH anonymous auth failed (HTTP ${res.status}).`);
  const data = (await res.json()) as TokenResponse;
  anon = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

// Pick a reasonably-sized product image from AH's `images` array.
function pickImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const sized = images.filter(
    (i): i is { url: string; width?: number } => !!i && typeof i.url === "string",
  );
  if (sized.length === 0) return null;
  const medium = sized.find((i) => (i.width ?? 0) >= 200);
  return (medium ?? sized[sized.length - 1]).url;
}

// ---- Search (anonymous) ----
export async function ahSearch(query: string, limit = 30): Promise<PicnicProduct[]> {
  const token = await anonToken();
  const res = await fetch(
    `${API}/mobile-services/product/search/v2?query=${encodeURIComponent(query)}&size=${limit}`,
    { headers: headers(token), signal: AbortSignal.timeout(15000) },
  );
  if (!res.ok) throw new Error(`AH search failed (HTTP ${res.status}).`);
  const data = await res.json();
  const products = Array.isArray(data?.products) ? data.products : [];
  return products
    .filter((p: { webshopId?: number; title?: string }) => p?.webshopId && p?.title)
    .slice(0, limit)
    .map((p: Record<string, unknown>): PicnicProduct => {
      const price =
        (typeof p.currentPrice === "number" && p.currentPrice) ||
        (typeof p.priceBeforeBonus === "number" && p.priceBeforeBonus) ||
        null;
      const imageUrl = pickImage(p.images);
      return {
        picnicId: String(p.webshopId),
        name: String(p.title),
        // We don't have a Picnic-style id; store the resolved URL as the
        // "imageId" so the grocer-aware resolver can pass it through.
        imageId: imageUrl,
        priceCents: price != null ? Math.round(price * 100) : null,
        unitQuantity: typeof p.salesUnitSize === "string" ? p.salesUnitSize : null,
        imageUrl,
      };
    });
}

// ---- Member auth (OAuth code flow) ----
// Accepts either a bare code or the full `appie://login-exit?code=…` redirect URL.
export function extractAuthCode(input: string): string | null {
  const s = input.trim();
  const m = s.match(/[?&]code=([^&\s]+)/);
  if (m) return decodeURIComponent(m[1]);
  // A bare code has no scheme/spaces.
  if (s && !/\s/.test(s) && !s.includes("://")) return s;
  return null;
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${API}/mobile-auth/v1/auth/token`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ clientId: CLIENT_ID, code }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`AH code exchange failed (HTTP ${res.status}).`);
  const data = (await res.json()) as TokenResponse;
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export async function refreshTokens(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${API}/mobile-auth/v1/auth/token/refresh`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ clientId: CLIENT_ID, refreshToken }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`AH token refresh failed (HTTP ${res.status}).`);
  const data = (await res.json()) as TokenResponse;
  // AH may rotate the refresh token; return whatever it gives back.
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? refreshToken };
}

// ---- Add to basket (member) ----
// AH's basket is updated via a GraphQL mutation (`basketItemsUpdate`), the same
// one ah.nl uses; we send it to api.ah.nl/graphql with the member Bearer token.
// `id` is the product's webshopId (what our `picnicId` holds). Returns the
// (possibly rotated) refresh token so the caller can re-persist it.
const BASKET_MUTATION =
  "mutation basketItemsUpdate($items: [BasketMutation!]!) {\n" +
  "  basketItemsUpdate(items: $items) {\n" +
  "    result { products { id quantity __typename } __typename }\n" +
  "    __typename\n" +
  "  }\n}";

export async function ahAddToCart(
  refreshToken: string,
  items: { picnicId: string; quantity: number }[],
): Promise<{ refreshToken: string }> {
  const { accessToken, refreshToken: rotated } = await refreshTokens(refreshToken);
  if (items.length === 0) return { refreshToken: rotated };

  const res = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operationName: "basketItemsUpdate",
      query: BASKET_MUTATION,
      variables: {
        items: items.map((i) => ({ id: Number(i.picnicId), quantity: i.quantity, description: null })),
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.errors) {
    const msg = data?.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`AH add-to-basket failed: ${msg}`);
  }
  return { refreshToken: rotated };
}
