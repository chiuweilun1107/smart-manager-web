#!/usr/bin/env python3
"""
score.py -- middleware.ts redirect-waste optimizer scorer
Score range: 0-100 (higher = better optimized toward 0ms redirect waste)

Deductions from 100:
  -35  No pre-auth cookie shortcut before full JWT decode on every request
  -30  No Accept:text/html detection for API vs browser routes
         (partial -10 if /api paths are at least excluded from redirect)
  -20  No CDN-layer pre-auth signal written back to client after auth
  -15  No early-exit path before heavy JWT decode block

Usage: python3 score.py <path-to-middleware.ts>
stdout last line: a single float
"""

import sys
import re


def score_middleware(path):
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    score = 100.0

    # Deduction 1 (-35): No pre-auth cookie shortcut before full JWT decode.
    has_preauth = bool(re.search(r"pre.?auth", src, re.IGNORECASE))
    if not has_preauth:
        score -= 35
        print("[-35] No pre-auth cookie shortcut found", file=sys.stderr)
    else:
        print("[+0] Pre-auth cookie shortcut present", file=sys.stderr)

    # Deduction 2 (-30 or -10): No Accept: text/html detection.
    # Partial credit (-10) if /api paths are at least excluded from redirect.
    has_accept = bool(re.search(r"text/html", src))
    excludes_api = bool(re.search(r"startsWith\(./api", src))
    if has_accept:
        print("[+0] Accept: text/html detection present", file=sys.stderr)
    elif excludes_api:
        score -= 10
        print("[-10] /api excluded but no Accept header detection", file=sys.stderr)
    else:
        score -= 30
        print("[-30] No API route protection at all", file=sys.stderr)

    # Deduction 3 (-20): No CDN-layer pre-auth signal written back to client.
    has_cdn_signal = bool(
        re.search(r"cookies\.set", src, re.IGNORECASE)
        or re.search(r"response\.cookies", src, re.IGNORECASE)
        or re.search(r"set-cookie", src, re.IGNORECASE)
    )
    if not has_cdn_signal:
        score -= 20
        print("[-20] No pre-auth signal cookie written back to client", file=sys.stderr)
    else:
        print("[+0] CDN-layer pre-auth signal present", file=sys.stderr)

    # Deduction 4 (-15): No early-exit before heavy JWT decode block.
    atob_pos = src.find("atob(")
    has_early_exit = False
    if atob_pos > 0:
        pre = src[:atob_pos]
        has_early_exit = bool(
            re.search(r"bypassToken|AUDIT_BYPASS", pre, re.IGNORECASE)
            or re.search(r"pre.?auth", pre, re.IGNORECASE)
        )
    if not has_early_exit:
        score -= 15
        print("[-15] No early-exit path before JWT decode block", file=sys.stderr)
    else:
        print("[+0] Early-exit path present before JWT decode", file=sys.stderr)

    final = max(0.0, min(100.0, score))
    print("Final score: {}".format(final), file=sys.stderr)
    return final


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 score.py <path-to-middleware.ts>", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]
    try:
        result = score_middleware(path)
    except FileNotFoundError:
        print("File not found: {}".format(path), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print("Error: {}".format(e), file=sys.stderr)
        sys.exit(1)
    print(result)


if __name__ == "__main__":
    main()
