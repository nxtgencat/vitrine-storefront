"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CheckoutForm } from "@/components/account/checkout-form";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { isApiError, messageFor, reasonCodeOf } from "@/lib/api/errors";
import { checkout, getCart, listAddresses, listStorefrontProducts } from "@/lib/api/requests";
import { formatINR } from "@/lib/domain/money";
import { logger } from "@/lib/logger";
import { useLiveStore, useQuery } from "@/stores/use-live";
import { useCartStore } from "@/stores/use-cart";
import { ShoppingBag } from "lucide-react";

/**
 * /checkout (architecture.md §13, api.md §4). Refetches the cart, selects an
 * address + payment mode, and submits exactly `{ custAddressId, paymentMode }`
 * — no prices, no cart snapshot; the backend re-reads and re-prices
 * everything in-tx. The rows shown here are the cart query's server-computed
 * `lineTotalPaise` values, verbatim.
 *
 * On `409 insufficient_stock` the transaction rolled back and the cart
 * survives: refetch the cart and highlight the lines the catalog reports as
 * unavailable (the listing's `isInStock` is the only stock the storefront is
 * allowed to see). On 429 the message stands; there is no auto-retry.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const invalidate = useLiveStore((state) => state.invalidate);
  const cart = useQuery("cart", getCart);
  const addresses = useQuery("addresses", listAddresses);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfStock, setOutOfStock] = useState<Set<string>>(new Set());

  const cartRows = cart.data?.data ?? [];

  async function markOutOfStockLines() {
    try {
      const listing = await listStorefrontProducts({});
      const availability = new Map<string, boolean>();
      for (const product of listing.data) {
        for (const variant of product.variants) availability.set(variant.id, variant.isInStock);
      }
      const next = new Set<string>();
      for (const row of cartRows) {
        if (availability.get(row.variantId) !== true) next.add(row.variantId);
      }
      setOutOfStock(next);
    } catch {
      // The 409 message stands on its own; the highlight is best-effort.
    }
  }

  async function runCheckout(input: { custAddressId: string; paymentMode: "cod" | "gateway" }) {
    if (busy || cartRows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await checkout(input);
      // The backend consumed the cart in-tx; drop both client mirrors so the
      // badge and the next /cart visit refetch the (now empty) cart.
      invalidate("cart");
      useCartStore.getState().invalidate();
      router.push(`/checkout/result?order=${result.order.id}&mode=${input.paymentMode}`);
    } catch (err) {
      logger.warn("checkout failed", { error: String(err) });
      if (reasonCodeOf(err) === "insufficient_stock") {
        setError("Some items are no longer available — review your cart.");
        invalidate("cart");
        void markOutOfStockLines();
      } else if (isApiError(err) && err.status === 429) {
        setError("You've tried checkout too many times — wait a minute and try again.");
      } else {
        setError(messageFor(err, "Couldn't place this order."));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

      {cart.status === "loading" && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {cart.status === "error" && (
        <div className="flex flex-col items-start gap-4">
          <ErrorState error={cart.error} fallback="Couldn't load your cart." />
          <Button variant="outline" size="sm" onClick={cart.refetch}>
            Try again
          </Button>
        </div>
      )}

      {cart.status === "success" && cartRows.length === 0 && (
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Add something to your cart before checking out."
        />
      )}

      {cart.status === "success" && cartRows.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          <CheckoutForm
            addresses={addresses.data?.data ?? []}
            cartEmpty={cartRows.length === 0}
            busy={busy}
            error={error}
            onSubmit={(input) => void runCheckout(input)}
            onAddressesChanged={() => invalidate("addresses")}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order summary</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {cartRows.map((row) => {
                  const unavailable = outOfStock.has(row.variantId);
                  return (
                    <li key={row.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.quantity} × {formatINR(row.unitPricePaise)}
                        </p>
                        {unavailable && (
                          <p className="text-destructive text-xs">No longer available — remove or review</p>
                        )}
                      </div>
                      <p className="shrink-0 font-medium tabular-nums">{formatINR(row.lineTotalPaise)}</p>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                The final total is confirmed when your order is placed.
              </p>
              <div className="mt-4 border-t pt-4">
                <Link href="/cart" className="text-sm font-medium underline-offset-4 hover:underline">
                  Back to cart
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}