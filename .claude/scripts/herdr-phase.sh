#!/usr/bin/env bash
#
# herdr-phase.sh — mark which workflow phase this agent's herdr tab is in.
#
# herdr auto-detects live *state* (working/done/idle/blocked) but exposes no
# writable "phase" field, so we encode phase as an emoji prefix on the tab
# label, preserving whatever feature name the tab already has. Re-running with
# a different phase swaps the prefix; it never stacks.
#
# Safe to call from any skill: it no-ops when not running inside herdr, so it
# does nothing in CI, plain terminals, or nested/headless agent runs.
#
# Usage: herdr-phase.sh <research|design|plan|implement|review|clear>
set -euo pipefail

[ "${HERDR_ENV:-0}" = "1" ] || exit 0
command -v herdr >/dev/null 2>&1 || exit 0
command -v python3 >/dev/null 2>&1 || exit 0

python3 - "${1:-}" "${HERDR_TAB_ID:-}" <<'PY'
import json, subprocess, sys

GLYPH = {
    "research":  "\U0001F52C",  # 🔬
    "design":    "\U0001F3A8",  # 🎨
    "plan":      "\U0001F4CB",  # 📋
    "implement": "\U0001F528",  # 🔨
    "review":    "\U0001F50D",  # 🔍
}
KNOWN = set(GLYPH.values())

phase = sys.argv[1].strip().lower() if len(sys.argv) > 1 else ""
if phase and phase != "clear" and phase not in GLYPH:
    sys.exit(0)  # unknown phase — leave the label untouched


def herdr(*args):
    return subprocess.run(["herdr", *args], capture_output=True, text=True)


# HERDR_TAB_ID is exported into this agent's own pane, so it names the tab we
# actually belong to. The focused-pane scan is only a fallback: whichever tab
# the human happens to be looking at is not necessarily ours, and using it
# stamps the phase glyph onto a sibling agent's tab.
tab_id = sys.argv[2].strip() if len(sys.argv) > 2 else ""

if not tab_id:
    try:
        panes = json.loads(herdr("pane", "list").stdout)["result"]["panes"]
    except (json.JSONDecodeError, KeyError):
        sys.exit(0)
    tab_id = next((p["tab_id"] for p in panes if p.get("focused")), None)

if not tab_id:
    sys.exit(0)

try:
    label = json.loads(herdr("tab", "get", tab_id).stdout)["result"]["tab"].get("label", "") or ""
except (json.JSONDecodeError, KeyError):
    sys.exit(0)

# Strip an existing phase prefix we set earlier (any of our glyphs + space).
for g in KNOWN:
    if label.startswith(g):
        label = label[len(g):].lstrip()
        break

new_label = label if phase in ("", "clear") else f"{GLYPH[phase]} {label}".strip()
herdr("tab", "rename", tab_id, new_label)
PY
