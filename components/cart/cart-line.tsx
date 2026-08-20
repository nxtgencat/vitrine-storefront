"use client";

import Link from "next/link";

import { QtyStepper } from "@/components/shared/qty-stepper";
import { PriceText } from "@/components/shared/price-text";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { CartDisplayRow } from "@/lib/types/cart";

/**
 * One cart row (architecture.md §5, api.md §3). Renders the backend's
 * server-recomputed row verbatim — `unitPricePaise` and `lineTotalPaise`
 * are what the API returned; the storefront never re-sums client-side.
 * Qty/remove mutations go through the page, which owns the idempotent API
 * call and the refetch.
 */
export function CartLine({
  row,
  busy,
  error,
  onQuantityChange,
  onRemove,
}: {
  row: CartDisplayRow;
  busy: boolean;
  error: string | null;
  onQuantityChange: (next: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/product/${row.productSlug}`}
          className="truncate font-medium underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
        {row.sku !== null && <p className="truncate text-xs text-muted-foreground">SKU {row.sku}</p>}
        <p className="mt-1 text-sm text-muted-foreground">
          <PriceText paise={row.unitPricePaise} /> each
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <QtyStepper value={row.quantity} disabled={busy} onChange={onQuantityChange} />
        {error !== null && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="w-24 text-right">
        <PriceText paise={row.lineTotalPaise} className="font-semibold" />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${row.name} from cart`}
        disabled={busy}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </li>
  );
}