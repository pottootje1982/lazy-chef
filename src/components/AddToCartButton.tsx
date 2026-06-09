"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { addToDraftCart } from "@/lib/order-actions";
import type { CartItem } from "@/lib/orders";

function BasketIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

// Adds product(s) to the in-app draft cart (the "basket" opened from the top
// menu). Shows a brief ✓ confirmation; refreshes so the nav badge updates.
export default function AddToCartButton({
  items,
  label,
  variant = "icon",
  className = "",
  sizeClass = "h-6 w-6",
}: {
  items: CartItem[];
  label?: string; // overrides the default aria/tooltip + visible text (text variant)
  variant?: "icon" | "labeled";
  className?: string;
  sizeClass?: string; // icon-variant button size (default matches the grocery rows)
}) {
  const t = useTranslations("cart");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function add() {
    if (pending || items.length === 0) return;
    startTransition(async () => {
      await addToDraftCart(items);
      setDone(true);
      router.refresh();
      setTimeout(() => setDone(false), 1500);
    });
  }

  const aria = label ?? t("added");

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={add}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60 ${className}`}
      >
        {done ? <span>✓</span> : <BasketIcon />}
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={pending}
      aria-label={aria}
      title={aria}
      className={`flex ${sizeClass} flex-none items-center justify-center rounded border border-stone-200 text-stone-600 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 ${className}`}
    >
      {done ? <span className="text-brand-600">✓</span> : <BasketIcon />}
    </button>
  );
}
