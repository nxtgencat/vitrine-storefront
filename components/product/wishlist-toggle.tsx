"use client";

import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWishlistToggle } from "@/hooks/use-wishlist-toggle";
import { requireCustomer, useSessionStore } from "@/stores/use-session";

/**
 * Wishlist toggle for browse surfaces (architecture.md §13). Session-gated:
 * while the session is unknown a fixed-size placeholder holds the layout;
 * anonymous users get a plain heart that redirects to /login?next=… on
 * click; signed-in users get the real toggle backed by the shared wishlist
 * membership query. `showError` renders the mutation's message inline where
 * the layout has room (wishlist page, product detail).
 */
export function WishlistToggle({
  variantId,
  showError = false,
}: {
  variantId: string;
  showError?: boolean;
}) {
  const status = useSessionStore((state) => state.status);

  if (status === "idle" || status === "loading") {
    return <span className="inline-flex size-7 items-center justify-center" aria-hidden />;
  }

  if (status !== "authenticated") {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Add to wishlist"
        onClick={() => void requireCustomer()}
      >
        <Heart />
      </Button>
    );
  }

  return <WishlistToggleBody variantId={variantId} showError={showError} />;
}

function WishlistToggleBody({ variantId, showError }: { variantId: string; showError: boolean }) {
  const { wished, busy, error, toggle } = useWishlistToggle(variantId);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={wished}
        disabled={busy}
        onClick={() => void toggle()}
      >
        <Heart className={cn(wished && "fill-primary text-primary")} />
      </Button>
      {showError && error !== null && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}