import Link from "next/link";
import { Suspense } from "react";

import { AccountMenu } from "@/components/layout/account-menu";
import { CartBadge } from "@/components/layout/cart-badge";
import { SearchBox } from "@/components/layout/search-box";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <span aria-hidden className="size-2.5 rounded-[3px] bg-primary" />
          <span className="text-lg">Vitrine</span>
        </Link>
        <div className="hidden min-w-0 flex-1 md:block md:max-w-md">
          <Suspense fallback={null}>
            <SearchBox />
          </Suspense>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <AccountMenu />
          <CartBadge />
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pb-3 md:hidden sm:px-6">
        <Suspense fallback={null}>
          <SearchBox />
        </Suspense>
      </div>
    </header>
  );
}