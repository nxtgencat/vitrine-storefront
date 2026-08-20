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