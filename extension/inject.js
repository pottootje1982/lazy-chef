// Runs in the PAGE's main world on *.ah.nl. AH delivers the OAuth code via a
// client-side redirect: it fetches the code, then navigates to
// `appie://login-exit?code=…`. webRequest can't see that, so we watch fetch/XHR
// responses for the appie:// URL and hand it to the extension via postMessage.
// We only look for the literal "appie://login-exit" marker — bodies are never
// stored or logged.
(function () {
  const MARK = "appie://login-exit";

  function report(url, via) {
    try {
      window.postMessage({ __ahConnect: true, url, via }, "*");
    } catch (e) {}
  }

  function scanText(text, via) {
    if (typeof text !== "string" || !text.includes(MARK)) return;
    const m = text.match(/appie:\/\/login-exit[^"'\\\s]*/);
    if (m) report(m[0], via);
  }

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      return origFetch.apply(this, args).then((res) => {
        try {
          if (res.url && res.url.includes(MARK)) report(res.url, "fetch-url");
          res.clone().text().then((t) => scanText(t, "fetch-body")).catch(() => {});
        } catch (e) {}
        return res;
      });
    };
  }

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__ahUrl = url;
    return origOpen.apply(this, arguments);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      try {
        if (this.responseURL && this.responseURL.includes(MARK)) report(this.responseURL, "xhr-url");
        if (typeof this.__ahUrl === "string" && this.__ahUrl.includes(MARK)) report(this.__ahUrl, "xhr-requrl");
        const rt = this.responseType;
        if (rt === "" || rt === "text") scanText(this.responseText, "xhr-body");
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };
})();
