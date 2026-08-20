# Vitrine Storefront — Build Plan (todo)

Phase-gated execution of `task.md`. One git commit per phase, `phase N: <slug>`, in order,
none bundling two phases. A phase is complete only when its named exit condition is green —
`bun run typecheck` + `bun run build` (+ the phase's named check), never "looks done."
Before starting any phase and before committing it, follow `AGENTS.md` §1.

**Read the Session Log (§ bottom) first — it is the source of truth for where work
stopped.**

---

## Phase 0 — Scaffolding

- [x] Add deps: `bun add zod zustand`. `hono` deliberately not added (architecture.md §2).
- [x] `lib/logger.ts`, `.env.example`, `.env.local`; `next.config.ts` `rewrites()`
      proxying `/api/:path*` to `{NEXT_PUBLIC_API_PROXY|NEXT_PUBLIC_API_BASE}`; verify
      `GET /api/health` through the proxy in dev.
- [x] `lib/verify` hygiene script + `package.json` scripts (`dev`, `typecheck`, `build`,
      `ci`).
- [x] Route groups + shell: `(public)` layout (SiteHeader with search + cart badge +
      account menu, SiteFooter), `(auth)/login` + `(auth)/signup` stubs, `(account)`
      guarded layout stub. Placeholder `(public)/page.tsx`. `bun run build` green.

**Exit:** `bun run ci` green on the shell + proxy; `/api/health` reachable through the
rewrite; route groups render. Commit `phase 0: scaffolding`.

## Phase 1 — API client, types, domain core

- [x] `lib/types/*` — zod mirrors for **every** storefront module in api.md, written from
      the backend sources (api.md §6 rule); phase 1 covers session, cart, wishlist,
      address, product, order, checkout shapes (all used in later phases).
- [x] `lib/api/client.ts`, `lib/api/errors.ts`, `lib/api/idempotency.ts`,
      `lib/api/requests.ts` (typed functions per api.md §1–§4).
- [x] `lib/domain/money.ts`, `lib/domain/lifecycle.ts` (order statuses), `lib/domain/
      lists.ts` (URL search state).
- [x] `stores/use-session.ts`, `stores/use-live.ts`, `stores/use-cart.ts`;
      `components/layout/*` (CartBadge wired to stores), `components/shared/*`
      (EmptyState, ErrorState, ConfirmDialog, QtyStepper, StockBadge, PriceText).

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
| 2026-08-20 | 0 — scaffolding | `bun run ci` green (typecheck + build + verify:hygiene); `/api/health` returns backend JSON through the dev rewrite; `/`, `/login`, `/signup` render 200. Docs updated in the same commit: architecture.md §3 — dev server port `:3000` (matches backend `ALLOWED_ORIGINS`) documented; §15 — dep-usage allowlist (`react-dom` as next's peer; `zod`/`zustand` declared phase 0, first import phase 1) added, only shrinks. Removed unused starter dep `date-fns` (hygiene: zero unused deps). `.gitignore` now allows committing `.env.example` (was swallowed by `.env*`). |
| 2026-08-20 | 1 — api-core | Full zod mirror set (`lib/types/{common,auth,product,cart,wishlist,address,order,returns,ops}.ts`), `lib/api/{client,errors,idempotency,requests}.ts`, `lib/domain/{money,lifecycle,lists}.ts`, `stores/{use-session,use-live,use-cart}.ts`, `components/shared/*` + CartBadge wired to the session/cart stores. Docs updated in the same commit: api.md §1 — `getSession` is `GET /api/auth/get-session` (better-auth registers `/get-session`, not `/session`; the old path 404s) and returns literal `null` when signed out; §1 — signUp/signIn return `{ token, user }`; §4 — checkout `invoice` is non-null (always created: COD issued, gateway draft); §6 — phase-1 verified shapes (cart rows, mutation responses). architecture.md §3/§7 — `/get-session` hydration; §8 — no `inputPaiseFromText` (storefront never inputs money); §15 — allowlist now exactly `react-dom` (`zod`/`zustand` removed in this commit, their first import). |
| 2026-08-20 | 2 — auth-cart | `bun run ci` green (typecheck + build + verify:hygiene); build route map shows `/cart` (ƒ server-rendered, guarded), `/login` + `/signup` static. **Live round-trip through the :3000 proxy → :3100 backend:** anonymous `/cart` → 307 → `/login`; sign-up via the form → 200 `{ token, user }` (auto-provisioned customer) + httpOnly cookie, redirect to `/`; header account menu hydrates on mount (avatar initials + name + email + Your cart + Sign out); cart round-trip — PUT qty 2 → server-recomputed `lineTotalPaise` 110000 (unit 55000), PUT qty 3 → 165000 on the same row (upsert, no duplicate), DELETE → empty; sign-out (with `Origin` header; better-auth CSRF-checked, 403 without it — a curl artifact, the browser sends Origin) → session null → `/cart` redirects again. Delivered: `lib/api/server-session.ts` (`getServerSession` — the app's only server-side fetch, mirrors dashboard; origin resolution API_SERVER_ORIGIN → NEXT_PUBLIC_API_PROXY → NEXT_PUBLIC_API_BASE → :3000), `app/(account)/layout.tsx` (async server guard, redirects anonymous, renders the site header/footer shell), `components/layout/account-menu.tsx` (session hydrate on mount — a real bug found live: a fresh page load showed "Sign in" for a signed-in customer because nothing hydrated the store — the server guard passed but the client never re-checked; fixed per architecture.md §7 "client-side shell re-checks for post-render races"), `components/cart/cart-line.tsx` (row renders the backend's verbatim `unitPricePaise`/`lineTotalPaise`, QtyStepper, remove), `app/(account)/cart/page.tsx` (`useQuery("cart", getCart)`, one-in-flight serialized idempotent mutations, invalidate cart query + badge store, EmptyState/ErrorState/loading states, checkout button gated on session (layout) + non-empty). Docs updated in the same commit: architecture.md §4 (lib/api listing + `server-session.ts`), §7 (server guard + client re-check + account menu hydration); api.md untouched (no new endpoints — cart/auth calls existed from phase 1); `safeNext` shared in lib/domain/lists.ts (login + signup both use it). |

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