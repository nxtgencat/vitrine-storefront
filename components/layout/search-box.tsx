"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { buildQuery, stringParam } from "@/lib/domain/lists";

/**
 * Catalog search (architecture.md §10): the query lives in the URL
 * (`/?q=…`). On the catalog page typing writes the URL with a 300ms
 * debounce and the listing refetches (debounced fetching); elsewhere the
 * box only submits on Enter (it would otherwise rewrite the current page's
 * URL). The input mirrors the URL value so back/forward stays in sync.
 */
export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = stringParam(searchParams, "q") ?? "";
  const onCatalog = pathname === "/";
  const [value, setValue] = useState(urlQ);

  useEffect(() => setValue(urlQ), [urlQ]);

  useEffect(() => {
    if (!onCatalog || value === urlQ) return;
    const timer = setTimeout(() => {
      const q = value.trim();
      router.replace(buildQuery({ q: q === "" ? undefined : q }));
    }, 300);
    return () => clearTimeout(timer);
  }, [value, urlQ, onCatalog, router]);

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        router.push(q === "" ? "/" : `/?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search
        data-slot="icon"
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        aria-label="Search products"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search products"
        className="pl-8"
      />
    </form>
  );
}