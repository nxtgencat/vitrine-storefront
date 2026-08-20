"use client";

import { useState } from "react";

import { AddressFormDialog } from "@/components/account/address-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { listAddresses } from "@/lib/api/requests";
import { useCheckoutStore } from "@/stores/use-checkout";
import { useLiveStore, useQuery } from "@/stores/use-live";
import { MapPin, Plus } from "lucide-react";

/**
 * /addresses (architecture.md §13, api.md §3). Address book: list, create,
 * and a "use for checkout" selection. The selection is view-state only
 * (`use-checkout.ts`) — checkout re-reads the address server-side; the flag
 * just makes phase 4's checkout form start from a choice already made here.
 */
export default function AddressesPage() {
  const invalidateLive = useLiveStore((state) => state.invalidate);
  const { data, status, error, refetch } = useQuery("addresses", listAddresses);
  const selectedAddressId = useCheckoutStore((state) => state.selectedAddressId);
  const setSelectedAddressId = useCheckoutStore((state) => state.setSelectedAddressId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Addresses</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus />
          New address
        </Button>
      </div>

      {status === "loading" && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-start gap-4">
          <ErrorState error={error} fallback="Couldn't load your addresses." />
          <Button variant="outline" size="sm" onClick={refetch}>
            Try again
          </Button>
        </div>
      )}

      {status === "success" && rows.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No addresses yet"
          description="Add an address to use at checkout."
        />
      )}

      {status === "success" && rows.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => {
            const selected = row.id === selectedAddressId;
            return (
              <li key={row.id}>
                <Card
                  data-state={selected ? "selected" : undefined}
                  className={cn("h-full", selected && "ring-2 ring-primary")}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>{row.label}</CardTitle>
                      {selected && <span className="text-primary text-xs font-medium">Using for checkout</span>}
                    </div>
                    <CardDescription>
                      {[row.line1, row.line2, row.city, row.state, row.pincode].filter(Boolean).join(", ")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedAddressId(selected ? null : row.id)}
                    >
                      {selected ? "Remove selection" : "Use for checkout"}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AddressFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={() => invalidateLive("addresses")} />
    </div>
  );
}