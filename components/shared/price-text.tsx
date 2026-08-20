import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/domain/money";

/**
 * The one price renderer for the storefront (architecture.md §8): integer
 * paise in, `₹`-formatted text out, tabular-nums, exact value on hover —
 * mirroring the dashboard's MoneyText. `compareAt` adds compare-at pricing
 * (original struck through) and renders only when the deal is real
 * (compareAt > price).
 */
export function PriceText({
  paise,
  compareAt,
  className,
}: {
  paise: number;
  compareAt?: number | null;
  className?: string;
}) {
  if (compareAt !== undefined && compareAt !== null && compareAt > paise) {
    return (
      <span className={cn("tabular-nums", className)} title={formatINR(paise)}>
        {formatINR(paise)}
        <span className="ml-1.5 text-muted-foreground line-through" title={formatINR(compareAt)}>
          {formatINR(compareAt)}
        </span>
      </span>
    );
  }
  return (
    <span className={cn("tabular-nums", className)} title={formatINR(paise)}>
      {formatINR(paise)}
    </span>
  );
}