"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";

import { isApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

/**
 * The live query cache (architecture.md §5, same as dashboard §5/§11).
 * `useQuery(key, loader)` is the one way pages read the network;
 * `invalidate(keyPrefix?)` is the one way mutations refresh it. Loaders
 * dedupe in flight, so parallel consumers of one key share a single
 * request; a failed load retries on the next `invalidate` (never on a
 * timer).
 */

type EntryStatus = "idle" | "loading" | "success" | "error";

type Entry = {
  status: EntryStatus;
  data: unknown;
  error: unknown;
  fetchedAt: number | null;
};

type LiveState = {
  entries: Record<string, Entry>;
  setEntry: (key: string, patch: Partial<Entry>) => void;
  invalidate: (keyPrefix?: string) => void;
};

const inflight = new Set<string>();
const cancelled = new Set<string>();

export const useLiveStore = create<LiveState>()((set, get) => ({
  entries: {},

  setEntry: (key, patch) => {
    set((state) => {
      const current = state.entries[key] ?? { status: "idle" as const, data: undefined, error: undefined, fetchedAt: null };
      return { entries: { ...state.entries, [key]: { ...current, ...patch } } };
    });
  },

  invalidate: (keyPrefix) => {
    const entries = get().entries;
    const targets = keyPrefix === undefined
      ? Object.keys(entries)
      : Object.keys(entries).filter((key) => key.startsWith(keyPrefix));
    if (targets.length === 0) return;
    for (const target of targets) cancelled.add(target);
    set((state) => {
      const next = { ...state.entries };
      for (const key of targets) {
        const current = next[key];
        next[key] = current !== undefined
          ? { ...current, status: "idle" }
          : { status: "idle", data: undefined, error: undefined, fetchedAt: null };
      }
      return { entries: next };
    });
  },
}));

function runLoader(key: string, loader: () => Promise<unknown>): void {
  if (inflight.has(key)) return;
  inflight.add(key);
  const { setEntry } = useLiveStore.getState();
  setEntry(key, { status: "loading", error: undefined });
  loader()
    .then((data) => {
      if (cancelled.has(key)) return;
      setEntry(key, { status: "success", data, error: undefined, fetchedAt: Date.now() });
    })
    .catch((err: unknown) => {
      if (cancelled.has(key)) return;
      if (isApiError(err) && err.status === 401) {
        // The session layer already handled (or failed) the rehydrate; keep
        // the entry in error so the UI can show the expired-session state.
        logger.warn("live query 401", { key });
      }
      setEntry(key, { status: "error", data: undefined, error: err, fetchedAt: Date.now() });
    })
    .finally(() => {
      inflight.delete(key);
      if (cancelled.has(key)) {
        // Invalidated while this load was in flight — restart so the
        // replacement data actually lands. The entry keeps its stale data
        // throughout, so this never blanks the UI.
        cancelled.delete(key);
        runLoader(key, loader);
      }
    });
}

export function useQuery<T>(key: string, loader: () => Promise<T>): {
  data: T | undefined;
  status: EntryStatus;
  error: unknown;
  fetchedAt: number | null;
  refetch: () => void;
} {
  const entry = useLiveStore((state) => state.entries[key]);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (entry === undefined || entry.status === "idle") {
      runLoader(key, () => loaderRef.current());
    }
  }, [key, entry]);

  return {
    data: entry?.data as T | undefined,
    status: entry?.status ?? "idle",
    error: entry?.error,
    fetchedAt: entry?.fetchedAt ?? null,
    refetch: () => useLiveStore.getState().invalidate(key),
  };
}