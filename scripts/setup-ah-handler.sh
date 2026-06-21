#!/bin/bash
# One-time setup: register a macOS handler for the `appie://` URL scheme so the
# Albert Heijn login code is captured automatically (no copy/paste).
#
# After running this, link AH from Settings → "Albert Heijn-login openen": log in
# and you're connected automatically. Re-run any time to update the handler.
#
# Uninstall:  rm -rf "$HOME/Applications/AH Connect.app"
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")/ah-handler" && pwd)"
APP="$HOME/Applications/AH Connect.app"
PLIST="$APP/Contents/Info.plist"
PB=/usr/libexec/PlistBuddy
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This handler is macOS-only. On other platforms, use the manual paste flow in Settings." >&2
  exit 1
fi

echo "Building $APP ..."
rm -rf "$APP"
osacompile -o "$APP" "$SRC_DIR/ah-connect.applescript"

echo "Registering the appie:// URL scheme ..."
# Drop any pre-existing (possibly broken) URL types, then declare ours.
$PB -c "Delete :CFBundleURLTypes" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleURLTypes array" "$PLIST"
$PB -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLName string com.recipe-manager.ah" "$PLIST"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string appie" "$PLIST"
# Run in the background (no dock icon / window).
$PB -c "Add :LSUIElement bool true" "$PLIST" 2>/dev/null || \
  $PB -c "Set :LSUIElement true" "$PLIST"

# Make Launch Services aware of the new handler.
"$LSREGISTER" -f "$APP"

echo
echo "✅ Done. 'appie://' links now open AH Connect.app, which links your account."
echo "   Next: open the app once at http://localhost:3000/settings → 'Albert Heijn-login openen'."
echo "   (macOS may ask once to allow opening the app — that's expected.)"
