# Optimization Goal

Eliminate all polyfill bytes for APIs natively supported in ES2022 browsers that are unnecessarily shipped by chunk 117-9bcfe95f89d4b2e1.js, reducing legacy-javascript-insight wastedBytes from 81,683 to 0 across all 7 Lighthouse route reports.

# Asset Description

`tsconfig.json` is the TypeScript compiler configuration for a Next.js 14 app (`aido-system`). It already sets `compilerOptions.target = "ES2022"` and `module = "esnext"`, which instructs the TypeScript compiler to emit modern JavaScript. However, `tsconfig.json` target only controls TypeScript's own output; it does not control the browser targets used by Next.js's SWC transpiler or any Babel preset-env configuration, which determines which polyfills get injected into the shared vendor chunk. The Lighthouse audit identifies chunk 117-9bcfe95f89d4b2e1.js (33 kB transfer / 124 kB resource) as shipping polyfills for five APIs that are natively available in all ES2022+ browsers: `Array.prototype.at`, `Array.prototype.flat`, `Array.prototype.flatMap`, `Object.fromEntries`, and `Object.hasOwn`. The chunk appears on every measured route (login, after-login, dashboard, approvals, notifications, not-found, root), confirming it is a shared entry-point chunk loaded universally.

# What you MAY change

- `tsconfig.json` — `compilerOptions.target` may be raised to a higher ES target (e.g., `"ES2023"` or `"ESNext"`) if needed; it must not be lowered below `"ES2022"` (score.py enforces -50000 penalty for non-ES2022+ target)
- `next.config.mjs` — add or modify `experimental` flags, webpack config overrides, compiler options, or SWC targets that control browser targeting and polyfill injection
- `.browserslistrc` (new file) — create a browserslist config that explicitly targets modern browsers, signaling to SWC and any browserslist-aware tool to skip polyfills for ES2019+ APIs
- `package.json` — add a `browserslist` field to configure browser targets globally across all tools that read browserslist
- `babel.config.js` / `.babelrc` (new file) — add a custom Babel config (only if the Babel pipeline contributes to this chunk) with explicit `targets` that exclude the five polyfilled APIs
- `postcss.config.js` — may be tuned (does not affect JS polyfills, but autoprefixer also reads browserslist)
- Webpack `resolve.alias` or `module.noParse` entries in `next.config.mjs` to alias out or skip polyfill source modules if they originate from a specific npm package within the chunk

# What you MUST NOT change

- `tsconfig.json` `compilerOptions.target` must remain `"ES2022"` or higher — dropping below ES2022 triggers a -50000 prerequisite score penalty in score.py
- The 7 Lighthouse report files (`lh-*.json`) — these are baseline measurement artifacts read by score.py and must not be modified
- `score.py` — the scoring harness must not be altered
- App functionality — all routes (login, dashboard, approvals, notifications, after-login, not-found, root) must continue to render and behave correctly
- `middleware.ts` — authentication cookie parsing, JWT validation, and redirect rules must remain intact
- Supabase integration (`@supabase/ssr`, `@supabase/supabase-js`) — authentication and data fetching behavior must be preserved
- `next.config.mjs` `experimental.optimizeCss: true` and the `critters: {}` key — CSS optimization is independent and must not be removed
- TypeScript strict mode and other non-target `compilerOptions` in `tsconfig.json` — these enforce code quality and must remain enabled
- `tailwind.config.js`, `postcss.config.js` (CSS pipeline structure) — these must remain intact
- `package.json` dependency list — do not add or remove npm packages (only configuration-level changes are in scope)

# Strategy hints

1. **Add a `.browserslistrc` targeting ES2022-capable browsers.** Next.js 14's SWC transpiler and any browserslist-aware tool respect a browserslist config file. Creating `.browserslistrc` with a query such as `last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions` (or `> 0.5%, last 2 versions, not dead, not IE 11, not op_mini all`) signals that `Array.prototype.at`, `flat`, `flatMap`, `Object.fromEntries`, and `Object.hasOwn` are all natively available, eliminating their polyfills from the shared vendor chunk. This is the lowest-risk, highest-impact change — no source code changes, only build targeting.

2. **Set explicit SWC compiler targets in `next.config.mjs`.** Next.js 14 uses SWC by default. Adding a `compiler` block or a webpack `target`/`env` option that explicitly sets minimum browser versions (e.g., Chrome 94+, Firefox 93+, Safari 15.4+, Edge 94+ — all supporting ES2022) tells the SWC bundler to skip polyfills for natively supported APIs. Specifically, adding `experimental: { browsersListForSwc: true }` or setting explicit engine targets in the SWC options causes the bundler to respect modern browser baselines rather than defaulting to a broad legacy target.

3. **Trace and alias the polyfill source module.** Since `package.json` has no explicit `core-js` or `@babel/polyfill` dependency, the polyfills likely originate from a transitive dependency compiled with an older Babel target (possibly Next.js's internal compiled modules or a `@supabase/*` transitive dep). Use `ANALYZE=true next build` with `@next/bundle-analyzer` or inspect `.next/static/chunks/117-*.js` directly to identify which `require('core-js/...')` call contributes the polyfills. Once identified, use `webpack.resolve.alias` in `next.config.mjs` to map the polyfill entry to an empty module (`false` or a no-op shim), exploiting the fact that these APIs already exist natively in the target browsers.

# Quality bar

- Score = 0.0 (perfect): `total wastedBytes` across all 7 `lh-*.json` files = 0 bytes; no `legacy-javascript-insight` items remain for chunk 117 or any other chunk
- Acceptable threshold: score >= -10000 (less than ~1.4 kB wasted per route on average), representing at least 87% reduction from baseline -81683
- Prerequisite: `tsconfig.json` `compilerOptions.target` must remain in `{"es2022", "es2023", "es2024", "es2025", "esnext"}` — score.py verifies this before computing the polyfill waste penalty
- The fix must apply to all 7 routes uniformly — chunk 117 is a shared vendor chunk loaded on every page, so a correct fix eliminates the waste on all routes simultaneously with a single configuration change
- Build must complete without errors (`next build` exits 0) and TypeScript type-check must pass (`tsc --noEmit` exits 0)
- No visible UI regression on any route; all pages must render correctly after the build configuration change
