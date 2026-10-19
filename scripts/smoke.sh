#!/usr/bin/env bash
# Container smoke test for the lbgca API image (upgrade safety net, see TESTING.md).
# Starts the BUILT image like docker-compose.yml does (database + static volumes) with a read-only rootfs,
# then exercises the flow the front uses: login (body read by ihm), profile, order, public order list,
# logout, JSON 404 — and fails on tracebacks in the logs.
#
#   docker build -t lbgca:smoke server && bash scripts/smoke.sh lbgca:smoke
set -euo pipefail

IMAGE="${1:-lbgca:smoke}"
NAME="lbgca-smoke-$$"
PORT="${SMOKE_PORT:-18480}"
BASE="http://127.0.0.1:${PORT}"
HOST="api-lbgca.hosh.it"
TMP="$(mktemp -d)"

dk() { MSYS_NO_PATHCONV=1 docker "$@"; }  # Git Bash on Windows rewrites /paths in args
cleanup() {
  cd /
  if [ "${SMOKE_OK:-0}" != 1 ]; then echo "---- container log ----"; dk logs "$NAME" 2>&1 | tail -n 40 || true; fi
  dk rm -f "$NAME" >/dev/null 2>&1 || true
  dk volume rm -f "$NAME-db" "$NAME-static" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT
fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
step() { echo "== $*"; }
code() { # code <expected> <curl args...>   body saved to $TMP/body
  local want="$1"; shift
  local got
  got="$(curl -sS -o "$TMP/body" -w '%{http_code}' -H "Host: $HOST" "$@")"
  [ "$got" = "$want" ] || { head -c 300 "$TMP/body" >&2; fail "expected $want got $got for: $*"; }
}

step "seed an empty init database in the database volume"
dk run --rm -v "$NAME-db:/app/database" --entrypoint python "$IMAGE" \
  -c "import sqlite3; sqlite3.connect('/app/database/init_database.db').close()"

step "start $IMAGE (read-only rootfs, cap_drop ALL, no-new-privileges)"
dk run -d --name "$NAME" --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
  -v "$NAME-db:/app/database" -v "$NAME-static:/app/static" -p "127.0.0.1:${PORT}:80" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  curl -fsS -o /dev/null -H "Host: $HOST" "$BASE/" 2>/dev/null && break
  [ "$(dk inspect --format '{{.State.Running}}' "$NAME")" = true ] || fail "container exited"
  sleep 1
done

step "boot"
code 200 "$BASE/"
grep -q '^The app is running ! \[0\] connected !$' "$TMP/body" || fail "root: $(cat "$TMP/body")"
code 404 "$BASE/nope"
grep -q '"Resource not found"' "$TMP/body" || fail "404 body"

step "login (creates the account) -> session body the front reads"
curl -sS -D "$TMP/h" -o "$TMP/body" -H "Host: $HOST" -H 'content-type: application/json' \
  -d '{"login":"smoke","password":"smoke-pw"}' "$BASE/session" >/dev/null
grep -q '"connected": true' "$TMP/body" || fail "login body lacks connected: $(cat "$TMP/body")"
grep -q '"username": "smoke"' "$TMP/body" || fail "login body lacks username: $(cat "$TMP/body")"
COOKIE="$(grep -i '^set-cookie: session=' "$TMP/h" | sed -E 's/^[Ss]et-[Cc]ookie: ([^;]+);.*/\1/')"
[ -n "$COOKIE" ] || fail "no session cookie"

step "profile, order, edit, public list, logout"
code 200 -H "cookie: $COOKIE" "$BASE/user"
grep -q '"username":"smoke"' "$TMP/body" || fail "profile"
code 200 -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"product":"pasta","amount":2,"variant":"red"}' "$BASE/order"
ORDER="$(grep -oE '"id":[0-9]+,"product"' "$TMP/body" | grep -oE '[0-9]+')"
code 200 -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"amount":3,"variant":"blue"}' "$BASE/order/$ORDER"
grep -q '"amount":3' "$TMP/body" && grep -q '"variant":"blue"' "$TMP/body" || fail "order edit: $(cat "$TMP/body")"
code 200 "$BASE/orders"
grep -q '"product":"pasta"' "$TMP/body" || fail "orders list"
code 200 -H "cookie: $COOKIE" -X DELETE "$BASE/session"
code 400 -H "cookie: $COOKIE" "$BASE/user"
dk exec "$NAME" test -s /app/database/database.db || fail "no database on the volume"

step "no tracebacks in logs"
if dk logs "$NAME" 2>&1 | grep -E 'Traceback'; then fail "traceback in container log"; fi

SMOKE_OK=1
echo "SMOKE OK ($IMAGE)"
