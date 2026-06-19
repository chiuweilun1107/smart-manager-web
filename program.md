# Optimization Goal
Exclude /api/* routes from the Lighthouse audit scope so they never appear in lh-*.json reports and middleware.ts uses a blanket /api exclusion rather than only /api/seed.

# Asset Description
`middleware.ts` is a Next.js Edge middleware file that guards all non-static routes. It currently redirects unauthenticated requests to /login, but its public-route allowlist only exempts `/login` and `/api/seed` — leaving all other /api/* routes subject to auth redirect and not excluded as a group from the Lighthouse audit runner. The Lighthouse reports (lh-*.json) record which URLs were audited; score.py inspects those reports and middleware.ts to measure how completely /api/* routes are excluded from the audit pipeline. Baseline score: 70.0 (middleware lacks blanket /api exclusion, earns only 40+20+10 pts).

# What you MAY change
- `middleware.ts` — add a blanket `pathname.startsWith('/api')` check to the public-route allowlist so all API routes bypass auth redirect and are structurally excluded from middleware processing
- The Lighthouse audit runner or CI script that generates lh-*.json files — add a URL allowlist or denylist so any route matching `/api/*` is skipped before Lighthouse is invoked
- Any wrapper script (shell or Node) that calls Lighthouse in a loop — filter out /api/* from the list of URLs to audit
- `next.config.mjs` matcher or rewrites — if it controls which paths are fed to the audit runner
- Score-aggregation helpers that post-process lh-*.json — may add skip logic for /api/* paths (lower priority; does not earn the 30-pt blanket middleware criterion)

# What you MUST NOT change
- The authentication logic inside middleware.ts (JWT parsing, cookie reading, `authenticated` flag computation) — do not weaken or remove auth checks for non-API, non-login routes
- The Lighthouse audit bypass token mechanism (`x-audit-bypass` header + `AUDIT_BYPASS_TOKEN` env check) — leave intact
- The static-asset matcher in `export const config` — do not alter the regex that skips _next/static, images, fonts, favicon
- `score.py` — the scoring script is the evaluation oracle and must not be modified
- Existing lh-*.json report files that already target HTML routes — do not delete or alter them; they already contribute to the 40-pt and 10-pt criteria
- App source files under `app/`, `components/`, `lib/`, `public/` — this is a tooling/process fix, not an application logic change
- `package.json` / `package-lock.json` dependencies — do not add or remove npm packages

# Strategy hints
1. **Blanket /api exclusion in middleware.ts (fastest, +30 pts):** In the `if (!authenticated && ...)` guard on line 34, change `!pathname.startsWith('/api/seed')` to `!pathname.startsWith('/api')`. This satisfies the regex in score.py (`pathname.startsWith('/api')`) and keeps `/login` in the allowlist — earning both the 30-pt blanket criterion and confirming the 20-pt login+api criterion simultaneously, bringing score to 100.
2. **Audit runner URL filter (locks in 40 pts for future runs):** In whichever script generates the lh-*.json files, add a filter so URLs matching `/api/` are skipped entirely before Lighthouse is called. This ensures no future /api/* report files are created, permanently securing the 40-pt no-api-in-reports criterion.
3. **Verify HTML-only purity after changes (preserves 10 pts):** After applying the above, re-run the audit and confirm that `requestedUrl`, `finalUrl`, and `mainDocumentUrl` fields in all lh-*.json files contain only HTML-rendering paths — preserving the 10-pt html_purity criterion already earned.

# Quality bar
Score >= 100.0 (perfect) — all four criteria satisfied:
- 40 pts: zero /api/* routes appear as requestedUrl in any lh-*.json report
- 30 pts: middleware.ts contains a blanket `pathname.startsWith('/api')` exclusion (not just /api/seed)
- 20 pts: middleware.ts public-route allowlist includes both '/login' and '/api'
- 10 pts: all URL fields (requestedUrl, finalUrl, mainDocumentUrl) across all lh-*.json are HTML-only paths

Baseline is 70.0. Target is 100.0. The single highest-leverage change is replacing `/api/seed` with `/api` in the middleware.ts public-route allowlist (one line, +30 pts).
