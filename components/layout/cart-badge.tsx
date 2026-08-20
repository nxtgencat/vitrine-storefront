"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/use-session";
import { useCartStore } from "@/stores/use-cart";
import { useEffect } from "react";

/**
 * Header cart entry — an icon button with the line-count badge. The count
 * comes from the cart store, which hydrates from `GET /api/storefront/cart`
 * once the session store reports the customer is authenticated
 * (architecture.md §5, §7). Nothing is shown while the session is unknown.
 */
export function CartBadge() {
  const sessionStatus = useSessionStore((s) => s.status);
  const count = useCartStore((s) => s.count);
  const status = useCartStore((s) => s.status);
  const hydrate = useCartStore((s) => s.hydrate);
  const invalidate = useCartStore((s) => s.invalidate);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      if (status === "idle") void hydrate();
    } else {
      if (status !== "idle") invalidate();
    }
  }, [sessionStatus, status, hydrate, invalidate]);

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label={`Cart, ${count} items`}
      nativeButton={false}
      render={<Link href="/cart" className="relative" />}
    >
      <ShoppingBag className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
          {count}
        </span>
      )}
    </Button>
  );
}