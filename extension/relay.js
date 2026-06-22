// Isolated-world content script: bridges the page (inject.js, main world) to the
// extension service worker, since main-world scripts can't use chrome.runtime.
window.addEventListener("message", (event) => {
  const d = event.data;
  if (event.source === window && d && d.__ahConnect && typeof d.url === "string") {
    chrome.runtime.sendMessage({ type: "AH_CODE", url: d.url, via: d.via });
  }
});
