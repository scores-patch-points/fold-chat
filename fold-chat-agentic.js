// fold-chat-agentic.js — a SIMPLIFIED AGENTIC MODE, inside the chat app.
//
// One pinned row in the SAME Chats list that starts something that is not a
// chat: an agentic coding run. Clicking it opens a panel that streams the real
// loop — the reason-gate's intent, the hunt of the field, the Gary-framed draw,
// the snip, the append-only log, the projection, and the real test — from the
// local agentic surface (penelope/gym/agentic-server.mjs).
//
// Mounted from fold-boot.js (after the app mounts). The row is re-pinned if the
// app re-renders the list.

const SURFACE = (() => {
  const h = location.hostname;
  if (h === "127.0.0.1" || h === "localhost") return "http://127.0.0.1:8853";
  return ""; // a published page has no loopback surface; the row shows a gap, never a fake run
})();

function el(tag, style, html) {
  const e = document.createElement(tag);
  if (style) e.style.cssText = style;
  if (html != null) e.innerHTML = html;
  return e;
}

function panel() {
  const el_ = el("div", "position:fixed;inset:0;z-index:2147483000;display:none;background:color-mix(in srgb, var(--fg,#2b2118) 45%, transparent);backdrop-filter:blur(2px)");
  const box = el("div", "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(860px,92vw);max-height:86vh;display:flex;flex-direction:column;background:var(--panel,#f6f1e7);color:var(--fg,#2b2118);border:1px solid var(--line,#d8ccb6);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace");
  const start = location.hostname;
  box.appendChild(el("div", "display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line,#d8ccb6)",
    `<b style="color:var(--acc,#8a5a2b)">⚙ Agent</b><span style="color:var(--dim,#7a6b58);font-size:12px">a coding run, not a chat — the real loop, streamed</span><span style="flex:1"></span><button data-close style="background:none;border:1px solid var(--line,#d8ccb6);border-radius:8px;color:inherit;font:inherit;padding:4px 10px;cursor:pointer">close</button>`));
  const runs = el("div", "display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px 6px");
  const out = el("pre", "flex:1;margin:0 14px 14px;padding:12px;background:#100d09;color:#e8dcc6;border:1px solid var(--line,#d8ccb6);border-radius:8px;overflow:auto;font-size:12.5px;white-space:pre-wrap");
  out.textContent = SURFACE ? "▮ choose a run above" : "no local agentic surface (run: node penelope/gym/agentic-server.mjs)";
  box.append(runs, out);
  el_.appendChild(box);
  box.querySelector("[data-close]").onclick = () => { el_.style.display = "none"; };
  el_.onclick = (e) => { if (e.target === el_) el_.style.display = "none"; };

  let loaded = false;
  async function load() {
    if (loaded || !SURFACE) return; loaded = true;
    let demos = {};
    try { demos = await (await fetch(SURFACE + "/api/demos")).json(); }
    catch { out.textContent = "could not reach the agentic surface at " + SURFACE; return; }
    for (const [key, d] of Object.entries(demos)) {
      const b = el("button", "background:none;border:1px solid var(--line,#d8ccb6);border-radius:8px;color:inherit;font:inherit;padding:8px 11px;cursor:pointer;text-align:left", `<b style="display:block;color:var(--acc,#8a5a2b)">${key}</b>${d.label}`);
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
  return { el: el_, open() { el_.style.display = "block"; load(); }, run };
}

export function mountAgentic() {
  const p = panel();
  document.body.appendChild(p.el);
  const bind = (row) => {
    row.onclick = () => p.open();
  };
  // the static entry in index.html (always visible, in the same Chats list)
  const stat = document.getElementById("agStart");
  if (stat) bind(stat);
  // and keep a row pinned if the app rebuilds the list without one
  const pin = () => {
    const list = document.getElementById("chats");
    if (!list || list.querySelector(":scope > .ag-row") || stat) return;
    const row = el("div", "display:flex;gap:8px;align-items:center;padding:7px 10px;margin:2px 6px;border:1px dashed var(--line,#d8ccb6);border-radius:8px;cursor:pointer;color:var(--acc,#8a5a2b)",
      '<span aria-hidden="true">⚙</span><span>Agent</span><span style="flex:1"></span><span style="color:var(--dim,#7a6b58);font-size:11px">not a chat</span>');
    row.className = "ag-row";
    row.title = "Start an agent (not a chat)";
    bind(row);
    list.prepend(row);
  };
  // wait for the app to render the Chats list, then keep the row pinned across re-renders
  const t = setInterval(() => {
    const list = document.getElementById("chats");
    if (!list) return;
    clearInterval(t);
    pin();
    new MutationObserver(pin).observe(list, { childList: true });
  }, 300);
}
