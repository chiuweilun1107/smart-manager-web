#!/usr/bin/env python3
"""
score.py - Middleware /login early-exit efficiency scorer

Asset: middleware.ts (Next.js middleware)

Optimization goal:
  /login FCP = 1445ms, target < 900ms.
  Root cause: JWT cookie parsing (cookie extraction + base64 decode) runs
  unconditionally on ALL requests including /login, even though unauthenticated
  users on /login never get redirected. Moving the /login early-exit BEFORE
  the cookie-parsing block eliminates this wasted work on every /login page load.

Score = composite 0..100 measuring how well the middleware short-circuits for /login:

  S1 [40 pts] /login path guard appears BEFORE cookie extraction begins
               (login_guard_line < cookie_get_line)
  S2 [30 pts] Public-route guard (covering /login AND /api) runs early,
               before the heavy authentication work
  S3 [20 pts] Supabase URL parsing (NEXT_PUBLIC_SUPABASE_URL) is also skipped
               for /login (supabaseUrl access line > login_guard_line)
  S4 [10 pts] atob / base64 decode is not reachable from /login
               (atob call line > login_guard_line OR no atob at all)

Higher = better. Perfect = 100.0 (all expensive work is behind the /login guard).
Current baseline is low because cookie parsing precedes the /login guard.

Usage:
    python3 score.py <path-to-middleware.ts>
"""

import sys
import re


def first_match_line(lines, pattern):
    """Return 1-indexed line number of first regex match, or 9999 if not found."""
    compiled = re.compile(pattern)
    for i, line in enumerate(lines, start=1):
        if compiled.search(line):
            return i
    return 9999


def score(path):
    with open(path, 'r', encoding='utf-8') as f:
        source = f.read()

    lines = source.splitlines()

    # Key structural line positions
    login_guard_line = first_match_line(
        lines, r"pathname\.startsWith\s*\(\s*['\"]\/login['\"]"
    )
    cookie_get_line = first_match_line(lines, r"\.cookies\.get\(")
    supabase_url_line = first_match_line(lines, r"NEXT_PUBLIC_SUPABASE_URL")
    atob_line = first_match_line(lines, r"\batob\(")

    print(f"login_guard_line: {login_guard_line}", file=sys.stderr)
    print(f"cookie_get_line:  {cookie_get_line}", file=sys.stderr)
    print(f"supabase_url_line: {supabase_url_line}", file=sys.stderr)
    print(f"atob_line:        {atob_line}", file=sys.stderr)

    # S1: login guard before cookie access (40 pts)
    if login_guard_line < cookie_get_line:
        s1 = 40.0
    else:
        gap = login_guard_line - cookie_get_line
        s1 = max(0.0, 40.0 - gap * 2.0)

    # S2: combined public-route guard (/login AND /api) before heavy work (30 pts)
    combined_guard_line = first_match_line(
        lines,
        r"(?:startsWith.*['\"]\/login['\"].*startsWith.*['\"]\/api['\"]"
        r"|startsWith.*['\"]\/api['\"].*startsWith.*['\"]\/login['\"]"
        r"|!\s*pathname\.startsWith.*&&\s*!\s*pathname\.startsWith)"
    )
    if combined_guard_line == 9999:
        if login_guard_line < cookie_get_line:
            s2 = 15.0
        else:
            s2 = 0.0
    elif combined_guard_line < cookie_get_line:
        s2 = 30.0
    else:
        s2 = 10.0

    # S3: supabase URL parse skipped for /login (20 pts)
    if supabase_url_line == 9999 or supabase_url_line > login_guard_line:
        s3 = 20.0
    else:
        s3 = 0.0

    # S4: atob/base64 decode not reached for /login (10 pts)
    if atob_line == 9999 or atob_line > login_guard_line:
        s4 = 10.0
    else:
        s4 = 0.0

    total = s1 + s2 + s3 + s4
    print(f"S1={s1} S2={s2} S3={s3} S4={s4} => total={total}", file=sys.stderr)
    return round(total, 2)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 score.py <path-to-middleware.ts>", file=sys.stderr)
        sys.exit(1)
    result = score(sys.argv[1])
    print(result)
