# Optimization Goal

Minimize the client-side JavaScript bundle size (measured by "First Load JS shared by all" in kB) of this Next.js 14 application to improve page load performance and user experience. Current baseline: **92.6 kB**.

# Task Description

Optimize the Next.js 14 application to reduce the first load shared JavaScript bundle without breaking core functionality. The optimization process must:

1. Maintain full correctness of the application (verified via E2E tests)
2. Preserve the login flow and dashboard rendering
3. Ensure all approval workflows render without errors
4. Keep the application deployable and production-ready

# Strategy Hints

## 1. **Dependency & Module Optimization**
   - Analyze and remove unused dependencies from `package.json`
   - Use dynamic imports to defer non-critical features (lazy load route handlers, server utilities)
   - Consolidate overlapping polyfills and vendor code via `transpilePackages` configuration
   - Eliminate redundant CommonJS→ESM conversions in the module pipeline

## 2. **Next.js Configuration Tuning**
   - Optimize `next.config.mjs` for tree-shaking (SWC settings, experimental features, build flags)
   - Enable SWC minification and advanced compression strategies
   - Fine-tune source map generation (disable for production, use cheap variants for dev)
   - Review and adjust `experimental` features that impact bundle size

## 3. **Component & Code Structure**
   - Remove dead code and unused exports from `components/` and `app/`
   - Consolidate utility functions in `lib/bpm.ts` and `lib/rbac.ts` to reduce redundancy
   - Extract and memoize heavy computations to client-side boundary layers
   - Apply code-splitting at route level using Next.js layouts and dynamic imports

# Quality Bar

- ✅ **Bundle Reduction**: Target ≥ 15% reduction from 92.6 kB (goal: ≤ 78.7 kB or lower)
- ✅ **E2E Correctness**: All Playwright tests pass (login, dashboard render, approval workflows)
- ✅ **No Errors**: Console shows zero page errors; runtime exceptions fully handled
- ✅ **Production Ready**: Application builds cleanly with no warnings or deprecations
- ✅ **No Regressions**: All existing features remain functional; no blocking issues introduced
