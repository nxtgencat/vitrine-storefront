"use client";

import { useState } from "react";

import { WishlistToggle } from "@/components/product/wishlist-toggle";
import { VariantPicker } from "@/components/product/variant-picker";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import { getStorefrontProduct } from "@/lib/api/requests";
import { useQuery } from "@/stores/use-live";
import { ShoppingBag } from "lucide-react";

/**
 * Product detail (architecture.md §13, api.md §2): the backend returns the
 * raw product + visible variants (no `isInStock`, no media — api.md §6), so
 * the page renders variant chips without stock badges and add-to-cart is
 * always offered; stock is decided at checkout. The base variant is
 * pre-selected (the backend orders variants base-first). Wishlist toggle
 * follows the selected variant.
 */
export function ProductDetailPage({ slug }: { slug: string }) {
  const { data, status, error, refetch } = useQuery(`product:${slug}`, () => getStorefrontProduct(slug));
  const { addToCart, busy, error: addError } = useAddToCart();

  const variants = data?.variants ?? [];
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selectedId = chosenId ?? variants[0]?.id ?? null;
  const selected = variants.find((variant) => variant.id === selectedId) ?? null;

  if (status === "loading" && data === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (status === "error" || data === undefined) {
    return (
      <div className="flex flex-col items-start gap-4">
        <ErrorState error={error} fallback="This product isn't available." />
        <Button variant="outline" size="sm" onClick={refetch}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
        {data.hsnCode !== "" && (
          <p className="mt-1 text-sm text-muted-foreground">HSN {data.hsnCode}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choose a variant</CardTitle>
        </CardHeader>
        <CardContent>
          <VariantPicker variants={variants} selectedId={selected?.id ?? variants[0].id} onSelect={setChosenId} />
        </CardContent>
      </Card>

      {selected !== null && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{selected.name}</p>
              {selected.sku !== null && <p className="text-xs text-muted-foreground">SKU {selected.sku}</p>}
            </div>
            <div className="flex items-center gap-1">
              <WishlistToggle variantId={selected.id} showError />
              <Button
                size="default"
                disabled={busy}
                onClick={() => void addToCart(selected.id)}
              >
                <ShoppingBag />
                {busy ? "Adding…" : "Add to cart"}
              </Button>
            </div>
          </div>
          {addError !== null && <p className="text-destructive text-sm">{addError}</p>}
        </div>
      )}
    </div>
  );
}