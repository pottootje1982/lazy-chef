# AH Connect — Chrome extension

Captures the Albert Heijn login code in the browser and links it to your Recipe
Manager account automatically — no copy/paste, works on Chrome/Chromium across
macOS, Windows and Linux.

## How it works

AH's OAuth login redirects to `appie://login-exit?code=…&state=…`, a native
scheme the browser can't open. In practice AH does this as a **client-side**
redirect — it fetches the code, then navigates to the `appie://` URL — so there
is no HTTP `Location` header for `webRequest` to read. The extension therefore
captures the code three ways and uses whichever fires:

1. **`webRequest`** — an `appie://` `Location` header, if a server `302` is ever used.
2. **page content script** (`inject.js`) — watches `fetch`/`XHR` responses on
   `*.ah.nl` for the `appie://login-exit` URL and relays it to the worker. This
   is the path that actually fires, and because it messages the worker it also
   wakes it (immune to MV3 service-worker sleep).
3. **`webNavigation`** — the `appie://` navigation attempt, as a fallback.

It then calls your Recipe Manager's `/api/ah/callback?code=…&state=…`, which
exchanges the code, stores your encrypted refresh token, and lands you on
Settings — already connected. It reuses the same callback route and signed
`state` as the macOS handler; only the capture mechanism differs.

## Install (Load unpacked)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. **Load unpacked** → select this `extension/` folder.
4. (Hosted deployment only) Right-click the extension → **Options** and set your
   Recipe Manager URL. Defaults to `http://localhost:3000`.

Then: **Settings → "Albert Heijn-login openen"**, sign in, and you're linked.

## Distribution

- **Self-hosters / yourself:** Load unpacked (above).
- **General users:** publish to the Chrome Web Store for true one-click install
  (one-time $5 developer fee + review). The folder is store-ready as-is.

## Permissions

- `webRequest` + `webNavigation` + host access to `*://*.ah.nl/*` — to observe
  the login redirect and run the content script that spots the `appie://` code
  in a response. Only the `appie://login-exit` URL is acted on; bodies are never
  stored or logged.
- `http://localhost:3000/*` (+ optional hosts via Options) — so the worker can
  `fetch` your Recipe Manager's callback to complete the link.
- `storage` — remembers the Recipe Manager URL from Options.

## Limitations

- Chrome/Chromium only (Edge, Brave, etc.). Safari/Firefox would need a port.
- Desktop only — Chrome on Android has no extensions. (Linking once on desktop
  is enough; the token is stored server-side, so ordering then works anywhere.)
- For non-Chrome browsers, use the macOS handler (`scripts/setup-ah-handler.sh`)
  or the manual paste fallback in Settings.
