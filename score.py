#!/usr/bin/env python3
"""
score.py -- Legacy Polyfill Waste Score (tsconfig.json asset)

Optimization goal: eliminate legacy JS polyfills injected by SWC/webpack when the
Browserslist config targets browsers that already support ES2022+ APIs natively.
tsconfig.json already sets target=ES2022, but without a matching Browserslist config,
Next.js/SWC still injects core-js polyfills for Array.prototype.at, Object.hasOwn etc,
causing chunk 117-9bcfe95f89d4b2e1.js to waste ~11 KiB per Lighthouse report.

Score formula (higher is better):
  score = tsconfig_bonus + browserslist_bonus + next_config_bonus - avg_wasted_bytes_per_route

  tsconfig_bonus:       +1000 if target >= ES2022 (prerequisite already met)
  browserslist_bonus:   +500  if modern Browserslist config targeting last 2 Chrome/Firefox/Safari
                        +100  if any Browserslist config found (partial)
  next_config_bonus:    +300  if experimental.browsersListForSwc in next.config
  avg_wasted_bytes:     avg wastedBytes from legacy-javascript-insight across all lh-*.json

Baseline (tsconfig correct, no browserslist): ~1000 - 11669 = -10669
After full fix (modern browserslist added):   ~1000 + 500 - 0 = +1500

Usage:
    python3 score.py <path-to-tsconfig.json>
"""

import sys
import json
import os
import glob


def score(asset_path):
    project_dir = os.path.dirname(os.path.abspath(asset_path))

    # Signal 1: tsconfig target alignment bonus
    tsconfig_bonus = 0.0
    try:
        with open(asset_path, "r", encoding="utf-8") as f:
            tsconfig = json.load(f)
        target = tsconfig.get("compilerOptions", {}).get("target", "").upper()
        good_targets = {"ES2022", "ES2023", "ES2024", "ES2025", "ESNEXT"}
        if target in good_targets:
            tsconfig_bonus = 1000.0
    except Exception:
        pass

    # Signal 2: Browserslist config presence bonus
    browserslist_bonus = 0.0

    bl_file = os.path.join(project_dir, ".browserslistrc")
    if os.path.isfile(bl_file):
        try:
            with open(bl_file, "r", encoding="utf-8") as f:
                content = f.read().strip()
            lower = content.lower()
            if any(kw in lower for kw in [
                "last 2 chrome", "last 2 firefox", "last 2 safari",
                "es2022", "chrome >= 100", "chrome>=100"
            ]):
                browserslist_bonus = 500.0
            elif content:
                browserslist_bonus = 100.0
        except Exception:
            pass

    pkg_path = os.path.join(project_dir, "package.json")
    if browserslist_bonus == 0.0 and os.path.isfile(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)
            bl = pkg.get("browserslist")
            if bl:
                bl_str = json.dumps(bl).lower()
                if any(kw in bl_str for kw in [
                    "last 2 chrome", "last 2 firefox", "last 2 safari",
                    "chrome >= 100", "chrome>=100"
                ]):
                    browserslist_bonus = 500.0
                else:
                    browserslist_bonus = 100.0
        except Exception:
            pass

    # Signal 3: next.config experimental.browsersListForSwc bonus
    next_config_bonus = 0.0
    for nc_name in ["next.config.mjs", "next.config.js", "next.config.ts", "next.config.cjs"]:
        nc_path = os.path.join(project_dir, nc_name)
        if os.path.isfile(nc_path):
            try:
                with open(nc_path, "r", encoding="utf-8") as f:
                    nc_content = f.read()
                if "browsersListForSwc" in nc_content or "browserslistForSwc" in nc_content:
                    next_config_bonus = 300.0
            except Exception:
                pass

    # Signal 4: Lighthouse legacy-javascript-insight wastedBytes (main penalty signal)
    lh_pattern = os.path.join(project_dir, "lh-*.json")
    lh_files = sorted(glob.glob(lh_pattern))
    main_report = os.path.join(project_dir, "lighthouse-report.json")
    if os.path.isfile(main_report):
        lh_files.append(main_report)

    total_wasted_bytes = 0.0
    routes_audited = 0

    for lh_path in lh_files:
        try:
            with open(lh_path, "r", encoding="utf-8") as f:
                report = json.load(f)
            audits = report.get("audits", {})
            lj_insight = audits.get("legacy-javascript-insight", {})
            items = lj_insight.get("details", {}).get("items", [])
            for item in items:
                total_wasted_bytes += float(item.get("wastedBytes", 0))
            routes_audited += 1
        except Exception:
            continue

    if routes_audited > 0:
        avg_wasted = total_wasted_bytes / routes_audited
    else:
        avg_wasted = 0.0

    final_score = tsconfig_bonus + browserslist_bonus + next_config_bonus - avg_wasted
    return final_score


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 score.py <path-to-tsconfig.json>", file=sys.stderr)
        sys.exit(1)
    result = score(sys.argv[1])
    print(result)
