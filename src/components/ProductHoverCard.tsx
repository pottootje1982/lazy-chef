"use client";

import { useRef, useState } from "react";
import { productImageUrl } from "@/lib/picnic-image";

type Product = {
  picnicId: string;
  name: string;
  imageId: string | null;
  priceCents: number | null;
  unitQuantity: string | null;
};

type Detail = {
  description: string | null;
  brand: string | null;
  unitPrice: string | null;
  highlights: string[];
};

// Wraps a Picnic search-result row. On hover it shows a detailed preview card
// (large image, name, price, and a lazily-fetched description) via CSS
// group-hover. The card is pointer-events-none so it never blocks the row's
// Link/Select button.
export default function ProductHoverCard({
  product,
  className = "",
  children,
}: {
  product: Product;
  className?: string;
  children: React.ReactNode;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onEnter() {
    if (fetched.current) return;
    // Small delay so scrolling/passing over rows doesn't fire a fetch each time.
    timer.current = setTimeout(async () => {
      fetched.current = true;
      setLoading(true);
      try {
        const res = await fetch(`/api/picnic/product?id=${encodeURIComponent(product.picnicId)}`);
        if (res.ok) setDetail(await res.json());
      } catch {
        /* leave detail null — card still shows image/name/price */
      } finally {
        setLoading(false);
      }
    }, 250);
  }
  function onLeave() {
    if (timer.current) clearTimeout(timer.current);
  }

  // AH stores a full image URL in imageId; Picnic stores an id we build a URL from.
  const large = product.imageId?.startsWith("http")
    ? product.imageId
    : productImageUrl(product.imageId, "large");
  const meta = [
    product.unitQuantity,
    product.priceCents == null ? null : "€" + (product.priceCents / 100).toFixed(2).replace(".", ","),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`group relative ${className}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}

      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-64 rounded-lg border border-stone-200 bg-white p-3 text-left shadow-xl group-hover:block">
        {large ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={large} alt={product.name} className="h-44 w-full rounded bg-stone-50 object-contain" />
        ) : (
          <div className="flex h-44 w-full items-center justify-center rounded bg-stone-100 text-3xl">🛒</div>
        )}
        <p className="mt-2 text-sm font-medium leading-snug">{product.name}</p>
        {meta ? <p className="mt-0.5 text-xs text-stone-500">{meta}</p> : null}

        {detail?.highlights?.length ? (
          <ul className="mt-2 list-inside list-disc text-xs text-stone-600">
            {detail.highlights.slice(0, 3).map((h, i) => (
              <li key={i} className="truncate">{h}</li>
            ))}
          </ul>
        ) : null}

        {detail?.description ? (
          <p className="mt-2 line-clamp-5 whitespace-pre-line text-xs text-stone-600">
            {detail.description}
          </p>
        ) : loading ? (
          <p className="mt-2 text-xs text-stone-400">Loading details…</p>
        ) : null}
      </div>
    </div>
  );
}
