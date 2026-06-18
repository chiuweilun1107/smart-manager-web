# Optimization Goal
Eliminate @supabase/ssr from middleware.ts and replace with native next/server cookie reads + lightweight JWT decode to shrink Edge Runtime bundle size and remove Edge-incompatible patterns.

# Asset Description
`middleware.ts` is a Next.js Edge Runtime middleware that guards all routes except static assets. It currently uses `createServerClient` from `@supabase/ssr` to call `supabase.auth.getUser()`, which makes a network round-trip to Supabase and pulls in a heavy SDK that references Node.js `process.version` — incompatible with the Edge Runtime. The middleware enforces two redirect rules: unauthenticated users are sent to `/login`; authenticated users already on `/login` are bounced to `/dashboard`.

# What you MAY change
- Replace `import { createServerClient } from '@supabase/ssr'` with lightweight alternatives (no import at all, or `jose`, or plain `atob`).
- Replace `supabase.auth.getUser()` with a direct cookie read: Supabase stores the session JWT in a cookie named `sb-<project-ref>-auth-token` (base64url JSON) or split across `sb-<ref>-auth-token.0` / `.1` chunks.
- Decode the JWT payload locally using `atob()` (available in Edge Runtime) or the `jose` package to verify expiry without a network call.
- Reduce total line count — target ≤ 20 lines.
- Remove the `supabaseResponse` pattern (cookie forwarding) if it is no longer needed once the SDK is gone.
- Keep or inline the `config.matcher` export unchanged.

# What you MUST NOT change
- The two redirect invariants must be preserved exactly:
  1. Unauthenticated user on any route except `/login` and `/api/seed` → redirect to `/login`.
  2. Authenticated user on `/login` → redirect to `/dashboard`.
- The `config.matcher` pattern `['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)']` must remain identical.
- The middleware must remain an Edge Runtime function (no `export const runtime = 'nodejs'`).
- Do not break the `/api/seed` bypass.
- Do not introduce server-side secrets or hard-coded project refs that differ between environments — read from `process.env.NEXT_PUBLIC_SUPABASE_URL` if a project ref is needed (it can be parsed from the URL).

# Strategy hints
1. **Cookie-direct + atob decode (zero new deps):** Read `request.cookies.get('sb-<ref>-auth-token')` (or iterate all cookies matching `sb-*-auth-token`), base64url-decode the JWT payload with `atob()`, and check `exp > Date.now()/1000`. This uses only `next/server` — no extra imports, max score bonus.
2. **Parse project ref from env URL:** Derive the Supabase project ref with `new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]` to build the exact cookie name dynamically, avoiding hard-coding.
3. **Guard against split cookies:** Supabase `@supabase/ssr` v0.5+ may split large tokens across `.0` / `.1` suffixes; concatenate them before decoding if `sb-<ref>-auth-token` is absent but `.0` is present.

# Quality bar
- Score (score.py) >= 90 out of 100.
- Zero imports from outside `next/server` (or at most `jose` if atob is insufficient — costs -5 but avoids -30/-20 from @supabase/ssr).
- Total lines <= 25 (ideally <= 20).
- No `@supabase/ssr` import.
- No `createServerClient` usage.
- Both redirect invariants pass a manual trace through the new logic.
