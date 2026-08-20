"use client";

import { create } from "zustand";

/**
 * Checkout view-state (architecture.md §5): the address selected on
 * /addresses is remembered for /checkout (phase 4 reads it). Purely a
 * convenience — the checkout endpoint re-reads the address server-side and
 * this store holds no domain facts.
 */
type CheckoutState = {
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;
};

export const useCheckoutStore = create<CheckoutState>()((set) => ({
  selectedAddressId: null,
  setSelectedAddressId: (id) => set({ selectedAddressId: id }),
}));