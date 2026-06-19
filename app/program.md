# Optimization Goal
Eliminate wasted 404 favicon requests on every page load by serving a valid favicon.ico and declaring it in the Next.js metadata icons field.

# Asset Description
`app/layout.tsx` is the Next.js 13+ root layout file. It exports a `metadata` object (currently only `title` and `description`) consumed by Next.js to inject `<head>` tags site-wide, and wraps all routes in a shared `<html lang="zh-TW"><body>` shell. Modifying this file affects every page in the application. Currently there is no `icons` field in `metadata` and no `public/favicon.ico`, so every browser visit generates a wasted HTTP round-trip that returns 404 for `/favicon.ico`.

# What you MAY change
- Add an `icons` field to the existing `metadata` export in `app/layout.tsx`, e.g. `icons: { icon: '/favicon.ico' }` or `icons: '/favicon.ico'`
- Create the `public/` directory at the project root (`/Users/chiuyongren/Desktop/aido-web/public/`)
- Place a valid `favicon.ico` file at `public/favicon.ico` (any square ICO/PNG accepted by browsers; minimum 16x16)
- Both changes may be applied together to reach a full score of 1.0

# What you MUST NOT change
- The existing `title: 'AiDo 智行'` and `description: '企業行政管理平台'` fields inside `metadata` — do not remove or rename them
- The `RootLayout` component signature, JSX structure (`<html lang="zh-TW"><body>{children}</body></html>`), or default export
- The `globals.css` import — do not remove or reorder it
- Any files outside `app/layout.tsx` and the `public/` directory (middleware, API routes, other page files, `next.config.mjs`, etc.)
- The TypeScript type annotation `import type { Metadata } from 'next'` — keep the import intact
- The scorer file `app/score.py` must not be modified

# Strategy hints
1. **Dual approach (score 1.0)**: Add `icons: { icon: '/favicon.ico' }` to the `metadata` object in `layout.tsx`, AND create `public/favicon.ico` with a minimal valid ICO binary. This satisfies both scoring signals simultaneously and eliminates all favicon 404s.
2. **File-only (score 0.5)**: Drop a `public/favicon.ico` — Next.js auto-serves it at `/favicon.ico`, eliminating the 404 for the browser's default request, even without the metadata `icons` field.
3. **Metadata-only (score 0.5)**: Add `icons: '/favicon.ico'` to `metadata` with no file — Next.js injects a `<link rel="icon">` tag but browsers still fall back to requesting `/favicon.ico` directly; without the file a 404 still occurs for that direct request.

# Quality bar
- Score 1.0 (full coverage): `public/favicon.ico` exists as a readable file AND `layout.tsx` metadata contains an `icons:` field
- Score 0.5 (partial): either the file exists OR the icons field is declared
- Score 0.0: current baseline — no `public/favicon.ico`, no `icons` field in metadata
- Verification command: `python3 /Users/chiuyongren/Desktop/aido-web/app/score.py /Users/chiuyongren/Desktop/aido-web/app/layout.tsx` must print `1.0`
