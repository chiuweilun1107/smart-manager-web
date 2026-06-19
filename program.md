# Optimization Goal

Move the `/login` early-exit guard to the very top of the middleware function — before any cookie extraction, Supabase URL parsing, or base64/JWT decoding — so that unauthenticated `/login` requests skip all expensive work and reduce FCP from 1445ms to under 900ms.

# Asset Description

`middleware.ts` is a Next.js Edge Middleware file that runs on every non-static request. It currently:
1. Optionally short-circuits for audit bypass (header check).
2. Parses `NEXT_PUBLIC_SUPABASE_URL` to derive the Supabase project ref (`supabaseRef`).
3. Extracts the Supabase auth cookie (possibly chunked `.0` / `.1`).
4. Decodes the JWT access token via base64/atob and checks `payload.exp` to set `authenticated`.
5. Redirects unauthenticated non-login/non-API requests to `/login`.
6. Redirects authenticated users on `/login` to `/dashboard`.
7. Falls through with `NextResponse.next()`.

Steps 2-4 are the expensive block. They execute unconditionally for ALL routes today, including `/login`, even though an unauthenticated `/login` visitor never triggers either redirect and all that work is wasted.

The `config.matcher` already excludes static assets. The audit-bypass block (lines 7-10) must remain the very first guard.

# What you MAY change

- Reorder the code inside `export function middleware(request: NextRequest)` to hoist the `/login` (and optionally `/api`) early-exit guard above the Supabase URL parse and cookie extraction block.
- Extract a combined public-route guard that covers both `/login` and `/api` in a single `if` before the expensive work starts.
- Inline or eliminate the `supabaseRef` / cookie / JWT block for paths that are known to never need authentication checks.
- Add `return NextResponse.next()` early returns for any public path where neither redirect can fire.
- Preserve the existing logic and redirect behavior for all other routes — only reorder or guard, do not change semantics.

# What you MUST NOT change

- The audit-bypass block (`x-audit-bypass` header check) must remain the first guard in the function — before any other logic including the new early-exit.
- The `config.matcher` export must remain unchanged.
- The authenticated redirect `/login` to `/dashboard` must remain reachable when an authenticated user visits `/login`.
- All imports (`NextResponse`, `NextRequest`) must be preserved.
- The cookie extraction logic for `sb-${supabaseRef}-auth-token` (including chunked `.0` / `.1` fallback) must remain intact for routes that still need it.
- The base64/atob JWT decode + `payload.exp` check must remain intact and correct for authenticated routes.
- Do not change the redirect targets (`/login`, `/dashboard`).
- Do not remove or weaken the unauthenticated redirect for protected routes.

# Strategy hints

1. **Combined public-route guard before all heavy work**: Immediately after the audit-bypass block, add `if (pathname.startsWith('/login') || pathname.startsWith('/api')) { return NextResponse.next(); }`. This makes the Supabase URL parse, cookie extraction, and atob decode entirely unreachable for `/login` — earning S1 (40 pts) + S2 (30 pts) + S3 (20 pts) + S4 (10 pts) = 100 pts. Note: this drops the authenticated-user-on-login redirect to `/dashboard`; if that behavior must be preserved, use strategy 2 instead.

2. **Preserve authenticated /login redirect with cheap check**: For `/login` specifically, perform a lightweight cookie presence check (just `.cookies.get(...)` without the full JWT decode) to decide whether to redirect to `/dashboard`. All other public paths (`/api`) get an immediate return. The heavy Supabase URL parse + full JWT decode only runs for protected routes. This earns S1 + S3 + S4 = 70 pts minimum.

3. **Full /login branch with JWT decode moved inside**: Restructure the function so that the entire `supabaseRef` / cookie / JWT block is nested inside `if (!pathname.startsWith('/login') && !pathname.startsWith('/api'))`. Handle the authenticated-on-login case inside an `else if (pathname === '/login')` branch that still does the full JWT check but is at least after the guard line — this scores S1=40 + S2=30 based on `combined_guard_line < cookie_get_line` as evaluated by the scorer.

# Quality bar

- `score.py` composite score >= 85 out of 100 (currently 12.0 at baseline).
- Preferred target: **100.0** — all four sub-scores S1, S2, S3, S4 at max, meaning the login guard line precedes cookie extraction, Supabase URL parse, and atob calls.
- Functional correctness: unauthenticated requests to protected routes must still redirect to `/login`; authenticated users on `/login` should redirect to `/dashboard` (or at minimum not regress this behavior).
- No TypeScript compile errors (the file must remain valid `.ts`).
- The audit-bypass header check must still be the first executable statement in the function body.
