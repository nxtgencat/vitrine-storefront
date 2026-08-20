"use client";

import { useCallback, useState } from "react";

import { messageFor } from "@/lib/api/errors";
import { upsertCartItem } from "@/lib/api/requests";
import { logger } from "@/lib/logger";
import { useCartStore } from "@/stores/use-cart";
import { useLiveStore } from "@/stores/use-live";
import { requireCustomer } from "@/stores/use-session";

/**
 * Add-to-cart for browse surfaces (architecture.md §13): session-gated (an
 * anonymous click lands on /login?next=…), one idempotent PUT of qty 1, then
 * invalidates the live cart query and the header badge store so the next
 * read is fresh. Returns an inline message for the caller to render
 * (null = ok).
 */
export function useAddToCart() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addToCart = useCallback(
    async (variantId: string) => {
      if (busy) return;
      if (!(await requireCustomer())) return;
      setBusy(true);
      setError(null);
      try {
        await upsertCartItem({ variantId, quantity: 1 });
        useLiveStore.getState().invalidate("cart");
        useCartStore.getState().invalidate();
      } catch (err) {
        logger.warn("add to cart failed", { error: String(err) });
        setError(messageFor(err, "Couldn't add this item to your cart."));
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  return { addToCart, busy, error };
}