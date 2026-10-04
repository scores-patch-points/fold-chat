// fold-chat.js — The Fold's chat surface. A browser page, no build, no server
// of its own: it speaks to the heimdall bridge (localhost:8790), which routes
// through the fleet, linked hosts, and the sealed remote providers. The chat
// never carries raw workspace material; for outside models it sends
// heimdall_privacy:"sealed-external" and shows the sealed badge, and the
// evidence drawer reports exactly who did the work and how many external
// tokens left.
//
// LibreChat-style features (artifacts, memory, search) are the roadmap; this
// first cut is the honest core: a chat that is sealed by default and routed
// by heimdall.

import * as client from "./fold-chat-client.js";

const DEFAULT_BRIDGE = "http://localhost:8790";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function now() {
  return new Date().toISOString();
}

function loadSessions() {
  try { return JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"); } catch { return {}; }
}
function saveSessions(sessions) {
  localStorage.setItem("fold-chat:sessions", JSON.stringify(sessions));
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function mount(root, opts = {}) {
  const bridge = opts.bridge || localStorage.getItem("fold-chat:bridge") || DEFAULT_BRIDGE;
  const sessions = loadSessions();
  let activeId = null;
  let models = [];
  let streamAbort = null;
  let meterInfo = null;

  root.classList.add("fc");

  /* ---------------- layout ---------------- */
  const sidebar = el("aside", "fc-side");
  const brand = el("div", "fc-brand", "fold · chat");
  const runtime = el("div", "fc-runtime", "");
  const newBtn = el("button", "fc-btn", "new chat");
  const list = el("div", "fc-sessions");
  const drawerBtn = el("button", "fc-btn", "evidence");
  const meterLine = el("div", "fc-meter", "");
  sidebar.append(brand, runtime, newBtn, list, drawerBtn, meterLine);

  const main = el("main", "fc-main");
  const head = el("div", "fc-head");
  const title = el("div", "fc-title", "…");
  const modelWrap = el("div", "fc-model");
  const modelSel = el("select");
  modelWrap.append(el("label", "", "model"), modelSel);
  const sealBadge = el("div", "fc-seal fc-seal-off", "sealed-external");
  head.append(title, modelWrap, sealBadge);

  const thread = el("div", "fc-thread");
  const composer = el("form", "fc-composer");
  const input = el("textarea", "fc-input");
  input.placeholder = "ask the fold… (raw workspace material never leaves)";
  input.rows = 2;
  const send = el("button", "fc-send", "send");
  composer.append(input, send);

  const drawer = el("section", "fc-drawer");
  drawer.hidden = true;

  main.append(head, thread, composer, drawer);
  root.append(sidebar, main);

  /* ---------------- model list ---------------- */
  async function refreshModels() {
    try {
      models = await client.listModels({ base: bridge });
      runtime.textContent = "server runtime · heimdall attached";
    } catch (e) {
      models = [];
      runtime.textContent = "heimdall bridge not answering — start it (heimdall up) or serve this page from localhost";
    }
    modelSel.innerHTML = "";
    if (!models.length) {
      modelSel.append(new Option("(no models)", ""));
      return;
    }
    for (const m of models) {
      const opt = new Option(m.sealed ? `${m.id}  ·  ${m.provider} (sealed)` : m.id, m.id);
      modelSel.append(opt);
    }
    modelSel.value = models.find((m) => !m.sealed)?.id ?? models[0]?.id ?? "";
  }

  function selectedModel() {
    return models.find((m) => m.id === modelSel.value) ?? null;
  }

  /* ---------------- sessions ---------------- */
  function renderSessions() {
    list.innerHTML = "";
    for (const [id, s] of Object.entries(sessions)) {
      const row = el("button", "fc-session" + (id === activeId ? " fc-active" : ""), s.title || id);
      row.onclick = () => open(id);
      list.append(row);
    }
  }

  function renderTitle() {
    const s = sessions[activeId];
    title.textContent = s?.title || "fold · chat";
  }

  function open(id) {
    activeId = id;
    renderSessions();
    renderTitle();
    thread.innerHTML = "";
    for (const m of sessions[id]?.messages || []) appendMsg(m.role, m.content, m.sealed);
    sealBadge.className = "fc-seal " + (sessions[id]?.sealed ? "fc-seal-on" : "fc-seal-off");
    input.focus();
  }

  function newChat() {
    const id = now() + "-" + Math.random().toString(36).slice(2, 6);
    const model = selectedModel()?.id ?? models[0]?.id ?? "";
    sessions[id] = { id, title: "new chat", messages: [], model, createdAt: now() };
    saveSessions(sessions);
    open(id);
  }

  function appendMsg(role, content, sealed) {
    const wrap = el("div", "fc-msg fc-" + role);
    const who = el("div", "fc-who", role === "user" ? "you" : "fold");
    const body = el("div", "fc-body");
    body.innerHTML = esc(content).replace(/\n/g, "<br>");
    if (sealed) body.classList.add("fc-sealed-msg");
    wrap.append(who, body);
    thread.append(wrap);
    thread.scrollTop = thread.scrollHeight;
    return body;
  }

  /* ---------------- chat ---------------- */
  composer.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const m = selectedModel();
    if (!m) return;
    input.value = "";
    const s = sessions[activeId] || newChat();
    s.messages.push({ role: "user", content: text, at: now() });
    s.title = s.title === "new chat" ? text.slice(0, 48) : s.title;
    s.model = m.id;
    s.sealed = m.sealed;
    saveSessions(sessions);
    renderSessions();
    renderTitle();
    appendMsg("user", text, false);
    sealBadge.className = "fc-seal " + (m.sealed ? "fc-seal-on" : "fc-seal-off");

    const body = appendMsg("assistant", "", m.sealed);
    const ac = new AbortController();
    streamAbort = ac;
    send.disabled = true;
    input.disabled = true;
    try {
      const out = await client.chat(m.id, s.messages.map((x) => ({ role: x.role, content: x.content })), {
        base: bridge,
        privacy: m.sealed ? "sealed-external" : "sealed-external",
        onToken: (t) => { body.textContent += t; thread.scrollTop = thread.scrollHeight; },
        signal: ac.signal,
      });
      s.messages.push({ role: "assistant", content: out.text, at: now() });
      saveSessions(sessions);
    } catch (err) {
      body.textContent = "error: " + err.message;
    } finally {
      send.disabled = false;
      input.disabled = false;
      streamAbort = null;
      input.focus();
      refreshMeter();
    }
  };

  /* ---------------- evidence drawer ---------------- */
  async function refreshMeter() {
    try {
      meterInfo = await client.meter({ base: bridge });
    } catch { meterInfo = null; }
    if (meterInfo) {
      const c = meterInfo.counts || {};
      meterLine.textContent = `local ${c["deterministic/local"] ?? 0} · remote ${c["open remote"] ?? 0} · frontier ${c.frontier ?? 0} · external tokens ${meterInfo.externalTokens ?? 0}`;
    } else {
      meterLine.textContent = "no dispatch meter yet";
    }
  }

  drawerBtn.onclick = async () => {
    drawer.hidden = !drawer.hidden;
    if (drawer.hidden) return;
    drawer.innerHTML = "";
    const f = await client.frontier({ base: bridge }).catch(() => null);
    const led = await client.ledger({ base: bridge }).catch(() => null);
    const gate = el("div", "fc-gate");
    gate.innerHTML = `<h3>secure chat with outside models</h3><p>${esc(f?.gate || "the bridge reports no frontier gate yet.")}</p>
<p class="fc-invariant"><b>RAW WORKSPACE TOKENS SENT TO EXTERNAL MODELS</b> — this chat never sends raw material; the ledger records what actually left.</p>`;
    drawer.append(gate);
    if (led?.entries?.length) {
      const table = el("table", "fc-ledger");
      const headRow = el("tr");
      for (const h of ["at", "job", "selected", "reason", "tokens", "accepted"]) headRow.append(el("th", "", h));
      table.append(headRow);
      for (const e of led.entries.slice(-12).reverse()) {
        const tr = el("tr");
        tr.append(el("td", "", String(e.at || "").slice(11, 19)));
        tr.append(el("td", "", e.job || ""));
        tr.append(el("td", "", e.selected || ""));
        tr.append(el("td", "", e.reason || ""));
        tr.append(el("td", "", e.actual?.outputTokens ?? ""));
        tr.append(el("td", "", e.actual?.accepted ? "yes" : "no"));
        table.append(tr);
      }
      drawer.append(table);
    } else {
      drawer.append(el("p", "fc-empty", "no dispatch records yet — send a message."));
    }
    refreshMeter();
  };

  /* ---------------- boot ---------------- */
  newBtn.onclick = newChat;
  refreshModels().then(() => {
    const first = Object.keys(sessions)[0];
    if (first) open(first);
    else newChat();
    refreshMeter();
  });
}