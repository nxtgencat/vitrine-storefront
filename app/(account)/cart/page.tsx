"use client";

import Link from "next/link";
import { useState } from "react";

import { CartLine } from "@/components/cart/cart-line";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { isApiError, messageFor } from "@/lib/api/errors";
import { getCart, removeCartItem, upsertCartItem } from "@/lib/api/requests";
import { logger } from "@/lib/logger";
import { useCartStore } from "@/stores/use-cart";
import { useLiveStore, useQuery } from "@/stores/use-live";
import { ShoppingBag } from "lucide-react";

/**
 * /cart (architecture.md §13, api.md §3). The backend re-reads the cart and
 * re-prices every line; this page renders those rows verbatim. Mutations are
 * idempotent and serialized — one in-flight mutation at a time, so the
 * shared single Idempotency-Key never spans two logical attempts
 * (lib/api/idempotency.ts). Every mutation invalidates the cart query and
 * the header badge so the next read is fresh.
 */

export default function CartPage() {
  const invalidateLive = useLiveStore((state) => state.invalidate);
  const invalidateCartStore = useCartStore((state) => state.invalidate);
  const { data, status, error, refetch } = useQuery("cart", getCart);

  const rows = data?.data ?? [];
  const [busy, setBusy] = useState(false);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  async function runMutation(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setLineErrors({});
    try {
      await fn();
      invalidateLive("cart");
      invalidateCartStore();
    } catch (err) {
      logger.warn("cart mutation failed", { error: String(err) });
      const message = isApiError(err) && err.status === 404
        ? "This item is no longer available."
        : messageFor(err, "Couldn't update your cart.");
      setLineErrors((previous) => {
        const next = { ...previous };
        for (const row of rows) next[row.variantId] = message;
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function onQuantityChange(variantId: string, nextQuantity: number) {
    void runMutation(() => upsertCartItem({ variantId, quantity: nextQuantity }));
  }

  function onRemove(variantId: string) {
    void runMutation(() => removeCartItem(variantId));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>

      {status === "loading" && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-start gap-4">
          <ErrorState error={error} fallback="Couldn't load your cart." />
          <Button variant="outline" size="sm" onClick={refetch}>
            Try again
          </Button>
        </div>
      )}

      {status === "success" && rows.length === 0 && (
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Browse the catalog to find something to add."
        />
      )}

      {status === "success" && rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{rows.length} item{rows.length === 1 ? "" : "s"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <CartLine
                  key={row.id}
                  row={row}
                  busy={busy}
                  error={lineErrors[row.variantId] ?? null}
                  onQuantityChange={(next) => onQuantityChange(row.variantId, next)}
                  onRemove={() => onRemove(row.variantId)}
                />
              ))}
            </ul>
            <div className="mt-6 flex justify-end">
              <Button size="lg" nativeButton={false} render={<Link href="/checkout" />}>
                Proceed to checkout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}