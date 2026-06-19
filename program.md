# Optimization Goal
Reduce /login cold-start TTFB from 1152ms to under 800ms by eliminating unnecessary JWT decode work on public routes and replacing the auth-guard redirect chain with an edge rewrite.

# Asset Description
`middleware.ts` is a Next.js edge middleware that runs on every non-static request. It reads a Supabase auth-token cookie (chunked or single, base64 or plain JSON), extracts the JWT access_token via regex, base64-decodes the JWT payload, and checks `exp` against the current time. Unauthenticated requests to protected routes are redirected to `/login`; authenticated users hitting `/login` are redirected to `/dashboard`. An `x-audit-bypass` escape hatch short-circuits all auth logic when a matching secret header is present. Static assets are excluded from the matcher. Baseline score.py score: **0.65 / 1.00**.

# What you MAY change
- **Early bail for /login before any cookie read**: Insert a public-route check immediately after extracting `pathname` (and after the bypass-token check) so that `/login` returns `NextResponse.next()` with zero cookie reads or JWT decode work. This is the single highest-impact change for cold-start latency on the /login route.
- **Replace auth-guard `NextResponse.redirect` with `NextResponse.rewrite`**: For unauthenticated requests to protected routes, switch from `NextResponse.redirect(new URL('/login', request.url))` to `NextResponse.rewrite(new URL('/login', request.url))`. Rewrite renders the login page in-place without a client-visible HTTP redirect, collapsing the 2030ms HTML to CSS dependency chain shown in Lighthouse.
- **Public-route allowlist expansion**: Add additional `pathname.startsWith(...)` guards for known-public paths (e.g., `/api/...`, `/public/...`) to prevent the blanket redirect from firing on crawlers or API probes. score.py Feature 5 awards +0.10 for having both `/login` and `/api` exclusions.
- **Lazy cookie read**: Move cookie access inside the protected-route branch so it is never executed for requests that bail early on public routes.
- **Module-level constant hoisting**: Any per-request value that does not depend on the request object (e.g., compiled regex literals) can be moved to module scope so it is evaluated once at cold start, not per invocation.

# What you MUST NOT change
- **`config.matcher` pattern**: Must continue to exclude `_next/static`, `_next/image`, `favicon.ico`, and common image/font extensions (`png|svg|jpg|jpeg|webp|woff2|ico`). Removing these wastes middleware CPU on every asset request and breaks the score.py Feature 3 check.
- **`x-audit-bypass` escape hatch**: The header check (`x-audit-bypass` vs `process.env.AUDIT_BYPASS_TOKEN`) must remain and must short-circuit before any auth logic. Lighthouse uses this path; score.py Feature 1 requires all three: the header read, the env var check, and `NextResponse.next()`.
- **Cookie name convention**: Cookie names `sb-${supabaseRef}-auth-token` (single) and `.0`/`.1` chunked variants, with `supabaseRef` extracted from `NEXT_PUBLIC_SUPABASE_URL`, must be preserved. Supabase clients write these names; changing them breaks auth entirely.
- **JWT expiry check** (`payload.exp > Date.now() / 1000`): This is the security invariant. Must not be removed, weakened, or replaced with a truthy check.
- **`try/catch` around JWT decode**: Invalid or malformed tokens must silently produce `authenticated = false`, not surface an error to the user.
- **Authenticated-user redirect away from /login**: If a valid, non-expired token is present and the user reaches `/login`, they must still be sent to `/dashboard` (redirect or rewrite, but must not remain on /login).
- **Regex extraction shortcut**: The current approach using `match(/"access_token"...)` avoids full outer `JSON.parse`; do not regress to parsing the entire cookie value as JSON.
- **TypeScript / Next.js edge runtime compatibility**: The file must remain valid TypeScript that runs in the Next.js edge runtime. No Node.js-only APIs (`fs`, `crypto`, `Buffer` without polyfill, etc.).
- **Do not modify `score.py`**: It is the scoring oracle.

# Strategy hints
1. **Add /login early-exit first (highest ROI, zero risk)**: Insert `if (pathname === '/login') return NextResponse.next()` immediately after the bypass-token check and before the cookie read. This eliminates all JWT decode work on cold-start Lighthouse hits to /login, directly addressing the 550ms server response time for this route. All other routes are unaffected.
2. **Switch auth redirect to rewrite (score.py +0.35)**: Replace `NextResponse.redirect(new URL('/login', request.url))` with `NextResponse.rewrite(new URL('/login', request.url))`. This removes the client-visible redirect and eliminates the 2030ms HTML to CSS dependency chain. score.py awards full +0.35 when no `NextResponse.redirect(...)` targeting `/login` remains. The remaining authenticated-user redirect goes to `/dashboard` (not `/login`), so it does not match the scorer regex — the full +0.35 is achievable.
3. **Combine both changes in a single edit**: With the early-exit in place, unauthenticated users bypass JWT decode entirely for /login. The rewrite covers protected routes for unauthenticated visitors. Together these two edits move the score from 0.65 to 1.00 and cut /login TTFB by eliminating both the decode overhead and the redirect round trip.

# Quality bar
- **score.py output >= 0.95** when run against the modified `middleware.ts` (current baseline: 0.65; target: 1.00).
- **Lighthouse TTFB for /login < 800ms** (current: 1152ms; 44% above threshold).
- **Server response time for /login < 300ms** (current Lighthouse network-server-latency: 550ms on this route).
- All other routes remain at 632-667ms or better — no regression on protected-route latency.
- `tsc --noEmit` passes on the modified `middleware.ts` with no TypeScript errors.
- The `x-audit-bypass` escape hatch continues to short-circuit before any cookie read or JWT decode.
