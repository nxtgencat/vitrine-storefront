"use client";

import { useCartStore } from "@/stores/use-cart";
import { useLiveStore } from "@/stores/use-live";
import { logger } from "@/lib/logger";

/**
 * The one WebSocket client (architecture.md §11, api.md §5). Created lazily
 * on the first `subscribe`; frame protocol: connect → `{ op: "subscribe",
 * topics }`, incoming frames are the backend's thin `{ type, entityId, at }`
 * (never the full entity — any event means "refetch this"). The
 * type → invalidate-prefix mapping lives here, the single refetch-on-event
 * dispatcher.
 *
 * Reconnect: exponential backoff (1s → 2s → … → 15s cap), resubscribes the
 * last topic set, and emits a synthetic `reconnected` frame so visible views
 * refetch.
 */

export type RealtimeFrame = { type: string; entityId: string; at: number };

const RECONNECTED: RealtimeFrame = { type: "reconnected", entityId: "", at: 0 };

const topics = new Set<string>();
const listeners = new Set<(frame: RealtimeFrame) => void>();

let socket: WebSocket | null = null;
let connectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let hasConnected = false;
let closingIntentionally = false;

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE;

function wsUrl(): string {
  if (WS_BASE !== undefined && WS_BASE !== "") {
    return `${WS_BASE.replace(/\/+$/, "")}/api/ws`;
  }
  return `${window.location.origin}/api/ws`;
}

function emit(frame: RealtimeFrame): void {
  for (const listener of listeners) listener(frame);
}

/**
 * Event type → query-key prefixes to invalidate (architecture.md §11). Frames
 * carry no topic, so the type routes. `order.created`/`order.confirmed`/
 * `order.cancelled` arrive on `order:{id}` (entityId = the order) and cover
 * the order detail + the orders list. The gateway webhook publishes
 * `payment.confirmed`/`payment.refunded` on the same order topic, and
 * `invoice.issued` on `invoice:{id}` (entityId = the invoice — a different
 * uuid than its order, so the `order:` prefix here is a harmless no-op; the
 * detail is already covered by the order-topic event of the same
 * transaction). The orders list rows carry the linked invoice summary
 * (draft → issued), so the list refetches on both.
 */
const INVALIDATE_PREFIXES: Record<string, (entityId: string) => string[]> = {
  "order.created": (entityId) => [`order:${entityId}`, "orders:"],
  "order.confirmed": (entityId) => [`order:${entityId}`, "orders:"],
  "order.cancelled": (entityId) => [`order:${entityId}`, "orders:"],
  "payment.confirmed": (entityId) => [`order:${entityId}`, "orders:"],
  "payment.refunded": (entityId) => [`order:${entityId}`, "orders:"],
  "invoice.issued": (entityId) => [`order:${entityId}`, "orders:"],
};

function handleFrame(frame: RealtimeFrame): void {
  const prefixes = INVALIDATE_PREFIXES[frame.type];
  if (prefixes !== undefined) {
    for (const prefix of prefixes(frame.entityId)) {
      useLiveStore.getState().invalidate(prefix);
    }
  }
  if (frame.type === "payment.confirmed") {
    // The backend clears the cart in the same tx that confirms the payment
    // (backend/services/payments.ts) — drop both client mirrors so the badge
    // and the next /cart visit show the empty cart.
    useLiveStore.getState().invalidate("cart");
    useCartStore.getState().invalidate();
  }
  emit(frame);
}

function sendSubscribe(): void {
  if (socket === null || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ op: "subscribe", topics: [...topics] }));
}

function scheduleReconnect(): void {
  if (closingIntentionally || reconnectTimer !== null) return;
  const delay = Math.min(15_000, 1_000 * 2 ** connectAttempts);
  connectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect(): void {
  if (typeof window === "undefined") return;
  if (socket !== null) return;
  try {
    socket = new WebSocket(wsUrl());
  } catch (err) {
    logger.warn("ws connect failed", { error: String(err) });
    scheduleReconnect();
    return;
  }
  socket.addEventListener("open", () => {
    const wasConnected = hasConnected;
    hasConnected = true;
    connectAttempts = 0;
    sendSubscribe();
    if (wasConnected) emit(RECONNECTED);
  });
  socket.addEventListener("message", (event) => {
    try {
      handleFrame(JSON.parse(String(event.data)) as RealtimeFrame);
    } catch (err) {
      logger.warn("ws bad frame", { error: String(err) });
    }
  });
  socket.addEventListener("close", () => {
    socket = null;
    if (closingIntentionally) {
      closingIntentionally = false;
      return;
    }
    scheduleReconnect();
  });
}

/**
 * Subscribe to a topic (api.md §5: `order:{id}` / `invoice:{id}`, own
 * documents). Idempotent; returns the unsubscribe. The last unsubscribe
 * closes the socket.
 */
export function subscribe(topic: string): () => void {
  topics.add(topic);
  if (socket !== null && socket.readyState === WebSocket.OPEN) {
    sendSubscribe();
  } else if (socket === null) {
    connect();
  }
  return () => {
    topics.delete(topic);
    if (topics.size === 0) closeSocket();
  };
}

function closeSocket(): void {
  closingIntentionally = true;
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket !== null) {
    socket.close();
    socket = null;
  }
}

/** Subscribe to realtime frames (including the synthetic `reconnected`). */
export function onRealtime(listener: (frame: RealtimeFrame) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}