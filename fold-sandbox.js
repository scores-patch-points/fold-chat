// fold-sandbox.js — where an artifact runs inside the extension (see fold-chat-sandframe.js).
//
// The manifest lists fold-sandbox.html under `sandbox.pages`: it is served with its own, relaxed CSP
// (inline script allowed — that is the artifact's code, not ours), in an opaque origin with no
// chrome.* APIs and no access to the extension's storage. The page that embedded it hands over the
// HTML; this script writes it as the document, and the probe inside it reports back to that page by
// postMessage exactly as it does from an srcdoc frame.

window.addEventListener("message", function onMessage(e) {
  if (e.source !== window.parent) return;               // only the page that embedded us
  var d = e.data;
  if (!d || typeof d.html !== "string" || !d.__foldsandbox) return;
  window.removeEventListener("message", onMessage);     // one artifact per frame
  document.open();
  document.write(d.html);
  document.close();
});

// Say we are listening. (The parent also sends on the frame's load event; whichever it sees first wins.)
window.parent.postMessage({ __foldsandbox_ready: true }, "*");
