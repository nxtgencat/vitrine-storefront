"use client";

import { useCallback, useState } from "react";

import { messageFor } from "@/lib/api/errors";
import { addWishlistItem, getWishlist, removeWishlistItem } from "@/lib/api/requests";
import { logger } from "@/lib/logger";
import { useLiveStore, useQuery } from "@/stores/use-live";
import { requireCustomer } from "@/stores/use-session";

const WISHLIST_KEY = "wishlist";

/**
 * One variant's wishlist membership (architecture.md §13). The toggle state
 * comes from the shared `wishlist` query (getWishlist → variantId set) — one
 * fetch per session instead of one getWishlistItem per row, same truth. The
 * flip is optimistic (a local override covers the refetch window) and rolls
 * back on error.
 *
 * The caller mounts the toggle only when the session is authenticated, so a
 * public page never fires the C-guarded wishlist read for an anonymous
 * visitor; anonymous clicks are handled by the plain button, which redirects
 * through requireCustomer().
 */
export function useWishlistToggle(variantId: string) {
  const { data, fetchedAt } = useQuery(WISHLIST_KEY, () => getWishlist());
  const [override, setOverride] = useState<boolean | null>(null);
  const [mutatedAt, setMutatedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membership = data?.data.some((row) => row.variantId === variantId) ?? false;
  // The optimistic value stays in charge until the refetch that started after
  // the mutation has landed (fetchedAt > mutatedAt); then the query's truth is
  // authoritative again. Derived from timestamps, so no effect is needed to
  // clear the override.
  const pending = override !== null && (fetchedAt === null || fetchedAt <= (mutatedAt ?? 0));
  const wished = pending ? override : membership;

  const toggle = useCallback(async () => {
    if (busy) return;
    if (!(await requireCustomer())) return;
    setBusy(true);
    setError(null);
    const target = !(pending ? override : membership);
    setOverride(target);
    setMutatedAt(Date.now());
    try {
      if (target) {
        await addWishlistItem({ variantId });
      } else {
        await removeWishlistItem(variantId);
      }
      useLiveStore.getState().invalidate(WISHLIST_KEY);
    } catch (err) {
      setOverride(null);
      setMutatedAt(null);
      logger.warn("wishlist toggle failed", { error: String(err) });
      setError(messageFor(err, "Couldn't update your wishlist."));
    } finally {
      setBusy(false);
    }
  }, [busy, pending, override, membership, variantId]);

  return { wished, busy, error, toggle };
}