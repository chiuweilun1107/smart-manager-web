# Optimization Goal

Reduce unused JS in the shared chunk `fd9d1056` from ~41% to below 10% (score > 90), by eliminating code that is bundled into the shared chunk but not needed on initial render of any given route.

# Asset Description

`fd9d1056-9f91b5e418130764.js` is a Next.js 14 shared vendor/framework chunk generated during `next build`. It is loaded on every audited route (login, dashboard, approvals, notifications, not-found, etc.). Lighthouse reports that approximately 40.9% of its bytes are unused at parse time across all routes, representing ~22-23 KiB of wasted transfer per page load. The project is a Next.js 14 App Router app (`aido-system`) using `@supabase/ssr` ^0.5.1 and `@supabase/supabase-js` ^2.45.4, with React 18 and Tailwind CSS. The browser Supabase client (`lib/supabase/client.ts`) is unconditionally imported with `'use client'`, causing `@supabase/ssr` browser utilities to be pulled into the shared chunk even on routes that do not need them on initial render.

# What you MAY change

- `next.config.mjs` — add `@next/bundle-analyzer`, configure `experimental.optimizePackageImports`, add webpack `splitChunks` overrides
- `lib/supabase/client.ts` — convert `createClient()` to a lazy/dynamic pattern so the browser Supabase client is not imported at module evaluation time on server-rendered or unauthenticated routes
- Any file in `app/`, `components/`, or `lib/` that unconditionally imports Supabase browser client at the top level — wrap with dynamic `import()` or move to a Client Component boundary that is only hydrated post-auth
- `app/layout.tsx` and route group layouts — ensure no top-level import of `@supabase/ssr` browser utilities pulls the full SSR bundle into the shared chunk
- `package.json` devDependencies — add `@next/bundle-analyzer` (dev only)
- Route-level components that import heavy shared utilities not needed on initial paint — move to `dynamic(() => import(...), { ssr: false })` or split into separate chunks
- `middleware.ts` imports — verify that no client-side-only code paths bleed into the middleware bundle and back into the shared chunk

# What you MUST NOT change

- Runtime behaviour and authentication flow: users must still be able to log in, and all protected routes must still redirect unauthenticated users
- API routes under `app/api/` — logic and response shape must remain identical
- `lib/supabase/server.ts` server client (`createClient`, `createServiceClient`, `aido`) — server-side Supabase access patterns must not break
- `supabase/` directory — schema, migrations, and seed files are out of scope
- `score.py` — the scoring script must not be modified
- Existing Lighthouse JSON report files (`lh-*.json`) — these are baseline measurement artefacts; do not delete or overwrite them (new post-optimisation reports should be written as separate files)
- Environment variables consumed by the app (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- TypeScript types and interfaces exported from `lib/` that are consumed across the codebase
- `tailwind.config.js`, `postcss.config.js`, `tsconfig.json` — build tooling config unrelated to JS bundling

# Strategy hints

1. **Dynamic-import the Supabase browser client**: In `lib/supabase/client.ts`, the `createBrowserClient` from `@supabase/ssr` is imported unconditionally with `'use client'`, causing Next.js to pull `@supabase/ssr` client utilities into the shared chunk that every route loads. Refactor components that call `createClient()` to use `const { createClient } = await import('@/lib/supabase/client')` inside event handlers or `useEffect`, keeping the heavy auth utilities out of the initial bundle.

2. **Enable `@next/bundle-analyzer` and `experimental.optimizePackageImports`**: Add `optimizePackageImports: ['@supabase/ssr', '@supabase/supabase-js']` to `next.config.mjs` so Next.js tree-shakes sub-paths instead of importing entire packages. Then run `ANALYZE=true next build` to inspect which modules are actually pulled into `fd9d1056` and identify the largest contributors to the unused slice.

3. **Audit top-level layout imports**: Check `app/layout.tsx` and `app/(system)/layout.tsx` for any component or utility that imports Supabase or other large libraries at module scope. Move those imports behind `dynamic()` with `ssr: false` where the functionality is not needed on first render (e.g., auth state listeners, real-time subscriptions), preventing them from being hoisted into the shared chunk.

# Quality bar

- `score.py` output > 90 (i.e., avg `wastedPercent` of chunk `fd9d1056` across all `lh-*.json` route reports is below 10%)
- No existing route returns a non-200 HTTP status that was 200 before the change
- `next build` completes without TypeScript errors (`tsc --noEmit` exits 0)
- Total JS transfer per page does not increase (the optimisation must not create more chunks than it removes bytes)
