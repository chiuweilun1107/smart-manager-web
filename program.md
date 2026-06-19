# Optimization Goal
Eliminate render-blocking CSS by configuring critters (via `experimental.critters` in next.config.mjs) to inline critical CSS and defer non-critical stylesheets, so no CSS file blocks first paint.

# Asset Description
`next.config.mjs` is the Next.js build configuration file. It currently enables `experimental.optimizeCss: true` and an empty `experimental.critters: {}` object. The critters integration inlines critical-path CSS into `<style>` tags and converts the original `<link rel="stylesheet">` to a non-blocking preload, but the empty critters config leaves several deferral and pruning options disabled. Lighthouse audits flag `_next/static/css/35bb91ee4f5a4120.css` (4.2–4.3 kB transfer) as render-blocking across all four measured routes, delaying first paint by ~39ms. `score.py` statically parses `next.config.mjs` and awards fractional points for each critters sub-option that is present.

# What you MAY change
- Add options inside the `critters: {}` object in `next.config.mjs` to improve inlining and deferral:
  - `preload` — controls how non-critical CSS is loaded after inlining (e.g., `"swap"` defers via `rel=preload`); worth +0.15 in score.py
  - `pruneSource` — removes already-inlined rules from the external stylesheet to shrink the deferred payload; worth +0.10
  - `mergeStylesheets` — merges multiple stylesheets into one to reduce request count; worth +0.10
  - `additionalStylesheets` — explicitly list critical asset paths for critters to process; worth +0.10
  - `inlineFonts` or `preloadFonts` — avoid font FOIT by inlining or preloading `@font-face` rules; worth +0.05
- Keep `optimizeCss: true` (already present, worth +0.30 in score.py)
- Keep the `critters:` key (already present, worth +0.20 in score.py)

# What you MUST NOT change
- Do not remove `experimental.optimizeCss: true` — removing it collapses the score by 0.30
- Do not remove the `critters:` key — required for the +0.20 bonus
- Do not change the overall file structure: the file must remain a valid ES module (`export default nextConfig`)
- Do not add unrelated Next.js config options that could break the existing app (do not alter `images`, `rewrites`, `headers`, or other unrelated keys unless they are part of the critters options above)
- Do not introduce CommonJS `require()` syntax — keep ESM
- Do not modify `score.py` — it is the scoring oracle

# Strategy hints
1. **Expand critters in one edit**: Replace `critters: {}` with a fully populated object — `critters: { preload: "swap", pruneSource: true, mergeStylesheets: true, additionalStylesheets: [], preloadFonts: true }`. This single change takes score.py from 0.50 (optimizeCss + critters keys only) to 1.00 (all signals present), clearing the quality bar in one step.
2. **Add `preload: "swap"` first (highest single-option gain)**: Setting `preload: "swap"` tells critters to emit `<link rel="preload" as="style" onload="this.rel='stylesheet'">`, deferring non-critical CSS after paint. At +0.15 it is the highest-value individual option; add it first if doing incremental changes.
3. **Pair `pruneSource: true` + `mergeStylesheets: true`**: `pruneSource` shrinks the deferred stylesheet by stripping already-inlined rules, and `mergeStylesheets` reduces the number of separate HTTP requests for stylesheets. Together they add +0.20 and directly address the "CSS file still present" issue critters leaves behind without them.

# Quality bar
- `python3 score.py next.config.mjs` outputs **1.0** (all scoring signals detected)
- `optimizeCss: true` and the `critters:` key are both present
- At minimum `preload`, `pruneSource`, and `mergeStylesheets` are set inside `critters: {}`
- `next.config.mjs` remains a valid ES module — `node --check next.config.mjs` passes
- No render-blocking CSS flag in Lighthouse audits (stretch goal; static score >= 0.90 is the primary measurable bar)
