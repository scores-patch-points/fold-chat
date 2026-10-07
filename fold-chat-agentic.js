// fold-chat-agentic.js — AGENT MODE: a TUI in the browser.
//
// Hitting "Agent +" starts a NEW agent (an item in the same list) and opens a
// terminal in the main area. It behaves like a TUI — full keyboard, monospace,
// a status line, line-history, tab-completion, an abort key — with the browser
// up top: selectable text, clickable links, real IME in the prompt, native
// scrolling.
//
//   ↑/↓ history · Tab complete · ^L clear · ^C abort · Esc close
//   help · ls · run <name> · clear
const SURFACE = (() => {
  const h = location.hostname;
  return (h === "127.0.0.1" || h === "localhost") ? "http://127.0.0.1:8853" : "";
})();

const CSS = `
.ag2{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;display:none;flex-direction:column;background:#0b0b0d;color:#d6d6de;font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.ag2.open{display:flex}
.ag2-bar{display:flex;align-items:center;gap:10px;padding:7px 12px;background:#101013;border-bottom:1px solid #23232a}
.ag2-bar b{color:#5eead4}
.ag2-bar .sub{color:#7b7b8a}
.ag2-bar .st{margin-left:auto;color:#7b7b8a;font-size:12px}
.ag2-bar .st .on{color:#56d364}.ag2-bar .st .off{color:#f87171}
.ag2-x{margin-left:10px;background:#1b1b20;border:1px solid #2c2c34;color:#c9c9d2;border-radius:6px;padding:3px 10px;cursor:pointer;font:inherit}
.ag2-out{flex:1;overflow:auto;padding:12px 14px;white-space:pre-wrap}
.ag2-out a{color:#8ab4ff}
.ag2-out .ln{display:block}
.ag2-out .c-dim{color:#6d6d7a}.ag2-out .c-acc{color:#5eead4}.ag2-out .c-ok{color:#56d364}.ag2-out .c-bad{color:#f87171}.ag2-out .c-warn{color:#f0b429}
.ag2-status{display:flex;gap:14px;padding:5px 12px;background:#0e0e11;border-top:1px solid #23232a;color:#7b7b8a;font-size:11.5px}
.ag2-status kbd{background:#1b1b20;border:1px solid #2c2c34;border-radius:4px;padding:0 5px;color:#c9c9d2;font:inherit}
.ag2-in{display:flex;gap:8px;align-items:center;padding:9px 12px;background:#0e0e11;border-top:1px solid #23232a}
.ag2-in .ps1{color:#5eead4;flex:none}
.ag2-in input{flex:1;background:transparent;border:0;outline:0;color:#eaeaef;font:inherit;caret-color:#5eead4}
.ag2-in .tail{color:#5f5f6b;font-size:11.5px}
.ag-row.cursor{background:var(--side2);color:var(--ink)!important;font-weight:600}
`;

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function colorize(raw) {
  let safe = esc(raw);
  safe = safe.replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
  let cls = "c-dim";
  if (/PASS|ok=true|✔|MATCH|byte-equal|complete: true|\[exit 0\]/.test(raw)) cls = "c-ok";
  else if (/FAIL|ok=false|Error|error|✖|\[exit [1-9]/.test(raw)) cls = "c-bad";
  else if (/^▶|^\s*(run|agent❯)|reason-gate|mechanical|invent|patch|fill/.test(raw)) cls = "c-acc";
  else if (/refus|warn|gap|no-op/.test(raw)) cls = "c-warn";
  return `<span class="ln ${cls}">${safe}</span>`;
}

export function mountAgentic() {
  const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);

  const term = document.createElement("div"); term.className = "ag2";
  term.innerHTML = `
    <div class="ag2-bar"><b>⚙ fold</b><span class="sub">agent — a coding run, not a chat</span><span class="st"></span><button class="ag2-x">close</button></div>
    <div class="ag2-out" id="ag2out"></div>
    <div class="ag2-status">
      <span><kbd>↑</kbd><kbd>↓</kbd> history</span><span><kbd>Tab</kbd> complete</span><span><kbd>^L</kbd> clear</span><span><kbd>^C</kbd> abort</span><span><kbd>Esc</kbd> close</span><span class="ag2-now"></span>
    </div>
    <div class="ag2-in"><span class="ps1">agent❯</span><input spellcheck="false" autocomplete="off"><span class="tail"></span></div>`;
  document.body.appendChild(term);
  const out = term.querySelector("#ag2out"), input = term.querySelector("input"), stat = term.querySelector(".ag2-bar .st"), now = term.querySelector(".ag2-now"), tail = term.querySelector(".ag2-in .tail");
  term.querySelector(".ag2-x").onclick = () => term.classList.remove("open");

  const place = () => { const s = document.getElementById("side"); const vis = s && s.offsetParent !== null && !s.classList.contains("hide"); term.style.left = (vis ? Math.max(0, Math.round(s.getBoundingClientRect().right)) : 0) + "px"; };
  window.addEventListener("resize", place);

  let demos = null, running = false, aborter = null;
  const history = []; let hIdx = 0;
  const sessions = new Map(); let current = null; let buf = "";
  const CMDS = ["help", "ls", "clear", "run "];

  const paint = (raw) => { const rec = sessions.get(current); if (rec) rec.log += raw; };
  const flush = () => { while (buf.includes("\n")) { const i = buf.indexOf("\n"); out.insertAdjacentHTML("beforeend", colorize(buf.slice(0, i))); buf = buf.slice(i + 1); } out.scrollTop = out.scrollHeight; };
  const write = (raw) => { paint(raw); buf += raw; flush(); };
  const line = (raw) => write(raw + "\n");

  async function ensureDemos() { if (demos) return demos; try { demos = await (await fetch(SURFACE + "/api/demos")).json(); } catch { demos = {}; } return demos; }

  async function run(name) {
    if (running) { line("a run is already going (^C to abort)"); return; }
    const d = await ensureDemos();
    if (!d[name]) { line("no run named '" + name + "'. try: " + Object.keys(d).join(", ")); return; }
    running = true; const t0 = performance.now(); now.textContent = "run: " + name + " …"; tail.textContent = "^C abort";
    line("▶ " + d[name].label);
    aborter = new AbortController();
    try {
      const r = await fetch(SURFACE + "/api/run?demo=" + encodeURIComponent(name), { signal: aborter.signal });
      const reader = r.body.getReader(); const dec = new TextDecoder();
      for (;;) { const { done, value } = await reader.read(); if (done) break; write(dec.decode(value, { stream: true })); }
    } catch (e) { line(e.name === "AbortError" ? "-- aborted --" : "[error] " + e.message); }
    if (buf.trim()) { out.insertAdjacentHTML("beforeend", colorize(buf)); paint(buf + "\n"); buf = ""; out.scrollTop = out.scrollHeight; }
    running = false; aborter = null; now.textContent = "run: " + name + " · " + ((performance.now() - t0) / 1000).toFixed(1) + "s"; tail.textContent = "";
  }

  async function command(raw) {
    const t = raw.trim();
    if (!t) return;
    history.push(t); hIdx = history.length;
    write("agent❯ " + t + "\n");
    if (t === "help") { line("commands:  help · ls · clear · run <name>"); line("           ↑/↓ history · Tab complete · ^L clear · ^C abort · Esc close"); return; }
    if (t === "clear") { out.textContent = ""; buf = ""; const rec = sessions.get(current); if (rec) rec.log = ""; return; }
    const d = await ensureDemos();
    if (t === "ls") { line(Object.entries(d).map(([k, v]) => "  " + k.padEnd(9) + v.label).join("\n")); return; }
    const m = t.match(/^(?:run\s+)?([\w-]+)$/);
    if (m && d[m[1]]) return run(m[1]);
    line("unrecognized: '" + t + "' — try help, ls, or run <name>");
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const v = input.value; input.value = ""; command(v); }
    else if (e.key === "ArrowUp") { if (hIdx > 0) { e.preventDefault(); input.value = history[--hIdx] ?? ""; } }
    else if (e.key === "ArrowDown") { if (hIdx < history.length) { e.preventDefault(); input.value = history[++hIdx] ?? ""; } }
    else if (e.key === "Tab") {
      e.preventDefault();
      const v = input.value;
      const pool = v.startsWith("run ") ? Object.keys(demos ?? {}) : CMDS;
      const hit = pool.find((c) => c.startsWith(v) && c !== v) ?? pool.find((c) => c.startsWith(v));
      if (hit) input.value = hit;
    } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.textContent = ""; buf = ""; const rec = sessions.get(current); if (rec) rec.log = ""; }
    else if (e.key === "c" && e.ctrlKey) { if (aborter) { aborter.abort(); e.preventDefault(); } }
    else if (e.key === "Escape") { term.classList.remove("open"); }
  });

  function addRow(sid) {
    const list = document.getElementById("chats"); if (!list) return null;
    const row = document.createElement("div");
    row.className = "chat ag-row";
    row.dataset.ag = sid;
    row.innerHTML = '<span class="cicon glyph" aria-hidden="true">▚</span><span class="ct">Agent run</span>';
    row.onclick = () => { activate(sid); place(); term.classList.add("open"); input.focus(); };
    list.prepend(row);
    return row;
  }
  function activate(sid) {
    current = sid;
    for (const r of document.querySelectorAll(".ag-row")) r.classList.toggle("cursor", r.dataset.ag === sid);
    out.textContent = ""; buf = "";
    const rec = sessions.get(sid);
    if (rec && rec.log) { out.textContent = rec.log; out.scrollTop = out.scrollHeight; }
  }
  async function newAgent() {
    const sid = "ag" + Date.now();
    sessions.set(sid, { log: "" });
    addRow(sid); activate(sid); place();
    term.classList.add("open"); input.focus();
    const d = await ensureDemos();
    line("fold agent — a coding run, not a chat.");
    line("runs: " + (Object.keys(d).join(" · ") || "(surface offline)"));
    line("type help, or run <name>.   ↑/↓ history · Tab complete · ^C abort · Esc close");
    line("");
    stat.innerHTML = SURFACE ? '<span class="on">● surface</span> ' + SURFACE.replace(/^https?:\/\//, "") : '<span class="off">● no surface</span>';
    if (!SURFACE) line("no local agentic surface — run: node penelope/gym/agentic-server.mjs");
  }

  const bind = () => { const s = document.getElementById("agStart"); if (s) s.onclick = newAgent; };
  bind();
  setInterval(bind, 500);
}
