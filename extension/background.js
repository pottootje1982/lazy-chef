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

// ---- Jumbo ordering (browser-side) ----
// Jumbo authenticates ordering with an httpOnly session cookie, so the basket
// call must run inside a jumbo.com tab (same-origin → the cookie attaches). The
// web app posts the draft items; app-relay.js forwards them here; we run the
// AddBasketLines mutation in a jumbo.com tab via scripting and report back.

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpd);
      resolve();
    };
    const onUpd = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(onUpd);
    chrome.tabs.get(tabId, (t) => {
      if (chrome.runtime.lastError) return;
      if (t && t.status === "complete") finish();
    });
    setTimeout(finish, timeoutMs);
  });
}

// Runs IN the jumbo.com tab: a same-origin fetch, so the session cookie attaches.
function addBasketInPage(items) {
  const query =
    "mutation AddBasketLines($input: AddBasketLinesInput!) {" +
    " addBasketLines(input: $input) { __typename ... on Basket { id totalProductCount } } }";
  return fetch("/api/graphql", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "apollographql-client-name": "JUMBO_WEB-search",
      "apollographql-client-version": "master-v33.9.0-web",
      "x-source": "JUMBO_WEB-search",
    },
    body: JSON.stringify({
      operationName: "AddBasketLines",
      query,
      variables: {
        input: {
          lines: items.map((i) => ({ sku: String(i.sku), quantity: Number(i.quantity) || 1 })),
          type: "ECOMMERCE",
        },
      },
    }),
  })
    .then((r) => r.json().then((d) => ({ status: r.status, d })))
    .then(({ status, d }) => {
      const node = d && d.data && d.data.addBasketLines;
      if (status >= 400 || (d && d.errors) || (node && node.__typename === "Error")) {
        const msg = (d && d.errors && d.errors[0] && d.errors[0].message) || (node && node.__typename) || "HTTP " + status;
        return { ok: false, error: msg };
      }
      return { ok: true, total: node && node.totalProductCount };
    })
    .catch((e) => ({ ok: false, error: String(e) }));
}

async function jumboAddToBasket(items) {
  let tab = (await chrome.tabs.query({ url: "*://*.jumbo.com/*" }))[0];
  if (!tab) {
    tab = await chrome.tabs.create({ url: "https://www.jumbo.com/", active: true });
    await waitForTabComplete(tab.id);
  } else {
    chrome.tabs.update(tab.id, { active: true });
  }
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: addBasketInPage,
      args: [items],
    });
    return res?.result ?? { ok: false, error: "no result from page" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "JUMBO_ADD_TO_BASKET" && Array.isArray(msg.items)) {
    jumboAddToBasket(msg.items).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
});
