// fold-chat-agentic.js — a SIMPLIFIED AGENT, inside the chat app.
//
// One entry in the SAME Chats list that starts something that is not a chat:
// an agent run. Clicking it opens a panel that streams the real loop — the
// reason-gate's intent, the hunt of the field, the Gary-framed draw, the snip,
// the append-only log, the projection, and the real test — from the local
// agentic surface (penelope/gym/agentic-server.mjs).
//
// Styled with the app's own tokens so it reads as native, in either theme.

const SURFACE = (() => {
  const h = location.hostname;
  if (h === "127.0.0.1" || h === "localhost") return "http://127.0.0.1:8853";
  return ""; // a published page has no loopback surface; the row names the gap, never fakes a run
})();

function el(tag, style, html) {
  const e = document.createElement(tag);
  if (style) e.style.cssText = style;
  if (html != null) e.innerHTML = html;
  return e;
}

function panel() {
  const overlay = el("div", "position:fixed;inset:0;z-index:2147483000;display:none;background:var(--scrim);backdrop-filter:blur(2px)");
  const box = el("div", "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(860px,92vw);max-height:86vh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);border:1px solid var(--line2);border-radius:var(--r-lg);box-shadow:var(--shadow);overflow:hidden;font:var(--fs-md)/1.5 var(--mono)");
  const head = el("div", "display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)",
    `<b style="color:var(--acc-deep);font-family:var(--sans)">⚙ Agent</b><span style="color:var(--mut);font-size:var(--fs-xs);font-family:var(--sans)">a coding run, not a chat — the real loop, streamed</span><span style="flex:1"></span>`);
  const close = el("button", "font:inherit;font-family:var(--sans);background:var(--side2);border:1px solid var(--line2);border-radius:var(--r-md);color:var(--ink2);padding:4px 12px;cursor:pointer", "close");
  head.appendChild(close);
  const runs = el("div", "display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px 6px");
  const out = el("pre", "flex:1;margin:0 14px 14px;padding:12px;background:var(--side2);color:var(--ink2);border:1px solid var(--line);border-radius:var(--r-md);overflow:auto;font:var(--fs-sm)/1.45 var(--mono);white-space:pre-wrap");
  out.textContent = SURFACE ? "▮ choose a run above" : "no local agentic surface (run: node penelope/gym/agentic-server.mjs)";
  box.append(head, runs, out);
  overlay.appendChild(box);
  close.onclick = () => { overlay.style.display = "none"; };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = "none"; };

  let loaded = false;
  async function load() {
    if (loaded || !SURFACE) return; loaded = true;
    let demos = {};
    try { demos = await (await fetch(SURFACE + "/api/demos")).json(); }
    catch { out.textContent = "could not reach the agentic surface at " + SURFACE; return; }
    for (const [key, d] of Object.entries(demos)) {
      const b = el("button", "font:inherit;font-family:var(--sans);background:var(--side2);border:1px solid var(--line2);border-radius:var(--r-md);color:var(--ink2);padding:8px 12px;cursor:pointer;text-align:left", `<b style="display:block;color:var(--acc-deep)">${key}</b>${d.label}`);
      b.onmouseenter = () => { b.style.borderColor = "var(--acc-deep)"; };
      b.onmouseleave = () => { b.style.borderColor = "var(--line2)"; };
      b.onclick = () => run(key);
      runs.appendChild(b);
    }
  }
  async function run(key) {
    for (const b of runs.querySelectorAll("button")) b.disabled = true;
    out.textContent = "running " + key + " …\n";
    try {
      const r = await fetch(SURFACE + "/api/run?demo=" + encodeURIComponent(key));
      const reader = r.body.getReader(); const dec = new TextDecoder();
      for (;;) { const { done, value } = await reader.read(); if (done) break; out.textContent += dec.decode(value, { stream: true }); out.scrollTop = out.scrollHeight; }
    } catch (e) { out.textContent += "\n[error] " + e.message; }
    for (const b of runs.querySelectorAll("button")) b.disabled = false;
  }
  return { el: overlay, open() { overlay.style.display = "block"; load(); } };
}

export function mountAgentic() {
  const p = panel();
  document.body.appendChild(p.el);
  const bind = (row) => { row.onclick = () => p.open(); };

  // the static entry in index.html (class="chat", native row; always visible)
  const stat = document.getElementById("agStart");
  if (stat) bind(stat);

  // fallback: pin a native-looking row if the app rebuilds the list without one
  const pin = () => {
    const list = document.getElementById("chats");
    if (!list || list.querySelector(":scope > .ag-row") || stat) return;
    const row = el("div", "display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r-md);color:var(--ink2);cursor:pointer",
      '<span class="cicon glyph" aria-hidden="true">⚙</span><span class="ct">Agent</span>');
    row.className = "chat ag-row";
    row.onmouseenter = () => { row.style.background = "var(--side2)"; };
    row.onmouseleave = () => { row.style.background = ""; };
    bind(row);
    list.prepend(row);
  };
  const t = setInterval(() => {
    const list = document.getElementById("chats");
    if (!list) return;
    clearInterval(t);
    pin();
    new MutationObserver(pin).observe(list, { childList: true });
  }, 300);
}
