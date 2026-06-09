"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clearDraftOrder } from "@/lib/order-actions";

// Empties the whole pending order (basket items + recipe/list selection), then
// returns to the recipes page (the order page has nothing left to show).
export default function ClearCartButton() {
  const t = useTranslations("order");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function clear() {
    if (pending) return;
    if (!confirm(t("clearCartConfirm"))) return;
    startTransition(async () => {
      await clearDraftOrder();
      router.push("/recipes");
      router.refresh();
    });
  }

  return (
    <button
      onClick={clear}
      disabled={pending}
      className="text-sm text-stone-400 hover:text-red-600 disabled:opacity-50"
    >
      {t("clearCart")}
    </button>
  );
}
