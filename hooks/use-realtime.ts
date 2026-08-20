"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { onRealtime, onRealtimeStatus, subscribe } from "@/lib/realtime/client";
import type { RealtimeStatus } from "@/lib/realtime/client";
import { useLiveStore } from "@/stores/use-live";

/**
 * Realtime wiring for order surfaces (architecture.md §11, api.md §5). The
 * client (lib/realtime/client.ts) owns connect/backoff/resubscribe and maps
 * event types to invalidations; these hooks add the view-local pieces: the
 * topic subscriptions themselves and the refetch of the current order after
 * a reconnect (the synthetic `reconnected` frame carries no entityId, so no
 * mapping applies).
 */

/** Subscribe to `order:{id}` (own) while mounted; refetch after reconnect. */
export function useOrderTopic(orderId: string | null | undefined): void {
  const invalidate = useLiveStore((state) => state.invalidate);

  useEffect(() => {
    if (orderId === undefined || orderId === null) return;
    const off = onRealtime((frame) => {
      if (frame.type === "reconnected") invalidate(`order:${orderId}`);
    });
    const unsubscribe = subscribe(`order:${orderId}`);
    return () => {
      unsubscribe();
      off();
    };
  }, [orderId, invalidate]);
}

/** Subscribe to `invoice:{id}` (own, linked) while mounted. */
export function useInvoiceTopic(invoiceId: string | null | undefined): void {
  const invalidate = useLiveStore((state) => state.invalidate);

  useEffect(() => {
    if (invoiceId === undefined || invoiceId === null) return;
    const off = onRealtime((frame) => {
      if (frame.type === "reconnected") invalidate(`order:${invoiceId}`);
    });
    const unsubscribe = subscribe(`invoice:${invoiceId}`);
    return () => {
      unsubscribe();
      off();
    };
  }, [invoiceId, invalidate]);
}

/**
 * Subscribe to every own order row's topics while the orders list is mounted
 * (api.md §5: a customer may only subscribe to own `order:`/`invoice:`
 * documents; each row's topics are authorized — ownership is the backend's
 * decision). Any event (or a reconnect) invalidates the `orders:` list query,
 * so a change to any listed order — a gateway order confirming via the
 * webhook, a cancellation from another session, a return confirmation —
 * re-renders the list live. A brand-new order created in another session has
 * no topic to subscribe to until it exists (the backend publishes only on
 * `order:{id}` — there is no customer-wide topic), so new rows arrive on the
 * next natural visit/refetch; every change to a row already on screen is
 * realtime.
 */
export function useOrdersRealtime(rows: ReadonlyArray<{ id: string; invoice: { id: string } | null }>): void {
  const invalidate = useLiveStore((state) => state.invalidate);
  const signature = rows.map((row) => `${row.id}|${row.invoice?.id ?? ""}`).join(",");

  useEffect(() => {
    if (signature === "") return;
    const off = onRealtime((frame) => {
      if (frame.type === "reconnected") invalidate("orders:");
    });
    const unsubscribes = signature.split(",").flatMap((part) => {
      const [orderId, invoiceId] = part.split("|");
      if (orderId === undefined || orderId === "") return [];
      const offs: (() => void)[] = [subscribe(`order:${orderId}`)];
      if (invoiceId !== undefined && invoiceId !== "") offs.push(subscribe(`invoice:${invoiceId}`));
      return offs;
    });
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      off();
    };
  }, [signature, invalidate]);
}

/** The shared client's connection state (the account shell's live indicator). */
export function useRealtimeStatus(): RealtimeStatus {
  const [current, setCurrent] = useState<RealtimeStatus>("idle");

  useEffect(() => onRealtimeStatus(setCurrent), []);

  return current;
}

/**
 * Toast when an order's status leaves `pending` through a refetch
 * (architecture.md §11: "if the order's status left pending, toast 'your
 * order is confirmed' (or cancelled) and re-render"). The first render is
 * not a transition; only a status change observed between refetches fires.
 */
export function useOrderStatusToast(status: string | undefined): void {
  const previous = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (status === undefined) return;
    const prior = previous.current;
    previous.current = status;
    if (prior === undefined) return;
    if (prior === "pending" && status === "confirmed") {
      toast.success("Your order is confirmed");
    } else if (prior === "pending" && status === "cancelled") {
      toast.error("This order was cancelled");
    }
  }, [status]);
}