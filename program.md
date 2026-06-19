# Optimization Goal
Activate the AUDIT_BYPASS_TOKEN mechanism in middleware.ts so Lighthouse can reach /approvals, /dashboard, and /notifications as authenticated pages instead of being redirected to /login, producing performance scores that reflect actual page content.

# Asset Description
`middleware.ts` is a Next.js Edge Runtime middleware that guards all protected routes. It reads a Supabase session JWT from cookies and redirects unauthenticated requests to `/login`. It already contains an AUDIT_BYPASS_TOKEN bypass: when the `x-audit-bypass` request header matches the `AUDIT_BYPASS_TOKEN` environment variable, the middleware calls `NextResponse.next()` immediately without checking authentication. This bypass was present but inactive during all Lighthouse runs because `AUDIT_BYPASS_TOKEN` was not set in the deployment environment, so every request to `/approvals`, `/dashboard`, and `/notifications` landed on `/login` instead.

# What you MAY change
- Set (or ensure) the `AUDIT_BYPASS_TOKEN` environment variable is present in the deployment environment (e.g., Vercel environment variables) so the bypass condition `process.env.AUDIT_BYPASS_TOKEN` evaluates to truthy.
- Adjust the bypass check logic in middleware.ts if the current implementation has gaps — e.g., the header comparison uses `===` which requires an exact token match; ensure the token value used by the Lighthouse runner matches what the env var is set to.
- Extend the bypass to also skip the authenticated-on-login redirect (line 32–33) so a bypass request to `/login` is not bounced away.
- Add or update the Lighthouse runner configuration to inject `x-audit-bypass: <token>` as an extra HTTP header when auditing protected routes.
- Update `lh-approvals.json`, `lh-dashboard.json`, and `lh-notifications.json` by re-running Lighthouse with the bypass header active, so the JSON reports reflect actual page content (finalUrl matches requestedUrl, no runWarning about redirect).

# What you MUST NOT change
- The two core redirect invariants must be preserved for all non-bypass requests:
  1. Unauthenticated user on any route except `/login` and `/api/seed` → redirect to `/login`.
  2. Authenticated user on `/login` → redirect to `/dashboard`.
- The `config.matcher` pattern must remain identical — do not alter which routes the middleware covers.
- The middleware must remain an Edge Runtime function; do not add `export const runtime = 'nodejs'`.
- Do not hard-code auth tokens or session cookies — the bypass must be header+env-var gated, not open to the public.
- Do not remove the bypass guard (`bypassToken === process.env.AUDIT_BYPASS_TOKEN`); the bypass must require a secret token match, not just any header value.
- Do not break the `/api/seed` route exemption.
- The cookie-based authentication logic (JWT decode from `sb-<ref>-auth-token`) must remain correct for normal (non-bypass) requests.

# Strategy hints
1. **Set AUDIT_BYPASS_TOKEN in Vercel and re-run Lighthouse with the header:** Add `AUDIT_BYPASS_TOKEN=<random-secret>` to the Vercel project environment variables, then re-run each Lighthouse audit with `--extra-headers '{"x-audit-bypass":"<secret>"}'`. The middleware bypass check on lines 7–10 will pass and the actual page will render.
2. **Verify the bypass covers both redirect branches:** The current bypass (line 9: `return NextResponse.next()`) skips the unauthenticated redirect but the authenticated-on-login redirect on lines 32–33 is after the bypass return, so it is already unreachable for bypass requests — confirm this is correct by tracing the control flow.
3. **Update Lighthouse JSON reports after bypass is active:** Replace `lh-approvals.json`, `lh-dashboard.json`, and `lh-notifications.json` with new runs where `requestedUrl === finalUrl` and `runWarnings` is empty. The score.py reads these files; accurate reports are prerequisites for a meaningful score.

# Quality bar
- All three protected-route Lighthouse JSON files have `finalUrl` matching `requestedUrl` (no redirect to `/login`).
- `runWarnings` array is empty in each protected-route report.
- Lighthouse performance scores for `/approvals`, `/dashboard`, and `/notifications` reflect actual page content, not the login page.
- The bypass only activates when both conditions are true: header `x-audit-bypass` is present AND its value equals `process.env.AUDIT_BYPASS_TOKEN` (non-empty).
- Normal unauthenticated browser requests (no bypass header) still redirect to `/login` — the auth wall is intact.
- score.py mean across all four pages (login + 3 protected) is >= 0.5 once real page data is captured.
