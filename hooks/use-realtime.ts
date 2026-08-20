"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { onRealtime, subscribe } from "@/lib/realtime/client";
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