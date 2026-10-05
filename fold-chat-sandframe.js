// fold-chat-sandframe.js — put an HTML document into a sandboxed <iframe>, on the web or in the extension.
//
//   sandboxDoc(frame, html, { nonce })     replaces   frame.srcdoc = html
//
// On the web that IS srcdoc, nothing else. In the browser extension an srcdoc frame inherits the page's
// CSP (script-src 'self'), so an artifact's own inline script would never run. There the frame is pointed
// at fold-sandbox.html (a manifest `sandbox` page: opaque origin, no chrome.* APIs, no access to the
// person's chats in storage — a script in it that reads localStorage gets a SecurityError) and the
// HTML is handed to it by postMessage. The handoff is a handshake — the sandbox page says it is ready,
// the parent answers — with the frame's `load` event as a backup, because either alone can be missed.
//
// The caller keeps its own `sandbox="allow-scripts"` attribute on the frame; this changes only how the
// document gets in.

/** The extension's sandbox page URL, or null on a plain web page. */
export function sandboxPageUrl(g = globalThis) {
  try { return g.chrome && g.chrome.runtime && g.chrome.runtime.id ? g.chrome.runtime.getURL("fold-sandbox.html") : null; } catch { return null; }
}

/** Load `html` into `frame`. Returns how: "srcdoc" (the web) or "sandbox-page" (the extension). */
export function sandboxDoc(frame, html, { nonce = "n", g = globalThis, win = globalThis } = {}) {
  const url = sandboxPageUrl(g);
  if (!url) { frame.srcdoc = html; return "srcdoc"; }
  const send = () => { try { frame.contentWindow.postMessage({ __foldsandbox: nonce, html }, "*"); } catch { /* the frame is gone */ } };
  const onMsg = (e) => {
    if (!e || e.source !== frame.contentWindow || !e.data || !e.data.__foldsandbox_ready) return;
    win.removeEventListener("message", onMsg);
    send();
  };
  win.addEventListener("message", onMsg);
  frame.addEventListener("load", send, { once: true });
  frame.src = url;
  return "sandbox-page";
}
