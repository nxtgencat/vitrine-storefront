"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Header cart entry — an icon button with the line-count badge. The count
 * is store-fed from `GET /api/storefront/cart` (phase 1); until then it
 * renders zero.
 */
export function CartBadge({ count = 0 }: { count?: number }) {
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