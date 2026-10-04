// fold-chat.js — The Fold's chat version, LibreChat's UX, Fold-native.
//
// Standalone surface (this repo is the source of truth; it is vendored into
// the-fold). A browser page, no build: it speaks to the heimdall bridge
// (localhost:8790), which routes the fleet, linked hosts, and the sealed
// remote providers. Outside models are sealed-external — the chat never sends
// raw workspace material, and the evidence drawer reports who did the work.
//
// Affordances (LibreChat's, built for the fold): icon rail + chat sidebar,
// model/endpoint switcher, Projects, Chats grouped by time, a centered
// welcome + big composer, generative artifacts (isolated HTML previews, code
// cards), conversation memory (fork / edit / continue), presets, a live stage
// line, and the sealed badge always visible.

import * as client from "./fold-chat-client.js";
import { artifactsOf, previewable } from "./fold-chat-artifacts.js";

const DEFAULT_BRIDGE = "http://localhost:8790";
const PRESETS = Object.freeze({
  plain: { label: "Plain", system: "You are a helpful assistant. Reply directly and naturally." },
  fold: { label: "Fold", system: "You are helping the Fold. Answer plainly. Where the conversation carries grounded material, answer from it; where it does not, say what is missing instead of filling it in. Never claim a source you cannot show." },
  code: { label: "Code", system: "You are a coding assistant. Prefer concrete, working code. Put substantial snippets in a fenced block with its language so they render as artifacts." },
  build: { label: "Build", system: "You are a generative UI assistant. When asked to build something, produce a complete, self-contained HTML document inside a ```html fence — it renders live in an isolated preview." },
});

const $ = (id, r = document) => r.querySelector("#" + id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function icon(name) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.8");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", name === "folder" ? "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" : "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5");
  svg.append(p); return svg;
}
const now = () => new Date().toISOString();
const sid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

export function mount(root, opts = {}) {
  const bridge = opts.bridge || localStorage.getItem("fold-chat:bridge") || DEFAULT_BRIDGE;
  const sessions = load("fold-chat:sessions", {});
  const projects = load("fold-chat:projects", {});
  let activeId = null;
  let filterProject = null;
  let search = "";
  let models = [];
  let preset = localStorage.getItem("fold-chat:preset") || "fold";
  let meterInfo = null;

  const E = {
    railToggle: $("railToggle"), railNew: $("railNew"), railSearch: $("railSearch"), railEvidence: $("railEvidence"), railTheme: $("railTheme"),
    side: $("side"), models: $("models"), projects: $("projects"), chats: $("chats"), projAdd: $("projAdd"), chatNew: $("chatNew"),
    endpointPill: $("endpointPill"), topNew: $("topNew"), topPlus: $("topPlus"), topFocus: $("topFocus"), sealBadge: $("sealBadge"),
    welcome: $("welcome"), welcomeSub: $("welcomeSub"), thread: $("thread"), threadCol: $("threadCol"), stage: $("stage"),
    composer: $("composer"), input: $("input"), send: $("send"), attach: $("attach"), mic: $("mic"),
    drawer: $("drawer"), toast: $("toast"), footEvidence: $("footEvidence"), ver: $("ver"),
  };
  E.ver.textContent = "v0.1";

  // preset selector, injected under the model list
  const presetWrap = el("div", "sec");
  const presetHead = el("div", "sec-head", "Preset");
  const presetSel = el("select");
  presetSel.style.cssText = "margin:0 10px;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink)";
  for (const [k, p] of Object.entries(PRESETS)) presetSel.append(new Option(p.label, k));
  presetSel.value = preset;
  presetWrap.append(presetHead, presetSel);
  E.models.after(presetWrap);

  // Chat | Code — both go through the same bridge; Code dispatches to the
  // machine door (opencode) behind heimdall, Chat to the routed models.
  let mode = localStorage.getItem("fold-chat:mode") || "chat";
  const modeBar = el("div", "modebar");
  const modeBtns = {};
  for (const [k, label] of [["chat", "Chat"], ["code", "Code"]]) {
    const b = el("button", "modebtn" + (mode === k ? " on" : ""), label);
    b.onclick = () => { mode = k; try { localStorage.setItem("fold-chat:mode", k); } catch (e) {} for (const [kk, bb] of Object.entries(modeBtns)) bb.classList.toggle("on", kk === k); E.input.placeholder = k === "code" ? "Describe the change to make…" : "Message the fold"; };
    modeBtns[k] = b; modeBar.append(b);
  }
  E.composer.before(modeBar);

  function toast(msg) { E.toast.textContent = msg; E.toast.classList.add("show"); setTimeout(() => E.toast.classList.remove("show"), 1600); }

  /* ---------------- models ---------------- */
  async function refreshModels() {
    try { models = await client.listModels({ base: bridge }); }
    catch (e) { models = []; toast("heimdall bridge not answering — run heimdall up"); }
    renderModels();
  }
  function selectedModel() { return models.find((m) => m.id === sessions[activeId]?.model) || models.find((m) => !m.sealed) || models[0] || null; }
  function providerColor(p) { const s = String(p || ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return `hsl(${h} 60% 45%)`; }
  function renderModels() {
    E.models.innerHTML = "";
    if (!models.length) { E.models.append(el("div", "empty-hint", "no models — start the heimdall bridge")); return; }
    const cur = sessions[activeId]?.model;
    for (const m of models) {
      const row = el("div", "model" + (m.id === cur ? " on" : ""));
      const dot = el("span", "pdot"); dot.style.background = providerColor(m.provider);
      row.append(dot, el("span", "name", m.id));
      if (m.sealed) row.append(el("span", "seal", "sealed"));
      row.onclick = () => setModel(m.id);
      E.models.append(row);
    }
  }
  function setModel(id) {
    const s = sessions[activeId];
    if (s) { s.model = id; s.sealed = !!(models.find((m) => m.id === id)?.sealed); save("fold-chat:sessions", sessions); }
    renderModels();
    updateSeal();
  }
  function updateSeal() {
    const sealed = !!sessions[activeId]?.sealed;
    E.sealBadge.className = "sealbadge " + (sealed ? "seal-on" : "seal-off");
    E.welcomeSub.textContent = sealed ? "sealed-external — verbatim spans withheld; the reading only" : "Chat with the fold";
  }

  /* ---------------- projects ---------------- */
  function renderProjects() {
    E.projects.innerHTML = "";
    const all = el("div", "folder" + (filterProject === null ? " on" : ""));
    all.append(icon("layers"), el("span", "", "All chats"));
    all.onclick = () => { filterProject = null; renderProjects(); renderChats(); };
    E.projects.append(all);
    for (const [id, p] of Object.entries(projects)) {
      const row = el("div", "folder" + (filterProject === id ? " on" : ""));
      row.append(icon("folder"), el("span", "", p.name));
      row.onclick = () => { filterProject = id; renderProjects(); renderChats(); };
      E.projects.append(row);
    }
  }
  E.projAdd.onclick = () => {
    const name = prompt("Project name");
    if (!name || !name.trim()) return;
    const id = sid(); projects[id] = { id, name: name.trim() };
    save("fold-chat:projects", projects);
    renderProjects();
  };

  /* ---------------- chats ---------------- */
  function timeGroup(s) {
    const t = new Date(s.updated || s.createdAt || 0).getTime();
    const d = new Date(); const startToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (t >= startToday) return "Today";
    if (t >= startToday - 864e5) return "Yesterday";
    if (t >= startToday - 7 * 864e5) return "Previous 7 days";
    return "Older";
  }
  function renderChats() {
    E.chats.innerHTML = "";
    let list = Object.values(sessions);
    if (filterProject) list = list.filter((s) => s.project === filterProject);
    if (search) list = list.filter((s) => (s.title || "").toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => new Date(b.updated || b.createdAt || 0) - new Date(a.updated || a.createdAt || 0));
    const pinned = list.filter((s) => s.pinned);
    const rest = list.filter((s) => !s.pinned);
    if (pinned.length) group("Pinned", pinned);
    const groups = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
    for (const s of rest) groups[timeGroup(s)].push(s);
    for (const [label, arr] of Object.entries(groups)) if (arr.length) group(label, arr);
    if (!list.length) E.chats.append(el("div", "empty-hint", search ? "no chats match" : "no chats yet"));
  }
  function group(label, arr) {
    const g = el("div", "group");
    g.append(el("div", "group-label", label));
    for (const s of arr) {
      const row = el("div", "chat" + (s.id === activeId ? " on" : ""));
      const ic = el("span", "cicon"); ic.style.background = providerColor(s.model);
      const t = el("span", "ct", s.title || "New chat");
      const menu = el("button", "menu", "⋯");
      menu.onclick = (ev) => { ev.stopPropagation(); chatMenu(s.id); };
      row.append(ic, t, menu);
      row.onclick = () => open(s.id);
      g.append(row);
    }
    E.chats.append(g);
  }
  function chatMenu(id) {
    const s = sessions[id]; if (!s) return;
    const act = prompt(`"${s.title || "New chat"}" — type: pin / unpin / rename / project / delete`, s.pinned ? "unpin" : "pin");
    if (act == null) return;
    const a = act.trim().toLowerCase();
    if (a === "pin") s.pinned = true;
    else if (a === "unpin") s.pinned = false;
    else if (a === "rename") { const n = prompt("New title", s.title || ""); if (n != null && n.trim()) s.title = n.trim(); }
    else if (a === "delete") { delete sessions[id]; if (activeId === id) { activeId = null; } save("fold-chat:sessions", sessions); renderChats(); if (!activeId) newChat(); return; }
    else if (a === "project") {
      const names = Object.values(projects).map((p) => p.name);
      const n = prompt("Project name (blank to remove)", s.project && projects[s.project] ? projects[s.project].name : "");
      if (n != null) { const found = Object.entries(projects).find(([, p]) => p.name === n.trim()); s.project = found ? found[0] : null; }
    }
    save("fold-chat:sessions", sessions);
    renderChats();
  }

  /* ---------------- open / render thread ---------------- */
  function open(id) {
    activeId = id;
    const s = sessions[id];
    E.threadCol.innerHTML = "";
    const msgs = s?.messages || [];
    if (msgs.length) { E.welcome.style.display = "none"; E.thread.style.display = ""; }
    else { E.welcome.style.display = ""; E.thread.style.display = "none"; }
    for (let i = 0; i < msgs.length; i++) appendMsg(msgs[i].role, msgs[i].content, { sealed: msgs[i].sealed, index: i });
    renderChats(); renderModels(); updateSeal();
  }
  function newChat() {
    const id = sid();
    const m = models.find((x) => !x.sealed) || models[0] || null;
    sessions[id] = { id, title: "New chat", messages: [], model: m?.id || "", sealed: !!m?.sealed, project: filterProject, preset, createdAt: now(), updated: now() };
    save("fold-chat:sessions", sessions);
    open(id);
    E.input.focus();
  }
  function forkAt(id, upto) {
    const src = sessions[id]; if (!src) return;
    const fid = sid();
    sessions[fid] = { id: fid, title: (src.title || "chat") + " · fork", model: src.model, sealed: src.sealed, preset: src.preset, createdAt: now(), updated: now(), messages: (src.messages || []).slice(0, upto + 1).map((m) => ({ ...m })) };
    save("fold-chat:sessions", sessions);
    open(fid);
  }

  /* ---------------- rendering a message ---------------- */
  function renderArtifact(body, art) {
    const card = el("div", "art");
    const bar = el("div", "art-bar");
    bar.append(el("span", "art-title", art.title || "artifact"), el("span", "art-kind", art.kind + (art.lang && art.lang !== art.kind ? " · " + art.lang : "")), el("span", "art-sp"));
    const copy = el("button", "art-btn", "copy");
    const fold = el("button", "art-btn", "collapse");
    bar.append(fold, copy);
    const inner = el("div", "art-inner");
    if (previewable(art.kind)) { const f = document.createElement("iframe"); f.sandbox = "allow-scripts"; f.srcdoc = art.code; inner.append(f); }
    else { inner.append(el("pre", "art-code", art.code)); if (art.kind === "mermaid") inner.append(el("div", "art-note", "Mermaid renders in the fold's workspace; here it stays code.")); }
    copy.onclick = async () => { try { await navigator.clipboard.writeText(art.code); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy"), 1200); } catch (e) {} };
    fold.onclick = () => { inner.hidden = !inner.hidden; fold.textContent = inner.hidden ? "expand" : "collapse"; };
    card.append(bar, inner);
    body.append(card);
  }
  function appendMsg(role, content, meta = {}) {
    const wrap = el("div", "msg " + role);
    const av = el("div", "av", role === "user" ? "You" : "F");
    const body = el("div", "body");
    if (meta.sealed) body.classList.add("sealed-body");
    if (role === "assistant") {
      for (const b of artifactsOf(content)) {
        if (b.kind === "prose") { if (b.text.trim()) body.append(el("div", "", b.text.trim())); }
        else renderArtifact(body, b.artifact);
      }
      if (meta.index != null) {
        const acts = el("div", "actions");
        const cont = el("button", "act", "continue"); cont.onclick = () => continueFrom(meta.index);
        const fork = el("button", "act", "fork"); fork.onclick = () => forkAt(activeId, meta.index);
        acts.append(cont, fork); body.append(acts);
      }
    } else {
      body.textContent = content;
      if (meta.index != null) {
        const acts = el("div", "actions");
        const ed = el("button", "act", "edit"); ed.onclick = () => editMessage(meta.index);
        const fork = el("button", "act", "fork"); fork.onclick = () => forkAt(activeId, meta.index);
        acts.append(ed, fork); body.append(acts);
      }
    }
    wrap.append(av, body);
    E.threadCol.append(wrap);
    E.thread.scrollTop = E.thread.scrollHeight;
    return body;
  }
  function liveBody() { const b = appendMsg("assistant", "", {}); b.classList.add("live"); return b; }

  /* ---------------- memory: edit / continue ---------------- */
  function editMessage(index) {
    const s = sessions[activeId]; const m = s?.messages?.[index];
    if (!m || m.role !== "user") return;
    const next = prompt("Edit your message", m.content);
    if (next == null || !next.trim() || next.trim() === m.content) return;
    s.messages = s.messages.slice(0, index).concat([{ ...m, content: next.trim(), at: now() }]);
    save("fold-chat:sessions", sessions);
    open(activeId);
    run(activeId, true);
  }
  function continueFrom(index) {
    const s = sessions[activeId]; if (!s) return;
    const id = sid();
    sessions[id] = { id, title: (s.title || "chat") + " · continue", model: s.model, sealed: s.sealed, preset: s.preset, createdAt: now(), updated: now(), messages: s.messages.slice(0, index + 1).map((m) => ({ ...m })) };
    save("fold-chat:sessions", sessions);
    open(id);
    run(id, true);
  }

  /* ---------------- run ---------------- */
  async function run(id = activeId, continuing = false) {
    const s = sessions[id]; if (!s) return;
    const m = models.find((x) => x.id === s.model) || selectedModel();
    if (!m) { toast("no model — start the heimdall bridge"); return; }
    if (continuing) s.messages.push({ role: "user", content: "Continue.", at: now() });
    const history = s.messages.map((x) => ({ role: x.role, content: x.content }));
    if (PRESETS[s.preset]?.system) history.unshift({ role: "system", content: PRESETS[s.preset].system });
    s.updated = now(); save("fold-chat:sessions", sessions);
    E.welcome.style.display = "none"; E.thread.style.display = "";
    const body = liveBody();
    const ac = new AbortController();
    E.send.disabled = true; E.input.disabled = true;
    E.stage.textContent = m.sealed ? "sealed-external · working…" : "working…";
    try {
      const out = await client.chat(m.id, history, {
        base: bridge, privacy: "sealed-external",
        onToken: (t) => { body.textContent += t; E.thread.scrollTop = E.thread.scrollHeight; E.stage.textContent = "answering…"; },
        signal: ac.signal,
      });
      E.stage.textContent = "";
      body.classList.remove("live");
      const idx = s.messages.length;
      s.messages.push({ role: "assistant", content: out.text, at: now() });
      s.sealed = !!m.sealed;
      save("fold-chat:sessions", sessions);
      const live = body.closest(".msg"); if (live) live.remove();
      appendMsg("assistant", out.text, { sealed: m.sealed, index: idx });
      renderChats();
    } catch (err) {
      E.stage.textContent = ""; body.classList.remove("live"); body.textContent = "error: " + err.message;
    } finally {
      E.send.disabled = false; E.input.disabled = false; E.input.focus(); refreshMeter();
    }
  }

  // The coding lane: dispatched THROUGH heimdall to the local opencode
  // machine door. Renders the agent's tool activity then its answer.
  async function runCode(id = activeId) {
    const s = sessions[id]; if (!s) return;
    const body = liveBody();
    E.send.disabled = true; E.input.disabled = true;
    E.stage.textContent = "coding · the fold dispatches to the machine door…";
    try {
      const out = await client.code(s.messages[s.messages.length - 1].content, { base: bridge, title: s.title });
      E.stage.textContent = "";
      body.classList.remove("live"); body.textContent = "";
      if (Array.isArray(out.activity) && out.activity.length) {
        const list = el("div", "activity");
        for (const a of out.activity) list.append(el("div", "actrow", `${a.tool}${a.title ? " · " + a.title : ""}${a.status ? "  [" + a.status + "]" : ""}`));
        body.append(list);
      }
      const text = out.text || "(the machine door returned no text)";
      for (const b of artifactsOf(text)) {
        if (b.kind === "prose") { if (b.text.trim()) body.append(el("div", "", b.text.trim())); }
        else renderArtifact(body, b.artifact);
      }
      const idx = s.messages.length;
      s.messages.push({ role: "assistant", content: text, at: now() });
      s.updated = now();
      save("fold-chat:sessions", sessions);
      renderChats();
    } catch (err) {
      E.stage.textContent = ""; body.classList.remove("live"); body.textContent = "error: " + err.message;
    } finally {
      E.send.disabled = false; E.input.disabled = false; E.input.focus(); refreshMeter();
    }
  }

  E.composer.onsubmit = (e) => {
    e.preventDefault();
    const text = E.input.value.trim();
    if (!text) return;
    E.input.value = "";
    const s = sessions[activeId] || (newChat(), sessions[activeId]);
    s.messages.push({ role: "user", content: text, at: now() });
    s.title = s.title === "New chat" ? text.slice(0, 46) : s.title;
    s.updated = now();
    save("fold-chat:sessions", sessions);
    E.welcome.style.display = "none"; E.thread.style.display = "";
    appendMsg("user", text, { index: s.messages.length - 1 });
    renderChats();
    if (mode === "code") runCode(activeId);
    else {
      if (!models.length) { toast("no model — start the heimdall bridge"); return; }
      run(activeId, false);
    }
  };
  E.input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); E.composer.requestSubmit(); } });
  E.input.addEventListener("input", () => { E.input.style.height = "auto"; E.input.style.height = Math.min(E.input.scrollHeight, 200) + "px"; });

  presetSel.onchange = () => {
    preset = presetSel.value;
    try { localStorage.setItem("fold-chat:preset", preset); } catch (e) {}
    const s = sessions[activeId]; if (s) { s.preset = preset; save("fold-chat:sessions", sessions); }
  };

  /* ---------------- evidence drawer ---------------- */
  async function refreshMeter() { try { meterInfo = await client.meter({ base: bridge }); } catch { meterInfo = null; } }
  async function toggleDrawer() {
    const open = E.drawer.style.display === "none";
    E.drawer.style.display = open ? "" : "none";
    if (!open) return;
    E.drawer.innerHTML = "";
    const f = await client.frontier({ base: bridge }).catch(() => null);
    const led = await client.ledger({ base: bridge }).catch(() => null);
    await refreshMeter();
    const c = meterInfo?.counts || {};
    const head = el("div");
    head.innerHTML = `<h3>secure chat with outside models</h3><p>${esc(f?.gate || "the bridge reports no frontier gate yet.")}</p>
      <p class="invariant"><b>RAW WORKSPACE TOKENS SENT TO EXTERNAL MODELS</b> — this chat never sends raw material; the ledger records what actually left.</p>
      <p>local ${c["deterministic/local"] ?? 0} · remote ${c["open remote"] ?? 0} · frontier ${c.frontier ?? 0} · external tokens ${meterInfo?.externalTokens ?? 0}</p>`;
    E.drawer.append(head);
    if (led?.entries?.length) {
      const table = el("table", "ledger");
      const hr = el("tr"); for (const h of ["at", "selected", "reason", "tokens", "ok"]) hr.append(el("th", "", h)); table.append(hr);
      for (const e of led.entries.slice(-12).reverse()) {
        const tr = el("tr");
        tr.append(el("td", "", String(e.at || "").slice(11, 19)), el("td", "", e.selected || ""), el("td", "", e.reason || ""), el("td", "", e.actual?.outputTokens ?? ""), el("td", "", e.actual?.accepted ? "yes" : "no"));
        table.append(tr);
      }
      E.drawer.append(table);
    } else E.drawer.append(el("p", "empty-hint", "no dispatch records yet — send a message."));
  }

  /* ---------------- rail / topbar ---------------- */
  E.railToggle.onclick = () => { E.side.classList.toggle("hide"); E.railToggle.classList.toggle("on", !E.side.classList.contains("hide")); };
  E.railNew.onclick = E.chatNew.onclick = E.topNew.onclick = E.topPlus.onclick = newChat;
  E.railSearch.onclick = () => { const q = prompt("Search chats", search); search = q == null ? search : q.trim(); renderChats(); };
  E.railEvidence.onclick = E.footEvidence.onclick = (e) => { e.preventDefault(); toggleDrawer(); };
  E.railTheme.onclick = () => { const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", cur); try { localStorage.setItem("fold-chat:theme", cur); } catch (e) {} };
  E.topFocus.onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); };
  E.attach.onclick = () => toast("attachments land with the opencode adapter");
  E.mic.onclick = () => toast("voice is not wired yet");
  E.endpointPill.onclick = () => toast("endpoint: heimdall bridge @ " + bridge);

  /* ---------------- boot ---------------- */
  try { const t = localStorage.getItem("fold-chat:theme"); if (t) document.documentElement.setAttribute("data-theme", t); } catch (e) {}
  renderProjects();
  refreshModels().then(() => {
    const first = Object.values(sessions).sort((a, b) => new Date(b.updated || 0) - new Date(a.updated || 0))[0];
    if (first) open(first.id); else newChat();
    refreshMeter();
  });
}