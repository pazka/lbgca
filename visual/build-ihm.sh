#!/usr/bin/env bash
# Builds the ihm front for the visual harness: visual/build-ihm.sh <out dir>
# On a COPY of ihm/ (git-tracked files only; the repo's working tree is not touched): valid placeholder
# pictures where the real ones are missing (visual/placeholders.mjs), then `npm ci --ignore-scripts` from the
# committed lockfile and `npm run build`, in the same pinned node:…@sha256 image as ci.yml's `ihm build` job
# (read from ci.yml, so a Dependabot bump of that job moves this too). <out dir> receives the CRA build/.
#   VISUAL_DOCKER_ARGS="..."  extra `docker run` arguments (e.g. a proxy CA for a sandbox); empty in CI.
set -euo pipefail
cd "$(dirname "$0")/.."
OUTDIR="${1:?usage: visual/build-ihm.sh <out dir>}"
NODE_IMAGE="$(grep -m1 -oE 'node:[^ ]+@sha256:[0-9a-f]{64}' .github/workflows/ci.yml)"
[ -n "$NODE_IMAGE" ] || { echo "VISUAL FAIL: no pinned node:…@sha256 image in ci.yml" >&2; exit 1; }
WORK="$(mktemp -d)"
trap 'docker run --rm -v "$WORK:/w" --entrypoint rm "$NODE_IMAGE" -rf /w/ihm >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
mkdir -p "$WORK/ihm" "$OUTDIR"
git ls-files -z ihm | while IFS= read -r -d '' f; do
  mkdir -p "$WORK/$(dirname "$f")"; cp "$f" "$WORK/$f"
done
cp visual/placeholders.mjs "$WORK/placeholders.mjs"
# shellcheck disable=SC2086
MSYS_NO_PATHCONV=1 docker run --rm ${VISUAL_DOCKER_ARGS:-} -v "$WORK:/w" -w /w/ihm "$NODE_IMAGE" sh -c '
  set -eu
  node /w/placeholders.mjs /w/ihm
  npm ci --ignore-scripts --no-audit --no-fund --loglevel=error
  CI=false GENERATE_SOURCEMAP=false npm run build >/w/build.log 2>&1 || { tail -40 /w/build.log; exit 1; }
  grep -q "<div id=\"root\">" build/index.html
'
rm -rf "${OUTDIR:?}"/*
cp -r "$WORK/ihm/build/." "$OUTDIR/"
echo "ihm built into $OUTDIR"
