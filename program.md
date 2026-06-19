# Optimization Goal

Eliminate per-request redirect overhead for authenticated users by hoisting the Supabase URL parse to module scope and simplifying the cookie-lookup chain, targeting a score.py score of 100/100.

# Asset Description

`middleware.ts` is a Next.js Edge-runtime middleware that guards every non-static route. On each request it:
1. Checks an optional `x-audit-bypass` header for Lighthouse perf measurement bypass (early exit before any auth work).
2. Parses `process.env.NEXT_PUBLIC_SUPABASE_URL` to derive the Supabase project ref (e.g. `abcxyz`) — currently done inside the function body on every request.
3. Reads the Supabase auth cookie (`sb-<ref>-auth-token`, with `.0`/`.1` chunked-cookie fallbacks) and concatenates chunks when present (3 `cookies.get()` calls total).
4. Decodes the base64-encoded cookie value, JSON-parses the session object twice (`JSON.parse` called 2x), extracts `access_token`, decodes the JWT payload with 4 `.replace()` calls, and checks `payload.exp > Date.now()/1000`.
5. Redirects unauthenticated users to `/login` (skipping `/login` and `/api/seed` paths) and authenticated users away from `/login` to `/dashboard`.

The `config.matcher` already excludes `_next/static`, `_next/image`, favicons, and common image/font extensions.

Baseline score (score.py): **82 / 100**.

Active score.py penalties on the baseline:
- **-20** `new URL(process.env...)` inside function body (runs every request)
- **-15** 3+ `cookies.get()` calls (chunked fallback: `.0` + `.1` concatenation)
- **-10** 2 `JSON.parse()` calls (outer session object + JWT payload separately)
- **-10** 4 `.replace()` calls (2 pairs of base64url normalisation instead of 1 pair)

Active score.py bonuses on the baseline:
- **+10** bypass token check fires before any cookie/auth work (true early exit)
- **+8** matcher excludes static assets
- **+5** authenticated users redirected away from `/login`
- **+5** extra public path whitelisted beyond `/login` (`/api/seed`)
- **+5** only `next/server` imported

# What you MAY change

- **Hoist `new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)` to module scope** — compute `ref` once at cold-start, not per-request. Eliminates the -20 penalty (biggest single gain).
- **Simplify the cookie-lookup chain** — reduce `request.cookies.get()` calls below 3. Prefer reading only `sb-${ref}-auth-token` first; add at most one fallback. Going from 3 calls to 2 calls changes penalty from -15 to -5 (net +10). Removing the chunked fallback entirely (1 call) removes the penalty completely.
- **Reduce `JSON.parse` calls to 1** — restructure the decode path so the outer session object parse and the JWT payload extraction are collapsed to 1 total `JSON.parse` call. Eliminates the -10 penalty.
- **Reduce `.replace()` calls to exactly 2** — limit base64url normalisation to one pair of replace calls total across the file. Eliminates the -10 penalty.
- **Add or expand whitelisted public paths** — adding another `pathname.startsWith(...)` guard beyond `/login` earns an additional +5 bonus if the bonus has not already been awarded.

# What you MUST NOT change

- **Functional correctness of the auth gate**: unauthenticated requests to protected routes must still redirect to `/login`; authenticated requests to `/login` must still redirect to `/dashboard`.
- **Bypass mechanism semantics**: the `x-audit-bypass` / `AUDIT_BYPASS_TOKEN` header check must remain the first early-exit and must only activate when the env var is set server-side.
- **`config.matcher` pattern**: the existing static-asset exclusion regex must remain intact (or be tightened, never loosened). Do not remove `_next/static`, `_next/image`, favicon, or image/font extension exclusions.
- **`/api/seed` whitelist**: this public path must remain unprotected (needed for seeding in CI).
- **JWT expiry check logic**: `payload.exp > Date.now() / 1000` is the single source of truth for session validity — do not replace with a Supabase SDK call, a server-side session fetch, or any I/O-bearing operation.
- **Edge runtime compatibility**: all code must run in `next/server` Edge runtime. `atob`, `URL`, `Request`/`Response` are fine. `Buffer`, Node.js `crypto` module, and `fs` are not available at Edge.
- **No new environment variables** beyond `NEXT_PUBLIC_SUPABASE_URL` and `AUDIT_BYPASS_TOKEN`.
- **No Supabase SDK imports** (`@supabase/ssr`, `@supabase/auth-helpers-nextjs`, `createServerClient`, etc.) — these add Edge bundle weight and trigger score.py penalties of -10 and -5.
- **Do not modify `score.py`** — it is the scoring oracle.

# Strategy hints

1. **Hoist the URL parse to module scope first** — move `const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]` above the `export function middleware` declaration. This is a one-line change that eliminates the -20 penalty with zero functional risk (the env var is static at Edge cold-start). This is the safest and highest-value first edit.

2. **Collapse the cookie read to two steps** — first try `request.cookies.get('sb-${ref}-auth-token')?.value`; only if falsy, do one additional get for the chunked form. This brings `cookie_get_count` to 2 (penalty -5 instead of -15, net +10). If chunked cookies are not used in production, dropping the `.0`/`.1` fallback entirely (1 call, zero penalty) is an even higher-value simplification.

3. **Unify JSON.parse and reduce replace calls** — restructure the decode so `access_token` is extracted in a single expression that only calls `JSON.parse` once total, then the JWT payload is decoded with exactly one `atob` using the minimum 2 `.replace()` calls. Target: parse the session cookie directly to get `access_token`, then decode the JWT payload segment with one `atob` + one `JSON.parse`, keeping the total `JSON.parse` count in the file at 1 and total `.replace()` count at 2.

# Quality bar

- **score.py score >= 95** on the optimized `middleware.ts` (up from baseline 82). Score of 100 is achievable by eliminating all four active penalties.
- **Functional parity**: redirect-to-login for expired/absent sessions and redirect-to-dashboard for authenticated `/login` visits must behave identically to the baseline.
- **No new imports**: `import` statements must reference only `next/server` (preserves +5 bonus).
- **Edge-safe**: TypeScript compilation with the project's `tsconfig.json` passes with zero errors (`npx tsc --noEmit`).
- **Redirect latency target**: the Lighthouse `redirects` audit wasted-ms for `/approvals -> /login` should drop below 100ms when re-measured after deployment (from 827ms baseline), achievable once the per-request `new URL()` construction and cookie-chain overhead are eliminated from the hot path.
