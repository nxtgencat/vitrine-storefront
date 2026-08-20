import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Status pill for customer-facing order and invoice states (architecture.md
 * §9). Customer copy: `pending` is a payment the store is still waiting on.
 */

const TONE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  confirmed: "default",
  cancelled: "destructive",
  draft: "outline",
  issued: "default",
  void: "destructive",
};

const LABELS: Record<string, string> = {
  pending: "Payment pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  draft: "Draft",
  issued: "Issued",
  void: "Void",
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={TONE[status] ?? "secondary"} className={cn("font-medium", className)}>
      {LABELS[status] ?? status}
    </Badge>
  );
}