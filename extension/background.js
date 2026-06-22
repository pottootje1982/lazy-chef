// AH Connect — captures the Albert Heijn OAuth code in Chrome.
//
// AH redirects login to `appie://login-exit?code=…&state=…`, which Chrome can't
// open. We capture that URL via three paths, because the redirect may be a
// server 302 header, a client-side JS redirect (code in a fetch/XHR response,
// seen by inject.js), or surface as a navigation attempt:
//   1. webRequest — appie:// in a Location header from any ah.nl host
//   2. runtime message — the page's fetch/XHR patch relayed the URL (this also
//      wakes the service worker, so it's immune to SW sleep)
//   3. webNavigation — the appie:// navigation attempt
// We then call the recipe-manager callback, which links the account server-side
// (the signed `state` carries the user id, so no session/tab is needed).

const DEFAULT_BASE = "http://localhost:3000";

let baseUrl = DEFAULT_BASE;
chrome.storage.sync.get("baseUrl").then(({ baseUrl: b }) => {
  if (b) baseUrl = b.replace(/\/+$/, "");
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.baseUrl) {
    baseUrl = (changes.baseUrl.newValue || DEFAULT_BASE).replace(/\/+$/, "");
  }
});

let lastHandled = "";

function handleAppieUrl(appieUrl, source) {
  if (!appieUrl || !appieUrl.includes("login-exit")) return;
  const qs = appieUrl.split("?")[1] ?? "";
  if (!qs || qs === lastHandled) return; // ignore blanks and duplicate captures
  lastHandled = qs;

  const url = `${baseUrl}/api/ah/callback?${qs}`;
  console.log(`[AH Connect] captured login code (${source}); linking…`);
  fetch(url, { redirect: "manual" })
    .then(() => {
      console.log("[AH Connect] linked; opening settings");
      const settings = `${baseUrl}/settings`;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) chrome.tabs.update(tabs[0].id, { url: settings });
        else chrome.tabs.create({ url: settings });
      });
    })
    .catch((e) => console.error("[AH Connect] link request failed:", e));
}

// 1 — server 302 carrying appie:// in the Location header (any ah.nl host).
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const loc = details.responseHeaders
      ?.find((h) => h.name.toLowerCase() === "location")
      ?.value;
    if (loc && loc.startsWith("appie://login-exit")) handleAppieUrl(loc, "redirect");
  },
  { urls: ["*://*.ah.nl/*"] },
  ["responseHeaders"],
);

// 2 — client-side: inject.js found the code in a fetch/XHR response.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "AH_CODE" && msg.url) handleAppieUrl(msg.url, "page");
});

// 3 — the appie:// navigation attempt, if it surfaces here.
if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener((d) => {
    if (d.url && d.url.startsWith("appie://login-exit")) handleAppieUrl(d.url, "navigation");
  });
}
