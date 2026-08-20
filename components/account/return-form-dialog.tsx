"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { QtyStepper } from "@/components/shared/qty-stepper";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { messageFor } from "@/lib/api/errors";
import { createSalesReturn } from "@/lib/api/requests";
import { formatINR } from "@/lib/domain/money";
import { logger } from "@/lib/logger";
import type { CustomerOrderDetail } from "@/lib/types/order";

/**
 * Return request form (architecture.md §9, §13; api.md §4). Confirmed
 * orders only (the page gates it): line/qty pickers against the order's
 * items, each quantity clamped to the original, custom lines excluded
 * (the backend rejects them). Submits a draft sales return; staff
 * confirmation applies the real caps. The parent remounts this dialog
 * (key) each time it opens, so quantities always start fresh.
 */
export function ReturnFormDialog({
  open,
  onOpenChange,
  order,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CustomerOrderDetail;
  onSubmitted: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const returnable = order.items.filter((item) => item.isCustomItem === 0);

  function quantityOf(itemId: string): number {
    return quantities[itemId] ?? 0;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const items = returnable
      .map((item) => ({ originalItemId: item.id, quantity: quantityOf(item.id) }))
      .filter((entry) => entry.quantity > 0);
    if (items.length === 0) {
      setFormError("Choose at least one item to return.");
      return;
    }
    setBusy(true);
    try {
      await createSalesReturn({ orderId: order.id, items });
      setQuantities({});
      toast.success("Return requested — our team will review it.");
      onSubmitted();
      onOpenChange(false);
    } catch (err) {
      logger.warn("return request failed", { error: String(err) });
      setFormError(messageFor(err, "Couldn't submit this return request."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a return</DialogTitle>
          <DialogDescription>
            Pick the items and quantities to return. Our team reviews each request before confirming it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
          <ul className="flex flex-col gap-3">
            {returnable.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    You bought {item.quantity} × {formatINR(item.unitPricePaise)} each
                  </p>
                </div>
                <QtyStepper
                  value={quantityOf(item.id)}
                  min={0}
                  max={item.quantity}
                  disabled={busy}
                  onChange={(next) =>
                    setQuantities((previous) => ({ ...previous, [item.id]: next }))
                  }
                />
              </li>
            ))}
          </ul>
          {returnable.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing on this order can be returned.</p>
          )}
          {formError !== null && <p className="text-destructive text-sm">{formError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy || returnable.length === 0}>
              {busy ? "Submitting…" : "Submit return request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}