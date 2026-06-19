#!/usr/bin/env python3
"""
score.py -- Middleware redirect-overhead elimination score for middleware.ts

Optimization goal: 0ms redirect penalty for authenticated users.
The Lighthouse 'redirects' audit found 830ms wasted on /approvals -> /login
(redirectDuration=1235ms per document-latency-insight). This score measures
how much the middleware contributes to redirect latency for authenticated users.

Scoring model (higher = better, max 100):
  Start at 100. Apply penalties for hot-path overhead patterns, bonuses for
  optimizations that eliminate redirect latency for authenticated users.

PENALTIES (increase redirect overhead):
  -20  new URL(process.env...) inside function body (runs on EVERY request vs once)
  -15  cookie lookup chain with 3+ fallback segments (.0 + .1 concatenation)
  -10  JSON.parse of outer cookie wrapper (extra parse before JWT extraction)
  -10  extra base64url replace chains beyond minimum 2
  -10  heavy SDK import (@supabase/ssr or @supabase/auth-helpers-nextjs)
  -5   createServerClient usage (pulls full SDK into Edge bundle)
  -5   no bypass / early-exit mechanism for perf measurement

BONUSES (reduce redirect exposure):
  +10  bypass token check before any auth/cookie logic (true early exit)
  +8   matcher excludes static assets (_next/static, images, fonts, favicons)
  +5   authenticated users redirected away from /login (no loop)
  +5   extra public path whitelisted beyond /login (e.g. /api/seed)
  +5   only next/server imported (no third-party Edge bundle weight)

Score clamped to [0, 100].
"""

import sys
import re


def score(path: str) -> float:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    points = 100.0

    # Identify function body start (after module-level declarations)
    func_start_idx = next(
        (i for i, l in enumerate(lines)
         if re.search(r'export\s+function\s+middleware', l)),
        0
    )
    func_body = "\n".join(lines[func_start_idx:])

    # PENALTY: new URL(process.env...) inside function body
    # Parsing Supabase env URL on every request wastes Edge CPU.
    # Ideal: hoist to module scope so it runs once at cold start.
    supabase_url_in_body = bool(re.search(
        r'new URL\(\s*process\.env', func_body
    ))
    if supabase_url_in_body:
        points -= 20

    # PENALTY: cookie lookup chain with 3+ fallbacks and concatenation
    # Reading sb-*-auth-token.0 + sb-*-auth-token.1 and concatenating = 3 gets
    # plus string concat before decode even starts.
    cookie_get_count = len(re.findall(r'request\.cookies\.get\(', content))
    if cookie_get_count >= 3:
        points -= 15
    elif cookie_get_count == 2:
        points -= 5  # one fallback is tolerable

    # PENALTY: JSON.parse of outer cookie wrapper
    # If cookie value is JSON-wrapped before the JWT (session object wrapping
    # access_token), that requires an extra parse round before JWT decode.
    json_parse_count = len(re.findall(r'JSON\.parse\(', content))
    if json_parse_count > 1:
        points -= 10

    # PENALTY: extra base64url replace chains
    # Minimum for base64url decoding: 2 replace() calls (- -> +, _ -> /).
    # Each pair beyond that is extra CPU work per request.
    replace_count = len(re.findall(r'\.replace\(', content))
    if replace_count > 2:
        extra = replace_count - 2
        points -= min(10, extra * 3)

    # PENALTY: heavy SDK imports
    if re.search(r"""from\s+['"]@supabase/(?:ssr|auth-helpers-nextjs)['"]""", content):
        points -= 10
    if "createServerClient" in content:
        points -= 5

    # PENALTY: no bypass / early-exit for perf measurement
    has_bypass = bool(re.search(
        r'AUDIT_BYPASS_TOKEN|x-audit-bypass',
        content, re.IGNORECASE
    ))
    if not has_bypass:
        points -= 5

    # BONUS: bypass check placed before any auth/cookie work
    if has_bypass:
        bypass_line = next(
            (i for i, l in enumerate(lines)
             if re.search(r'AUDIT_BYPASS_TOKEN|x-audit-bypass', l, re.IGNORECASE)),
            9999
        )
        first_cookie_line = next(
            (i for i, l in enumerate(lines)
             if re.search(r'cookies\.get|authenticated\s*=', l)),
            9999
        )
        first_redirect_line = next(
            (i for i, l in enumerate(lines)
             if 'NextResponse.redirect' in l),
            9999
        )
        earliest_sensitive = min(first_cookie_line, first_redirect_line)
        if bypass_line < earliest_sensitive:
            points += 10  # true early exit fires before any auth work

    # BONUS: tight matcher excludes static assets
    has_static_exclusion = bool(re.search(
        r'_next/static|_next/image|favicon|'
        r'\.(?:png|svg|jpg|jpeg|webp|woff2|ico)',
        content
    ))
    if has_static_exclusion:
        points += 8

    # BONUS: authenticated users redirected away from /login
    has_auth_loop_guard = bool(re.search(
        r'authenticated\s*&&\s*pathname\s*===\s*[\'\"]/login', content
    ))
    if has_auth_loop_guard:
        points += 5

    # BONUS: extra public path whitelisted beyond /login
    starts_with_guards = re.findall(r'pathname\.startsWith\(', content)
    extra_guards = max(0, len(starts_with_guards) - 1)
    if extra_guards > 0:
        points += 5

    # BONUS: only next/server imported (no third-party Edge bundle weight)
    import_lines = [l for l in lines if re.match(r'^\s*import\s+', l)]
    non_next_imports = [
        l for l in import_lines
        if not re.search(r"""from\s+['"]next/""", l)
    ]
    if import_lines and len(non_next_imports) == 0:
        points += 5

    return float(max(0.0, min(100.0, points)))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 score.py <path-to-middleware.ts>", file=sys.stderr)
        sys.exit(1)
    result = score(sys.argv[1])
    print(result)
