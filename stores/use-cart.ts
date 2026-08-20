"use client";

import { create } from "zustand";

import { getCart } from "@/lib/api/requests";
import { logger } from "@/lib/logger";
import type { CartDisplayRow } from "@/lib/types/cart";

/**
 * The cart store (architecture.md §5). Holds the header badge count and the
 * cart page's line state, hydrated from `GET /api/storefront/cart` — the
 * only cart read the backend serves. Convenience state only (task.md §3.1):
 * nothing here is ever treated as an authoritative total; checkout
 * re-derives everything server-side.
 *
 * `hydrate()` no-ops when the session is not authenticated; the cart badge
 * triggers it once the session store reports `authenticated`. Mutations
 * elsewhere call `invalidate()` so the next consumer refetches.
 */

type CartStatus = "idle" | "loading" | "success" | "error";

type CartState = {
  status: CartStatus;
  rows: CartDisplayRow[];
  count: number;
  error: unknown;
  hydrate: () => Promise<void>;
  invalidate: () => void;
};

export const useCartStore = create<CartState>()((set, get) => ({
  status: "idle",
  rows: [],
  count: 0,
  error: null,

  hydrate: async () => {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      const cart = await getCart();
      set({ status: "success", rows: cart.data, count: cart.data.length, error: null });
    } catch (err) {
      logger.warn("cart hydrate failed", { error: String(err) });
      set({ status: "error", rows: [], count: 0, error: err });
    }
  },

  invalidate: () => {
    set({ status: "idle", error: null });
  },
}));