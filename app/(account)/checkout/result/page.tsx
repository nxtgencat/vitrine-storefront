"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useInvoiceTopic, useOrderStatusToast, useOrderTopic } from "@/hooks/use-realtime";
import { isApiError, reasonCodeOf } from "@/lib/api/errors";
import { getMyOrder } from "@/lib/api/requests";
import { formatDate } from "@/lib/domain/dates";
import { formatINR } from "@/lib/domain/money";
import { stringParam } from "@/lib/domain/lists";
import { useLiveStore, useQuery } from "@/stores/use-live";
import { CheckCircle2, LoaderCircle, PackageX } from "lucide-react";

/**
 * /checkout/result (architecture.md §11, §13; api.md §4). Two render paths
 * off the backend's own order status — never a client assumption about what
 * happened:
 *
 * - `confirmed` → the receipt (order number, items, totals verbatim). COD
 *   arrives here immediately; a gateway order arrives here when the backend's
 *   webhook path confirmed it.
 * - `pending` → "payment processing", subscribed to `order:{id}` +
 *   `invoice:{id}`; a frame or manual refresh resolves it to the receipt (or
 *   the cancelled state) live. A gateway "success" is never trusted
 *   client-side — only the backend's status counts.
 *
 * The status-toast hook fires when a refetch observes the status leaving
 * `pending`.
 */
function CheckoutResult() {
  const searchParams = useSearchParams();
  const invalidate = useLiveStore((state) => state.invalidate);
  const orderId = stringParam(searchParams, "order");
  const mode = stringParam(searchParams, "mode");

  useOrderTopic(orderId);

  const hasOrderId = orderId !== undefined;
  const order = useQuery(hasOrderId ? `order:${orderId}` : "__none__", () =>
    hasOrderId ? getMyOrder(orderId) : new Promise<never>(() => {}),
  );
  const invoiceId = order.data?.invoice?.id ?? null;
  useInvoiceTopic(invoiceId);
  useOrderStatusToast(order.data?.status);

  const paymentLabel =
    mode === "gateway" ? "Online payment" : mode === "cod" ? "Cash on delivery" : null;

  if (order.data === undefined) {
    if (order.status === "error") {
      if (isApiError(order.error) && (order.error.status === 404 || reasonCodeOf(order.error) === "not_found")) {
        return (
          <EmptyState
            icon={PackageX}
            title="Order not found"
            description="We couldn't find that order. Check your orders list."
          />
        );
      }
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

  if (row.status === "pending") {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <LoaderCircle className="size-12 animate-spin text-muted-foreground" />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Payment processing</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Payment processing — we&apos;ll update this order automatically. No need to refresh; this page
            updates on its own once the payment is confirmed.
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 text-sm">
          <p>
            Order <span className="font-medium">{row.orderNumber}</span>
          </p>
          <p className="font-medium tabular-nums">
            {formatINR(row.invoice !== null ? row.invoice.totalPaise : row.totalPaise)}
          </p>
          <p className="text-muted-foreground">Placed {formatDate(row.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => invalidate(`order:${row.id}`)}>
            Check status now
          </Button>
          <Button variant="ghost" nativeButton={false} render={<Link href="/orders" />}>
            View all orders
          </Button>
        </div>
      </div>
    );
  }

  if (row.status === "cancelled") {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <PackageX className="size-12 text-muted-foreground" />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">This order was cancelled</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Order {row.orderNumber} was cancelled. If you paid for it, the refund is handled by the
            store.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/orders" />}>
          View all orders
        </Button>
      </div>
    );
  }

  const invoice = row.invoice;
  return (
    <div className="flex flex-col items-start gap-6">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-10 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order confirmed</h1>
          <p className="text-sm text-muted-foreground">
            {row.orderNumber} · placed {formatDate(row.createdAt)}
            {paymentLabel !== null && <> · {paymentLabel}</>}
          </p>
        </div>
        <OrderStatusBadge status={row.status} />
      </div>

      <Card className="w-full">
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
          {invoice !== null && (
            <dl className="mt-4 flex flex-col gap-1 border-t pt-4 text-sm">
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

      <div className="flex items-center gap-2">
        <Button nativeButton={false} render={<Link href={`/orders/${row.id}`} />}>
          View order
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Continue shopping
        </Button>
      </div>
    </div>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutResult />
    </Suspense>
  );
}