# Vitrine Storefront — Build Plan (todo)

Phase-gated execution of `task.md`. One git commit per phase, `phase N: <slug>`, in order,
none bundling two phases. A phase is complete only when its named exit condition is green —
`bun run typecheck` + `bun run build` (+ the phase's named check), never "looks done."
Before starting any phase and before committing it, follow `AGENTS.md` §1.

**Read the Session Log (§ bottom) first — it is the source of truth for where work
stopped.**

---

## Phase 0 — Scaffolding

- [ ] Add deps: `bun add zod zustand`. `hono` deliberately not added (architecture.md §2).
- [ ] `lib/logger.ts`, `.env.example`, `.env.local`; `next.config.ts` `rewrites()`
      proxying `/api/:path*` to `{NEXT_PUBLIC_API_PROXY|NEXT_PUBLIC_API_BASE}`; verify
      `GET /api/health` through the proxy in dev.
- [ ] `lib/verify` hygiene script + `package.json` scripts (`dev`, `typecheck`, `build`,
      `ci`).
- [ ] Route groups + shell: `(public)` layout (SiteHeader with search + cart badge +
      account menu, SiteFooter), `(auth)/login` + `(auth)/signup` stubs, `(account)`
      guarded layout stub. Placeholder `(public)/page.tsx`. `bun run build` green.

**Exit:** `bun run ci` green on the shell + proxy; `/api/health` reachable through the
rewrite; route groups render. Commit `phase 0: scaffolding`.

## Phase 1 — API client, types, domain core

- [ ] `lib/types/*` — zod mirrors for **every** storefront module in api.md, written from
      the backend sources (api.md §6 rule); phase 1 covers session, cart, wishlist,
      address, product, order, checkout shapes (all used in later phases).
- [ ] `lib/api/client.ts`, `lib/api/errors.ts`, `lib/api/idempotency.ts`,
      `lib/api/requests.ts` (typed functions per api.md §1–§4).
- [ ] `lib/domain/money.ts`, `lib/domain/lifecycle.ts` (order statuses), `lib/domain/
      lists.ts` (URL search state).
- [ ] `stores/use-session.ts`, `stores/use-live.ts`, `stores/use-cart.ts`;
      `components/layout/*` (SiteHeader, SiteFooter, CartBadge, SearchBox),
      `components/shared/*` (EmptyState, ErrorState, ConfirmDialog, QtyStepper,
      StockBadge, PriceText).

**Exit:** typecheck-clean `lib/api` + stores; sign-in as a backend-created customer
hydrates the session store; `getCart` returns the server-recomputed rows. Commit
`phase 1: api-core`.

## Phase 2 — Auth & account shell

- [ ] `(auth)/login`, `(auth)/signup` — full forms (controlled, zod, error surfaces),
      redirect to `next`.
- [ ] `(account)/layout.tsx` — server session guard; header account menu shows name +
      sign-out; 401 rehydrate path (architecture.md §6).
- [ ] `/cart` page — server-recomputed cart rows, qty stepper, remove, totals verbatim,
      checkout button (gated on session + non-empty).

**Exit:** sign-up → auto-provisioned customer can sign in; guarded routes redirect
anonymous; cart round-trips (add via API, qty edit, remove). Commit `phase 2: auth-cart`.

## Phase 3 — Browse & product

- [ ] `(public)/page.tsx` — listing from `listStorefrontProducts({ q })` with URL search
      param + debounce, StockBadge, variant chips, wishlist toggle (session-gated),
      add-to-cart (session-gated → `/login?next=`).
- [ ] `(public)/product/[slug]/page.tsx` — detail, VariantPicker (`isInStock`-aware),
      media, add-to-cart, wishlist toggle state from `getWishlistItem`.
- [ ] Wishlist page `(account)/wishlist` (rows + add-to-cart + remove) and addresses page
      `(account)/addresses` (list/create/select-flag for checkout).

**Exit:** browse/search works live; product detail adds to cart; wishlist + addresses
round-trip; anonymous add-to-cart redirects to login. Commit `phase 3: browse`.

## Phase 4 — Checkout & orders

- [ ] `(account)/checkout` — refetch cart, address select/create, payment mode
      (cod/gateway), submit `checkout({ custAddressId, paymentMode })` with key.
- [ ] `(account)/checkout/result` — two render paths: **COD/confirmed** (receipt: order
      number, items, totals) and **gateway/pending** ("payment processing", subscribe to
      `order:{id}`, live-update to receipt/cancelled on event, refetch on reconnect).
- [ ] `(account)/orders` — own order list; `(account)/orders/[id]` — items, totals,
      timeline, cancel (pending only), return request form (confirmed only, validated ≤
      original).
- [ ] `lib/realtime` client wired on order detail + checkout result (subscribe, refetch on
      event, backoff reconnect, resubscribe).
- [ ] `insufficient_stock` checkout path → refetch cart, highlight lines; 429 handled.

**Exit:** COD checkout round-trips to a receipt and the order appears in /orders; gateway
mode shows "payment processing" and resolves to a receipt when the backend confirms (via
WS event or refetch); pending order cancels; return request round-trips to a draft.
Commit `phase 4: checkout-orders`.

## Phase 5 — Realtime hardening, hygiene, sign-off

- [ ] Full realtime client pass (connect, staff-auth-per-topic verified against customer
      rules, reconnect/resubscribe, live indicator in account shell).
- [ ] `verify:hygiene` final pass; `bun run ci` green; api.md/architecture.md updated to
      match the shipped tree; every phase's checkboxes verified; known-gap list (§bottom)
      revisited.

**Exit:** `bun run ci` green; a COD checkout from another session updates this session's
orders live; a gateway checkout's pending → confirmed transition lands without a manual
refresh; `bun run build` green from a cold state. Commit `phase 5: realtime-ops`.

---

## Session Log

The source of truth for where work stopped. One row per phase commit — date, phase, what
passed, what changed in the docs (if anything). Read this table first, every time, before
starting the next phase.

| Date | Phase | Note |
| ---- | ----- | ---- |

---

## Known backend gaps raised (not fixed here — surfaced to the operator at review)

1. **Gateway checkout is a placeholder in the frontend.** The backend's gateway path is
   webhook-driven (phase 8 backend) and there is no real provider yet; the storefront
   implements the documented pending→wait-on-`order:{id}` behavior and a manual
   "refresh" affordance, so a store can complete gateway orders via a future provider
   webhook with zero frontend changes.
2. **`GET /api/storefront/products` is non-paginated.** The listing is a bounded catalog
   read (`{ data }`); a large catalog returns one big page. The UI renders it directly
   (no client pagination) and treats search as the mitigation — per the backend's design.
3. **Product detail exposes no `isInStock`.** `GET /api/storefront/products/:slug`
   returns raw variant rows without the stock flag (only the listing adds it). The detail
   page therefore shows no stock state; stock is enforced by the backend at checkout
   (`409 insufficient_stock`).