#!/usr/bin/env bash
# Boots the production build under `wrangler dev` against a throwaway local D1 and
# checks that the core flow works: login page, signup, saving a card, seeing it on the board.
# Local-only: never touches remote Cloudflare and needs no API key.
#
# Usage: npm run build && bash scripts/ci-d1-smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRANGLER="$ROOT/node_modules/.bin/wrangler"
PORT="${SMOKE_PORT:-8799}"
# Per-request limit in seconds, so a hung server fails the job instead of stalling it. Each
# status=$(curl ...) || true lets a timeout surface as HTTP 000 in expect_status.
CURL_TIMEOUT="${SMOKE_CURL_TIMEOUT:-20}"
BASE="http://localhost:$PORT"
BUILD="$ROOT/.svelte-kit/cloudflare"

[ -f "$BUILD/_worker.js" ] || { echo "No production build at $BUILD; run npm run build first." >&2; exit 1; }

# A scratch wrangler config with a local-only D1 binding, so the real wrangler.toml never
# carries a fake database_id.
WORK="$(mktemp -d)"
LOG="$WORK/wrangler-dev.log"
SERVER_PID=""
cleanup() {
	if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi
	rm -rf "$WORK"
}
trap cleanup EXIT

# Built from scratch: only the top-level runtime keys are copied (stopping at the first table
# header), so a real [[d1_databases]] block in wrangler.toml can't collide with this one.
{
	awk '/^[[:space:]]*\[/ { exit } /^(name|compatibility_date|compatibility_flags)[[:space:]]*=/' \
		"$ROOT/wrangler.toml"
	cat <<EOF
main = "$BUILD/_worker.js"

[assets]
binding = "ASSETS"
directory = "$BUILD"

[[d1_databases]]
binding = "DB"
database_name = "butterfly-net-db"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "$ROOT/drizzle"
EOF
} >"$WORK/wrangler.toml"

fail() {
	echo "FAIL: $*" >&2
	echo "--- wrangler dev log (tail) ---" >&2
	tail -n 40 "$LOG" >&2 || true
	exit 1
}

echo "Applying migrations to a local D1..."
(cd "$WORK" && "$WRANGLER" d1 migrations apply butterfly-net-db --local --persist-to "$WORK/state") >/dev/null

echo "Starting wrangler dev on :$PORT..."
(cd "$WORK" && exec "$WRANGLER" dev --port "$PORT" --persist-to "$WORK/state" \
	--show-interactive-dev-session=false) >"$LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
	if curl -s --max-time 2 -o /dev/null "$BASE/login"; then break; fi
	kill -0 "$SERVER_PID" 2>/dev/null || fail "wrangler dev exited early"
	sleep 1
done

expect_status() { # label expected actual
	[ "$3" = "$2" ] || fail "$1: expected HTTP $2, got $3"
	echo "ok  $1 -> $3"
}

# 1. Login page renders.
status=$(curl -s --max-time "$CURL_TIMEOUT" -o /dev/null -w '%{http_code}' "$BASE/login") || true
expect_status "GET /login" 200 "$status"

# 2. Signup (form action) redirects home and sets a session cookie. Accept: text/html makes
#    it a plain browser form post (otherwise Kit answers with a JSON action result).
email="smoke-$(date +%s)-$RANDOM@example.com"
headers="$WORK/signup.headers"
status=$(curl -s --max-time "$CURL_TIMEOUT" -o /dev/null -D "$headers" -w '%{http_code}' -X POST "$BASE/signup" \
	-H "Origin: $BASE" -H 'Accept: text/html' \
	--data-urlencode "email=$email" --data-urlencode "password=correct-horse-battery") || true
expect_status "POST /signup" 303 "$status"
session=$(grep -i '^set-cookie: session=' "$headers" | head -n1 | sed -E 's/^[^=]*: session=([^;]*).*/\1/' | tr -d '\r')
[ -n "$session" ] || fail "POST /signup: no session cookie set"
echo "ok  session cookie set"
cookie="Cookie: session=$session"

# 3. Parse with no API key falls back to a preview rather than failing.
status=$(curl -s --max-time "$CURL_TIMEOUT" -o "$WORK/parse.json" -w '%{http_code}' -X POST "$BASE/api/parse" \
	-H "$cookie" -H "Origin: $BASE" -H 'Content-Type: application/json' \
	--data '{"text":"buy smoke detector batteries"}') || true
expect_status "POST /api/parse (no key, fallback)" 200 "$status"
grep -q '"source":"fallback"' "$WORK/parse.json" || fail "POST /api/parse: expected a fallback preview, got $(cat "$WORK/parse.json")"

# 4. Save a card onto a new pile.
title="Smoke card $RANDOM"
status=$(curl -s --max-time "$CURL_TIMEOUT" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/cards" \
	-H "$cookie" -H "Origin: $BASE" -H 'Content-Type: application/json' \
	--data "{\"title\":\"$title\",\"notes\":\"\",\"subtasks\":[],\"pile\":{\"kind\":\"new\",\"name\":\"smoke tests\"}}") || true
expect_status "POST /api/cards" 201 "$status"

# 5. The board shows it.
body="$WORK/home.html"
status=$(curl -s --max-time "$CURL_TIMEOUT" -o "$body" -w '%{http_code}' -H "$cookie" "$BASE/") || true
expect_status "GET /" 200 "$status"
grep -qF "$title" "$body" || fail "GET /: card title \"$title\" not on the page"
echo "ok  board shows \"$title\""

echo "D1 smoke passed."
