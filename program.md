# Optimization Goal
Add a non-empty favicon file to the project so that every browser request resolves the favicon without a 404, achieving score.py score = 1.0.

# Asset Description
`next.config.mjs` is the Next.js configuration entry point for `aido-web` (aido-system), a TypeScript + Tailwind CSS enterprise admin platform built with Next.js 14, React 18, and Supabase authentication. The project currently has no `public/` directory and no favicon anywhere under `app/`, causing `score.py` to return 0.0. The middleware (`middleware.ts`) already excludes `favicon.ico` from auth redirection via the `config.matcher` pattern, so serving a favicon requires only dropping the file into the right location.

# What you MAY change
- Create `/public/favicon.ico` (or `/public/favicon.svg`, `/public/favicon.png`, `/public/favicon.webp`) — any non-empty file with one of these exact names in `/public/` satisfies score.py.
- Alternatively, place a favicon file directly under `/app/` (e.g., `/app/favicon.ico`) — Next.js App Router 13+ treats this as a special metadata file convention and serves it at `/favicon.ico` automatically.
- Create the `/public/` directory if it does not exist (it is currently absent).
- Optionally add or update `<link rel="icon">` metadata in `app/layout.tsx` for explicit browser control, without removing the existing `metadata` export.

# What you MUST NOT change
- Do NOT modify `middleware.ts` — the auth logic and `config.matcher` pattern are production-critical and must remain untouched.
- Do NOT modify `next.config.mjs` in a way that breaks existing `dev`, `build`, or `start` scripts.
- Do NOT remove or alter existing route files under `app/(auth)/` or `app/(system)/`.
- Do NOT alter `package.json` dependency list or scripts.
- Do NOT modify `score.py` — it is the scoring oracle.
- The favicon file MUST be non-empty (`score.py` rejects zero-byte files via `os.path.getsize(candidate) > 0`).
- The favicon filename MUST be exactly one of: `favicon.ico`, `favicon.svg`, `favicon.png`, `favicon.webp` — no other extensions are checked.

# Strategy hints
1. **Quickest win — SVG favicon**: Create `public/favicon.svg` with a minimal SVG (e.g., a small colored square or the letter "A" for AiDo). SVG is ~200 bytes, universally supported in modern browsers, and score.py accepts it. No binary encoding needed.
2. **App Router convention**: Place `app/favicon.ico` — Next.js 13+ App Router treats this as a special file and automatically serves it at `/favicon.ico` with no config changes. A valid minimal ICO binary is ~198 bytes (1x1 pixel).
3. **Static public directory**: Create `public/favicon.ico` as a real ICO file. Next.js serves everything in `public/` at the root path (`/favicon.ico`), which is what browsers request by default. This is the most universally compatible approach.

# Quality bar
- `python3 score.py next.config.mjs` prints `1.0` to stdout (current baseline is `0.0`).
- The favicon file exists on disk and `os.path.getsize(candidate) > 0` (non-empty).
- `next build` completes without errors after the change.
- Browsers loading any route no longer receive a 404 for `/favicon.ico`.
