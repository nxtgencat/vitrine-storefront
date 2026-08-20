"use client";

import Link from "next/link";

import { WishlistToggle } from "@/components/product/wishlist-toggle";
import { PriceText } from "@/components/shared/price-text";
import { StockBadge } from "@/components/shared/stock-badge";
import { Button } from "@/components/ui/button";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import type { StorefrontProductWithVariants } from "@/lib/types/product";
import { Plus } from "lucide-react";

/**
 * One catalog card (architecture.md §13, api.md §2). The backend's listing
 * rows carry `isInStock` per visible variant — the ONLY stock field — so the
 * add button is disabled exactly for out-of-stock variants. Wishlist is
 * variant-keyed, so the toggle lives per variant row, next to the price.
 * Every price rendered is a price just returned by the API.
 */
export function ProductCard({ product }: { product: StorefrontProductWithVariants }) {
  const { addToCart, busy, error } = useAddToCart();

  return (
    <li className="flex flex-col rounded-xl border bg-card p-4">
      <Link
        href={`/product/${product.slug}`}
        className="font-heading text-base leading-snug font-medium underline-offset-4 hover:underline"
      >
        {product.name}
      </Link>
      <ul className="mt-3 flex flex-col gap-2">
        {product.variants.map((variant) => (
          <li
            key={variant.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{variant.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <StockBadge inStock={variant.isInStock} />
                <PriceText
                  paise={variant.sellingPricePaise}
                  compareAt={variant.mrpPaise}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <WishlistToggle variantId={variant.id} />
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Add ${variant.name} to cart`}
                disabled={busy || !variant.isInStock}
                onClick={() => void addToCart(variant.id)}
              >
                <Plus />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error !== null && <p className="mt-2 text-destructive text-sm">{error}</p>}
    </li>
  );
}