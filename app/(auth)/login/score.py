#!/usr/bin/env python3
"""
score.py — Login Page Lazy-Init Bundle Optimization Score
==========================================================
Measures how optimized the login page is for reducing First Load JS.
Score: 0-100, higher = MORE optimized (better).

Scoring criteria:
  A. createClient() NOT called at component top-level render scope  (+35 pts)
     Anti-pattern: `const supabase = createClient()` in component body
     before any event handler
  B. createClient import is NOT a static top-level module import     (+30 pts)
     Anti-pattern: `import { createClient } from ...` at module scope
  C. DEMO_ACCOUNTS NOT declared at module top-level scope            (+15 pts)
     Anti-pattern: `const DEMO_ACCOUNTS = [` with zero leading indentation
  D. Component uses async handlers (good pattern for lazy init)      (+10 pts)
     Reward: presence of `async function handle*` or arrow async handlers
  E. No direct @supabase/* import at module scope                    (+10 pts)
     Anti-pattern: `import ... from '@supabase/...'`

Baseline (current un-optimized state): ~20 pts
Fully optimized state: 100 pts

Usage: python3 score.py <path_to_page.tsx>
Output: last stdout line is a single float
"""

import sys
import re
from pathlib import Path


def score_file(file_path: str) -> float:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    score = 0.0

    # ── A. createClient() NOT called at component render scope (+35) ──────
    # Anti-pattern: inside component body but outside event handlers
    # Heuristic: find `const X = createClient()` with <=4 leading spaces
    # and no enclosing function keyword on that line
    render_scope_client = False
    for line in lines:
        if re.search(r'const\s+\w+\s*=\s*createClient\s*\(\s*\)', line):
            leading = len(line) - len(line.lstrip())
            # In component scope: leading indent is typically 2 spaces
            # Not inside a nested function (those would have 4+ spaces)
            if leading <= 4 and "function" not in line and "=>" not in line:
                render_scope_client = True
                break
    if not render_scope_client:
        score += 35.0

    # ── B. createClient NOT statically imported at top-level (+30) ────────
    static_import = re.search(
        r"^import\s+\{[^}]*createClient[^}]*\}\s+from\s+['\"]",
        content,
        re.MULTILINE,
    )
    if not static_import:
        score += 30.0

    # ── C. DEMO_ACCOUNTS NOT at module top-level (+15) ────────────────────
    module_level_demo = False
    for line in lines:
        if re.match(r'^const\s+DEMO_ACCOUNTS\s*=', line):
            module_level_demo = True
            break
    if not module_level_demo:
        score += 15.0

    # ── D. Has async event handlers (good lazy-init pattern) (+10) ────────
    has_async_handlers = bool(
        re.search(r'async\s+(function\s+\w+|\(\s*\w*\s*\)\s*=>)', content)
    )
    if has_async_handlers:
        score += 10.0

    # ── E. No direct @supabase/* import at module scope (+10) ─────────────
    direct_supabase = re.search(
        r"^import\s+.*from\s+['\"]@supabase/",
        content,
        re.MULTILINE,
    )
    if not direct_supabase:
        score += 10.0

    # Clamp to [0, 100]
    return max(0.0, min(100.0, score))


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 score.py <path_to_tsx>", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    if not Path(file_path).exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    result = score_file(file_path)
    print(f"{result:.2f}")


if __name__ == "__main__":
    main()
