#!/usr/bin/env bash
# Visual regression of the ihm front against the built API image (hosh-management AGENTS.md §3, use cases in
# TESTING.md "Visual use cases"). Pattern of pazka/WordWave and pazka/henryivrevival visual/:
#   visual/run.sh [IMAGE] [--update]          (default lbgca:smoke)
# 1. builds ihm/ with placeholder pictures (visual/build-ihm.sh; IHM_BUILD=<dir> reuses a build instead);
# 2. starts the API image as docker-compose.example.yml runs it (uid 10001, read-only rootfs, tmpfs /tmp,
#    cap_drop ALL, no-new-privileges, pids/memory limits, PORT=8000, DATA_DIR=/data on a FRESH volume, a
#    throwaway SECRET_KEY);
# 3. starts two headless Chromes on the runner (mouse / touch; every host name resolves to nothing);
# 4. runs visual/shoot.mjs with Node from the same pinned node:…@sha256 image as ci.yml's `ihm build` job
#    (built-in fetch/WebSocket/http, no package): Chrome opens https://lbgca.hosh.it/…, the front is answered
#    from the build, https://api-lbgca.hosh.it/… by the container (visual/cdp.mjs). Every use case at
#    1400 / 1024 / 390 is compared with visual/baseline/. Shots, diffs and report.json: $OUT.
#   CHROME=/path/to/chrome (default google-chrome)   OUT=visual/out   VISUAL_PRINT_NEW=1 (CI: failing shots
#   printed in the log, visual/from-log.mjs writes them back as files)   ONLY=L1 (cases starting with L1)
#   --update: overwrite the baselines (QA only, in a PR that says why).
# New baselines (QA, in a PR that says the change is wanted): take them from the CI artifact (or the CI log
# with visual/from-log.mjs), made by the runner's Chrome, look at every picture, commit them.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
IMAGE="${1:-lbgca:smoke}"
[ $# -gt 0 ] && shift
OUT="${OUT:-visual/out}"
NAME="lbgca-visual-$$"
VOL="lbgca-visual-$$"
PORT=18491
CDP_DESKTOP=9381
CDP_PHONE=9382
NODE_IMAGE="$(grep -m1 -oE 'node:[^ ]+@sha256:[0-9a-f]{64}' .github/workflows/ci.yml)"
P1="$(mktemp -d)"; P2="$(mktemp -d)"
LOGS="$(mktemp -d)"
FRONT_DIR="${IHM_BUILD:-}"
OWN_BUILD=""
PIDS=()
dk() { MSYS_NO_PATHCONV=1 docker "$@"; }
cleanup() {
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  # wait for the Chromes to exit: a profile still being written makes rm -rf fail ("Directory not empty")
  # and, under set -e, that turned a green run red after "0 failure(s)" (fix of pazka/StoraAlex#31)
  for p in "${PIDS[@]}"; do wait "$p" 2>/dev/null || true; done
  dk rm -f "$NAME" >/dev/null 2>&1 || true
  dk volume rm -f "$VOL" >/dev/null 2>&1 || true
  rm -rf "$P1" "$P2" "$LOGS" 2>/dev/null ||
    { sleep 2; rm -rf "$P1" "$P2" "$LOGS" || true; }
  [ -n "$OWN_BUILD" ] && rm -rf "$OWN_BUILD"
  return 0
}
trap cleanup EXIT
fail() { echo "VISUAL FAIL: $*" >&2; exit 1; }
[ -n "$NODE_IMAGE" ] || fail "no pinned node:…@sha256 image in .github/workflows/ci.yml"

# 1. the front
if [ -z "$FRONT_DIR" ]; then
  OWN_BUILD="$(mktemp -d)"; FRONT_DIR="$OWN_BUILD"
  bash visual/build-ihm.sh "$FRONT_DIR"
fi
FRONT_DIR="$(cd "$FRONT_DIR" && pwd)"
[ -f "$FRONT_DIR/index.html" ] || fail "no built front in $FRONT_DIR"
chmod -R a+rX "$FRONT_DIR"  # read by the shooter's uid 10001

# 2. the API as docker-compose.example.yml runs it (values of that file, by hand: no env file, no secret)
dk volume create "$VOL" >/dev/null
dk run -d --name "$NAME" \
  --user 10001:10001 --read-only --tmpfs /tmp:size=16m,mode=1777 --cap-drop ALL \
  --security-opt no-new-privileges:true --pids-limit 128 --memory 512m \
  -e PORT=8000 -e DATA_DIR=/data -e STATIC_DIR=/data/static -e SECRET_KEY=visual-secret-not-real \
  -v "$VOL:/data" -p "127.0.0.1:$PORT:8000" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null || { dk logs "$NAME" >"$LOGS/app.log" 2>&1 || true; tail -40 "$LOGS/app.log" >&2; fail "API not healthy"; }
test "$(dk exec "$NAME" id -u)" = 10001 || fail "API does not run as 10001"
curl -fsS "http://127.0.0.1:$PORT/healthz" | grep -q '"orders":0' || fail "the database is not fresh"

# 3. the Chromes
RULES="MAP * ~NOTFOUND"  # = visual/cdp.mjs RESOLVER_RULES
COMMON=(--headless=new --no-sandbox --disable-gpu --mute-audio --no-first-run --hide-scrollbars
  --force-color-profile=srgb --font-render-hinting=none --disable-features=Translate,MediaRouter
  --disable-background-networking --lang=en-US --autoplay-policy=no-user-gesture-required "--host-resolver-rules=$RULES")
LANG=en_US.UTF-8 "${CHROME:-google-chrome}" "${COMMON[@]}" \
  --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 \
  --remote-debugging-port=$CDP_DESKTOP --user-data-dir="$P1" about:blank >"$LOGS/chrome1.log" 2>&1 &
PIDS+=($!)
LANG=en_US.UTF-8 "${CHROME:-google-chrome}" "${COMMON[@]}" \
  --remote-debugging-port=$CDP_PHONE --user-data-dir="$P2" about:blank >"$LOGS/chrome2.log" 2>&1 &
PIDS+=($!)
for port in $CDP_DESKTOP $CDP_PHONE; do
  for _ in $(seq 1 120); do curl -fsS "http://127.0.0.1:$port/json/version" >/dev/null 2>&1 && break; sleep 0.5; done
  curl -fsS "http://127.0.0.1:$port/json/version" >/dev/null 2>&1 || {
    tail -30 "$LOGS/chrome1.log" "$LOGS/chrome2.log" >&2
    fail "Chrome (${CHROME:-google-chrome}) has no DevTools endpoint on 127.0.0.1:$port"; }
done

# 4. the shots
rm -rf "$OUT"; mkdir -p "$OUT"; chmod 777 "$OUT"
BASE_MOUNT=(-v "$ROOT/visual:/v:ro")
for a in "$@"; do
  if [ "$a" = --update ]; then mkdir -p visual/baseline; BASE_MOUNT+=(-v "$ROOT/visual/baseline:/v/baseline"); chmod 777 visual/baseline; fi
done
set +e
dk run --rm --network host --user 10001:10001 --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  -e CDP_DESKTOP=$CDP_DESKTOP -e CDP_PHONE=$CDP_PHONE -e OUT=/out -e BASELINE=/v/baseline/ \
  -e VISUAL_PRINT_NEW="${VISUAL_PRINT_NEW:-}" -e ONLY="${ONLY:-}" \
  "${BASE_MOUNT[@]}" -v "$FRONT_DIR:/front:ro" -v "$ROOT/$OUT:/out" --entrypoint node "$NODE_IMAGE" \
  /v/shoot.mjs "http://127.0.0.1:$PORT" /front "$@"
rc=$?
set -e
# logs to a file first: under pipefail a pipe into grep -q can lose the match (SIGPIPE) and hide an error
dk logs "$NAME" >"$LOGS/app.log" 2>&1 || true
if grep -qE 'Traceback' "$LOGS/app.log"; then
  echo "VISUAL FAIL: the API logged a traceback" >&2
  grep -E -B2 -A12 'Traceback' "$LOGS/app.log" | head -60 >&2
  rc=1
fi
cp "$LOGS/app.log" "$OUT/server.log" 2>/dev/null || true
exit $rc
