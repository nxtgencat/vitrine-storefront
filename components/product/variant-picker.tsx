"use client";

import { PriceText } from "@/components/shared/price-text";
import { cn } from "@/lib/utils";
import type { StorefrontVariantRow } from "@/lib/types/product";

/**
 * Variant selection on the product detail page (architecture.md §13). The
 * detail endpoint returns raw visible variants WITHOUT `isInStock` (backend
 * gap, api.md §6) — the picker is deliberately not stock-aware: every
 * variant is offered, and stock is enforced by the backend at checkout
 * (`409 insufficient_stock`). Selection state lives in the page; this
 * component only renders and reports.
 */
export function VariantPicker({
  variants,
  selectedId,
  onSelect,
}: {
  variants: StorefrontVariantRow[];
  selectedId: string;
  onSelect: (variantId: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Variants" className="flex flex-col gap-2">
      {variants.map((variant) => {
        const selected = variant.id === selectedId;
        return (
          <button
            key={variant.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(variant.id)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
              selected ? "border-primary bg-primary/5" : "hover:bg-accent",
            )}
          >
            <span className="text-sm font-medium">{variant.name}</span>
            <PriceText
              paise={variant.sellingPricePaise}
              compareAt={variant.mrpPaise}
              className="text-sm"
            />
          </button>
        );
      })}
    </div>
  );
}