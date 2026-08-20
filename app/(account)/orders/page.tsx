"use client";

import Link from "next/link";

import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { listMyOrders } from "@/lib/api/requests";
import { formatDate } from "@/lib/domain/dates";
import { formatINR } from "@/lib/domain/money";
import { useQuery } from "@/stores/use-live";
import { Package } from "lucide-react";

/**
 * /orders (architecture.md §13; api.md §4). My orders list from
 * GET /api/storefront/orders/my; every row's totals come from the backend
 * (`totalPaise`, invoice summary) and are shown verbatim.
 */
export default function OrdersPage() {
  const orders = useQuery("orders:", listMyOrders);
  const rows = orders.status === "success" ? (orders.data?.data ?? []) : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>

      {orders.status === "loading" && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {orders.status === "error" && (
        <div className="flex flex-col items-start gap-4">
          <ErrorState error={orders.error} fallback="Couldn't load your orders." />
          <Button variant="outline" size="sm" onClick={orders.refetch}>
            Try again
          </Button>
        </div>
      )}

      {orders.status === "success" && rows.length === 0 && (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you place an order it will show up here."
        />
      )}

      {orders.status === "success" && rows.length > 0 && (
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