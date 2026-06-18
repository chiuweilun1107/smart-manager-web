# Optimization Goal
Move Supabase client initialization and DEMO_ACCOUNTS out of module/render scope so they are deferred until actual user interaction, reducing login page First Load JS from ~154 kB to parity with other pages (~97 kB).

# Asset Description
`app/(auth)/login/page.tsx` is a Next.js 'use client' login page that:
- Statically imports `createClient` from `@/lib/supabase/client` at module scope (top-level `import`)
- Instantiates the Supabase client at component render scope: `const supabase = createClient()` inside the component body (runs on every render)
- Declares `DEMO_ACCOUNTS` (12 demo credential objects) as a module-level `const` (zero-indent, parsed at bundle load time)
- Has one async event handler `handleLogin` that calls `supabase.auth.signInWithPassword`
- Uses `fillDemo` to populate email/password fields from DEMO_ACCOUNTS

# What you MAY change
- Remove the top-level `import { createClient } from '@/lib/supabase/client'` and replace with a dynamic import (`const { createClient } = await import('@/lib/supabase/client')`) inside the `handleLogin` async handler
- Move `const supabase = createClient()` from component body into `handleLogin` (lazy init on first login attempt)
- Move `DEMO_ACCOUNTS` inside the component function body (indented, not module-scope) OR wrap it in a `useMemo` / `useRef` / lazy initializer so it is not at zero-indent module scope
- Change `const supabase = createClient()` to be created inside the event handler each call, or store in a `useRef` so it is initialized lazily on first interaction
- Add or adjust TypeScript types as needed when restructuring
- Reorganize imports (remove static `createClient` import, keep `useState`, `FormEvent`, `useRouter`)

# What you MUST NOT change
- The visual UI must remain identical: same layout, same Tailwind classes, same labels and placeholder text (Chinese content preserved)
- `handleLogin` must still call `supabase.auth.signInWithPassword({ email, password: pwd })` and on success navigate to `/dashboard` with `router.refresh()`
- `handleLogin` must still set `loading` state (`setLoading(true)` before call, `setLoading(false)` after)
- `handleLogin` must still set `err` state on error
- The demo account fill functionality (`fillDemo`) must still work: clicking a demo button populates email and password fields
- All 12 demo accounts must still be available and renderable in the grid
- The form must still be a controlled component with `email` and `pwd` state
- The `'use client'` directive must stay at the top of the file
- `useRouter` import from `next/navigation` must stay (used for navigation after login)
- Do NOT introduce new dependencies not already in the project
- Do NOT break TypeScript types (file must pass tsc)

# Strategy hints
1. **Dynamic import createClient inside handler**: Replace `import { createClient } from '@/lib/supabase/client'` with an inline `const { createClient } = await import('@/lib/supabase/client')` at the top of `handleLogin`. This eliminates the static top-level import (scores criterion B +30) and moves client creation into the handler (scores criterion A +35).
2. **Move DEMO_ACCOUNTS inside component**: Indent `const DEMO_ACCOUNTS = [...]` by 2 spaces so it is declared inside `LoginPage()` function body rather than at module scope. This scores criterion C +15 without any runtime cost. Alternatively, extract to a separate non-SDK file that can be tree-shaken.
3. **Remove render-scope createClient call**: After applying hint 1, there will be no `const supabase = createClient()` in the component body at all — the client is created lazily inside `handleLogin` only when the user submits the form. This avoids initializing the heavy Supabase browser SDK during SSG/SSR or on page render.

# Quality bar
- Static analysis score (score.py): **>= 90 / 100**
- Baseline score: 20 / 100
- Target breakdown: A (+35) + B (+30) + C (+15) + D (+10, already present) + E (+10) = 100
- The page must render without runtime errors in a Next.js 14+ app
- No new ESLint errors introduced
- Login flow must work end-to-end: form submit → Supabase auth → redirect to /dashboard
