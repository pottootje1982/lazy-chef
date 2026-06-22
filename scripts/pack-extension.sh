#!/bin/bash
# Package the Chrome extension into a zip — the format the Chrome Web Store
# accepts for upload, and that self-hosters can unzip for "Load unpacked".
#
# Usage:
#   ./scripts/pack-extension.sh                       # dev build (localhost:3000)
#   ./scripts/pack-extension.sh https://your.app      # zero-config production build
#
# A production build bakes the given URL in as the default (no Options step),
# scopes host_permissions to that origin + ah.nl, and drops the broad
# optional_host_permissions (cleaner for Web Store review).
#
# Output: dist/ah-connect-extension[-prod]-v<version>.zip  (manifest.json at root)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/extension"
OUT_DIR="$ROOT/dist"
PROD_URL="${1:-}"

VERSION="$(node -p "require('$SRC/manifest.json').version")"
mkdir -p "$OUT_DIR"

if [ -n "$PROD_URL" ]; then
  PROD_URL="${PROD_URL%/}" # strip trailing slash
  if [[ ! "$PROD_URL" =~ ^https?://[^[:space:]\"]+$ ]]; then
    echo "Invalid URL: '$PROD_URL' (expected e.g. https://your.app)" >&2
    exit 1
  fi
  BUILD="$(mktemp -d)/extension"
  mkdir -p "$BUILD"
  # Files without a base-URL reference: copy as-is.
  cp "$SRC/inject.js" "$SRC/relay.js" "$BUILD/"
  # Files that reference the base URL: point them at the production origin.
  for f in background.js options.js options.html README.md; do
    sed "s#http://localhost:3000#$PROD_URL#g" "$SRC/$f" > "$BUILD/$f"
  done
  # Manifest: scope to the prod origin + ah.nl, drop the broad optional hosts.
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const origin = new URL(process.argv[2]).origin + "/*";
    m.host_permissions = ["*://*.ah.nl/*", origin];
    delete m.optional_host_permissions;
    fs.writeFileSync(process.argv[3], JSON.stringify(m, null, 2) + "\n");
  ' "$SRC/manifest.json" "$PROD_URL" "$BUILD/manifest.json"

  PACK_DIR="$BUILD"
  ZIP="$OUT_DIR/ah-connect-extension-prod-v$VERSION.zip"
  LABEL="production build → $PROD_URL"
else
  PACK_DIR="$SRC"
  ZIP="$OUT_DIR/ah-connect-extension-v$VERSION.zip"
  LABEL="dev build (localhost:3000)"
fi

rm -f "$ZIP"
( cd "$PACK_DIR" && zip -r -q "$ZIP" . -x '*.DS_Store' -x '__MACOSX/*' -x '*/.*' )
echo "Packed $ZIP  ($LABEL)"
unzip -l "$ZIP" | tail -n +2
