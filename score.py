#!/usr/bin/env python3
"""
score.py — Legacy JavaScript Polyfill Waste Score
Asset: tsconfig.json (ES2022 target config)

Optimization goal: 0 bytes wasted on native-supported polyfills.
tsconfig already sets target=ES2022; the fix must eliminate the
third-party bundler override that ships polyfills for:
  Array.prototype.at/flat/flatMap, Object.fromEntries/hasOwn,
  String.prototype.trimStart/trimEnd

Score = -(total wastedBytes from legacy-javascript-insight across all lh-*.json)
  Higher is better; perfect = 0.0 (no polyfill waste on any route).
  Baseline: -11669 * 7 routes = -81683

If tsconfig.json target is NOT ES2022+, applies -50000 prerequisite penalty.

Usage:
    python3 score.py <path-to-tsconfig.json>
"""

import sys
import json
import glob
import os

ES2022_TARGETS = {"es2022", "es2023", "es2024", "es2025", "esnext"}


def load_tsconfig(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def tsconfig_target_ok(tsconfig):
    target = (
        tsconfig.get("compilerOptions", {})
        .get("target", "")
        .lower()
        .strip()
    )
    return target in ES2022_TARGETS


def polyfill_waste_bytes(lh_dir):
    pattern = os.path.join(lh_dir, "lh-*.json")
    report_files = sorted(glob.glob(pattern))
    total_wasted = 0
    for fpath in report_files:
        try:
            with open(fpath, encoding="utf-8") as fh:
                data = json.load(fh)
        except (json.JSONDecodeError, OSError):
            continue
        audit = data.get("audits", {}).get("legacy-javascript-insight", {})
        for item in audit.get("details", {}).get("items", []):
            total_wasted += item.get("wastedBytes", 0)
    return total_wasted, len(report_files)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 score.py <path-to-tsconfig.json>", file=sys.stderr)
        sys.exit(1)

    asset_path = sys.argv[1]
    lh_dir = os.path.dirname(os.path.abspath(asset_path))

    try:
        tsconfig = load_tsconfig(asset_path)
    except (json.JSONDecodeError, OSError) as exc:
        print(f"ERROR reading tsconfig: {exc}", file=sys.stderr)
        sys.exit(1)

    target_ok = tsconfig_target_ok(tsconfig)
    total_wasted, file_count = polyfill_waste_bytes(lh_dir)
    prerequisite_penalty = 0 if target_ok else -50000
    score = -total_wasted + prerequisite_penalty

    print(f"tsconfig target ES2022+: {target_ok}", file=sys.stderr)
    print(f"lh-*.json files scanned: {file_count}", file=sys.stderr)
    print(f"total wastedBytes (all routes): {total_wasted}", file=sys.stderr)
    print(f"prerequisite_penalty: {prerequisite_penalty}", file=sys.stderr)
    print(f"score: {score}", file=sys.stderr)

    print(float(score))


if __name__ == "__main__":
    main()
