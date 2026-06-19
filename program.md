# Optimization Goal

Eliminate the ~800ms redirect-chain penalty on unauthenticated requests by short-circuiting the JWT decode with a lightweight pre-auth signal, and returning 401 JSON for API/non-browser routes instead of a full redirect.

# Asset Description

`middleware.ts` is a Next.js Edge middleware that runs on every non-static request. For each request it:
1. Checks an optional Lighthouse audit-bypass header (`x-audit-bypass`).
2. Derives the Supabase project ref from `NEXT_PUBLIC_SUPABASE_URL`.
3. Reads the Supabase session cookie (handling both plain and base64-encoded multi-part variants: `sb-{ref}-auth-token`, `.0`, `.1`).
4. Decodes the JWT access_token (base64 atob + JSON.parse) to check `payload.exp`.
5. Redirects unauthenticated non-login, non-API requests to `/login` — producing the confirmed 780–803ms wasted redirect chains on `/_not-found`, `/approvals`, `/dashboard`, `/notifications`.
6. Redirects authenticated users who land on `/login` to `/dashboard`.
7. Falls through with `NextResponse.next()`.

The full decode runs on every matched request including server-side navigation, adding CPU cost inside the Edge runtime. `/login` itself has no redirect chain and is 617ms faster at FCP, confirming the redirect is the dominant overhead.

# What you MAY change

- Add a short-lived **pre-auth cookie** (e.g. `pa=1; Path=/; Max-Age=300; HttpOnly; SameSite=Lax`) set on the response when full JWT verification passes, and use its presence as an **early-exit shortcut** on subsequent requests to skip the entire Supabase URL parse + cookie extraction + JWT decode block.
- Add **`Accept: text/html` detection**: before issuing the `/login` redirect, check whether the caller is a browser navigation (`Accept` includes `text/html`). If not, return `NextResponse.json({ error: 'unauthorized' }, { status: 401 })` instead — eliminating redirect chains for programmatic/API callers.
- Add a **CDN-layer pre-auth signal**: set a response header (e.g. `X-Pre-Auth: 1`) on authenticated responses so a CDN edge rule can skip the middleware round-trip on repeat visits.
- Place the early-exit pre-auth cookie check **before** the JWT decode block so the hot path avoids the decode entirely.
- Tighten the `matcher` config to exclude `/_not-found` (one confirmed 780ms penalty source with zero logic change required).
- Keep, adjust, or extend the existing Lighthouse audit-bypass header check.

# What you MUST NOT change

- The redirect target for unauthenticated browser navigation must remain `/login`.
- The redirect of authenticated users from `/login` → `/dashboard` must be preserved.
- `/api/**` routes already pass through without redirect — this exemption must not be removed or narrowed.
- The Supabase cookie name pattern `sb-${supabaseRef}-auth-token` and its multi-part variant (`.0` / `.1`) must continue to be read correctly whenever a full decode is actually needed.
- `NEXT_PUBLIC_SUPABASE_URL` and `AUDIT_BYPASS_TOKEN` environment variable names must not be renamed.
- Static asset exclusions in `matcher` (`_next/static`, `_next/image`, `favicon.ico`, image/font extensions) must remain excluded.
- The `exp` check (`payload.exp > Date.now() / 1000`) is the source of truth for token validity — do not remove or weaken it.
- Do not introduce `npm` / `package.json` dependency changes that require a build step; the middleware must remain a single self-contained TypeScript file runnable in the Edge runtime.
- Do not remove the audit-bypass header block (`x-audit-bypass` / `AUDIT_BYPASS_TOKEN`).

# Strategy hints

1. **Pre-auth cookie shortcut (highest impact):** After a successful JWT decode, set `Set-Cookie: pa=1; Path=/; Max-Age=300; HttpOnly; SameSite=Lax` on the `NextResponse.next()` response. At the very top of the function body (right after the audit-bypass check), if `request.cookies.get('pa')?.value === '1'`, return `NextResponse.next()` immediately — cutting all decode cost and eliminating the redirect for the penalty routes on repeat visits.

2. **`Accept: text/html` discrimination:** Before issuing the `/login` redirect, check `request.headers.get('accept')?.includes('text/html')`. If false, return `NextResponse.json({ error: 'unauthorized' }, { status: 401 })`. This removes the redirect chain for programmatic callers and keeps the redirect only for real browser navigations.

3. **CDN pre-auth response header:** On every successful `NextResponse.next()` for an authenticated request, call `response.headers.set('X-Pre-Auth', '1')`. A CDN edge rule can then cache this signal and skip the middleware on repeat authenticated visits entirely.

# Quality bar

- `score.py` static analysis score: **≥ 80 / 100**.
- The score.py rubric rewards: (1) pre-auth cookie shortcut present, (2) `Accept: text/html` detection present, (3) CDN-layer pre-auth signal (response header) present, (4) early-exit placed before JWT decode.
- Achieving all four optimizations = maximum score; three of four = acceptable minimum.
- Zero redirect chains for `/_not-found`, `/approvals`, `/dashboard`, `/notifications` in Lighthouse JSON (wastedMs = 0 on re-audit).
- No regression: authenticated users still reach protected routes; unauthenticated browser requests still land on `/login`; `/login` → `/dashboard` redirect for authenticated users preserved.
