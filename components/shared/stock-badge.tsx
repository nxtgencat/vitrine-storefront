import { Badge } from "@/components/ui/badge";

/**
 * Stock indicator for product cards and variant rows. Renders from the
 * backend's `inStock` flag only (task.md §3.1 — never computed client-side):
 * in-stock → subtle secondary badge, out-of-stock → destructive.
 */
export function StockBadge({ inStock }: { inStock: boolean }) {
  if (inStock) {
    return <Badge variant="secondary">In stock</Badge>;
  }
  return <Badge variant="destructive">Out of stock</Badge>;
}