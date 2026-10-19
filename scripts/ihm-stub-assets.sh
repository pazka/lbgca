#!/usr/bin/env sh
# The front's images are not in git (root .gitignore ignores *.png/*.jpg; they live on the owner's Google
# Drive, see ihm/public/README-ressource-to-fetch.txt). For a CI compile check, put a tiny placeholder at
# every image path the sources import, in src/ and public/, so webpack can resolve them.
# Usage (from ihm/): sh ../scripts/ihm-stub-assets.sh
set -eu
grep -rhoE "img/[A-Za-z0-9_./-]+\.(png|jpe?g|gif|svg)" src | sort -u | while read -r f; do
  for base in src public; do
    [ -e "$base/$f" ] && continue
    mkdir -p "$base/$(dirname "$f")"
    printf '\211PNG\r\n\032\n' > "$base/$f"
  done
done
