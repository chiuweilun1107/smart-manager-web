#!/usr/bin/env python3
"""
Score middleware.ts for Edge Runtime lean-ness.

Scoring model (higher = better, max 100):
  - Base: 100 points
  - Penalty: -30 if @supabase/ssr is imported (heavy SDK, pulls process.version)
  - Penalty: -20 if createServerClient is used (Edge-incompatible heavy pattern)
  - Penalty: -0.5 per line over 20 (lean middleware should be short)
  - Penalty: -5 per additional non-next/server import (each extra import = more bundle weight)
  - Bonus: +10 if only 'next/server' imports are used (fully native)
  - Bonus: +5 if JWT/cookie-direct pattern detected (lightweight session check)

Score is clamped to [0, 100].
"""

import sys
import re


def score(path: str) -> float:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    total_lines = len(lines)

    points = 100.0

    # --- Penalties ---

    # Heavy SDK: @supabase/ssr import
    if re.search(r"""from\s+['"]@supabase/ssr['"]""", content):
        points -= 30

    # createServerClient usage (Edge-incompatible pattern)
    if "createServerClient" in content:
        points -= 20

    # Line count penalty: -0.5 per line over 20
    if total_lines > 20:
        points -= (total_lines - 20) * 0.5

    # Extra non-next/server imports penalty
    import_lines = [l for l in lines if re.match(r"^\s*import\s+", l)]
    non_next_imports = [
        l for l in import_lines
        if "next/server" not in l and "next/" not in l
    ]
    # Each non-next/server import costs 5 points
    points -= len(non_next_imports) * 5

    # --- Bonuses ---

    # Only next/server imports used (fully native Edge)
    if len(import_lines) > 0 and len(non_next_imports) == 0:
        points += 10

    # Lightweight JWT/cookie-direct pattern detected
    # Look for signs of manual cookie reading + JWT decode (atob / jose / jwtDecode / split('.'))
    lightweight_patterns = [
        r"cookies\(\s*\)\s*\.get",          # direct cookie read
        r"request\.cookies\.get",            # next/server native cookie API
        r"atob\s*\(",                        # manual base64 JWT decode
        r"jose",                              # lightweight jose JWT lib
        r"jwtDecode",                         # jwt-decode lib
        r"\.split\s*\(\s*['\"]\\.['\"]",    # JWT split by dot
        r"btoa|atob",                         # base64 ops
    ]
    if any(re.search(p, content) for p in lightweight_patterns):
        points += 5

    # Clamp to [0, 100]
    points = max(0.0, min(100.0, points))

    return points


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: score.py <path_to_middleware.ts>", file=sys.stderr)
        sys.exit(1)

    result = score(sys.argv[1])
    print(result)
