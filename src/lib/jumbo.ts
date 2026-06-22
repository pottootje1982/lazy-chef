// Jumbo (jumbo.nl) client — product search via the public web GraphQL API.
//
// Jumbo's storefront runs a GraphQL endpoint at www.jumbo.com/api/graphql. The
// "No client headers set" gate is satisfied by static Apollo client headers (no
// token): product SEARCH works server-side with no authentication at all.
//
// ORDERING is intentionally NOT here. Jumbo authenticates ordering with an
// httpOnly session cookie obtained via a full-page OIDC login behind Akamai —
// there is no storable bearer/refresh token like Albert Heijn. So add-to-basket
// can only run browser-side, in the user's logged-in jumbo.com session (handled
// by the AH/Jumbo Connect extension). The basket mutation lives in the extension.
import type { PicnicProduct } from "@/lib/picnic";

const API = "https://www.jumbo.com/api/graphql";

// Static client headers the storefront sends; no secret/token involved.
function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "apollographql-client-name": "JUMBO_WEB-search",
    "apollographql-client-version": "master-v33.9.0-web",
    "x-source": "JUMBO_WEB-search",
    "User-Agent": "Mozilla/5.0",
  };
}

// Minimal slice of the storefront's SearchProducts query — just the fields we map.
const SEARCH_QUERY =
  "query SearchProducts($input: ProductSearchInput!) {\n" +
  "  searchProducts(input: $input) {\n" +
  "    count\n" +
  "    products {\n" +
  "      id\n" +
  "      sku\n" +
  "      title\n" +
  "      subtitle\n" +
  "      image\n" +
  "      price { price pricePerUnit { price unit } promoPrice }\n" +
  "    }\n" +
  "  }\n}";

type JumboPrice = {
  price?: number | null;
  promoPrice?: number | null;
};
type JumboProduct = {
  id?: string;
  sku?: string;
  title?: string;
  subtitle?: string | null;
  image?: string | null;
  price?: JumboPrice | null;
};

// Search Jumbo. Anonymous — no linked account needed. Maps to PicnicProduct so
// the rest of the app stays grocer-agnostic. `picnicId` holds the Jumbo SKU.
export async function jumboSearch(query: string, limit = 30): Promise<PicnicProduct[]> {
  const res = await fetch(API, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      operationName: "SearchProducts",
      query: SEARCH_QUERY,
      variables: {
        input: {
          searchType: "keyword",
          searchTerms: query,
          friendlyUrl: "",
          offSet: 0,
          currentUrl: "",
          previousUrl: "",
          bloomreachCookieId: "",
        },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Jumbo search failed (HTTP ${res.status}).`);
  const data = await res.json().catch(() => null);
  if (data?.errors) throw new Error(`Jumbo search failed: ${data.errors[0]?.message ?? "GraphQL error"}`);

  const products: JumboProduct[] = data?.data?.searchProducts?.products ?? [];
  return products
    .filter((p) => (p.sku || p.id) && p.title)
    .slice(0, limit)
    .map((p): PicnicProduct => {
      const promo = p.price?.promoPrice;
      const cents = (typeof promo === "number" ? promo : null) ?? p.price?.price ?? null;
      const image = typeof p.image === "string" ? p.image : null;
      return {
        // SKU is the basket identifier (AddBasketItems uses `sku`); fall back to id.
        picnicId: String(p.sku || p.id),
        name: String(p.title),
        imageId: image, // already a full URL; grocer.imageUrl passes it through
        priceCents: typeof cents === "number" ? cents : null,
        unitQuantity: typeof p.subtitle === "string" ? p.subtitle : null,
        imageUrl: image,
      };
    });
}
