// fold-chat-agentic.js — AGENT MODE: a terminal, in the app.
//
// Hitting "Agent +" starts a NEW agent (an item in the same list as chats) and
// opens a terminal in the main area — a dark, monospace console with an
// `agent❯` prompt. Type a command; a run streams its real loop (the reason-
// gate's intent, the hunt of the field, the Gary-framed draw, the snip, the
// append-only log, the projection, the real test) from the local agentic
// surface. The composer is the terminal prompt.
//
//   help | ls | clear | run <name>
const SURFACE = (() => {
  const h = location.hostname;
  if (h === "127.0.0.1" || h === "localhost") return "http://127.0.0.1:8853";
  return "";
})();

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const TERM_CSS = `
.ag2{position:fixed;inset:0;z-index:2147483000;display:none;background:#0b0b0d;color:#d6d6de;font:13.5px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}
.ag2.open{display:flex;flex-direction:column}
.ag2-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#111114;border-bottom:1px solid #23232a;font-sans:var(--sans)}
.ag2-bar b{color:#5eead4}.ag2-bar span{color:#7b7b8a}.ag2-x{margin-left:auto;background:#1b1b20;border:1px solid #2c2c34;color:#c9c9d2;border-radius:8px;padding:4px 12px;cursor:pointer;font:inherit}
.ag2-out{flex:1;overflow:auto;padding:14px 16px;white-space:pre-wrap}
.ag2-out .p{color:#5eead4}.ag2-out .e{color:#f87171}.ag2-out .ok{color:#56d364}
.ag2-in{display:flex;gap:8px;align-items:center;padding:10px 16px;border-top:1px solid #23232a;background:#0e0e11}
.ag2-in .ps1{color:#5eead4;flex:none}
.ag2-in input{flex:1;background:transparent;border:0;outline:0;color:#e8e8ef;font:inherit}
.ag2-in .hint{color:#5f5f6b;font-size:12px}
.ag-row.cursor{background:var(--side2);color:var(--ink)!important;font-weight:600}
`;

export function mountAgentic() {
  const style = document.createElement("style"); style.textContent = TERM_CSS; document.head.appendChild(style);

  const term = el("div", "ag2");
  const bar = el("div", "ag2-bar", '<b>⚙ agent</b><span class="ag2-sub">new run</span>');
  const close = el("button", "ag2-x", "close");
  bar.appendChild(close);
  const out = el("div", "ag2-out");
  const inn = el("div", "ag2-in", '<span class="ps1">agent❯</span>');
  const input = el("input");
  input.autocomplete = "off"; input.spellcheck = false;
  inn.append(input, el("span", "hint", "help · ls · run <name> · clear"));
  term.append(bar, out, inn);
  document.body.appendChild(term);
  const place = () => { const s = document.getElementById("side"); const vis = s && s.offsetParent !== null && !s.classList.contains("hide"); term.style.left = (vis ? Math.max(0, Math.round(s.getBoundingClientRect().right)) : 0) + "px"; };
  window.addEventListener("resize", place);
  close.onclick = () => term.classList.remove("open");

  let demos = null, running = false;
  const sessions = new Map(); let current = null;

  const print = (s, cls) => {
    const span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = s;
    out.appendChild(span);
    const rec = sessions.get(current); if (rec) rec.log += s;
    out.scrollTop = out.scrollHeight;
  };
  const prompt = (t) => { const l = el("div"); l.innerHTML = '<span class="p">agent❯</span> '; l.appendChild(document.createTextNode(t)); out.appendChild(l); const rec = sessions.get(current); if (rec) rec.log += "agent❯ " + t + "\n"; };

  async function run(name) {
    if (running) return;
    if (!demos) { try { demos = await (await fetch(SURFACE + "/api/demos")).json(); } catch { print("no local agentic surface (run: node penelope/gym/agentic-server.mjs)\n", "e"); return; } }
    if (!demos[name]) { print("no run named '" + name + "'. try: " + Object.keys(demos).join(", ") + "\n", "e"); return; }
    running = true;
    print("▶ " + demos[name].label + "\n", "p");
    try {
      const r = await fetch(SURFACE + "/api/run?demo=" + encodeURIComponent(name));
      const reader = r.body.getReader(); const dec = new TextDecoder();
      for (;;) { const { done, value } = await reader.read(); if (done) break; print(dec.decode(value, { stream: true })); }
    } catch (e) { print("\n[error] " + e.message + "\n", "e"); }
    print("\n", "ok"); running = false;
  }

  async function command(line) {
    const t = line.trim();
    if (!t) return;
    prompt(t);
    print("\n");
    if (t === "help") return print("commands: help · ls · run <name> · clear\n");
    if (t === "clear") { out.textContent = ""; const rec = sessions.get(current); if (rec) rec.log = ""; return; }
    if (!demos) { try { demos = await (await fetch(SURFACE + "/api/demos")).json(); } catch { demos = {}; } }
    if (t === "ls") return print(Object.entries(demos).map(([k, d]) => "  " + k + "  " + d.label).join("\n") + "\n");
    const m = t.match(/^(?:run\s+)?([\w-]+)$/);
    if (m && demos[m[1]]) return run(m[1]);
    print("unrecognized: '" + t + "'. try: help, ls, run <name>\n", "e");
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = input.value; input.value = ""; command(v); } });

  function addRow(sid) {
    const list = document.getElementById("chats"); if (!list) return null;
    const row = el("div", "chat ag-row", '<span class="cicon glyph" aria-hidden="true">▚</span><span class="ct">Agent run</span>');
    row.dataset.ag = sid;
    row.onclick = () => { activate(sid); place(); term.classList.add("open"); input.focus(); };
    list.prepend(row);
    return row;
  }
  function activate(sid) {
    current = sid;
    for (const r of document.querySelectorAll(".ag-row")) r.classList.toggle("cursor", r.dataset.ag === sid);
    out.textContent = "";
    const rec = sessions.get(sid);
    if (rec && rec.log) out.textContent = rec.log;
  }
  function newAgent() {
    const sid = "ag" + Date.now();
    sessions.set(sid, { log: "" });
    addRow(sid);
    activate(sid);
    place();
    term.classList.add("open");
    bar.querySelector(".ag2-sub").textContent = "new run · " + sid;
    out.textContent = ""; print("fold agent — a coding run, not a chat.\n", "p");
    print("type: help · ls · run <name>\n\n");
    input.focus();
  }

  // "Agent +" starts a new agent
  const bind = () => { const s = document.getElementById("agStart"); if (s) s.onclick = newAgent; };
  bind();
  // if the app rebuilds the sidebar, re-bind (the static row stays; others get pinned)
  const t = setInterval(() => { bind(); const l = document.getElementById("chats"); if (l && !t._b) { t._b = true; new MutationObserver(bind).observe(l, { childList: true }); } }, 400);
}
