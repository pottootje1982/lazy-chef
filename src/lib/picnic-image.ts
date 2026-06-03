// Client-safe Picnic product image URLs (no picnic-api import, so this can be
// used from client components). Images are public/static — no auth needed.
const IMAGE_HOST = "https://storefront-prod.nl.picnicinternational.com";

export function productImageUrl(
  imageId: string | null | undefined,
  size: "tiny" | "small" | "medium" | "large" = "medium",
): string | null {
  if (!imageId) return null;
  return `${IMAGE_HOST}/static/images/${imageId}/${size}.png`;
}
