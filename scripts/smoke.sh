#!/usr/bin/env bash
# Container smoke test for the lbgca API image (upgrade safety net, see TESTING.md).
# Starts the BUILT image, then exercises the flow the front uses: login (body read by ihm), profile, order,
# public order list, logout, JSON 404, and fails on tracebacks in the logs.
#
#   docker build -t lbgca:smoke server && bash scripts/smoke.sh lbgca:smoke [mode]
#
# Modes
#   ro      (default) read-only rootfs, cap_drop ALL, no-new-privileges, database + static named volumes.
#   legacy  the box's legacy compose exactly (scripts/compose/legacy-box.yml: root, bind mounts
#           ./app/database + .docker/static, container port 80) + data kept across restart and re-create.
set -euo pipefail

IMAGE="${1:-lbgca:smoke}"
MODE="${2:-ro}"
NAME="lbgca-smoke-$$"
PORT="${SMOKE_PORT:-18480}"
BASE="http://127.0.0.1:${PORT}"
HOST="api-lbgca.hosh.it"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
WORK="$TMP/work"   # compose project directory (legacy: holds the bind-mounted dirs)

dk() { MSYS_NO_PATHCONV=1 docker "$@"; }  # Git Bash on Windows rewrites /paths in args
case "$MODE" in
  ro) ;;
  legacy) COMPOSE=(dk compose -p "$NAME" -f "$ROOT/scripts/compose/legacy-box.yml" --project-directory "$WORK") ;;
  *) echo "unknown mode '$MODE' (ro|legacy)" >&2; exit 2 ;;
esac
export LBGCA_IMAGE="$IMAGE" SMOKE_PORT="$PORT"

applogs() { if [ "$MODE" = ro ]; then dk logs "$NAME" 2>&1; else "${COMPOSE[@]}" logs --no-color 2>&1; fi; }
cleanup() {
  cd /
  if [ "${SMOKE_OK:-0}" != 1 ]; then echo "---- container log ----"; applogs | tail -n 40 || true; fi
  if [ "$MODE" = ro ]; then
    dk rm -f "$NAME" >/dev/null 2>&1 || true
    dk volume rm -f "$NAME-db" "$NAME-static" >/dev/null 2>&1 || true
  else
    "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
    # bind-mounted files belong to the container's root: remove them from a container
    [ -d "$WORK" ] && dk run --rm --entrypoint rm -v "$WORK:/w" "$IMAGE" -rf /w/app /w/.docker >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP" 2>/dev/null || true
}
trap cleanup EXIT
fail() { echo "SMOKE FAIL [$MODE]: $*" >&2; exit 1; }
step() { echo "== [$MODE] $*"; }
code() { # code <expected> <curl args...>   body saved to $TMP/body
  local want="$1"; shift
  local got
  got="$(curl -sS -o "$TMP/body" -w '%{http_code}' -H "Host: $HOST" "$@")"
  [ "$got" = "$want" ] || { head -c 300 "$TMP/body" >&2; fail "expected $want got $got for: $*"; }
}
wait_up() {
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null -H "Host: $HOST" "$BASE/" 2>/dev/null && return 0
    sleep 1
  done
  fail "API not answering on $BASE"
}
login() { # login <name> -> prints "session=…" cookie
  curl -sS -D "$TMP/h" -o "$TMP/body" -H "Host: $HOST" -H 'content-type: application/json' \
    -d "{\"login\":\"$1\",\"password\":\"$1-pw\"}" "$BASE/session" >/dev/null
  grep -q '"connected": true' "$TMP/body" || fail "login $1 body lacks connected: $(cat "$TMP/body")"
  grep -q "\"username\": \"$1\"" "$TMP/body" || fail "login $1 body lacks username: $(cat "$TMP/body")"
  local c
  c="$(grep -i '^set-cookie: session=' "$TMP/h" | sed -E 's/^[Ss]et-[Cc]ookie: ([^;]+);.*/\1/')"
  [ -n "$c" ] || fail "no session cookie for $1"
  printf '%s' "$c"
}

# ------------------------------------------------------------------------------------------- start
if [ "$MODE" = ro ]; then
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
else
  step "seed an empty init database in ./app/database (bind mount, as on the box)"
  mkdir -p "$WORK"
  dk run --rm -v "$WORK/app/database:/app/database" --entrypoint python "$IMAGE" \
    -c "import sqlite3; sqlite3.connect('/app/database/init_database.db').close()"

  step "docker compose up: the box's legacy compose (root, bind mounts, port 80)"
  "${COMPOSE[@]}" up -d --quiet-pull >/dev/null
  wait_up
  [ "$(dk inspect --format '{{.Config.User}}' "$("${COMPOSE[@]}" ps -q lbgca)")" = "" ] || fail "legacy runs as the image user (root)"
fi

# --------------------------------------------------------------------------------- the front's flow
step "boot"
code 200 "$BASE/"
grep -q '^The app is running ! \[0\] connected !$' "$TMP/body" || fail "root: $(cat "$TMP/body")"
code 404 "$BASE/nope"
grep -q '"Resource not found"' "$TMP/body" || fail "404 body"

step "login (creates the account) -> session body the front reads"
COOKIE="$(login smoke)"

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

if [ "$MODE" = ro ]; then
  dk exec "$NAME" test -s /app/database/database.db || fail "no database on the volume"
else
  step "database + static on the host bind mounts"
  [ -s "$WORK/app/database/database.db" ] || fail "no database.db in ./app/database"
  [ -d "$WORK/.docker/static" ] || fail "no .docker/static"

  step "data survives a restart and a re-create (orders, accounts, server-side sessions)"
  KEEP="$(login keeper)"
  code 200 -H "cookie: $KEEP" -H 'content-type: application/json' \
    -d '{"product":"keepme","amount":7,"variant":"green"}' "$BASE/order"
  check_kept() {
    code 200 "$BASE/orders"
    grep -q '"product":"keepme"' "$TMP/body" || fail "order lost after $1"
    grep -q '"product":"pasta"' "$TMP/body" || fail "edited order lost after $1"
    code 200 -H "cookie: $KEEP" "$BASE/user"
    grep -q '"username":"keeper"' "$TMP/body" || fail "session lost after $1"
    code 200 "$BASE/user/smoke"
  }
  "${COMPOSE[@]}" restart >/dev/null 2>&1; wait_up; check_kept restart
  "${COMPOSE[@]}" down >/dev/null 2>&1; "${COMPOSE[@]}" up -d >/dev/null 2>&1; wait_up; check_kept re-create
fi

step "no tracebacks in logs"
if applogs | grep -E 'Traceback'; then fail "traceback in container log"; fi

SMOKE_OK=1
echo "SMOKE OK ($IMAGE, $MODE)"
