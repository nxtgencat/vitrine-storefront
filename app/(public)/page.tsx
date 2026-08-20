"use client";

import { Suspense } from "react";

import { ProductCard } from "@/components/product/product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { listStorefrontProducts } from "@/lib/api/requests";
import { stringParam } from "@/lib/domain/lists";
import { useQuery } from "@/stores/use-live";
import { PackageSearch } from "lucide-react";
import { useSearchParams } from "next/navigation";

/**
 * The catalog listing (architecture.md §10, §13; api.md §2). `q` lives in
 * the URL (`useSearchParams`): the header SearchBox writes it (debounced on
 * this page), and the fetch keys off it — the URL is the source, the list
 * just follows. The backend returns `{ data }` without pagination (bounded
 * catalog read), so the page renders directly.
 */
function ProductListing() {
  const searchParams = useSearchParams();
  const q = stringParam(searchParams, "q") ?? "";

  const products = useQuery(`catalog:${q}`, () => listStorefrontProducts({ q: q === "" ? undefined : q }));
  const rows = products.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {q === "" ? "Shop the catalog" : `Results for “${q}”`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {q === ""
            ? "Browse the store's catalog and add to your cart."
            : "Searching product names across the catalog."}
        </p>
      </div>

      {products.status === "loading" && products.data === undefined && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {products.status === "error" && (
        <div className="flex flex-col items-start gap-4">
          <ErrorState error={products.error} fallback="Couldn't load the catalog." />
          <Button variant="outline" size="sm" onClick={products.refetch}>
            Try again
          </Button>
        </div>
      )}

      {products.status === "success" && rows.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title={q === "" ? "The catalog is empty" : "No products found"}
          description={q === "" ? "Check back soon." : "Try a different search."}
        />
      )}

      {products.status === "success" && rows.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PublicHomePage() {
  return (
    <Suspense fallback={null}>
      <ProductListing />
    </Suspense>
  );
}