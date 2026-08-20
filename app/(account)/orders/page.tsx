"use client";

import Link from "next/link";

import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useOrdersRealtime } from "@/hooks/use-realtime";
import { listMyOrders } from "@/lib/api/requests";
import { formatDate } from "@/lib/domain/dates";
import { formatINR } from "@/lib/domain/money";
import { useQuery } from "@/stores/use-live";
import { Package } from "lucide-react";

/**
 * /orders (architecture.md §13; api.md §4). My orders list from
 * GET /api/storefront/orders/my; every row's totals come from the backend
 * (`totalPaise`, invoice summary) and are shown verbatim. Live (architecture
 * .md §11): each rendered row's own `order:`/`invoice:` topics are
 * subscribed, so a status change to any listed order — webhook
 * confirmation, cancellation from another session — re-renders the list
 * without a refresh. A brand-new order appears on the next visit/refetch
 * (the backend has no customer-wide topic).
 */
export default function OrdersPage() {
  const orders = useQuery("orders:", listMyOrders);
  const rows = orders.data?.data ?? [];

  useOrdersRealtime(rows);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>

      {orders.data === undefined && (orders.status === "loading" || orders.status === "idle") && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {orders.data === undefined && orders.status === "error" && (
        <div className="flex flex-col items-start gap-4">
          <ErrorState error={orders.error} fallback="Couldn't load your orders." />
          <Button variant="outline" size="sm" onClick={orders.refetch}>
            Try again
          </Button>
        </div>
      )}

      {orders.data !== undefined && rows.length === 0 && (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you place an order it will show up here."
        />
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/orders/${row.id}`}
                className="block rounded-xl border bg-card transition-colors hover:bg-muted/50"
              >
                <Card className="border-0 shadow-none">
                  <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="font-medium">{row.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">Placed {formatDate(row.createdAt)}</p>
                    </div>
                    <OrderStatusBadge status={row.status} />
                    {row.invoice !== null && (
                      <p className="text-xs text-muted-foreground">Invoice {row.invoice.invoiceNumber}</p>
                    )}
                    <p className="ml-auto font-medium tabular-nums">
                      {formatINR(row.invoice !== null ? row.invoice.totalPaise : row.totalPaise)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}