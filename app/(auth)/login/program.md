# Optimization Goal
Prevent the (system) layout's Sidebar/TopBar components and their heavy transitive dependencies from being bundled into the shared vendor chunk (fd9d1056) that is shipped to every route including the lightweight /login page, so unused bytes per chunk drop below 10%.

# Asset Description
`app/(auth)/login/page.tsx` is a Next.js 'use client' login page. It currently scores **100/100** on score.py because it already defers `@/lib/supabase/client` via a dynamic `import()` inside the `handleLogin` async handler (no static top-level SDK import). The root cause of excess bytes on the /login route is not the login page itself.

`app/(system)/layout.tsx` is the server layout wrapping all authenticated routes. It statically imports `Sidebar` and `TopBar` from `@/components/`, which causes those components and their transitive dependencies (lib/rbac, lib/chains, lib/modules, @supabase/*) to be bundled into the shared synchronous chunk fd9d1056 (22.9 kB). Next.js ships this chunk to every route — including /login — because it appears in the shared dependency graph. That chunk ships 22.9 kB of code that /login never uses.

score.py (located here alongside page.tsx) evaluates any file passed as `sys.argv[1]`. When targeting `(system)/layout.tsx`, it starts at 100, subtracts 15 per heavy static import (Sidebar, TopBar, supabase, lib/rbac, lib/chains, lib/modules), and adds +20 if `dynamic(` is found and +10 if `<Suspense` is found. Current layout score: **70/100** (two -15 hits for Sidebar and TopBar).

# What you MAY change
- `app/(system)/layout.tsx` — replace static `import Sidebar` and `import TopBar` with `next/dynamic` lazy imports so these components are code-split into separate async chunks instead of the shared synchronous chunk.
- Add `<Suspense fallback={...}>` wrappers (or use the `loading` option of `next/dynamic`) around Sidebar and TopBar usage in the layout.
- `next.config.mjs` — optionally add `experimental.optimizePackageImports`, or custom `webpack.optimization.splitChunks` cache groups to further isolate system-layout chunks from auth-route chunks.
- Any component or lib file if strictly needed to support the lazy-loading refactor (e.g. client boundary splits).

# What you MUST NOT change
- `app/(auth)/login/page.tsx` — must remain exactly as-is; it already scores 100/100 and the auth flow (signInWithPassword, redirect to /dashboard, error handling, demo account fill) must be unaffected.
- All existing route paths (/login, /dashboard, /approvals, etc.) must remain functional.
- `app/layout.tsx` (root layout) — keep minimal as-is.
- `score.py` — do not modify the scoring script.
- Files under `app/api/` or `lib/` unless directly required; avoid broadening scope unnecessarily.
- Do NOT introduce new npm dependencies not already present in package.json.
- No TypeScript errors: changes must pass `tsc --noEmit`.

# Strategy hints
1. **next/dynamic for Sidebar and TopBar in (system)/layout.tsx**: Replace `import Sidebar from '@/components/Sidebar'` and `import TopBar from '@/components/TopBar'` with `const Sidebar = dynamic(() => import('@/components/Sidebar'))` and `const TopBar = dynamic(() => import('@/components/TopBar'))` using `next/dynamic`. Wrap their JSX usage in `<Suspense fallback={<div />}>`. This removes both -15 penalties and adds the +20 (`dynamic(`) and +10 (`<Suspense`) bonuses, pushing the layout score from 70 to 100.
2. **Verify chunk output**: After the change, run `next build` and inspect `.next/static/chunks/` — confirm that a new async chunk for Sidebar/TopBar appears and that the shared chunk no longer contains those modules. The /login route's JS payload should drop by roughly 22.9 kB.
3. **Custom splitChunks (optional, if dynamic alone is insufficient)**: Add a `webpack` config in `next.config.mjs` with a `splitChunks.cacheGroups` rule isolating `app/(system)/` modules into a dedicated `system-layout` chunk, preventing any residual bleed into the auth-route shared chunk.

# Quality bar
- `python3 score.py app/(system)/layout.tsx` must return >= 90.0 (current: 70.0; target: 100.0 after applying strategy 1).
- The shared chunk shipped to /login must not contain Sidebar, TopBar, or their direct deps.
- Login page loads and authenticates without regression (auth flow, demo buttons, error display all work).
- No new TypeScript errors (`tsc --noEmit` clean).
