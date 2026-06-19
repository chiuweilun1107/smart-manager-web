#!/usr/bin/env python3
"""
score.py — favicon coverage scorer for Next.js layout.tsx

Scoring goal: favicon.ico returns 200; 0 unnecessary 404 requests per page.

Two complementary signals are measured (each worth 0.5):
  1. layout.tsx metadata exports an `icons` field
     -> tells Next.js to inject <link rel="icon"> so browsers know where to look
  2. public/favicon.ico exists in the project root
     -> directly serves the browser's default /favicon.ico request

Score range: 0.0 (nothing done) -> 1.0 (fully covered).
Higher is always better.

Usage:
    python3 score.py <path-to-layout.tsx>

Stdout last line: a single float (0.0, 0.5, or 1.0).
"""

import sys
import os
import re


def score(asset_path: str) -> float:
    # Locate project root: layout.tsx lives in <project>/app/layout.tsx
    # so project root = grandparent of asset_path
    asset_dir = os.path.dirname(os.path.abspath(asset_path))
    project_root = os.path.dirname(asset_dir)

    points = 0.0

    # --- Signal 1: public/favicon.ico exists ---
    favicon_path = os.path.join(project_root, "public", "favicon.ico")
    if os.path.isfile(favicon_path):
        points += 0.5

    # --- Signal 2: metadata in layout.tsx has an `icons` field ---
    try:
        with open(asset_path, "r", encoding="utf-8") as fh:
            content = fh.read()
    except OSError:
        print(points)
        return points

    # Match patterns like:  icons: '...'  or  icons: { ... }  or  icons: [...]
    has_icons_field = bool(re.search(r'\bicons\s*:', content))
    if has_icons_field:
        points += 0.5

    return points


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: score.py <asset_path>")
        sys.exit(1)

    result = score(sys.argv[1])
    print(result)
