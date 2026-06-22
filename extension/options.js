const input = document.getElementById("base");
const status = document.getElementById("status");

chrome.storage.sync.get("baseUrl").then(({ baseUrl }) => {
  input.value = baseUrl || "http://localhost:3000";
});

document.getElementById("save").addEventListener("click", async () => {
  const v = input.value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/.+/.test(v)) {
    status.textContent = "Enter a valid http(s) URL";
    status.className = "err";
    return;
  }
  // fetch() to the callback needs host permission for this origin. localhost is
  // already granted in the manifest; for any other host, request it now (this
  // click is the required user gesture).
  const origin = new URL(v).origin + "/*";
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    status.textContent = "Permission for that URL was denied";
    status.className = "err";
    return;
  }
  await chrome.storage.sync.set({ baseUrl: v });
  status.textContent = "Saved ✓";
  status.className = "ok";
});
