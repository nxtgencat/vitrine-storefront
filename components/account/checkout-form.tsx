"use client";

import { useState } from "react";

import { AddressFormDialog } from "@/components/account/address-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { CustAddressRow } from "@/lib/types/address";
import { useCheckoutStore } from "@/stores/use-checkout";
import { Plus } from "lucide-react";

/**
 * The checkout submit form (architecture.md §13, api.md §4): address
 * select/create and the payment-mode choice. Submits exactly
 * `{ custAddressId, paymentMode }` — no prices, no cart snapshot; the
 * backend re-reads the cart and re-prices everything server-side. The
 * selected address starts from the /addresses "use for checkout" flag
 * (use-checkout.ts, view-state only), falling back to the first address.
 * The cart rows themselves render on the page next to this card.
 */
export function CheckoutForm({
  addresses,
  cartEmpty,
  busy,
  error,
  onSubmit,
  onAddressesChanged,
}: {
  addresses: CustAddressRow[];
  cartEmpty: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (input: { custAddressId: string; paymentMode: "cod" | "gateway" }) => void;
  onAddressesChanged: () => void;
}) {
  const flaggedAddressId = useCheckoutStore((state) => state.selectedAddressId);
  const setSelectedAddressId = useCheckoutStore((state) => state.setSelectedAddressId);
  const [localSelection, setLocalSelection] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<"cod" | "gateway">("cod");
  const [dialogOpen, setDialogOpen] = useState(false);

  /**
   * The selected address is derived at render time — never written from an
   * effect — so it tracks the list loading in after the page mounts (the
   * flagged /addresses "use for checkout" choice wins, else the first row).
   * `localSelection` records an explicit pick and wins over the fallbacks.
   */
  const effectiveAddressId = (() => {
    if (localSelection !== null && addresses.some((row) => row.id === localSelection)) return localSelection;
    if (flaggedAddressId !== null && addresses.some((row) => row.id === flaggedAddressId)) return flaggedAddressId;
    return addresses[0]?.id ?? null;
  })();

  function selectAddress(id: string) {
    setLocalSelection(id);
    setSelectedAddressId(id);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery address</CardTitle>
          <CardDescription>Where this order will be delivered.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {addresses.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You need an address to check out — add one below.
            </p>
          )}
          <RadioGroup
            value={effectiveAddressId ?? ""}
            onValueChange={selectAddress}
            className="gap-3"
          >
            {addresses.map((row) => (
              <Label
                key={row.id}
                htmlFor={`checkout-address-${row.id}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
                  effectiveAddressId === row.id && "ring-2 ring-primary",
                )}
              >
                <RadioGroupItem id={`checkout-address-${row.id}`} value={row.id} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{row.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {[row.line1, row.line2, row.city, row.state, row.pincode].filter(Boolean).join(", ")}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          <div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setDialogOpen(true);
              }}
            >
              <Plus />
              New address
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment method</CardTitle>
          <CardDescription>How you want to pay for this order.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={paymentMode} onValueChange={(value) => setPaymentMode(value as "cod" | "gateway")} className="gap-3">
            <Label
              htmlFor="checkout-mode-cod"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
                paymentMode === "cod" && "ring-2 ring-primary",
              )}
            >
              <RadioGroupItem id="checkout-mode-cod" value="cod" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Cash on delivery</span>
                <span className="text-sm text-muted-foreground">Pay when your order arrives.</span>
              </span>
            </Label>
            <Label
              htmlFor="checkout-mode-gateway"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
                paymentMode === "gateway" && "ring-2 ring-primary",
              )}
            >
              <RadioGroupItem id="checkout-mode-gateway" value="gateway" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Online payment</span>
                <span className="text-sm text-muted-foreground">Pay now by card, UPI, or bank transfer.</span>
              </span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {error !== null && <p className="text-destructive text-sm">{error}</p>}

      <Button
        size="lg"
        disabled={busy || cartEmpty || effectiveAddressId === null}
        onClick={() => {
          if (effectiveAddressId !== null) onSubmit({ custAddressId: effectiveAddressId, paymentMode });
        }}
      >
        {busy ? "Placing order…" : "Place order"}
      </Button>

      <AddressFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          onAddressesChanged();
          setDialogOpen(false);
        }}
      />
    </div>
  );
}