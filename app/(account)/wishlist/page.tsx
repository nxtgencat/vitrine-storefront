"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import { messageFor } from "@/lib/api/errors";
import { getWishlist, removeWishlistItem } from "@/lib/api/requests";
import { logger } from "@/lib/logger";
import { useLiveStore, useQuery } from "@/stores/use-live";
import { Heart, Trash2 } from "lucide-react";

/**
 * /wishlist (architecture.md §13, api.md §3). The rows are the backend's
 * WishlistDisplayRows (variant-keyed); each row offers add-to-cart and
 * remove. Mutations invalidate the shared `wishlist` query, so the browse
 * surfaces' hearts stay in sync with this page.
 */
export default function WishlistPage() {
  const invalidateLive = useLiveStore((state) => state.invalidate);
  const { data, status, error, refetch } = useQuery("wishlist", getWishlist);
  const { addToCart, busy: adding, error: addError } = useAddToCart();
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const rows = data?.data ?? [];

  async function onRemove(variantId: string) {
    if (removing) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeWishlistItem(variantId);
      invalidateLive("wishlist");
    } catch (err) {
      logger.warn("wishlist remove failed", { error: String(err) });
      setRemoveError(messageFor(err, "Couldn't remove this item."));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your wishlist</h1>

      {status === "loading" && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-start gap-4">
          <ErrorState error={error} fallback="Couldn't load your wishlist." />
          <Button variant="outline" size="sm" onClick={refetch}>
            Try again
          </Button>
        </div>
      )}

      {status === "success" && rows.length === 0 && (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here."
        />
      )}

      {status === "success" && rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{rows.length} saved item{rows.length === 1 ? "" : "s"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/product/${row.productSlug}`}
                      className="truncate font-medium underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.sku !== null && <p className="truncate text-xs text-muted-foreground">SKU {row.sku}</p>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={adding || removing}
                    onClick={() => void addToCart(row.variantId)}
                  >
                    Add to cart
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${row.name} from wishlist`}
                    disabled={removing}
                    onClick={() => void onRemove(row.variantId)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            {addError !== null && <p className="mt-3 text-destructive text-sm">{addError}</p>}
            {removeError !== null && <p className="mt-3 text-destructive text-sm">{removeError}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}