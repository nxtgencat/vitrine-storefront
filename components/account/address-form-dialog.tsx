"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageFor } from "@/lib/api/errors";
import { createAddress } from "@/lib/api/requests";
import { logger } from "@/lib/logger";
import { createAddressBodySchema } from "@/lib/types/address";

/**
 * New-address dialog (architecture.md §12, api.md §3). Controlled fields,
 * validated with the request zod schema, per-field errors on submit, the
 * API's own message on failure. On save it invalidates the `addresses`
 * query so the page refetches.
 */
export function AddressFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setLine1("");
    setLine2("");
    setCity("");
    setState("");
    setPincode("");
    setFieldErrors({});
    setFormError(null);
    setBusy(false);
  }, [open]);

  function setFieldError(field: string, message?: string) {
    setFieldErrors((previous) => (previous[field] === message ? previous : { ...previous, [field]: message }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = createAddressBodySchema.safeParse({
      label,
      line1,
      line2: line2.trim() === "" ? undefined : line2.trim(),
      city,
      state,
      pincode,
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string | undefined> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    setBusy(true);
    try {
      await createAddress(parsed.data);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      logger.warn("create address failed", { error: String(err) });
      setFormError(messageFor(err, "Couldn't save this address."));
    } finally {
      setBusy(false);
    }
  }

  const fields: Array<{ name: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }> = [
    { name: "label", label: "Label", value: label, onChange: setLabel, placeholder: "Home, Work, …", required: true },
    { name: "line1", label: "Address line 1", value: line1, onChange: setLine1, placeholder: "Flat, building, street", required: true },
    { name: "line2", label: "Address line 2", value: line2, onChange: setLine2, placeholder: "Area, landmark" },
    { name: "city", label: "City", value: city, onChange: setCity, placeholder: "Mumbai", required: true },
    { name: "state", label: "State", value: state, onChange: setState, placeholder: "Maharashtra", required: true },
    { name: "pincode", label: "Pincode", value: pincode, onChange: setPincode, placeholder: "400001", required: true },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New address</DialogTitle>
          <DialogDescription>Save an address for delivery and checkout.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name} className={`flex flex-col gap-2 ${field.name === "line1" || field.name === "line2" ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={`address-${field.name}`}>
                  {field.label}
                  {!field.required && <span className="text-muted-foreground"> (optional)</span>}
                </Label>                <Input
                  id={`address-${field.name}`}
                  autoComplete="off"
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                    setFieldError(field.name);
                  }}
                  aria-invalid={fieldErrors[field.name] !== undefined}
                />
                {fieldErrors[field.name] !== undefined && (
                  <p className="text-destructive text-sm">{fieldErrors[field.name]}</p>
                )}
              </div>
            ))}
          </div>
          {formError !== null && <p className="text-destructive text-sm">{formError}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}