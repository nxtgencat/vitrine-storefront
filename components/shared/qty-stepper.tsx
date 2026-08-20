"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

/**
 * Quantity stepper for cart lines. Clamped to [1, max]; the backend enforces
 * the true stock cap (`insufficient_stock`), so `max` here is the soft cap
 * the UI knows (available stock or a purchase limit) and step changes still
 * go through the API.
 */
export function QtyStepper({
  value,
  min = 1,
  max = 99,
  disabled = false,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus />
      </Button>
      <span className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus />
      </Button>
    </div>
  );
}