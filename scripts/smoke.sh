#!/usr/bin/env bash
# Container smoke test for the lbgca API image (upgrade safety net, see TESTING.md).
# Starts the BUILT image, then exercises the flow the front uses: login (body read by ihm), profile, order,
# public order list, logout, JSON 404, and fails on tracebacks in the logs.
#
#   docker build -t lbgca:smoke server && bash scripts/smoke.sh lbgca:smoke [mode]
#
# Modes
#   ro       (default) read-only rootfs, cap_drop ALL, no-new-privileges, database + static named volumes.
#   legacy   the box's legacy compose exactly (scripts/compose/legacy-box.yml: root, bind mounts
#            ./app/database + .docker/static, container port 80) + data kept across restart and re-create.
#   template docker-compose.example.yml + .env.example as on the box (/srv/lbgca: user 10001, read-only,
#            named volume lbgca-data at /data, PORT 8000), driven like hosh-deploy: healthy, non-root,
#            read-only, loopback /healthz, POST_DEPLOY from deploy/hosh-deploy.conf, data kept.
#   cutover  DEPLOY.md §5 rehearsal: legacy with data → stop → data move into lbgca-data (same command as
#            DEPLOY.md) → template sees the same database (sha256) → rollback = legacy again, data intact.
# template/cutover use the fixed names of the box (container lbgca, volume lbgca-data): CI only.
set -euo pipefail

IMAGE="${1:-lbgca:smoke}"
MODE="${2:-ro}"
NAME="lbgca-smoke-$$"
PORT="${SMOKE_PORT:-18480}"
BASE="http://127.0.0.1:${PORT}"
HOST="api-lbgca.hosh.it"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
WORK="$TMP/legacy"   # legacy compose project directory (holds the bind-mounted dirs, like /root/hosh-deploy/lbgca)
SRV="$TMP/srv"       # template project directory (like /srv/lbgca)

dk() { MSYS_NO_PATHCONV=1 docker "$@"; }  # Git Bash on Windows rewrites /paths in args
LEGACY=(dk compose -p "$NAME" -f "$ROOT/scripts/compose/legacy-box.yml" --project-directory "$WORK")
TEMPLATE=(dk compose --project-directory "$SRV" --env-file "$SRV/lbgca.env" -f "$SRV/docker-compose.yml")
case "$MODE" in
  ro|legacy) ;;
  template|cutover)
    if dk volume inspect lbgca-data >/dev/null 2>&1 || dk container inspect lbgca >/dev/null 2>&1; then
      echo "a volume lbgca-data or container lbgca already exists here: refusing (template/cutover are for CI)" >&2; exit 2
    fi ;;
  *) echo "unknown mode '$MODE' (ro|legacy|template|cutover)" >&2; exit 2 ;;
esac
export LBGCA_IMAGE="$IMAGE" SMOKE_PORT="$PORT"
CUR=none   # which deployment is up: ro | legacy | template

applogs() {
  case "$CUR" in
    ro) dk logs "$NAME" 2>&1 ;;
    legacy) "${LEGACY[@]}" logs --no-color 2>&1 ;;
    template) "${TEMPLATE[@]}" logs --no-color 2>&1 ;;
  esac
}
cleanup() {
  cd /
  if [ "${SMOKE_OK:-0}" != 1 ]; then echo "---- container log ($CUR) ----"; applogs | tail -n 40 || true; fi
  dk rm -f "$NAME" >/dev/null 2>&1 || true
  dk volume rm -f "$NAME-db" "$NAME-static" >/dev/null 2>&1 || true
  [ -d "$WORK" ] && { "${LEGACY[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
  [ -f "$SRV/docker-compose.yml" ] && { "${TEMPLATE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
  # bind-mounted files belong to the container's root: remove them from a container
  [ -d "$WORK" ] && { dk run --rm --entrypoint rm -v "$WORK:/w" "$IMAGE" -rf /w/app /w/.docker >/dev/null 2>&1 || true; }
  case "$MODE" in template|cutover) dk volume rm -f lbgca-data >/dev/null 2>&1 || true ;; esac
  rm -rf "$TMP" 2>/dev/null || true
}
trap cleanup EXIT
fail() { echo "SMOKE FAIL [$MODE/$CUR]: $*" >&2; exit 1; }
step() { echo "== [$MODE/$CUR] $*"; }
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

# ------------------------------------------------------------------------------- the deployments
start_legacy() {
  CUR=legacy
  if [ ! -d "$WORK/app/database" ]; then
    step "seed an empty init database in ./app/database (bind mount, as on the box)"
    mkdir -p "$WORK"
    dk run --rm -v "$WORK/app/database:/app/database" --entrypoint python "$IMAGE" \
      -c "import sqlite3; sqlite3.connect('/app/database/init_database.db').close()"
  fi
  step "docker compose up: the box's legacy compose (root, bind mounts, port 80)"
  "${LEGACY[@]}" up -d --quiet-pull >/dev/null 2>&1 || { "${LEGACY[@]}" up -d; fail "legacy compose up"; }
  wait_up
  [ "$(dk inspect --format '{{.Config.User}}' "$("${LEGACY[@]}" ps -q lbgca)")" = "" ] || fail "legacy must run as the image user (root)"
}

start_template() {
  CUR=template
  if [ ! -f "$SRV/docker-compose.yml" ]; then
    step "/srv/lbgca as DEPLOY.md §1b builds it: compose + env from the examples, SECRET_KEY generated"
    mkdir -p "$SRV"
    cp "$ROOT/docker-compose.example.yml" "$SRV/docker-compose.yml"
    install -m 600 "$ROOT/.env.example" "$SRV/lbgca.env"
    sed -i "s|^SECRET_KEY=.*|SECRET_KEY='$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')'|" "$SRV/lbgca.env"
    sed -i "s|^APP_IMAGE=.*|APP_IMAGE='$IMAGE'|; s|^APP_BIND=.*|APP_BIND='127.0.0.1:$PORT'|" "$SRV/lbgca.env"
  fi
  step "docker compose up (template: user 10001, read-only, lbgca-data at /data, PORT 8000)"
  "${TEMPLATE[@]}" up -d --quiet-pull >/dev/null 2>&1 || { "${TEMPLATE[@]}" up -d; fail "template compose up"; }
  # what hosh-deploy checks after `compose up`
  local cid state
  cid="$("${TEMPLATE[@]}" ps -q lbgca)"
  for _ in $(seq 1 45); do
    state="$(dk inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")"
    [ "$state" = healthy ] && break
    [ "$state" = unhealthy ] || [ "$state" = none ] && fail "container health: $state"
    sleep 2
  done
  [ "$state" = healthy ] || fail "not healthy (health: $state)"
  [ "$(dk inspect -f '{{.Config.User}}' "$cid")" = "10001:10001" ] || fail "user is not 10001"
  [ "$(dk inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$cid")" = true ] || fail "rootfs writable"
  curl -fsS --max-time 10 "$BASE/healthz" | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("status")=="ok" else 1)' \
    || fail "loopback /healthz (no Host header, as hosh-deploy calls it) not ok"
  wait_up
}

stop_current() {
  case "$CUR" in
    legacy) "${LEGACY[@]}" stop >/dev/null 2>&1 ;;
    template) "${TEMPLATE[@]}" stop >/dev/null 2>&1 ;;
  esac
  CUR=none
}

# ----------------------------------------------------------------------------------- the checks
front_flow() {  # the front's flow on a FRESH database
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
}

keep_data() {  # an account with an order and a live server-side session, checked later by check_kept
  step "write data to keep (account keeper, order keepme, open session)"
  KEEP="$(login keeper)"
  code 200 -H "cookie: $KEEP" -H 'content-type: application/json' \
    -d '{"product":"keepme","amount":7,"variant":"green"}' "$BASE/order"
}
check_kept() {
  step "data kept after $1 (orders, accounts, server-side session)"
  code 200 "$BASE/orders"
  grep -q '"product":"keepme"' "$TMP/body" || fail "order lost after $1"
  grep -q '"product":"pasta"' "$TMP/body" || fail "edited order lost after $1"
  code 200 -H "cookie: $KEEP" "$BASE/user"
  grep -q '"username":"keeper"' "$TMP/body" || fail "session lost after $1"
  code 200 "$BASE/user/smoke"
}
restart_and_recreate() {
  local -a C
  if [ "$CUR" = legacy ]; then C=("${LEGACY[@]}"); else C=("${TEMPLATE[@]}"); fi
  "${C[@]}" restart >/dev/null 2>&1; wait_up; check_kept restart
  "${C[@]}" down >/dev/null 2>&1; "${C[@]}" up -d >/dev/null 2>&1; wait_up; check_kept re-create
}
post_deploy() {  # POST_DEPLOY of deploy/hosh-deploy.conf, run like hosh-deploy: plain argv, no shell
  local pd
  pd="$(sed -n 's/^POST_DEPLOY=//p' "$ROOT/deploy/hosh-deploy.conf")"
  [ -n "$pd" ] || fail "POST_DEPLOY empty"
  step "POST_DEPLOY inside the container: $pd"
  local -a argv; read -r -a argv <<< "$pd"
  "${TEMPLATE[@]}" exec -T lbgca "${argv[@]}" || fail "POST_DEPLOY failed"
  code 200 "$BASE/orders"
  if grep -q '"product":"hosh-smoke"' "$TMP/body"; then fail "POST_DEPLOY left its order behind"; fi
}
no_tracebacks() {
  step "no tracebacks in logs"
  if applogs | grep -E 'Traceback'; then fail "traceback in container log"; fi
}
db_sha_legacy() { dk run --rm --network none --entrypoint sha256sum -v "$WORK/app/database:/d:ro" "$IMAGE" /d/database.db | cut -d' ' -f1; }
db_sha_volume() { dk run --rm --network none --entrypoint sha256sum -v lbgca-data:/d:ro "$IMAGE" /d/database.db | cut -d' ' -f1; }

# -------------------------------------------------------------------------------------- modes
case "$MODE" in
ro)
  CUR=ro
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
  front_flow
  dk exec "$NAME" test -s /app/database/database.db || fail "no database on the volume"
  no_tracebacks
  ;;
legacy)
  start_legacy
  front_flow
  step "database + static on the host bind mounts"
  [ -s "$WORK/app/database/database.db" ] || fail "no database.db in ./app/database"
  [ -d "$WORK/.docker/static" ] || fail "no .docker/static"
  keep_data
  restart_and_recreate
  no_tracebacks
  ;;
template)
  start_template
  front_flow
  step "database + static in the lbgca-data volume, owned by 10001"
  "${TEMPLATE[@]}" exec -T lbgca test -s /data/database.db || fail "no /data/database.db"
  "${TEMPLATE[@]}" exec -T lbgca test -d /data/static -a -w /data/static || fail "no writable /data/static"
  [ "$(dk run --rm --network none --entrypoint stat -v lbgca-data:/d "$IMAGE" -c %u:%g /d/database.db)" = 10001:10001 ] || fail "database.db owner"
  "${TEMPLATE[@]}" exec -T lbgca sh -c 'touch /app/x 2>/dev/null' && fail "rootfs is writable"
  keep_data
  post_deploy
  restart_and_recreate
  code 200 "$BASE/healthz"
  grep -q '"status":"ok"' "$TMP/body" || fail "healthz: $(cat "$TMP/body")"
  no_tracebacks
  ;;
cutover)
  start_legacy
  front_flow
  keep_data
  no_tracebacks
  stop_current
  before="$(db_sha_legacy)"
  step "data move: legacy bind mounts → volume lbgca-data, chown 10001 (the exact DEPLOY.md §5 command)"
  # ---- keep in sync with DEPLOY.md §5 step 3 (paths: legacy dir = $WORK) ----
  dk volume create lbgca-data >/dev/null
  dk run --rm --network none --user 0:0 --entrypoint sh \
    -v "$WORK/app/database:/from/database:ro" -v "$WORK/.docker/static:/from/static:ro" -v lbgca-data:/to \
    "$IMAGE" -c 'set -e; cp -a /from/database/. /to/; mkdir -p /to/static; cp -a /from/static/. /to/static/; chown -R 10001:10001 /to; chmod 750 /to; ls -la /to'
  # ----
  after="$(db_sha_volume)"
  [ "$before" = "$after" ] || fail "database.db changed during the move ($before → $after)"
  echo "database.db sha256 identical: $after"
  start_template
  check_kept cutover
  post_deploy
  no_tracebacks
  step "rollback = legacy compose again (its bind mounts were only read)"
  stop_current
  [ "$(db_sha_legacy)" = "$before" ] || fail "legacy database modified by the move"
  start_legacy
  check_kept rollback
  no_tracebacks
  ;;
esac

SMOKE_OK=1
echo "SMOKE OK ($IMAGE, $MODE)"
