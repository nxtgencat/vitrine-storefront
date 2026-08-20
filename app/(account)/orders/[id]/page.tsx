"use client";

import Link from "next/link";
import { use, useState } from "react";

import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { OrderTimeline } from "@/components/account/order-timeline";
import { ReturnFormDialog } from "@/components/account/return-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useInvoiceTopic, useOrderStatusToast, useOrderTopic } from "@/hooks/use-realtime";
import { messageFor } from "@/lib/api/errors";
import { cancelMyOrder, getMyOrder } from "@/lib/api/requests";
import { formatDate } from "@/lib/domain/dates";
import { storefrontActionsFor } from "@/lib/domain/lifecycle";
import { formatINR } from "@/lib/domain/money";
import { logger } from "@/lib/logger";
import { useLiveStore, useQuery } from "@/stores/use-live";

/**
 * /orders/[id] (architecture.md §13; api.md §4). Order detail with the
 * backend's items/invoice totals verbatim, the event timeline, and the
 * status-gated actions from `storefrontActionsFor` (pending → cancel,
 * confirmed → request return). Live: the `order:{id}` topic keeps this
 * page current — a payment confirmation, an admin edit, a return
 * confirmation all land here as invalidations; the status toast announces
 * pending→confirmed/cancelled transitions (use-realtime.ts).
 */
export default function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const invalidate = useLiveStore((state) => state.invalidate);
  const order = useQuery(`order:${id}`, () => getMyOrder(id));

  useOrderTopic(id);
  useInvoiceTopic(order.data?.invoice?.id ?? null);
  useOrderStatusToast(order.data?.status);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnKey, setReturnKey] = useState(0);

  async function runCancel() {
    setCancelBusy(true);
    setCancelError(null);
    try {
      await cancelMyOrder(id);
      setCancelOpen(false);
      invalidate(`order:${id}`);
      invalidate("orders:");
    } catch (err) {
      logger.warn("order cancel failed", { error: String(err) });
      setCancelError(messageFor(err, "Couldn't cancel this order."));
    } finally {
      setCancelBusy(false);
    }
  }

  if (order.data === undefined) {
    if (order.status === "error") {
      return (
        <div className="flex flex-col items-start gap-4">
          <ErrorState error={order.error} fallback="Couldn't load this order." />
          <Button variant="outline" size="sm" onClick={order.refetch}>
            Try again
          </Button>
        </div>
      );
    }
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const row = order.data;
  const invoice = row.invoice;
  const actions = storefrontActionsFor(row.status);
  // The order row's `totalPaise` is 0 until the payment confirms; the draft
  // invoice carries the real backend-computed totals from the moment the
  // checkout tx landed — show that when it exists, verbatim.
  const displayTotal = invoice !== null ? invoice.totalPaise : row.totalPaise;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{row.orderNumber}</h1>
        <OrderStatusBadge status={row.status} />
        <p className="text-sm text-muted-foreground">Placed {formatDate(row.createdAt)}</p>
        <p className="ml-auto text-lg font-semibold tabular-nums">{formatINR(displayTotal)}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {row.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {formatINR(item.unitPricePaise)}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium tabular-nums">{formatINR(item.lineTotalPaise)}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {row.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <OrderTimeline events={row.events} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice === null ? (
                <p className="text-sm text-muted-foreground">
                  The invoice is issued once the payment is confirmed.
                </p>
              ) : (
                <dl className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Invoice</dt>
                    <dd className="font-medium">{invoice.invoiceNumber}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="tabular-nums">{formatINR(invoice.subtotalPaise)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tax</dt>
                    <dd className="tabular-nums">{formatINR(invoice.taxPaise)}</dd>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatINR(invoice.totalPaise)}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            {actions.includes("cancel") && (
              <>
                <Button variant="outline" onClick={() => setCancelOpen(true)}>
                  Cancel order
                </Button>
                {cancelError !== null && <p className="text-destructive text-sm">{cancelError}</p>}
              </>
            )}
            {actions.includes("request-return") && (
              <Button variant="outline" onClick={() => { setReturnKey((k) => k + 1); setReturnOpen(true); }}>
                Request a return
              </Button>
            )}
            <Button variant="ghost" nativeButton={false} render={<Link href="/orders" />}>
              All orders
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this order?"
        description="A cancelled order can't be undone. If you already paid, the refund is handled by the store."
        confirmLabel="Cancel order"
        destructive
        busy={cancelBusy}
        onConfirm={() => void runCancel()}
      />

      {row.items.length > 0 && (
        <ReturnFormDialog
          key={returnKey}
          open={returnOpen}
          onOpenChange={setReturnOpen}
          order={row}
          onSubmitted={() => undefined}
        />
      )}
    </div>
  );
}