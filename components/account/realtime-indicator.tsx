"use client";

import { useEffect } from "react";

import { useRealtimeStatus } from "@/hooks/use-realtime";
import { connect } from "@/lib/realtime/client";

/**
 * The account shell's live indicator (architecture.md §11). Mounting the
 * shell opens the shared WebSocket channel (no topics — pages subscribe on
 * top), and this pill shows its real state: a green dot while connected,
 * amber while connecting/reconnecting, red when the backend rejected the
 * connection (1008). Renders an invisible placeholder while idle so the
 * layout never shifts.
 */
const LABELS: Record<string, { dot: string; label: string }> = {
  connecting: { dot: "bg-amber-500", label: "Connecting…" },
  connected: { dot: "bg-emerald-500", label: "Live" },
  reconnecting: { dot: "bg-amber-500", label: "Reconnecting…" },
  rejected: { dot: "bg-red-500", label: "Offline" },
};

export function RealtimeIndicator() {
  const status = useRealtimeStatus();

  useEffect(() => {
    connect();
  }, []);

  const view = LABELS[status];

  if (view === undefined) {
    return <span className="inline-flex h-5 items-center" aria-hidden />;
  }

  return (
    <span className="inline-flex h-5 items-center gap-1.5 text-xs text-muted-foreground" title="Order updates arrive live">
      <span className={`size-1.5 rounded-full ${view.dot}`} />
      {view.label}
    </span>
  );
}