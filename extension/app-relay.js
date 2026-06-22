// Runs on the Recipe Manager web app. Bridges the app to the extension service
// worker so the app can ask us to add items to the user's Jumbo basket — which
// must happen inside a jumbo.com tab where the session cookie applies.
window.addEventListener("message", (event) => {
  const d = event.data;
  if (event.source !== window || !d || d.source !== "recipe-manager") return;
  if (d.type === "JUMBO_ADD_TO_BASKET" && Array.isArray(d.items)) {
    chrome.runtime.sendMessage({ type: "JUMBO_ADD_TO_BASKET", items: d.items }, (res) => {
      window.postMessage(
        { source: "recipe-manager-ext", type: "JUMBO_ADD_RESULT", result: res || { ok: false, error: "no response" } },
        "*",
      );
    });
  }
});

// Announce presence so the app can tell the extension is installed.
window.postMessage({ source: "recipe-manager-ext", type: "READY" }, "*");
