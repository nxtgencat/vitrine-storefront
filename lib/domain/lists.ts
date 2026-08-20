/**
 * URL-state helpers (architecture.md §10). The storefront's only URL-held
 * list state is the product search `q`; the listing reads it from
 * `useSearchParams` and writes it back via `buildQuery`.
 */

export function stringParam(sp: URLSearchParams, name: string): string | undefined {
  const value = sp.get(name)?.trim();
  return value === "" ? undefined : value;
}

/** Serialize a params object, dropping undefined/null/empty values. */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(name, String(value));
  }
  const query = search.toString();
  return query === "" ? "" : `?${query}`;
}

/**
 * The `next` redirect target after auth (architecture.md §7): only an
 * internal path may be honored — never a scheme, and never a
 * protocol-relative URL (`//host`). Anything else falls back to null.
 */
export function safeNext(value: string | null): string | null {
  if (value === null) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}