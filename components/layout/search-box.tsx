"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";

/**
 * Catalog search (architecture.md §10): the query lives in the URL
 * (`/?q=…`) so it survives navigation. Debounced fetching arrives with
 * the listing page (phase 3); this box only writes the URL.
 */
export function SearchBox() {
  const router = useRouter();
  const [value, setValue] = useState("");

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