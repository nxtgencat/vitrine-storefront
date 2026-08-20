"use client";

import { useCartStore } from "@/stores/use-cart";
import { useLiveStore } from "@/stores/use-live";
import { useSessionStore } from "@/stores/use-session";
import { logger } from "@/lib/logger";

/**
 * The one WebSocket client (architecture.md §11, api.md §5). Created lazily
 * on the first `subscribe` (or eagerly by the account shell's live
 * indicator); frame protocol: connect → `{ op: "subscribe", topics }`,
 * incoming frames are the backend's thin `{ type, entityId, at }` (never
 * the full entity — any event means "refetch this"). The
 * type → invalidate-prefix mapping lives here, the single refetch-on-event
 * dispatcher.
 *
 * Reconnect: exponential backoff (1s → 2s → … → 15s cap), resubscribes the
 * last topic set, and emits a synthetic `reconnected` frame so visible views
 * refetch. A policy-violation close (1008 — the backend closes the whole
 * connection when any subscribed topic is unauthorized) is terminal: no
 * reconnect, the denial is per-connection and retrying it is noise. A
 * signed-out session also stops the loop (the upgrade would be refused
 * anyway); the account shell's 401 rehydrate path handles session expiry.
 *
 * Topic guard: a customer may only subscribe to own `order:<uuid>` /
 * `invoice:<uuid>` documents (backend `routes/realtime.ts`). One bad topic
 * kills the whole connection, so `subscribe` validates the shape client-side
 * and refuses anything else — the backend's authorization still decides
 * ownership, this guard only keeps shape bugs from taking the socket down.
 */

export type RealtimeFrame = { type: string; entityId: string; at: number };
export type RealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "rejected";

const RECONNECTED: RealtimeFrame = { type: "reconnected", entityId: "", at: 0 };

const OWN_TOPIC_RE = /^(order|invoice):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const topics = new Set<string>();
const listeners = new Set<(frame: RealtimeFrame) => void>();
const statusListeners = new Set<(status: RealtimeStatus) => void>();

let socket: WebSocket | null = null;
let connectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let hasConnected = false;
let closingIntentionally = false;
let status: RealtimeStatus = "idle";

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE;

function wsUrl(): string {
  if (WS_BASE !== undefined && WS_BASE !== "") {
    return `${WS_BASE.replace(/\/+$/, "")}/api/ws`;
  }
  return `${window.location.origin}/api/ws`;
}

function setStatus(next: RealtimeStatus): void {
  if (status === next) return;
  status = next;
  for (const listener of statusListeners) listener(next);
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

function handleErrorFrame(reason: string): void {
  logger.warn("ws error frame", { reason });
}

function sendSubscribe(): void {
  if (socket === null || socket.readyState !== WebSocket.OPEN) return;
  if (topics.size === 0) return;
  socket.send(JSON.stringify({ op: "subscribe", topics: [...topics] }));
}

function scheduleReconnect(): void {
  if (closingIntentionally || reconnectTimer !== null) return;
  if (useSessionStore.getState().status === "unauthenticated") {
    // No session, no socket — the next upgrade would be refused; the account
    // shell's 401 rehydrate path surfaces expiry. Stop the loop.
    setStatus("idle");
    return;
  }
  const delay = Math.min(15_000, 1_000 * 2 ** connectAttempts);
  connectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, delay);
}

function openSocket(): void {
  if (typeof window === "undefined") return;
  if (socket !== null) return;
  setStatus("connecting");
  let ws: WebSocket;
  try {
    ws = new WebSocket(wsUrl());
  } catch (err) {
    logger.warn("ws connect failed", { error: String(err) });
    setStatus("reconnecting");
    scheduleReconnect();
    return;
  }
  socket = ws;
  ws.addEventListener("open", () => {
    const wasConnected = hasConnected;
    hasConnected = true;
    connectAttempts = 0;
    setStatus("connected");
    sendSubscribe();
    if (wasConnected) emit(RECONNECTED);
  });
  ws.addEventListener("message", (event) => {
    try {
      const parsed: unknown = JSON.parse(String(event.data));
      if (typeof parsed === "object" && parsed !== null && "op" in parsed) {
        const frame = parsed as { op?: unknown; reason?: unknown };
        if (frame.op === "error") {
          handleErrorFrame(String(frame.reason ?? ""));
          return;
        }
      }
      handleFrame(parsed as RealtimeFrame);
    } catch (err) {
      logger.warn("ws bad frame", { error: String(err) });
    }
  });
  ws.addEventListener("close", (event) => {
    socket = null;
    if (closingIntentionally) {
      closingIntentionally = false;
      setStatus("idle");
      return;
    }
    if (event.code === 1008) {
      // Policy violation (unauthorized topic / forbidden actor) — the backend
      // closes the whole connection and will keep refusing. Terminal.
      logger.warn("ws closed by policy (1008)");
      setStatus("rejected");
      return;
    }
    setStatus("reconnecting");
    scheduleReconnect();
  });
}

/**
 * Eager connection without topics — the account shell's live indicator
 * (architecture.md §11). Pages that need events call `subscribe` on top.
 */
export function connect(): void {
  if (typeof window === "undefined") return;
  if (socket !== null || reconnectTimer !== null) return;
  openSocket();
}

/**
 * Subscribe to an own `order:{id}` / `invoice:{id}` topic (api.md §5).
 * Any other shape is refused client-side — the backend closes the whole
 * connection (1008) on a single unauthorized topic. Idempotent; returns the
 * unsubscribe. The last unsubscribe closes the socket.
 */
export function subscribe(topic: string): () => void {
  const match = OWN_TOPIC_RE.exec(topic);
  if (match === null) {
    logger.warn("ws subscribe refused: not an own order/invoice topic", { topic });
    return () => {};
  }
  const normalized = `${match[1].toLowerCase()}:${match[2].toLowerCase()}`;
  topics.add(normalized);
  if (socket !== null && socket.readyState === WebSocket.OPEN) {
    sendSubscribe();
  } else if (socket === null) {
    openSocket();
  }
  return () => {
    topics.delete(normalized);
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

/** Subscribe to connection-state changes (the account shell's indicator). */
export function onRealtimeStatus(listener: (status: RealtimeStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}