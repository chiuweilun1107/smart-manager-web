# Optimization Goal

Enable `experimental.optimizeCss: true` in `next.config.mjs` so that Next.js uses the bundled `critters` package to inline critical CSS and load the global CSS chunk asynchronously, eliminating it as a render-blocking resource on every route.

# Asset Description

`next.config.mjs` is the root Next.js 14 configuration file for the `aido-system` project. It currently exports an empty config object (`const nextConfig = {}`), meaning no experimental or custom options are active. The project already has `critters@^0.0.23` in production dependencies — the package that Next.js's `optimizeCss` flag delegates to — but because the flag is absent the build pipeline never invokes it.

# What you MAY change

- `next.config.mjs`: add an `experimental` block containing `optimizeCss: true`
- No other file needs to change to satisfy the scoring criterion

# What you MUST NOT change

- Any file outside `next.config.mjs` (app code, components, Supabase config, Tailwind/PostCSS config, middleware, etc.)
- The existing `export default nextConfig` export shape — keep it as the default export
- `package.json` / `package-lock.json` — do not add or remove dependencies
- `score.py` and any `lh-*.json` Lighthouse report files
- The Next.js version constraint (`^14.2.15`) — `experimental.optimizeCss` is the correct flag for Next.js 14; do not upgrade to Next.js 15 (different flag name)

# Strategy hints

1. **Direct flag insertion** — replace the empty config object with one that adds `experimental: { optimizeCss: true }`. This is the single minimal change required and directly maps to the score.py detection logic (score 1.0).
2. **Verify via static analysis first** — after editing, run `python3 score.py next.config.mjs` (the scorer does a static string search for the flag, not a live build) to confirm the score flips to 1.0 before attempting a full rebuild.
3. **Build smoke-check (optional but recommended)** — run `npm run build` to confirm critters does not throw on the actual CSS output; if critters errors on a specific CSS construct (e.g., complex `:has()` selectors), narrow the scope with `experimental: { optimizeCss: { path: 'public' } }` or add a `critters` config key.

# Quality bar

- `score.py` returns **1.0** (flag present and correctly placed inside `experimental`)
- The rendered HTML `<head>` for `/login` contains a `<link rel="stylesheet">` that has been converted to `media="print" onload="this.media='all'"` pattern (or equivalent async load), confirming critters ran during build
- FCP on `/login` drops from ~1445 ms baseline toward the ~828 ms best-case routes (render-blocking CSS no longer on the critical path)
- No existing functionality is broken: `npm run build` exits 0 and `npm run type-check` passes
