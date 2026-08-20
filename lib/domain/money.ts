/**
 * Money domain (architecture.md §8). All money on the wire is INTEGER paise;
 * formatting never does float math. en-IN grouping is locale-driven, but the
 * compact formatter is manual because the ICU compact output for "thousands"
 * is "12T" (not "12K"), and the storefront's copy contract is K/L/Cr.
 *
 * The storefront never computes totals client-side — every price shown is a
 * price just returned by the API (architecture.md §8).
 */

export const PAISE_PER_RUPEE = 100;

/** `1234567` → "₹12,34,567"; paise shown only when nonzero (`₹1.50`). */
export function formatINR(paise: number): string {
  const rupees = Math.floor(Math.abs(paise) / PAISE_PER_RUPEE);
  const remainder = Math.abs(paise) % PAISE_PER_RUPEE;
  const sign = paise < 0 ? "-" : "";
  const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rupees);
  if (remainder === 0) return `${sign}₹${whole}`;
  const frac = String(remainder).padStart(2, "0");
  return `${sign}₹${whole}.${frac}`;
}

/** `1200000` → "₹12L", `12500` → "₹12.5K", `15000000` → "₹1.5Cr". */
export function formatINRCompact(paise: number): string {
  const abs = Math.abs(paise);
  const sign = paise < 0 ? "-" : "";

  const units: Array<{ divisor: number; label: string }> = [
    { divisor: 1_00_00_000, label: "Cr" },
    { divisor: 1_00_000, label: "L" },
    { divisor: 1_000, label: "K" },
  ];

  for (const unit of units) {
    if (abs >= unit.divisor) {
      const value = abs / unit.divisor;
      const whole = Math.floor(value);
      const fraction = Math.round((value - whole) * 10);
      if (fraction === 0) return `${sign}₹${whole}${unit.label}`;
      return `${sign}₹${whole}.${fraction}${unit.label}`;
    }
  }
  return formatINR(paise);
}