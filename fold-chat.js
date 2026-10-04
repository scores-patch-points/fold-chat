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
import * as memory from "./fold-chat-memory.js";

const DEFAULT_BRIDGE = "http://localhost:8790";
const PRESETS = Object.freeze({
  plain: { label: "Plain", system: "You are a helpful assistant. Reply directly, briefly, and naturally, the way a person would. If the person just says hi or asks how you are, answer in kind and offer to help — do not ask them for files or material." },
  fold: { label: "Fold", system: "You are the fold — the reading and research surface over this person's own material: their audits, transcripts, reports, pages, and records. Reply plainly, in a warm, grounded voice. Where the conversation carries grounded material, answer from it; where it does not, say what is missing instead of filling it in. Never claim a source you cannot show, and never state a personal fact you were not given. When greeted — hi, hey, how are you — answer warmly and briefly, say what you can help with, and never ask them to produce passages or files." },
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

const CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';

// Inline text dialog — replaces window.prompt. Resolves the trimmed value on
// OK (empty string allowed), or null on cancel / Escape / backdrop.
function askDialog({ title, value = "", placeholder = "", okLabel = "OK" } = {}) {
  return new Promise((resolve) => {
    const modal = el("div", "modal");
    const sheet = el("div", "sheet dialog-sheet");
    const head = el("div", "sheet-head");
    head.append(el("h2", "", title), el("div", "grow"));
    const close = el("button", "sheet-close"); close.innerHTML = CLOSE_SVG;
    head.append(close);
    const field = el("div", "field");
    const input = document.createElement("input");
    input.type = "text"; input.value = value; input.placeholder = placeholder; input.autocomplete = "off"; input.spellcheck = false;
    field.append(input);
    const foot = el("div", "sheet-foot");
    const cancel = el("button", "btn", "Cancel");
    const ok = el("button", "btn primary", okLabel);
    foot.append(el("div", "grow"), cancel, ok);
    sheet.append(head, field, foot);
    modal.append(sheet);
    const done = (v) => { modal.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    document.addEventListener("keydown", onKey);
    cancel.onclick = close.onclick = () => done(null);
    ok.onclick = () => done(input.value.trim());
    modal.onclick = (e) => { if (e.target === modal) done(null); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok.click(); } });
    document.body.append(modal);
    input.focus(); input.select();
  });
}

// Inline chooser — resolves the chosen value, or null on cancel.
function chooseDialog({ title, items = [] } = {}) {
  return new Promise((resolve) => {
    const modal = el("div", "modal");
    const sheet = el("div", "sheet dialog-sheet");
    const head = el("div", "sheet-head");
    head.append(el("h2", "", title), el("div", "grow"));
    const close = el("button", "sheet-close"); close.innerHTML = CLOSE_SVG;
    head.append(close);
    const list = el("div", "choose-list");
    const done = (v) => { modal.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    document.addEventListener("keydown", onKey);
    for (const it of items) {
      const b = el("button", "choose-item" + (it.danger ? " danger" : ""), it.label);
      b.onclick = () => done(it.value);
      list.append(b);
    }
    sheet.append(head, list);
    modal.append(sheet);
    close.onclick = () => done(null);
    modal.onclick = (e) => { if (e.target === modal) done(null); };
    document.body.append(modal);
  });
}

// Anchored popup menu. items: [{ label, onClick, danger?, sep? }].
function menuAt(anchor, items) {
  document.querySelectorAll(".pop").forEach((p) => p.remove());
  const pop = el("div", "pop");
  for (const it of items) {
    if (it.sep) { pop.append(el("div", "sep")); continue; }
    const b = el("button", it.danger ? "danger" : "", it.label);
    b.onclick = () => { pop.remove(); it.onClick?.(); };
    pop.append(b);
  }
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  const left = Math.min(r.left, window.innerWidth - pr.width - 8);
  let top = r.bottom + 6;
  if (top + pr.height > window.innerHeight - 8) top = Math.max(8, r.top - pr.height - 6);
  pop.style.left = Math.max(8, left) + "px";
  pop.style.top = top + "px";
  const away = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener("mousedown", away); } };
  setTimeout(() => document.addEventListener("mousedown", away), 0);
  return pop;
}

export function mount(root, opts = {}) {
  // Where heimdall is. The stored override / opts.bridge is preferred; on boot
  // the surface also probes the standard local port itself, so a fresh
  // GitHub-Pages page finds a bridge the person never had to type in.
  let bridge = opts.bridge || localStorage.getItem("fold-chat:bridge") || DEFAULT_BRIDGE;
  let bridgeHello = null;
  const sessions = load("fold-chat:sessions", {});
  const projects = load("fold-chat:projects", {});
  let activeId = null;
  let filterProject = null;
  let search = "";
  let models = [];
  let preset = localStorage.getItem("fold-chat:preset") || "fold";
  let meterInfo = null;
  const collapsed = load("fold-chat:collapse", {});

  const E = {
    railToggle: $("railToggle"), railNew: $("railNew"), railSearch: $("railSearch"), railEvidence: $("railEvidence"), railTheme: $("railTheme"), railSettings: $("railSettings"),
    side: $("side"), models: $("models"), projects: $("projects"), chats: $("chats"), projAdd: $("projAdd"), chatNew: $("chatNew"),
    agentSlot: $("agentSlot"), curModel: $("curModel"),
    topNew: $("topNew"), topFocus: $("topFocus"), sealBadge: $("sealBadge"),
    welcome: $("welcome"), welcomeSub: $("welcomeSub"), thread: $("thread"), threadCol: $("threadCol"), stage: $("stage"),
    composerWrap: $("composerWrap"), composer: $("composer"), input: $("input"), send: $("send"), attach: $("attach"), mic: $("mic"),
    footer: $("footer"), drawer: $("drawer"), toast: $("toast"), footEvidence: $("footEvidence"), ver: $("ver"),
    settingsModal: $("settingsModal"), settingsClose: $("settingsClose"), settingsCancel: $("settingsCancel"), settingsSave: $("settingsSave"),
    setBridge: $("setBridge"), setPreset: $("setPreset"), setTheme: $("setTheme"), setMode: $("setMode"), setAbout: $("setAbout"),
  };
  E.ver.textContent = "v0.1";

  // Chat | Code — both go through the same bridge; Code dispatches to the
  // machine door (opencode) behind heimdall, Chat to the routed models. The
  // toggle rides the topbar as LibreChat's agent selector.
  let mode = localStorage.getItem("fold-chat:mode") || "chat";
  const modeBar = el("div", "agentbar");
  const modeBtns = {};
  for (const [k, label] of [["chat", "Chat"], ["code", "Code"]]) {
    const b = el("button", "agentbtn" + (mode === k ? " on" : ""), label);
    b.onclick = () => { mode = k; try { localStorage.setItem("fold-chat:mode", k); } catch (e) {} for (const [kk, bb] of Object.entries(modeBtns)) bb.classList.toggle("on", kk === k); E.input.placeholder = k === "code" ? "Describe the change to make…" : "Message the fold"; };
    modeBtns[k] = b; modeBar.append(b);
  }
  if (E.agentSlot) E.agentSlot.append(modeBar); else E.composer.before(modeBar);

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
    const groups = {};
    for (const m of models) { const t = m.tier || client.tierOf(m); (groups[t] || (groups[t] = [])).push(m); }
    for (const t of client.TIER_ORDER) {
      const list = groups[t]; if (!list || !list.length) continue;
      const meta = client.TIERS[t] || { label: t, note: "" };
      const head = el("div", "tier");
      head.append(el("span", "tier-label", meta.label));
      if (meta.note) head.append(el("span", "tier-note", meta.note));
      E.models.append(head);
      for (const m of list) {
        const row = el("div", "model" + (m.id === cur ? " on" : ""));
        const dot = el("span", "pdot"); dot.style.background = providerColor(m.provider);
        row.append(dot, el("span", "name", m.id));
        if (m.sealed) row.append(el("span", "seal", "sealed"));
        row.onclick = () => setModel(m.id);
        E.models.append(row);
      }
    }
  }
  function setModel(id) {
    const s = sessions[activeId];
    if (s) { s.model = id; s.sealed = !!(models.find((m) => m.id === id)?.sealed); save("fold-chat:sessions", sessions); }
    renderModels();
    updateSeal();
  }
  function updateSeal() {
    const s = sessions[activeId];
    const m = models.find((x) => x.id === s?.model);
    if (E.curModel) E.curModel.textContent = m ? m.id : "";
    const sealed = !!s?.sealed;
    if (E.sealBadge) E.sealBadge.className = "sealbadge " + (sealed ? "seal-on" : "seal-off");
    E.welcomeSub.textContent = sealed ? "sealed-external — verbatim spans withheld; the reading only" : "Contact: The Fold";
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
  E.projAdd.onclick = async (e) => {
    e.stopPropagation();
    const name = await askDialog({ title: "New project", placeholder: "Project name", okLabel: "Create" });
    if (!name) return;
    const id = sid(); projects[id] = { id, name };
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
      menu.onclick = (ev) => { ev.stopPropagation(); chatMenu(s.id, menu); };
      row.append(ic, t, menu);
      row.onclick = () => open(s.id);
      g.append(row);
    }
    E.chats.append(g);
  }
  function chatMenu(id, anchor) {
    const s = sessions[id]; if (!s) return;
    menuAt(anchor, [
      { label: s.pinned ? "Unpin" : "Pin", onClick: () => { s.pinned = !s.pinned; save("fold-chat:sessions", sessions); renderChats(); } },
      { label: "Rename…", onClick: async () => { const n = await askDialog({ title: "Rename chat", value: s.title || "", okLabel: "Rename" }); if (n) { s.title = n; save("fold-chat:sessions", sessions); renderChats(); } } },
      { label: "Move to project…", onClick: () => moveToProject(s) },
      { sep: true },
      { label: "Delete", danger: true, onClick: () => { delete sessions[id]; if (activeId === id) activeId = null; save("fold-chat:sessions", sessions); renderChats(); if (!activeId) newChat(); } },
    ]);
  }
  async function moveToProject(s) {
    const items = [{ label: "No project", value: "none" }];
    for (const [id, p] of Object.entries(projects)) items.push({ label: p.name, value: id });
    items.push({ label: "New project…", value: "new" });
    const v = await chooseDialog({ title: "Move to project", items });
    if (v == null) return;
    if (v === "new") {
      const name = await askDialog({ title: "New project", placeholder: "Project name", okLabel: "Create" });
      if (!name) return;
      const nid = sid(); projects[nid] = { id: nid, name }; save("fold-chat:projects", projects);
      s.project = nid;
    } else s.project = v === "none" ? null : v;
    save("fold-chat:sessions", sessions);
    renderProjects(); renderChats();
  }

  /* ---------------- open / render thread ---------------- */
  // The empty state is LibreChat's: the composer rides centered under the
  // welcome title. Once a thread exists, the composer docks above the footer.
  function setView(empty) {
    E.welcome.style.display = empty ? "" : "none";
    E.thread.style.display = empty ? "none" : "";
    if (!E.composerWrap) return;
    if (empty) { if (E.composerWrap.parentElement !== E.welcome) E.welcome.append(E.composerWrap); }
    else if (E.footer && E.composerWrap.nextElementSibling !== E.footer) E.footer.before(E.composerWrap);
  }
  function open(id) {
    activeId = id;
    const s = sessions[id];
    E.threadCol.innerHTML = "";
    const msgs = s?.messages || [];
    setView(!msgs.length);
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
  async function editMessage(index) {
    const s = sessions[activeId]; const m = s?.messages?.[index];
    if (!m || m.role !== "user") return;
    const next = await askDialog({ title: "Edit message", value: m.content, okLabel: "Save" });
    if (next == null || !next || next === m.content) return;
    s.messages = s.messages.slice(0, index).concat([{ ...m, content: next, at: now() }]);
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
  // The identity + memory pipeline: the fold holds who the person is, learns
  // it only when stated, carries it in the system context, and refuses to let
  // an ungrounded identity claim stand (resolution, never invention).
  let readerName = (() => { try { return localStorage.getItem("fold-chat:reader") || null; } catch { return null; } })();

  async function run(id = activeId, continuing = false) {
    const s = sessions[id]; if (!s) return;
    const m = models.find((x) => x.id === s.model) || selectedModel();
    if (!m) { toast("no model — start the heimdall bridge"); return; }
    if (continuing) s.messages.push({ role: "user", content: "Continue.", at: now() });
    const history = s.messages.map((x) => ({ role: x.role, content: x.content }));
    const sys = [PRESETS[s.preset]?.system, memory.systemContext({ readerName, facts: s.facts || {} })].filter(Boolean).join(" ");
    if (sys) history.unshift({ role: "system", content: sys });
    s.updated = now(); save("fold-chat:sessions", sessions);
    setView(false);
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
      // The guard: if the model asserted an identity the record cannot ground,
      // the fold withdraws it — the claim never stands.
      let text = out.text;
      const bad = memory.ungroundedIdentity(text, { readerName, facts: s.facts || {} });
      if (bad) text = text + "\n\n" + memory.identityCorrection(bad, { readerName });
      const idx = s.messages.length;
      s.messages.push({ role: "assistant", content: text, at: now() });
      s.sealed = !!m.sealed;
      save("fold-chat:sessions", sessions);
      const live = body.closest(".msg"); if (live) live.remove();
      appendMsg("assistant", text, { sealed: m.sealed, index: idx });
      renderChats();
    } catch (err) {
      E.stage.textContent = ""; body.classList.remove("live"); body.textContent = "error: " + err.message;
    } finally {
      E.send.disabled = false; E.input.disabled = false; E.input.focus(); refreshMeter();
    }
  }

  // The coding lane: dispatched THROUGH heimdall to the local opencode
  // machine door. Renders the agent's tool activity then its answer.
  // The model opencode reasons with is itself routed by heimdall (a
  // `heimdall` provider in opencode's config pointing at the bridge's /v1).
  const CODE_MODEL = { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" };
  function codeModelRef() { try { const v = JSON.parse(localStorage.getItem("fold-chat:codemodel") || "null"); return v || CODE_MODEL; } catch { return CODE_MODEL; } }
  async function runCode(id = activeId) {
    const s = sessions[id]; if (!s) return;
    const body = liveBody();
    E.send.disabled = true; E.input.disabled = true;
    E.stage.textContent = "coding · the fold dispatches to the machine door…";
    try {
      const out = await client.code(s.messages[s.messages.length - 1].content, { base: bridge, title: s.title, model: codeModelRef() });
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
    // Learn the person's name only when they state it — never guessed.
    const learned = memory.extractStatedName(text);
    if (learned) { s.facts = { ...(s.facts || {}), name: learned }; readerName = learned; try { localStorage.setItem("fold-chat:reader", learned); } catch (e) {} }
    s.title = s.title === "New chat" ? text.slice(0, 46) : s.title;
    s.updated = now();
    save("fold-chat:sessions", sessions);
    setView(false);
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

  /* ---------------- settings ---------------- */
  // The bridge, the preset, the theme, and the default mode — the surface's
  // configuration, kept out of the conversation sidebar.
  function applyPreset(next) {
    preset = next;
    try { localStorage.setItem("fold-chat:preset", preset); } catch (e) {}
    const s = sessions[activeId]; if (s) { s.preset = preset; save("fold-chat:sessions", sessions); }
  }
  function paintTheme() {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    for (const b of E.setTheme.querySelectorAll("button")) b.classList.toggle("on", b.dataset.theme === cur);
  }
  function paintMode() { for (const b of E.setMode.querySelectorAll("button")) b.classList.toggle("on", b.dataset.mode === mode); }
  E.setTheme.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; document.documentElement.setAttribute("data-theme", b.dataset.theme); try { localStorage.setItem("fold-chat:theme", b.dataset.theme); } catch (e2) {} paintTheme(); };
  E.setMode.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; mode = b.dataset.mode; try { localStorage.setItem("fold-chat:mode", mode); } catch (e2) {} for (const [kk, bb] of Object.entries(modeBtns)) bb.classList.toggle("on", kk === mode); E.input.placeholder = mode === "code" ? "Describe the change to make…" : "Message the fold"; paintMode(); };

  function openSettings() {
    for (const [k, p] of Object.entries(PRESETS)) if (!E.setPreset.querySelector(`option[value="${k}"]`)) E.setPreset.append(new Option(p.label, k));
    E.setBridge.value = bridge;
    E.setPreset.value = preset;
    paintTheme(); paintMode();
    E.setAbout.innerHTML = `bridge <b>${esc(bridge)}</b> · version <b>v0.1</b> · cloud models are <b>sealed-external</b> by default; raw workspace tokens never leave.`;
    E.settingsModal.hidden = false;
    E.setBridge.focus();
  }
  function closeSettings() { E.settingsModal.hidden = true; }
  function saveSettings() {
    const next = E.setBridge.value.trim();
    if (next) { try { localStorage.setItem("fold-chat:bridge", next); } catch (e) {} }
    applyPreset(E.setPreset.value);
    closeSettings();
    toast("settings saved");
    // The bridge may have moved — re-list the models it serves.
    if (next && next !== bridge) location.reload();
  }
  E.railSettings.onclick = openSettings;
  E.settingsClose.onclick = E.settingsCancel.onclick = closeSettings;
  E.settingsSave.onclick = saveSettings;
  E.settingsModal.addEventListener("click", (e) => { if (e.target === E.settingsModal) closeSettings(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !E.settingsModal.hidden) closeSettings(); });

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

  /* ---------------- collapsible sections ---------------- */
  for (const head of document.querySelectorAll(".sec-head")) {
    const sec = head.closest(".sec");
    const key = sec?.dataset.sec;
    if (key && collapsed[key]) sec.classList.add("collapsed");
    head.onclick = (e) => {
      if (e.target.closest("button")) return;
      sec.classList.toggle("collapsed");
      if (key) { collapsed[key] = sec.classList.contains("collapsed"); save("fold-chat:collapse", collapsed); }
    };
  }

  /* ---------------- rail / topbar ---------------- */
  E.railToggle.onclick = () => { E.side.classList.toggle("hide"); E.railToggle.classList.toggle("on", !E.side.classList.contains("hide")); };
  for (const b of [E.railNew, E.chatNew, E.topNew, E.topPlus]) if (b) b.onclick = newChat;
  E.railSearch.onclick = async () => {
    const q = await askDialog({ title: "Search chats", value: search, placeholder: "Search titles", okLabel: "Search" });
    if (q == null) return;
    search = q.trim();
    renderChats();
  };
  E.railEvidence.onclick = E.footEvidence.onclick = (e) => { e.preventDefault(); toggleDrawer(); };
  E.railTheme.onclick = () => { const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", cur); try { localStorage.setItem("fold-chat:theme", cur); } catch (e) {} };
  E.topFocus.onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); };
  E.attach.onclick = () => toast("attachments land with the opencode adapter");
  E.mic.onclick = () => toast("voice is not wired yet");

  /* ---------------- boot ---------------- */
  try { const t = localStorage.getItem("fold-chat:theme"); if (t) document.documentElement.setAttribute("data-theme", t); } catch (e) {}
  renderProjects();
  // Auto-detect the bridge first (the override, then the standard local port),
  // then list whatever it serves. A page served from GitHub Pages finds the
  // person's own heimdall this way, with no URL to type.
  client.detectBridge({ override: opts.bridge || null }).then((found) => {
    if (found.ok) { bridge = found.base; bridgeHello = found.hello; }
    else toast("heimdall not found — run `heimdall up`");
    refreshModels().then(() => {
      const first = Object.values(sessions).sort((a, b) => new Date(b.updated || 0) - new Date(a.updated || 0))[0];
      if (first) open(first.id); else newChat();
      refreshMeter();
      updateBridgeStatus();
    });
  });
}