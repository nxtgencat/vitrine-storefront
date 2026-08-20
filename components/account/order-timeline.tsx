import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { formatDateTime } from "@/lib/domain/dates";
import type { OrderEventRow } from "@/lib/types/order";

/**
 * The order timeline (architecture.md §9): the backend's `order_events`
 * rows in creation order. Customer-facing labels for the known event types;
 * unknown types render their raw type string (new backend event types never
 * break the page).
 */

const EVENT_LABELS: Record<string, string> = {
  "order.created": "Order placed",
  "order.confirmed": "Order confirmed",
  "order.cancelled": "Order cancelled",
  "payment.confirmed": "Payment confirmed",
  "payment.refunded": "Payment refunded",
  "invoice.issued": "Invoice issued",
  "return.confirmed": "Return confirmed",
  "shipment.dispatched": "Order dispatched",
  "shipment.delivered": "Order delivered",
};

export function OrderTimeline({ events }: { events: OrderEventRow[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-center gap-2 text-sm">
          <OrderStatusBadge status={EVENT_LABELS[event.type] ?? event.type} />
          <span className="text-muted-foreground">{formatDateTime(event.createdAt)}</span>
        </li>
      ))}
    </ol>
  );
}