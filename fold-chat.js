// fold-chat.js — The Fold's chat version, LibreChat's UX, Fold-native.
//
// Standalone surface (this repo is the source of truth; it is vendored into
// the-fold). A browser page, no build. The model runs IN THIS TAB (fold-chat-webllm.js, WebGPU) — no bridge needed to answer. The
// Fold's own server mounts heimdall at /heimdall on this page's origin (server.mjs); it routes the fleet, linked hosts and the
// sealed remote providers, and serves the doors (read, reason, weave, code). Outside models are sealed-external — the chat never
// sends raw workspace material, and the evidence drawer reports who did the work. An in-tab model never leaves the tab.
//
// Affordances (LibreChat's, built for the fold): icon rail + chat sidebar,
// model/endpoint switcher, Projects, Chats grouped by time, a centered
// welcome + big composer, generative artifacts (isolated HTML previews, code
// cards), conversation memory (fork / edit / continue), presets, a live stage
// line, and the sealed badge always visible.

import * as client from "./fold-chat-client.js";
import { artifactsOf, previewable } from "./fold-chat-artifacts.js";
import { mdHtml } from "./fold-chat-render.js";
import * as memory from "./fold-chat-memory.js";
import * as ground from "./fold-chat-ground.js";
import * as web from "./fold-chat-web.js";
// What this tab has already read, and which hosts turned it away: a follow-up about the same pages costs no fetch.
const pageMemo = web.makeMemo();
import { classifyTurn, GENERATE_NUDGE, checkable, recordable, skipsSearch, noClaimsLabel, KIND_PROMPT } from "./fold-chat-discourse.js";
import { evaluate as computeEvaluate, answerKeeps } from "./fold-chat-compute.js";
import { UNSOURCED_ANSWERS, unsourcedPlan, sourcesPrompt, liveAsk, unreachedGap, liveGap, emptyNotice, errorNotice, declinedFallbackNotice, noModelFallbackNotice, gapAnswerLine, modelSpeaksAlone, aloneTurn } from "./fold-chat-gaps.js";
import { threadPrompt, threadNotice, coldFollowUpNotice } from "./fold-chat-thread.js";
// GARY, TERRY GROSS AND THE PATHOS ARCHONS (vendored khora organs, by closure): the prompt door (what the mouth is handed, in what
// order, question last, a refused fold withheld), the conversation's flow (follow-ups, push-backs and frame-asks are moves against
// the thread), and the felt shape of the recent answers for a DECLARED experiencer.
import { door as garyDoor, noteWindows } from "./fold-chat-gary.js";
import { planTurn, cuesFor, actOf } from "./fold-chat-flow.js";
import { readFelt } from "./fold-chat-pathos.js";
import { hintsFor } from "./fold-chat-hints.js";
import { admitReferents, emptyReferents } from "./fold-chat-mind.js";
import { fetchLoaded, describeLoaded, noModelWhy, createLoadedPoller } from "./fold-chat-loaded.js";
import { createPageEngine, canonicalModelId, ollamaTagOf, MODEL_CHOICES } from "./fold-chat-webllm.js";
import { snipsOf, strandText, storeSnip, verifySnips } from "./fold-chat-strand.js";
import { renderStrand } from "./fold-chat-strandview.js";
import { ANSWER_MODES, normAnswerMode, resolveAnswerMode, answerModeOfTurn } from "./fold-chat-answer.js";
import { stripScaffolding, checkAttributions, attributionNotice } from "./fold-chat-attribution.js";
import { detectLang, sameLanguage, languageInstruction, restateMessages, languageNotice } from "./fold-chat-lang.js";
import { senseTerm, disambiguationOf, sensesLine } from "./fold-chat-senses.js";
import { voidReport, voidText, voidLabel, normVoid, migrateSessions, modelHistory } from "./fold-chat-channels.js";
import { recipeSnips, CARD_PROMPT } from "./fold-chat-snip.js";
import { renderSnips } from "./fold-chat-snipview.js";
import { configureTip, tipControl } from "./fold-chat-tipview.js";
import { jumpToSnip } from "./fold-chat-pagerview.js";
import { isExtension } from "./fold-chat-exit.js";
import * as topic from "./fold-chat-topic.js";
import { PHOSPHOR, PHOSPHOR_VIEWBOX } from "./fold-chat-icons.js";
import * as FOLD from "./vendor/the-fold/fold.js";
import { runAgent } from "./fold-chat-agent.js";
import { observeArtifact, callMany } from "./fold-chat-sandbox.js";
import { createFeed, replayFeed } from "./fold-chat-agentfeed.js";
import { newTurnTrace, startEvents, lineEvent, beginStep, endStep, noteEvent, doneEvents, eventsForStep, summaryLine, storeEvents } from "./fold-chat-turnfeed.js";
import { createFold, addVersion as addFoldVersion, addLog as addFoldLog, addEvent as addFoldEvent, snapshot as foldSnapshot, revive as foldRevive } from "./fold-chat-fold.js";
import { mountFold, tuckSteps } from "./fold-chat-foldview.js";
import { createOutbound, describeSummary, formatBytes } from "./fold-chat-outbound.js";
import { mountMonitor } from "./fold-chat-monitor.js";
import { createTaint } from "./fold-chat-seal.js";
import { createRedactor, DEFAULT_REDACTOR } from "./fold-chat-redact.js";
import * as life from "./fold-chat-sessions.js";

const PRESETS = Object.freeze({
  plain: { label: "Plain", system: "You are a helpful assistant. Reply directly, briefly, and naturally, the way a person would. If the person just says hi or asks how you are, answer in kind and offer to help — do not ask them for files or material." },
  fold: { label: "Fold", system: "You are the fold — the reading and research surface over this person's own material: their documents, transcripts, reports, pages, records, and the live web. Reply plainly, in a warm, grounded voice. You research people, relationships, and events from SOURCES: when asked about a person, report what the sources say, quoting and citing them — that is the work, and it is fine to do. The conversation itself is NEVER a source. Ground every factual claim in the material you were given (attachments, pasted documents, web passages); never ground in the dialogue, and never in your own memory. You may not ASSERT a personal fact you were not given — but you may report a sourced one and point to where it came from. Where the material does not cover something, say plainly what is missing instead of filling it in. Never claim a source you cannot show. When greeted — hi, hey, how are you — answer warmly and briefly." },
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
// A Phosphor icon, by name, from the vendored set (fold-chat-icons.js). The
// chat's topic icon — the same mark in the sidebar and on the assistant's
// messages, so a conversation wears what it became about.
function phosphor(name, size = 16) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", PHOSPHOR_VIEWBOX);
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("width", String(size)); svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = PHOSPHOR[name] || PHOSPHOR[topic.FALLBACK_ICON] || "";
  return svg;
}
const now = () => new Date().toISOString();
const sid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// A model content-refusal, not an answer: "I cannot…", "I do not have access to
// personal information…", "I'm unable to…". Short and apology-flavoured.
const REFUSAL_RE = /\b(i (?:can(?:no|')t|am unable|cannot|do not have access|don'?t have access|won'?t|will not)|i'm sorry,? but|as an ai|i am not able|i'm not able)\b/i;
function isRefusal(text) {
  const t = String(text ?? "").trim();
  if (!t) return false;
  // Only a SHORT apology/refusal counts — a long answer that merely contains a
  // caveat is not a refusal.
  if (t.length > 320) return false;
  return REFUSAL_RE.test(t) && !/\b(source|according to|https?:|\b\d{3,4}\b)/i.test(t);
}
// A real CODE/files task (dispatch to the machine door) vs. a research/writing
// question that happens to be asked while the Code engagement is selected.
function isCodeTask(text) {
  const t = String(text ?? "");
  // A factual/comparative question is never a code task, even in Code mode.
  if (/^(who|what|when|where|which|why|how many|how much|compare|find|tell me|search)\b/i.test(t)) return false;
  // An explicit prose ask (essay/report/letter… about) is generation, not code —
  // even in Code mode it rides penelope's prose weave, never the coding pipeline.
  if (/\b(essay|article|story|poem|song|report|summary|letter|email|post|blog|copy|piece|outline|plan|guide|analysis|review|memo|brief)\b/i.test(t)) return false;
  // EVERYTHING ELSE in Code mode is the machine's to decide. A keyword regex
  // can never route "make me a countdown clock" — the coding pipeline swarms
  // the ask and reads the units itself, disclosing a gap when it is not a
  // coding ask. (2026-10-04: the keyword gate fell through to the chat lane
  // and the coder refused in prose — the exact failure this replaces.)
  return true;
}

/** The fence language for a raw code-lane artifact: HTML-looking text renders
 *  as a previewable page, everything else as a JS code card. Deterministic,
 *  never the model's word. */
function fenceLangFor(text) {
  const t = String(text ?? "").trimStart();
  if (/^<!doctype html>/i.test(t) || /^<html[\s>]/i.test(t)) return "html";
  return "js";
}

// THE VOID — what the turn could NOT establish — lives in fold-chat-channels.js
// (voidReport returns it as DATA; voidText is its one-line text for the process
// panel only). It is drawn as its own gap block, never appended to the answer.
function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; } }
// STOPPING A TURN. A stop (button, Escape, or deleting the chat) aborts one
// AbortController; these let work that does not take a signal itself (the web
// search) yield at once and let its fetches carry the signal.
function abortError() { const e = new Error("stopped"); e.name = "AbortError"; return e; }
function raceAbort(p, signal) {
  if (!signal) return p;
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const on = () => reject(abortError());
    signal.addEventListener("abort", on, { once: true });
    p.then((v) => { signal.removeEventListener("abort", on); resolve(v); }, (e) => { signal.removeEventListener("abort", on); reject(e); });
  });
}
function anyOf(a, b) {
  if (!a) return b;
  if (typeof AbortSignal !== "undefined" && AbortSignal.any) return AbortSignal.any([a, b]);
  const c = new AbortController();
  for (const x of [a, b]) { if (x.aborted) c.abort(); else x.addEventListener("abort", () => c.abort(), { once: true }); }
  return c.signal;
}
function withSignal(fetchImpl, signal) { return (u, o = {}) => fetchImpl(u, { ...o, signal: anyOf(o.signal, signal) }); }

// DELETED IDS (tombstones): a chat or project deleted here is remembered for 30
// days as id -> deletedAt, so a second tab holding a stale copy can never write
// it back. The sessions/projects maps are saved by MERGING with what is stored
// (life.mergeSessions): a chat only another tab has is kept, the later `updated`
// wins, a tombstoned id stays dead.
const DELETED_KEY = "fold-chat:deleted";
function loadTombs() { return life.pruneTombstones(load(DELETED_KEY, {}) || {}, Date.now()); }
function tombstone(ids) {
  const t = loadTombs(); const at = new Date().toISOString();
  for (const id of ids) t[id] = at;
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(t)); } catch (e) {}
}
function untombstone(id) {
  const t = loadTombs(); delete t[id];
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(t)); } catch (e) {}
}
function save(key, v) {
  try {
    if (key === "fold-chat:sessions" || key === "fold-chat:projects") v = life.mergeSessions(v, load(key, {}) || {}, loadTombs());
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {}
}

const CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
// The × of a dialog sheet, with a name a screen reader can say.
function closeButton() {
  const b = el("button", "sheet-close"); b.type = "button";
  b.setAttribute("aria-label", "Close"); b.title = "Close";
  b.innerHTML = CLOSE_SVG;
  return b;
}
// A modal overlay + sheet, announced as a dialog named by its heading.
function modalSheet(sheetClass = "sheet") {
  const modal = el("div", "modal");
  const sheet = el("div", sheetClass);
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true");
  return { modal, sheet };
}
// Make a non-button row (chat, project, folder, section head) keyboard-operable.
function activatable(node, label) {
  node.tabIndex = 0;
  node.setAttribute("role", "button");
  if (label) node.setAttribute("aria-label", label);
  node.addEventListener("keydown", (e) => {
    if (e.target !== node) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); node.click(); }
  });
  return node;
}

// Inline text dialog — replaces window.prompt. Resolves the trimmed value on
// OK (empty string allowed), or null on cancel / Escape / backdrop.
function askDialog({ title, value = "", placeholder = "", okLabel = "OK" } = {}) {
  return new Promise((resolve) => {
    const { modal, sheet } = modalSheet("sheet dialog-sheet");
    const head = el("div", "sheet-head");
    const h = el("h2", "", title); h.id = "dlg" + sid();
    sheet.setAttribute("aria-labelledby", h.id);
    head.append(h, el("div", "grow"));
    const close = closeButton();
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
    const { modal, sheet } = modalSheet("sheet dialog-sheet");
    const head = el("div", "sheet-head");
    const h = el("h2", "", title); h.id = "dlg" + sid();
    sheet.setAttribute("aria-labelledby", h.id);
    head.append(h, el("div", "grow"));
    const close = closeButton();
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

// Inline confirm — resolves true on the confirming button, false on cancel /
// Escape / backdrop. Cancel holds focus: a destructive confirm is never one
// stray Enter away.
function confirmDialog({ title, message = "", okLabel = "OK", danger = false } = {}) {
  return new Promise((resolve) => {
    const { modal, sheet } = modalSheet("sheet dialog-sheet");
    const head = el("div", "sheet-head");
    const h = el("h2", "", title); h.id = "dlg" + sid();
    sheet.setAttribute("aria-labelledby", h.id);
    head.append(h, el("div", "grow"));
    const close = closeButton();
    head.append(close);
    const msg = el("p", "hint dialog-msg", message);
    const foot = el("div", "sheet-foot");
    const cancel = el("button", "btn", "Cancel"); cancel.type = "button";
    const ok = el("button", "btn " + (danger ? "danger" : "primary"), okLabel); ok.type = "button";
    foot.append(el("div", "grow"), cancel, ok);
    sheet.append(head, msg, foot);
    modal.append(sheet);
    const done = (v) => { modal.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); done(false); } };
    document.addEventListener("keydown", onKey);
    cancel.onclick = close.onclick = () => done(false);
    ok.onclick = () => done(true);
    modal.onclick = (e) => { if (e.target === modal) done(false); };
    document.body.append(modal);
    cancel.focus();
  });
}

// Anchored popup menu. items: [{ label, onClick, danger?, sep? }].
function menuAt(anchor, items) {
  document.querySelectorAll(".pop").forEach((p) => p.remove());
  const pop = el("div", "pop");
  pop.setAttribute("role", "menu");
  for (const it of items) {
    if (it.sep) { const sp = el("div", "sep"); sp.setAttribute("role", "separator"); pop.append(sp); continue; }
    const b = el("button", it.danger ? "danger" : "", it.label);
    b.type = "button"; b.setAttribute("role", "menuitem");
    b.onclick = () => { pop.remove(); it.onClick?.(); };
    pop.append(b);
  }
  // Keyboard: arrows move, Escape closes and hands focus back to the opener.
  pop.addEventListener("keydown", (e) => {
    const btns = [...pop.querySelectorAll("button")];
    const i = btns.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
    // Escape closes ONLY this menu (not the nav drawer or the evidence drawer
    // beneath it) and hands focus back to the button that opened it.
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); pop.remove(); anchor.focus?.(); }
    else if (e.key === "Tab") pop.remove();
  });
  document.body.append(pop);
  pop.querySelector("button")?.focus();
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
  // Where heimdall is. The stored override / opts.bridge is preferred (except an old stored standalone-bridge port, which never
  // shadows the embedded heimdall serving this very page); on boot the surface probes the same-origin /heimdall first, then the
  // legacy local port, so a fresh page finds a bridge the person never had to type in. A page with none still has its in-tab model.
  let bridge = client.pickBridge(opts.bridge || localStorage.getItem("fold-chat:bridge"));
  let bridgeHello = null;
  const sessions = load("fold-chat:sessions", {});
  // Sessions stored before the channels were split carry the system-authored
  // "⟂ void — …" paragraph baked into assistant `content`. Move it out, once,
  // and save back, so old chats render as gap blocks and stop polluting history.
  if (migrateSessions(sessions)) save("fold-chat:sessions", sessions);
  const projects = load("fold-chat:projects", {});
  let activeId = null;
  // TURNS IN FLIGHT, by chat id: { ac, stop, label, startedAt, wrap, stage }. A turn
  // belongs to ITS chat, not to whichever chat is open when it finishes: every UI
  // write a turn makes is guarded by `activeId === id`, the persisted session
  // record is always updated, and the composer's lock is derived from this map
  // (life.composerLocked) for the OPEN chat only.
  const inflight = new Map();
  let filterProject = null;
  let search = "";
  let models = [];
  // WHAT LEFT THIS MACHINE. One ledger for the page: every request to an outside
  // model (through heimdall's sealed gate) and every direct call to a public
  // service is recorded before it leaves, graded, and cross-checked against
  // heimdall's own ledger (heimdall/src/audit.js). The TAINT registry holds
  // private particulars learned from local reads; an outgoing request that
  // carries one is flagged. The "never sent raw material" line in the drawer is
  // computed from this, not asserted.
  const taint = createTaint();
  const outbound = createOutbound({ storage: localStorage, taint, auditUrl: null });
  // The local Python PII redactor (scripts/pii/server.py). "fold-chat:privacymode" = "open" is the person's opt-in to sending more of their
  // own material; either way personal identifiers are replaced by per-turn ids first, and an unreachable redactor means nothing is sent.
  const redactor = createRedactor({ base: (() => { try { return localStorage.getItem("fold-chat:piibase") || DEFAULT_REDACTOR; } catch { return DEFAULT_REDACTOR; } })() });
  const privacyMode = () => { try { return localStorage.getItem("fold-chat:privacymode") === "open" ? "open" : "default"; } catch { return "default"; } };
  // "Tip the creator" reads the creator's OWN contact page, only on a click: audited like any page read, through the tab's page memory.
  configureTip({ humans: true, readText: (u, o = {}) => web.readText(u, { memo: pageMemo, fetchImpl: outbound.auditedFetch("tip: the creator's own page"), direct: isExtension() || !!o.direct }) });   // o.direct: humans.txt is a guessed URL, read through the direct door only, never a proxy
  let currentRun = null;
  const newRun = (kind) => (currentRun = kind + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  // GARY'S DOOR: every model call this page makes (the turn, the restatement, a sealed code draw) is read by Gary before it is audited
  // or sent; one he refuses never leaves.
  client.setPromptDoor(garyDoor.guard);
  client.setAuditHook({
    before: (info) => {
      const m = models.find((x) => x.id === info.model);
      // A local model never leaves the machine; only an outside (sealed) one is an exit.
      if (client.isPageModel(info.model) || (m && !m.sealed && m.location !== "external")) return null;
      const h = outbound.sendModel({ auditId: info.auditId, model: info.model, host: m?.provider || null, messages: info.messages, segments: info.segments, worlds: info.worlds, symmetry: info.symmetry, gate: info.privacy === "sealed-external" || info.privacy === "explicit", purpose: info.purpose, run: info.run || currentRun, base: info.base || bridge, masking: info.masking || null });
      return (r) => h.done(r);
    },
  });
  let preset = localStorage.getItem("fold-chat:preset") || "fold";
  let meterInfo = null;
  const collapsed = load("fold-chat:collapse", {});
  // Transparency: show the grounding record on every answer. On by default —
  // the fold would rather disclose than dress up. Persisted per browser.
  let transparency = (() => { try { const v = localStorage.getItem("fold-chat:transparency"); return v == null ? true : v === "1"; } catch { return true; } })();
  function setTransparency(on) {
    transparency = !!on;
    try { localStorage.setItem("fold-chat:transparency", transparency ? "1" : "0"); } catch (e) {}
    if (activeId) open(activeId);
  }
  // The composer's effort control: the DEFAULT for the next message, remembered
  // across reloads. It is read once, when a message is sent, and stamped on that
  // turn; moving it never touches a turn already sent. `effortMoved` is true
  // once the person has changed it since the last send, which is what lets an
  // edit / continue / run-as re-run keep the original turn's effort unless they
  // chose otherwise.
  let composerEffort = (() => { try { return web.normEffort(localStorage.getItem("fold-chat:effort")); } catch { return "balanced"; } })();
  let effortMoved = false;
  // The composer's ANSWER control (Facing page | Sources only), the same shape as effort: the DEFAULT for the
  // next message, remembered across reloads (`fold-chat:answerMode`), read once at send and stamped on the ask
  // as `answerMode`. A re-run keeps the original turn's mode unless the chip was moved since.
  let composerAnswer = (() => { try { return normAnswerMode(localStorage.getItem("fold-chat:answerMode")); } catch { return "facing"; } })();
  let answerMoved = false;

  const E = {
    railToggle: $("railToggle"), railSearch: $("railSearch"), railEvidence: $("railEvidence"), railSettings: $("railSettings"),
    side: $("side"), models: $("models"), projects: $("projects"), chats: $("chats"), projAdd: $("projAdd"), projNewProject: $("projNewProject"),
    composerMode: $("composerMode"), composerCwd: $("composerCwd"), composerTag: $("composerTag"),
    topNew: $("topNew"), topFocus: $("topFocus"), topMenu: $("topMenu"), scrim: $("scrim"), turnSlot: $("turnSlot"),
    welcome: $("welcome"), welcomeSub: $("welcomeSub"), thread: $("thread"), threadCol: $("threadCol"), stage: $("stage"), main: document.querySelector("main.main"),
    composerWrap: $("composerWrap"), composer: $("composer"), input: $("input"), send: $("send"), attach: $("attach"),
    footer: $("footer"), drawer: $("drawer"), toast: $("toast"),
    settingsModal: $("settingsModal"), settingsClose: $("settingsClose"), settingsCancel: $("settingsCancel"), settingsSave: $("settingsSave"),
    setBridge: $("setBridge"), bridgeDetect: $("bridgeDetect"), bridgeStatus: $("bridgeStatus"), setPreset: $("setPreset"), setAgentLane: $("setAgentLane"), setAgentRounds: $("setAgentRounds"), setAgentEscalate: $("setAgentEscalate"), setTheme: $("setTheme"), setMode: $("setMode"), setTransparency: $("setTransparency"), setAbout: $("setAbout"),
    keyAnthropic: $("keyAnthropic"), keyOpenai: $("keyOpenai"), keyStatus: $("keyStatus"),
  };

  // Engagements — ONE thread, one project, two affordances. This is the
  // Claude / Claude-Code shape: the tabs are sibling modes over a SHARED
  // session, not one app embedded in a pane. `chat` answers from the routed
  // models (heimdall /v1); `code` dispatches the same turn through the SAME
  // bridge to the machine door (the khora conductor: read → derive → execute →
  // retain). The answer, its tool activity, and the project's folder all land
  // in the one thread. Nothing is a separate app with its own store.
  let engagement = localStorage.getItem("fold-chat:engagement") || localStorage.getItem("fold-chat:mode") || "chat";
  // The switch is the MODE row of the composer's "this turn" chip (see turnChip
  // below), not a control of its own in the top bar.
  function setEngagement(k) {
    engagement = k;
    try { localStorage.setItem("fold-chat:engagement", k); } catch (e) {}
    refreshComposer();
  }
  // The composer is the mode's face: the agent register (mono input, › prompt,
  // the bound folder as a chip, teal send) appears only while the machine door
  // is engaged. Chat keeps the plain prose composer. Effort is a chat affordance
  // — the door reads the folder, and effort only shapes a grounded turn — so the
  // turn chip drops it (and its menu hides that row) in agent.
  function refreshComposer() {
    const s = sessions[activeId];
    const isAgent = engagement === "code";
    const cwd = sessionCwd(s);
    E.composer.classList.toggle("agent", isAgent);
    E.input.placeholder = isAgent ? "Describe the change to make…" : "Message the fold";
    paintTurn();
    E.composerMode.textContent = isAgent ? "agent" : "";
    E.composerCwd.textContent = cwd ? "· " + cwd : "";
    E.composerCwd.title = cwd || "";
    // The OPEN chat's own turn locks the composer — never another chat's. While it
    // runs the send button becomes Stop (the textarea stays focusable but read-only,
    // so Escape in the composer can stop the turn).
    const locked = life.composerLocked(inflight, activeId);
    E.input.readOnly = locked;
    E.input.setAttribute("aria-busy", locked ? "true" : "false");
    if (locked) E.input.placeholder = "Working… press Esc or Stop to cancel";
    E.send.disabled = false;
    E.send.classList.toggle("stop", locked);
    E.send.title = locked ? "Stop (Esc)" : "Send";
    E.send.setAttribute("aria-label", locked ? "Stop" : "Send");
    const want = locked ? "stop" : "send";
    if (E.send.dataset.state !== want) { E.send.dataset.state = want; E.send.innerHTML = locked ? STOP_SVG : SEND_SVG; }
  }
  const SEND_SVG = E.send.innerHTML;
  const STOP_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.6"/></svg>';
  // Stop the OPEN chat's running turn (the Stop button, and Escape in the composer).
  function stopOpenTurn() { const t = inflight.get(activeId); if (t) { t.stop(); return true; } return false; }

  function toast(msg) { E.toast.textContent = msg; E.toast.classList.add("show"); setTimeout(() => E.toast.classList.remove("show"), Math.min(9000, Math.max(1600, String(msg).length * 55))); }
  // A toast with one action (Undo). It lives ~8 s, is announced politely, and the
  // action is a real button (the plain toast ignores the pointer). One at a time:
  // a new one commits the previous. Returns { dismiss }.
  let undoToastEl = null;
  function actionToast(msg, label, onAction, { ms = 8000, onExpire = null } = {}) {
    undoToastEl?.dismiss(true);
    const box = el("div", "toast show toast-action");
    box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
    const btn = el("button", "toast-btn", label); btn.type = "button";
    box.append(el("span", "toast-msg", msg), btn);
    let timer = null, closed = false;
    const dismiss = (expired = false) => {
      if (closed) return; closed = true; clearTimeout(timer); box.remove();
      if (undoToastEl && undoToastEl.box === box) undoToastEl = null;
      if (expired) onExpire?.();
    };
    btn.onclick = () => { if (closed) return; closed = true; clearTimeout(timer); box.remove(); if (undoToastEl && undoToastEl.box === box) undoToastEl = null; onAction(); };
    timer = setTimeout(() => dismiss(true), ms);
    document.body.append(box);
    undoToastEl = { box, dismiss };
    return undoToastEl;
  }

  /* ---------------- models ---------------- */
  // `modelsUp`: did the bridge answer the last model listing? It decides what "no model" has to say (noModelWhy).
  let modelsUp = true;
  const NO_MODEL = Object.freeze({ id: "", sealed: false, kind: "none", tier: "local", none: true });
  // ── THE MODEL IN THIS TAB (fold-chat-webllm.js) ──
  // The page's own engine: WebGPU, a module Worker, weights cached by the browser. It needs no bridge, so its models are listed
  // (and can answer) when the bridge is down or never answered. Importing the engine downloads nothing; only an approved first
  // send does. The extension keeps the bridge (its pages cannot load the engine's CDN module), so it has no engine here.
  const pageEngine = isExtension() ? null : (opts.pageEngine || createPageEngine({ storage: localStorage, onProgress: (p) => pagePulse(p) }));
  let pageGpu = { available: false, reason: pageEngine ? "no-adapter" : "no-engine" };
  let pageLoading = null;        // { id, name, progress, text, phase } while a first load is in flight
  let pageSink = null;           // the turn in flight listens here (its live feed shows the load)
  const tabName = (id) => { const c = MODEL_CHOICES.find((x) => x.id === canonicalModelId(id)); return c ? c.label.split(" \u2014 ")[0] : String(id); };
  const tabTag = (id) => ollamaTagOf(canonicalModelId(id)) || String(id);
  function pageState() {
    const entries = pageEngine && pageEngine.isLoaded() ? [{ id: tabTag(pageEngine.loadedId()), ctx: client.PAGE_CONTEXT_TOKENS }] : [];
    return { available: pageGpu.available, reason: pageGpu.reason, entries, loading: pageLoading };
  }
  function pagePulse(p) {
    if (!p || p.phase === "ready") pageLoading = null;
    else {
      pageLoading = { ...(pageLoading || {}), progress: p.progress, text: p.text, phase: p.phase };
      if (!pageLoading.id) pageEngine?.status().then((st) => { if (pageLoading && !pageLoading.id && st.loading[0]) { pageLoading.id = st.loading[0]; pageLoading.name = tabName(st.loading[0]); paintLoadedNow(); } }).catch(() => {});
    }
    try { pageSink?.(p); } catch {}
    paintLoadedNow();
  }
  // A progress tick repaints the footer at once (no network); a settled state asks the poller for the full picture.
  function paintLoadedNow() {
    if (pageLoading) paintLoaded({ bridge: modelsUp ? "up" : "down", entries: [], servable: null, errors: [], page: pageState() });
    else loadedPoller?.refresh();
  }
  // The ONE question before a multi-GB download: a toast with a button, never silent. No answer in a minute is a "no".
  function askDownload({ id }) {
    const c = MODEL_CHOICES.find((x) => x.id === id);
    return new Promise((resolve) => {
      let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
      actionToast(`Download ${tabName(id)} (${c ? c.sizeLabel : "a large file"}) to run in this tab? It is saved in your browser; after that nothing leaves the tab.`, "Download", () => fin(true), { ms: 60000, onExpire: () => fin(false) });
    });
  }
  client.setPageEngine(pageEngine, { confirmDownload: askDownload });
  // Where a model runs, in the words a turn is labelled with. An in-tab model is "in this tab" — never "sealed-external".
  const placeLabel = (mm) => mm?.sealed ? "sealed-external" : client.isPageModel(mm) ? "in this tab" : "local";
  async function refreshModels({ pageOnly = false } = {}) {
    // pageOnly: the boot's first paint — the in-tab models are listed before (and without waiting for) the bridge probes.
    const all = await client.listAllModels({ base: bridge, bridge: !pageOnly });
    if (pageOnly) {
      if (!all.page.available || models.length) return;
      models = all.models; pageGpu = all.page;
    } else { models = all.models; modelsUp = all.bridgeUp; pageGpu = all.page; }
    try { noteWindows(models.filter(client.isPageModel).map((m) => ({ id: m.id, ctx: m.contextWindow }))); } catch {}
    // The bridge is optional now: only when NOTHING can answer (no bridge, no WebGPU) does the page say so.
    if (!pageOnly && !all.bridgeUp && !all.page.available) toast(noModelWhy({ bridgeUp: false, models, page: pageGpu }).text);
    renderModels();
    paintHint();
    loadedPoller?.refresh();
  }
  // "no model" always says WHY: the bridge is unreachable / serves nothing / serves only embedders / the selected one is gone.
  // The one-line hint under the composer: no model reachable and the chip is on Facing page → say Sources only still works.
  function paintHint() {
    const h = document.getElementById("turnHint"); if (!h) return;
    const why = noModelWhy({ bridgeUp: modelsUp, models, page: pageState() });
    const none = why.code === "bridge-down" || why.code === "no-models" || why.code === "no-chat-model" || why.code === "no-webgpu";
    // An in-tab model that is picked but not on this device: say what the first send will cost BEFORE it asks. Picking downloads nothing.
    const sel = selectedModel();
    const toFetch = !none && sel && client.isPageModel(sel) && !sel.loaded && !sel.cached && !pageLoading;
    const show = (none || toFetch) && composerAnswer === "facing" && engagement !== "code";
    h.hidden = !show;
    if (show) document.getElementById("turnHintText").textContent = toFetch
      ? `Download ${sel.sizeLabel} to start \u2014 the first message asks once, then ${sel.name} runs in this tab and nothing leaves it. Or switch the chip to Sources only (no model).`
      : `No model reachable (${why.code === "bridge-down" ? "the bridge isn't running" : why.text}) \u2014 switch the chip to Sources only to get cited passages anyway.`;
  }
  { const hb = document.getElementById("turnHintBtn"); if (hb) hb.onclick = () => setAnswerMode("snips"); }
  const noModelText = () => noModelWhy({ bridgeUp: modelsUp, models, selectedId: sessions[activeId]?.model || null, page: pageState() }).text || "no model is available";
  // THE FOOTER: which models are LOADED right now (the fleet via the bridge's /api/ps + this machine's Ollama), polled every
  // ~15 s only while the tab is visible and refreshed after each turn. It never blocks rendering: a failed read keeps the last words.
  const fLoaded = document.getElementById("fLoaded");
  function paintLoaded(st) {
    try { noteWindows((st?.entries || []).filter((e) => e.ctx).map((e) => ({ id: e.id, ctx: e.ctx }))); } catch {}   // Gary reads the window each model is loaded at
    if (!fLoaded) return;
    const d = describeLoaded(st);
    fLoaded.dataset.kind = d.kind; fLoaded.title = d.title;
    fLoaded.querySelector(".f-dot").textContent = d.dot; fLoaded.querySelector(".f-text").textContent = d.text;
  }
  let loadedPoller = null;
  function startLoadedPoller() {
    if (loadedPoller || !fLoaded) return;
    loadedPoller = createLoadedPoller({
      get: () => fetchLoaded({ base: client.bridgeBase(bridge), upstream: bridgeHello?.upstream || null, page: pageState() }),
      onState: paintLoaded,
      isVisible: () => document.visibilityState !== "hidden",
      onVisibilityChange: (cb) => { document.addEventListener("visibilitychange", cb); return () => document.removeEventListener("visibilitychange", cb); },
    });
  }
  function selectedModel() { return models.find((m) => m.id === sessions[activeId]?.model) || client.autoPick(models); }
  function providerColor(p) { const s = String(p || ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; if (h >= 250 && h <= 310) h = (h + 70) % 360; /* no purple */ return `hsl(${h} 60% 45%)`; }
  function renderModels() {
    E.models.innerHTML = "";
    if (!models.length) { E.models.append(el("div", "empty-hint", "no models \u2014 " + noModelText())); return; }
    const cur = sessions[activeId]?.model;
    const free = new Set(client.FREE_TIERS);
    const groups = {};
    for (const m of models) { const t = m.tier || client.tierOf(m); (groups[t] || (groups[t] = [])).push(m); }
    for (const t of client.TIER_ORDER) {
      const list = groups[t]; if (!list || !list.length) continue;
      const meta = client.TIERS[t] || { label: t, note: "" };
      // The free tiers start collapsed; a tier the person opened (or a paid
      // tier) stays open. The collapse is remembered per browser.
      const isCollapsed = collapsed[t] ?? free.has(t);
      const head = el("div", "tier clickable" + (isCollapsed ? "" : " open"));
      head.append(el("span", "tier-caret", isCollapsed ? "▸" : "▾"));
      head.append(el("span", "tier-label", meta.label));
      head.append(el("span", "tier-count", String(list.length)));
      if (meta.note) head.append(el("span", "tier-note", meta.note));
      head.onclick = () => { collapsed[t] = !isCollapsed; save("fold-chat:collapse", collapsed); renderModels(); };
      activatable(head); head.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      E.models.append(head);
      if (isCollapsed) continue;
      for (const m of list) {
        const row = el("div", "model" + (m.id === cur ? " on" : ""));
        const dot = el("span", "pdot"); dot.style.background = providerColor(m.provider);
        row.append(dot, el("span", "name", client.isPageModel(m) ? m.name : m.id));
        if (m.sealed) row.append(el("span", "seal", "sealed"));
        else if (client.isPageModel(m)) {
          // The tab's own model: where it lives and what the first use costs. It never says "sealed" — nothing leaves the tab.
          const kt = el("span", "kindtag", "in this tab" + (m.loaded ? " \u00b7 loaded" : m.cached ? " \u00b7 downloaded" : " \u00b7 " + m.sizeLabel));
          kt.title = m.note || "runs in this browser tab (WebLLM)";
          row.append(kt);
        } else if (m.kind === "webllm" || m.kind === "fleet" || m.kind === "native") {
          // Where it is served from: a heimdall browser tab (WebLLM), a fleet worker, or a linked native host — not this machine's own Ollama.
          const kt = el("span", "kindtag", m.kind === "webllm" ? "browser tab" : m.kind === "native" ? "native host" : "fleet");
          kt.title = m.kind === "webllm" ? "served by a heimdall browser tab running WebLLM" : m.kind === "native" ? "served by a linked native host" : "served by a connected fleet worker";
          row.append(kt);
        }
        row.onclick = () => setModel(m.id);
        activatable(row); row.setAttribute("aria-pressed", m.id === cur ? "true" : "false");
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
    const sealed = !!s?.sealed;
    E.welcomeSub.textContent = sealed ? "sealed-external — verbatim spans withheld; the reading only" : "";
  }

  /* ---------------- projects ---------------- */
  // A project is the shared container (Claude's shape): a name, an optional
  // FOLDER (the working directory code turns are bound to, and the same folder
  // the conductor reads), and a PRESET the project's sessions inherit. Chat
  // turns and code turns hang off the same project — that is what "sharing
  // projects" means: one place a conversation and the machine door both start
  // from. The project carries no files itself; the folder is the ground.
  function projectSub(p) {
    const parts = [];
    if (p.cwd) parts.push(p.cwd);
    const pr = PRESETS[p.preset]; if (pr) parts.push(pr.label);
    return parts.join(" · ") || "no folder yet";
  }
  function newProjectDialog(existing = null) {
    const { modal, sheet } = modalSheet("sheet dialog-sheet");
    const head = el("div", "sheet-head");
    const h = el("h2", "", existing ? "Project settings" : "New project"); h.id = "dlg" + sid();
    sheet.setAttribute("aria-labelledby", h.id);
    head.append(h, el("div", "grow"));
    const close = closeButton(); head.append(close);
    const nameField = el("div", "field");
    const nameLabel = el("label", "", "Name"); nameLabel.htmlFor = "pjName"; nameField.append(nameLabel);
    const name = document.createElement("input"); name.id = "pjName";
    name.type = "text"; name.value = existing?.name || ""; name.placeholder = "Project name"; name.autocomplete = "off";
    nameField.append(name);
    const cwdField = el("div", "field");
    const cwdLabel = el("label", "", "Folder (working directory)"); cwdLabel.htmlFor = "pjCwd"; cwdField.append(cwdLabel);
    const cwd = document.createElement("input"); cwd.id = "pjCwd";
    cwd.type = "text"; cwd.value = existing?.cwd || ""; cwd.placeholder = "/Users/you/Documents/your-project"; cwd.autocomplete = "off"; cwd.spellcheck = false;
    cwdField.append(cwd, el("div", "hint", "Code turns read and edit this folder through the conductor. Leave blank for a chat-only project."));
    const presetField = el("div", "field");
    const presetLabel = el("label", "", "Preset"); presetLabel.htmlFor = "pjPreset"; presetField.append(presetLabel);

    return new Promise((resolve) => {
      const sel = document.createElement("select"); sel.id = "pjPreset";
      for (const [k, p] of Object.entries(PRESETS)) sel.append(new Option(p.label, k));
      sel.value = existing?.preset || preset;
      presetField.append(sel);
      const foot = el("div", "sheet-foot");
      const cancel = el("button", "btn", "Cancel");
      const ok = el("button", "btn primary", existing ? "Save" : "Create");
      foot.append(el("div", "grow"), cancel, ok);
      sheet.append(head, nameField, cwdField, presetField, foot);
      modal.append(sheet);
      const done = (v) => { modal.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
      const onKey = (e) => { if (e.key === "Escape") done(null); };
      document.addEventListener("keydown", onKey);
      cancel.onclick = close.onclick = () => done(null);
      ok.onclick = () => { const n = name.value.trim(); done(n ? { name: n, cwd: cwd.value.trim(), preset: sel.value } : null); };
      modal.onclick = (e) => { if (e.target === modal) done(null); };
      document.body.append(modal);
      name.focus(); name.select();
    });
  }
  function projectMenu(id, anchor) {
    const p = projects[id]; if (!p) return;
    menuAt(anchor, [
      { label: "Settings…", onClick: async () => { const v = await newProjectDialog(p); if (v) { Object.assign(p, v, { updated: now() }); save("fold-chat:projects", projects); renderProjects(); } } },
      { sep: true },
      { label: "Delete…", danger: true, onClick: () => deleteProject(id) },
    ]);
  }
  // Deleting a project keeps its chats: they are ungrouped, and a folder they only
  // inherited from the project is cleared (one they were given themselves stays).
  async function deleteProject(id) {
    const p = projects[id]; if (!p) return;
    const n = Object.values(sessions).filter((s) => s.project === id).length;
    const ok = await confirmDialog({
      title: `Delete project \u201c${p.name}\u201d?`,
      message: n ? `Its ${n} chat${n === 1 ? "" : "s"} will be kept and ungrouped \u2014 nothing in them is deleted. A folder they only inherited from this project is cleared.` : "The project has no chats. Nothing else is affected.",
      okLabel: "Delete project", danger: true,
    });
    if (!ok || !projects[id]) return;
    life.detachProject(sessions, id, { projectCwd: p.cwd || null });
    tombstone([id]);
    delete projects[id];
    if (filterProject === id) filterProject = null;
    save("fold-chat:projects", projects); save("fold-chat:sessions", sessions);
    renderProjects(); renderChats(); refreshComposer();
    toast(n ? `project deleted \u00b7 ${n} chat${n === 1 ? "" : "s"} kept` : "project deleted");
  }
  function renderProjects() {
    E.projects.innerHTML = "";
    const all = el("div", "folder" + (filterProject === null ? " on" : ""));
    all.append(icon("layers"), el("span", "", "All chats"));
    all.onclick = () => { filterProject = null; renderProjects(); renderChats(); };
    activatable(all);
    // "All chats" is a filter: with no project to filter by it is only noise, and
    // ▶ (new session in the selected project) means nothing until one is selected.
    if (Object.keys(projects).length) E.projects.append(all);
    E.projAdd.hidden = !filterProject;
    for (const [id, p] of Object.entries(projects)) {
      const row = el("div", "project" + (filterProject === id ? " on" : ""));
      const ico = el("span", "pico", (p.name || "P").trim().slice(0, 1).toUpperCase());
      const meta = el("div", "pmeta");
      meta.append(el("div", "pname", p.name), el("div", "psub", projectSub(p)));
      const menu = el("button", "pmenu", "⋯"); menu.type = "button"; menu.setAttribute("aria-label", "Project actions"); menu.setAttribute("aria-haspopup", "menu");
      menu.onclick = (ev) => { ev.stopPropagation(); projectMenu(id, menu); };
      row.append(ico, meta, menu);
      row.onclick = () => { filterProject = id; renderProjects(); renderChats(); };
      activatable(row);
      E.projects.append(row);
    }
    paintSections();
  }
  // ＋ makes a project (with a folder + preset); ▶ starts a fresh session in the
  // selected project — the same thing Claude's "new session in a project" does.
  E.projNewProject.onclick = async (e) => {
    e.stopPropagation();
    const v = await newProjectDialog();
    if (!v) return;
    const id = sid(); projects[id] = { id, ...v };
    save("fold-chat:projects", projects);
    filterProject = id;
    renderProjects(); renderChats();
  };
  E.projAdd.onclick = async (e) => {
    e.stopPropagation();
    if (!filterProject) { toast("pick a project first"); return; }
    newChat();
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
  // What a chat has BECOME. Until the conversation has found its subject the
  // chat keeps the provisional name (its opening words) and the plain provider
  // mark. Once it has run TURNS_TO_NAME turns, the name is redrawn from the
  // salient terms of the whole exchange, and the icon is the Phosphor mark most
  // similar to it — then both are LOCKED, so the chat's identity is stable. A
  // name the person set by hand is never touched (titleAuto === false).
  // EVERY chat wears a Phosphor icon, from its first moment. An empty chat has
  // the neutral conversation mark; after each user turn the icon is re-picked
  // from the conversation so far (provisional, refined as the subject
  // develops) and then FROZEN (`iconFinal`) once the chat has run
  // TURNS_TO_NAME turns or been named. iconOf is deterministic, so a chat from
  // before this feature (no `s.icon`) gets one lazily, computed from its
  // messages the first time it is drawn, and is saved. A hand-renamed chat
  // keeps its title and still gets an icon. Returns true when it changed.
  function refreshIcon(s) {
    if (!s || s.iconFinal) return false;
    const msgs = s.messages || [];
    // (A chat named before icons were frozen carries a pick from an older
    // lexicon; it is re-picked ONCE here, then frozen like any other.)
    const next = topic.iconOf(msgs);
    const final = s.named || topic.userTurns(msgs) >= topic.TURNS_TO_NAME;
    const changed = s.icon !== next || (final && !s.iconFinal);
    s.icon = next;
    if (final) s.iconFinal = true;
    return changed;
  }
  // The open chat's mark and name in the topbar, so the icon is visible where
  // the person is looking. Hidden when no chat is open.
  function paintTopChat() {
    const box = $("topChat"); if (!box) return;
    const s = activeId ? sessions[activeId] : null;
    box.innerHTML = "";
    box.hidden = !s || !(s.messages || []).length;
    if (box.hidden) return;
    const ic = el("span", "tc-icon"); ic.setAttribute("aria-hidden", "true");
    ic.append(phosphor(s.icon || topic.FALLBACK_ICON, 18));
    box.append(ic, el("span", "tc-title", s.title || "New chat"));
    box.title = s.title || "New chat";
  }
  function maybeName(s) {
    if (!s) return;
    if (s.titleAuto === false || s.named) { if (refreshIcon(s)) save("fold-chat:sessions", sessions); return; }
    const msgs = s.messages || [];
    if (topic.userTurns(msgs) < topic.TURNS_TO_NAME) { if (refreshIcon(s)) save("fold-chat:sessions", sessions); return; }
    const { title, icon } = topic.topicOf(msgs);
    if (title) s.title = title;
    s.icon = icon;
    s.iconFinal = true;
    s.named = true;
    save("fold-chat:sessions", sessions);
  }
  function renderChats() {
    let iconDirty = false;
    for (const s of Object.values(sessions)) if (refreshIcon(s)) iconDirty = true;
    if (iconDirty) save("fold-chat:sessions", sessions);
    paintTopChat();
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
      // The chat's own Phosphor mark (regular weight, currentColor). Decorative:
      // the title beside it is the accessible name.
      const ic = el("span", "cicon glyph");
      ic.setAttribute("aria-hidden", "true");
      ic.append(phosphor(s.icon || topic.FALLBACK_ICON, 18));
      const t = el("span", "ct", s.title || "New chat");
      const menu = el("button", "menu", "⋯"); menu.type = "button"; menu.setAttribute("aria-label", "Chat actions"); menu.setAttribute("aria-haspopup", "menu");
      menu.onclick = (ev) => { ev.stopPropagation(); chatMenu(s.id, menu); };
      // A turn running in this chat shows a quiet spinner; a reply that landed
      // while another chat was open leaves a small dot, cleared when it is opened.
      // (Meaning is in the label too, never colour alone.)
      const state = inflight.has(s.id) ? "running" : (s.unseen && s.id !== activeId ? "new" : null);
      if (state) {
        const dot = el("span", "cstate " + state);
        dot.setAttribute("role", "img");
        dot.setAttribute("aria-label", state === "running" ? "working" : "new reply");
        dot.title = state === "running" ? "working…" : "new reply";
        row.append(ic, t, dot, menu);
      } else row.append(ic, t, menu);
      row.onclick = () => open(s.id);
      activatable(row); if (s.id === activeId) row.setAttribute("aria-current", "true");
      g.append(row);
    }
    E.chats.append(g);
  }
  function chatMenu(id, anchor) {
    const s = sessions[id]; if (!s) return;
    menuAt(anchor, [
      { label: s.pinned ? "Unpin" : "Pin", onClick: () => { s.pinned = !s.pinned; save("fold-chat:sessions", sessions); renderChats(); } },
      { label: "Rename…", onClick: async () => { const n = await askDialog({ title: "Rename chat", value: s.title || "", okLabel: "Rename" }); if (n) { s.title = n; s.titleAuto = false; save("fold-chat:sessions", sessions); renderChats(); } } },
      { label: "Move to project…", onClick: () => moveToProject(s) },
      { sep: true },
      { label: "Delete", danger: true, onClick: () => deleteChat(id) },
    ]);
  }
  // DELETE, with Undo. A running turn is aborted (the search, the model call, the
  // agent door — it must not keep costing tokens for a chat that is gone). The
  // chat's id is tombstoned so no other tab can write it back; the session
  // object is stashed for ~8 s and Undo puts it back (it keeps its `updated`, so
  // it re-sorts into the same place) and re-opens it if it was the open one.
  // What opens next comes from life.nextAfterDelete: the most recent NON-EMPTY
  // chat, ignoring the search filter (which is cleared if it would hide that
  // chat); only empty chats left means the welcome state, never an identical
  // blank "New chat".
  function deleteChat(id) {
    const s = sessions[id]; if (!s) return;
    const wasActive = activeId === id;
    inflight.get(id)?.ac.abort();
    tombstone([id]);
    delete sessions[id];
    const next = life.nextAfterDelete(sessions, { id, filterProject, search });
    const husks = life.pruneStaleEmpties(sessions, { keep: [next.id, wasActive ? null : activeId] });
    if (husks.length) tombstone(husks);
    save("fold-chat:sessions", sessions);
    if (wasActive) {
      if (next.clearSearch) search = "";
      if (next.id) open(next.id); else closeThread();
    } else renderChats();
    const label = (s.title || "chat").length > 36 ? (s.title || "chat").slice(0, 35) + "…" : (s.title || "chat");
    actionToast(`Deleted \u201c${label}\u201d`, "Undo", () => {
      sessions[id] = s; s.restoredAt = now();
      untombstone(id);
      save("fold-chat:sessions", sessions);
      if (wasActive && activeId === next.id) open(id); else renderChats();
    });
  }
  async function moveToProject(s) {
    const items = [{ label: "No project", value: "none" }];
    for (const [id, p] of Object.entries(projects)) items.push({ label: p.name, value: id });
    items.push({ label: "New project…", value: "new" });
    const v = await chooseDialog({ title: "Move to project", items });
    if (v == null) return;
    if (v === "new") {
      const made = await newProjectDialog();
      if (!made) return;
      const nid = sid(); projects[nid] = { id: nid, ...made }; save("fold-chat:projects", projects);
      life.moveToProjectId(s, nid, { project: projects[nid], oldProjectCwd: projects[s.project]?.cwd || null });
    } else {
      const to = v === "none" ? null : v;
      life.moveToProjectId(s, to, { project: to ? projects[to] : null, oldProjectCwd: projects[s.project]?.cwd || null });
    }
    save("fold-chat:sessions", sessions);
    renderProjects(); renderChats(); if (s.id === activeId) refreshComposer();
  }

  /* ---------------- open / render thread ---------------- */
  // The empty state is LibreChat's: the composer rides centered under the
  // welcome title. Once a thread exists, the composer docks above the footer.
  function setView(empty) {
    // One thread always: the empty state only chooses whether the composer
    // rides under the welcome title. No mode owns a separate pane.
    E.welcome.style.display = empty ? "" : "none";
    E.thread.style.display = empty ? "none" : "";
    if (E.composerWrap) {
      if (empty) { if (E.composerWrap.parentElement !== E.welcome) E.welcome.append(E.composerWrap); }
      else if (E.footer && E.composerWrap.nextElementSibling !== E.footer) E.footer.before(E.composerWrap);
    }
  }
  function open(id) {
    activeId = id;
    setNav(false);
    const s = sessions[id];
    // A conversation that already found its subject (a chat from before this
    // feature, or one whose reply arrived while the tab was closed) is named
    // and given its icon the moment it is opened.
    maybeName(s);
    // Opening a chat is "seeing" it: a reply that landed while it was in the
    // background has been seen now.
    if (s?.unseen) { s.unseen = false; save("fold-chat:sessions", sessions); }
    E.threadCol.innerHTML = "";
    const msgs = s?.messages || [];
    setView(!msgs.length);
    for (let i = 0; i < msgs.length; i++) appendMsg(s, msgs[i].role, msgs[i].content, { sealed: msgs[i].sealed, index: i, grounding: msgs[i].grounding, notices: msgs[i].notices, void: msgs[i].void, model: s?.model, cwd: msgs[i].cwd, authored: msgs[i].authored, snips: msgs[i].snips });
    // A turn still running in this chat: hang its live row back on the thread
    // (the row is the run's own node, so what it streamed while we were away is
    // still in it) and re-point the stage line at it.
    const live = inflight.get(id);
    if (live?.wrap) { E.threadCol.append(live.wrap); E.stage.textContent = live.stage || ""; E.thread.scrollTop = E.thread.scrollHeight; }
    else E.stage.textContent = "";
    // Husks: never-used "New chat" rows (older than ten minutes, so another
    // tab's brand-new chat is not swept from under it) are pruned on open.
    const husks = life.pruneStaleEmpties(sessions, { keep: [id], minAgeMs: 10 * 60 * 1000 });
    if (husks.length) { tombstone(husks); save("fold-chat:sessions", sessions); }
    renderChats(); renderModels(); updateSeal(); refreshComposer();
  }
  // "New chat" never piles up empties: when the open chat is already empty IT is
  // the new chat (focus the composer); otherwise the most recent empty chat is
  // reused; only then is one made (life.newChatInto).
  function newChat() {
    const m = client.autoPick(models) || models[0] || null;
    const r = life.newChatInto(sessions, { activeId, filterProject, projects, newId: sid(), now: now(), model: m?.id || "", sealed: !!m?.sealed, preset });
    save("fold-chat:sessions", sessions);
    if (r.id === activeId) { setNav(false); renderProjects(); renderChats(); refreshComposer(); }
    else open(r.id);
    E.input.focus();
  }
  // No chat is open: the welcome state, with nothing selected. Reached when the
  // last chat is deleted, and on boot when no chats exist — the send path (and
  // every + button) opens a new one.
  function closeThread() {
    activeId = null;
    setNav(false);
    E.threadCol.innerHTML = "";
    E.stage.textContent = "";
    setView(true);
    renderChats(); renderModels(); updateSeal(); refreshComposer();
  }
  function cloneSession(src, overrides) {
    // Forks and continues are the same conversation moved forward: they keep
    // the project, the folder, the learned facts, and the attachments — never
    // silently drop the link the way the old code did.
    return {
      id: overrides.id, title: overrides.title, messages: overrides.messages,
      titleAuto: src.titleAuto !== false, named: !!src.named, icon: src.icon ?? null, iconFinal: !!src.iconFinal,
      model: src.model, sealed: src.sealed, preset: src.preset, grounding: src.grounding !== false,
      project: src.project ?? null, cwd: src.cwd ?? null, cwdFromProject: src.cwdFromProject,
      facts: src.facts ? { ...src.facts } : undefined,
      attachments: src.attachments ? src.attachments.map((a) => ({ ...a })) : undefined,
      createdAt: now(), updated: now(),
    };
  }
  function forkAt(id, upto) {
    const src = sessions[id]; if (!src) return;
    const fid = sid();
    sessions[fid] = cloneSession(src, { id: fid, title: (src.title || "chat") + " · fork", messages: (src.messages || []).slice(0, upto + 1).map((m) => ({ ...m })) });
    save("fold-chat:sessions", sessions);
    open(fid);
  }

  /* ---------------- rendering a message ---------------- */
  // A prose block renders as markdown: headings, lists, tables, links, code —
  // everything escaped first, so the model's words become markup, never code.
  function prose(body, text) {
    const t = String(text || "").trim();
    if (!t) return;
    const d = el("div", "md");
    d.innerHTML = mdHtml(t);
    body.append(d);
  }
  function renderArtifact(body, art, s = null) {
    const card = el("div", "art");
    const bar = el("div", "art-bar");
    bar.append(el("span", "art-title", art.title || "artifact"), el("span", "art-kind", art.kind + (art.lang && art.lang !== art.kind ? " · " + art.lang : "")), el("span", "art-sp"));
    const copy = el("button", "art-btn", "copy");
    const fold = el("button", "art-btn", "collapse");
    // The controls travel as ONE group, so a narrow bar wraps them together (right-aligned) instead of stranding one.
    const acts = el("span", "art-acts");
    acts.append(fold, copy);
    bar.append(acts);
    // ITERATE ON THE ARTIFACT (LibreChat's "Ask", 2026-10-04): continue the
    // code lane on this artifact — the next Code turn carries the prior
    // artifact (the bridge's per-session record) and CHANGES it, never builds
    // fresh. Shown only when this thread has already coded.
    if (s?.codeSessionId) {
      const iterate = el("button", "art-btn primary", "iterate");
      iterate.title = "Continue on this artifact — the next Code turn modifies it";
      iterate.onclick = () => {
        setEngagement("code");
        s.iterate = true; save("fold-chat:sessions", sessions);
        E.input.placeholder = "change the artifact… (it will modify the last agent artifact)";
        E.input.focus();
      };
      acts.append(iterate);
    }
    const inner = el("div", "art-inner");
    if (previewable(art.kind)) { const f = document.createElement("iframe"); f.sandbox = "allow-scripts"; f.srcdoc = art.code; inner.append(f); }
    else { inner.append(el("pre", "art-code", art.code)); if (art.kind === "mermaid") inner.append(el("div", "art-note", "Mermaid renders in the fold's workspace; here it stays code.")); }
    copy.onclick = async () => { try { await navigator.clipboard.writeText(art.code); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy"), 1200); } catch (e) {} };
    fold.onclick = () => { inner.hidden = !inner.hidden; fold.textContent = inner.hidden ? "expand" : "collapse"; };
    card.append(bar, inner);
    body.append(card);
  }
  // The transparency block: the holodeck's per-turn record, on the message.
  // What was addressed, what is NOT in the material, and the one-line record.
  // The ENTIRE per-turn disclosure is ONE collapsed block. The head shows the
  // line a reader needs at a glance (the mechanical warrant); grounding, web
  // reads, and the model/route footnote all live inside the panel, opened only
  // on demand. It starts collapsed — except a turn that carries a real problem
  // (unsupported figures/names) opens itself, disclosed rather than hidden.
  // THE PROCESS DISCLOSURE — what the fold DID this turn: the pipeline it ran
  // (classify → search → read → write → check), the web reads, and the route.
  // It carries NO grounding counts and NO addresses — those live in the facing
  // page, which is always present on the message. A JSON copy gives a machine
  // the whole record of the process.
  function renderDisclosure(body, rec, meta) {
    const box = el("div", "disclosure");
    const steps = Array.isArray(rec.process) ? rec.process : [];
    const feedDone = Array.isArray(rec.feed) ? rec.feed.find((e) => e && e.op === "done") : null;
    const head = el("button", "disc-head");
    head.type = "button";
    head.setAttribute("aria-expanded", "false");
    head.append(
      el("span", "disc-caret", "▸"),
      el("span", "disc-title", "how this was answered"),
      el("span", "disc-line", [feedDone ? feedDone.title : null, rec.effort ? "effort " + rec.effort : null, feedDone ? null : (meta?.model || null), meta?.sealed ? "sealed-external" : client.isPageModel(meta?.model) ? "in this tab" : null].filter(Boolean).join(" \u00b7 ")),
    );
    const panel = el("div", "disc-panel");
    // The live feed this turn showed, collapsed into the line above and replayed here from the stored trace:
    // the same rows, no timers (fold-chat-agentfeed.js replayFeed).
    if (Array.isArray(rec.feed) && rec.feed.length) { const fh = el("div", "disc-feed"); panel.append(fh); replayFeed(fh, rec.feed); }

    const ul = el("div", "proc-steps");
    for (const s of steps) ul.append(el("div", "proc-step", s));
    panel.append(ul);

    // Web — what was searched and read for this turn.
    if (rec.web && rec.web.length) {
      const reads = rec.web.filter((w) => w.read || w.engine || w.ok === false);
      panel.append(el("div", "disc-label", "Web"));
      const wl = el("div", "disc-ungrounded");
      for (const w of reads.slice(0, 8)) {
        const label = w.read ? `read ${w.read}${w.via ? " via " + w.via : ""}${w.chars ? " · " + w.chars + " chars" : ""}` : w.scope ? `${w.engine || w.scope}${w.n != null ? " · " + w.n + " result(s)" : ""}${w.ok === false ? " — " + (w.why || "no answer") : ""}` : "";
        if (label) wl.append(el("div", "disc-text", label));
      }
      panel.append(wl);
    }

    // Copy the whole process as JSON — for an agent, a log, or a bug report.
    const procJson = JSON.stringify({
      turn: rec.turn,
      kind: rec.kind ?? null,
      effort: rec.effort ?? null,
      process: steps,
      model: meta?.model ?? null,
      sealed: !!meta?.sealed,
      carried: !!rec.hasMaterial,
      web: rec.web ?? null,
    }, null, 2);
    const copy = el("button", "proc-copy", "copy JSON");
    copy.type = "button";
    copy.onclick = async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(procJson);
        copy.textContent = "copied ✓";
      } catch (err) {
        copy.textContent = "copy failed";
      }
      setTimeout(() => { copy.textContent = "copy JSON"; }, 1400);
    };
    panel.append(copy);

    if (meta && meta.model) {
      panel.append(el("div", "disc-foot", client.isPageModel(meta.model) && !meta.sealed ? `${meta.model} · in this tab \u00b7 run by this page's own engine, nothing left the tab` : `${meta.model}${meta.sealed ? " · sealed-external" : ""} · routed by heimdall`));
    }

    head.onclick = () => { const open = box.classList.toggle("open"); head.setAttribute("aria-expanded", open ? "true" : "false"); };
    box.append(head, panel);
    body.append(box);
  }

  // THE FACING PAGE — the answer, and under it ONE quiet line about what stands
  // behind it. The RESPONSE is the model's markdown, nothing added to it. The
  // SOURCES line reads "3 passages from 1 source · ✱ 3 of 6 sentences have no
  // source": one control, collapsed. Opening it (it takes the right-hand page of
  // the spread on a wide screen, and sits under the answer on a narrow one) lists
  // the DOCUMENTS read, each with the passages it supplied (S1, S2 …); a passage
  // opens to the verbatim excerpt with the cited span marked. The gap's detail
  // (what was tried, what would close it) rides inside the same panel.
  // The ambiguity line (record.senses): one app-authored line, small, dismissible (its dismissal is kept on the record).
  function sensesEl(rec) {
    if (!rec?.senses?.line || rec.senses.dismissed) return null;
    const sn = el("div", "senses");
    sn.setAttribute("role", "note");
    sn.append(el("span", "senses-t", rec.senses.line));
    const x = el("button", "senses-x", "\u00d7");
    x.type = "button"; x.title = "Dismiss"; x.setAttribute("aria-label", "Dismiss this note");
    x.onclick = (e) => { e.stopPropagation(); sn.remove(); rec.senses.dismissed = true; try { save("fold-chat:sessions", sessions); } catch {} };
    sn.append(x);
    return sn;
  }
  const pluralize = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  function renderFacingPage(body, rec, content, meta) {
    const face = rec?.facing || { sources: [], response: [] };
    const spread = el("div", "facing");
    const gap = meta?.gap || null;   // the typed gap (record.void), drawn in its own block

    // --- RESPONSE page ------------------------------------------------------
    // The answer renders as FULL MARKDOWN (lists, bold, headings survive), so a
    // written answer reads as written. Provenance is the SOURCES line below.
    const respPage = el("div", "face-page face-response");
    const md = el("div", "ganswer md");
    md.innerHTML = mdHtml(content);
    // AMBIGUITY: one bare word that names several things — a single app-authored line above the
    // answer (Wikipedia's own distinct titles, never model prose); small, and dismissible.
    { const sn = sensesEl(rec); if (sn) respPage.append(sn); }
    if (String(content || "").trim()) respPage.append(md);
    else if (gap && gapAnswerLine(gap)) { respPage.append(el("div", "face-empty", gapAnswerLine(gap))); respPage.append(renderGap(gap, { retry: meta?.retry })); }
    else if (rec?.computed) {
      // the mechanical result card: the fold's own arithmetic, no model wording
      const card = el("div", "calc");
      card.setAttribute("role", "note");
      card.append(el("span", "calc-k", "computed by the fold \u2014 not written by a model"), el("span", "calc-expr", rec.computed.expr), el("span", "calc-val", "= " + rec.computed.value));
      respPage.append(card);
    }
    else if (meta?.appAuthored) { /* the app's own note below IS the turn: no model was asked */ }
    else if (meta?.noticed) respPage.append(el("div", "face-empty", "the model wrote no answer text \u2014 see the note below"));
    else respPage.append(el("div", "face-empty", "nothing was written for this turn"));
    // The sources the model pointed at with its own [W#] labels, drawn as real citation chips
    // (the label itself was removed from its text).
    if (Array.isArray(rec?.cited) && rec.cited.length && String(content || "").trim()) {
      const row = el("div", "cites");
      row.append(el("span", "cites-k", "cited"));
      for (const c of rec.cited) {
        const chip = c.url && /^https?:\/\//i.test(c.url) ? Object.assign(el("a", "cite-chip", c.title || c.domain || c.n), { href: c.url, target: "_blank", rel: "noopener" }) : el("span", "cite-chip", c.title || c.n);
        if (c.domain) chip.title = c.domain;
        // a chip whose source is shown as a page of a snip pager brings that page up (a modified click still opens the source)
        if (c.url) chip.addEventListener("click", (ev) => { if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button) return; if (jumpToSnip(chip.closest(".msg") || document, c.url)) ev.preventDefault(); });
        row.append(chip);
      }
      respPage.append(row);
    }

    // --- SOURCES page: one line, collapsed -----------------------------------
    const srcPage = el("div", "face-page face-sources");
    // Only sentences the MODEL wrote are scored, and only when the turn has
    // claims: a creative turn (a poem, a story) is never marked unsourced.
    const total = (face.response || []).length;
    const unverified = (rec?.creative || rec?.noClaims) ? 0 : (face.response || []).filter((r) => !r.grounded).length;
    const gapText = gap ? (gap.kind === "legacy" ? "gap" : voidLabel(gap)) : (unverified ? `${unverified} of ${total} sentence${total === 1 ? "" : "s"} ${unverified === 1 ? "has" : "have"} no source` : "");
    const docs = ground.sourceDocs(face.sources);
    if (face.sources.length || gapText) {
      const line = el("button", "srcline");
      line.type = "button";
      line.setAttribute("aria-expanded", "false");
      line.append(el("span", "sl-caret", "▸"));
      if (face.sources.length) line.append(el("span", "sl-main", `${pluralize(face.sources.length, "passage")} from ${pluralize(docs.length, "source")}`));
      if (gapText) line.append(el("span", "sl-gap", "✱ " + gapText));
      const panel = el("div", "srcpanel");
      if (docs.length) {
        const list = el("div", "srclist");
        docs.forEach((d, di) => {
          const doc = el("div", "srcdoc");
          const dh = el("div", "srcdoc-h");
          dh.append(el("span", "src-title", d.title));
          if (d.domain) dh.append(el("span", "src-dom", d.domain));
          if (d.url) { const a = el("a", "src-open", "open ↗"); a.href = d.url; a.target = "_blank"; a.rel = "noopener"; a.setAttribute("aria-label", "Open " + d.title + " in a new tab"); dh.append(a); }
          if (d.url && !/(^|\.)wikipedia\.org$/i.test(d.domain || "")) dh.append(tipControl({ url: d.url, title: String(d.title || "").split(" \u2014 ").slice(1).join(" \u2014 ") || d.title, site: d.domain }, { toast, quiet: true }));
          doc.append(dh);
          d.passages.forEach((p, pi) => doc.append(passageRow(p, di === 0 && pi === 0)));
          list.append(doc);
        });
        panel.append(list);
      }
      if (gap) panel.append(renderGap(gap, { head: false, retry: meta?.retry }));
      line.onclick = () => {
        const open = srcPage.classList.toggle("open");
        spread.classList.toggle("open", open);
        line.setAttribute("aria-expanded", open ? "true" : "false");
      };
      srcPage.append(line, panel);
    } else if (rec?.creative || rec?.noClaims || rec?.hasMaterial || !(face.sources || []).length) {
      srcPage.append(el("div", "face-empty",
        rec?.computed ? `computed by the fold's evaluator: ${rec.computed.text}`
        : rec?.noClaims ? rec.noClaims
        : rec?.creative ? "creative — no claims checked"
        : rec?.hasMaterial ? "no sentence here is addressed to the material"
                           : "nothing carried — the answer stands on the model alone"));
    }

    // RESPONSE on the left, SOURCES on the right once opened (the answer leads).
    // a turn whose whole content is the typed gap draws it open, under the answer line — no collapsed sources line
    const gapIsTurn = !!(gap && gapAnswerLine(gap) && !String(content || "").trim());
    if (gapIsTurn) spread.append(respPage); else spread.append(respPage, srcPage);
    // the wrapper is the size container the spread's column query reads
    const wrap = el("div", "facing-wrap");
    wrap.append(spread);
    body.append(wrap);
  }

  // One PASSAGE of a source document: its tag (S1) and a one-line lead, opening to
  // the verbatim excerpt with the cited span marked. Only an opened passage shows
  // its quote.
  function passageRow(src, open = false) {
    const card = el("div", "src" + (src.domain ? " web" : " local") + (open ? " open" : ""));
    const head = el("button", "src-head");
    head.type = "button";
    head.setAttribute("aria-expanded", open ? "true" : "false");
    head.title = (src.label || src.n) + (src.cite > 1 ? ` · cited ${src.cite}×` : "");
    head.append(el("span", "src-n", src.n), el("span", "src-snip", src.mark || src.text || ""));
    const ex = el("div", "src-ex");
    if (src.ellipsisBefore) ex.append(el("span", "src-el", "… "));
    if (src.before) ex.append(document.createTextNode(src.before + " "));
    ex.append(el("mark", "src-quote", src.mark || src.text));
    if (src.after) ex.append(document.createTextNode(" " + src.after));
    if (src.ellipsisAfter) ex.append(el("span", "src-el", " …"));
    head.onclick = () => { const o = card.classList.toggle("open"); head.setAttribute("aria-expanded", o ? "true" : "false"); };
    card.append(head, ex);
    return card;
  }

  // THE GAP BLOCK — what the turn could not establish, drawn as a TYPED MARK in
  // its own bordered block (Constitution III.3), labelled with which silence it
  // is, listing what was read but did not establish it and what would close it.
  // It is data from `record.void`, rendered by the surface: never a sentence the
  // assistant said, never part of `content`, never scored, never sent back.
  function renderGap(v, { head = true, retry = null } = {}) {
    const box = el("div", "gap gap-" + v.kind);
    box.setAttribute("role", "note");
    if (head) {
      const h = el("div", "gap-h");
      h.append(el("span", "gap-mark", "⟂"), el("span", "gap-kind", v.kind === "legacy" ? "gap" : voidLabel(v)));
      box.append(h);
    }
    if (v.kind === "legacy") { box.append(el("div", "gap-text", v.text || "")); return box; }
    // What was actually searched, authored by the app from the search trace (fold-chat-gaps.js) — never narrated by the model.
    if (v.note) box.append(el("div", "gap-text gap-note", v.note));
    else if (v.kind === "unreached" && (v.tried || []).length) box.append(el("div", "gap-text", "tried: " + v.tried.join(", ")));
    if ((v.kind === "unreached" || v.kind === "live" || v.kind === "model") && (v.attempts || []).length) {
      const ul = el("ul", "gap-list gap-attempts");
      for (const a of v.attempts) ul.append(el("li", a.ok ? "" : "gap-failed", `${a.name}${a.engine && a.engine !== a.name ? " (" + a.engine + ")" : ""} \u2014 ${a.ok ? (a.n ?? 0) + " result" + (a.n === 1 ? "" : "s") : "failed: " + a.why}`));
      box.append(ul);
    }
    if ((v.kind === "unsupported" || v.kind === "live") && (v.read || []).length) {
      box.append(el("div", "gap-sub", "read, but did not establish it"));
      const ul = el("ul", "gap-list");
      for (const r of v.read) {
        const li = el("li");
        if (r.url && /^https?:\/\//i.test(r.url)) { const a = el("a", "", r.title || r.url); a.href = r.url; a.target = "_blank"; a.rel = "noopener"; li.append(a); }
        else li.append(el("span", "", r.title || "source"));
        if (r.domain) li.append(el("span", "gap-dom", " · " + r.domain));
        ul.append(li);
      }
      box.append(ul);
    }
    if ((v.closeBy || []).length) box.append(el("div", "gap-text gap-close", "to close it: " + v.closeBy.join(" \u00b7 ")));
    if (retry && (v.kind === "unreached" || v.kind === "live")) { const b = el("button", "note-retry", "try again"); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); retry(); }; box.append(b); }
    return box;
  }
  // System notes about a turn (an identity claim the fold withdrew, a model
  // refusal it replaced, an agent that produced no code): each its OWN element,
  // labelled as the fold's — never part of what the model wrote.
  const NOTICE_LABEL = { "language-gap": "not checkable", identity: "withdrawn claim", refusal: "model declined", agent: "agent", fold: "fold note", stopped: "stopped", error: "turn failed", declined: "model declined", thread: "from this chat", empty: "no answer", attribution: "attribution removed", language: "language", computed: "computed" };
  // A note whose turn wrote nothing (a failure, an empty stream, a stop) carries a retry: `onRetry` re-runs the ask.
  function renderNotices(body, notices, onRetry = null) {
    for (const n of notices || []) {
      if (!n || !n.text) continue;
      const d = el("div", "fold-note" + (n.kind ? " kind-" + String(n.kind).replace(/[^a-z-]/gi, "") : ""));
      d.setAttribute("role", "note");
      d.append(el("span", "fold-note-k", NOTICE_LABEL[n.kind] || "fold note"), el("span", "fold-note-t", String(n.text).replace(/^⟂ fold:\s*/, "")));
      if (onRetry && (n.retry || n.kind === "stopped")) { const b = el("button", "note-retry", "try again"); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); onRetry(); }; d.append(b); }
      body.append(d);
    }
  }

  // A message is built for ITS session (`s`), passed in — never read off whichever
  // chat happens to be open — and returned unattached; appendMsg puts it on the
  // open thread. A turn finishing in a background chat builds the same way and
  // simply never attaches (see run()).
  function buildMsg(s, role, content, meta = {}) {
    const wrap = el("div", "msg " + role);
    let seam = null;
    // Which engine this turn belongs to: stored on new messages, derived for
    // legacy ones (an assistant turn carrying a code record is agent work).
    const mode = meta.mode || (meta.index != null ? modeOf(s, meta.index) : "chat");
    // THE SEAM — a labelled rule where the register changes inside the shared
    // thread, so a handoff between chat and agent is visible, never silent.
    if (meta.index != null && meta.index > 0 && modeOf(s, meta.index - 1) !== mode) {
      const se = el("div", "seam");
      const sp = el("span", "", `${modeOf(s, meta.index - 1)} → `);
      sp.append(el("b", "", mode));
      se.append(sp);
      seam = se;
    }
    wrap.classList.toggle("agent", mode === "agent");
    const av = el("div", "av");
    const sIcon = role === "assistant" ? s?.icon : null;
    if (role === "user") av.textContent = "You";
    else if (sIcon && PHOSPHOR[sIcon]) { av.classList.add("topic"); av.append(phosphor(sIcon, 17)); av.title = sIcon; }
    else av.textContent = "F";
    const body = el("div", "body");
    if (meta.sealed) body.classList.add("sealed-body");
    if (mode === "agent") body.append(el("span", "mtag", "agent"));
    if (role === "assistant") {
      if (meta.cwd) body.append(el("span", "chip folderchip", "📁 " + meta.cwd));
      const showDisclosure = transparency && s?.grounding !== false;
      const showFace = !!meta.grounding?.facing;
      // The channels of this message, each drawn on its own: the gap (record.void,
      // or the message-level void of a turn that carried no record) and the notes.
      const ownRec = meta.grounding && !meta.grounding.generate && !meta.grounding.code ? meta.grounding : null;
      const gapV = normVoid(ownRec?.void, ownRec) || normVoid(meta.void);
      const noticeList = Array.isArray(meta.notices) ? meta.notices : [];
      // An agent turn's WORK comes first — the steps it took, replayed from the
      // stored trace — and the artifact it landed on follows.
      const traced = Array.isArray(meta.grounding?.events) && meta.grounding.events.length;
      // The Fold viewer (Live · Actions · EOT · Folded) replaces the bare preview card for a run that kept one, and comes FIRST:
      // the result is the headline, the step-by-step transcript is tucked under it, shut.
      const foldSnap = meta.grounding?.fold ? foldRevive(meta.grounding.fold) : null;
      const hasFold = !!(foldSnap && (foldSnap.versions.length || foldSnap.log.length));
      if (hasFold) {
        const rs = s?.resumeFrom && s.resumeFrom.foldId === foldSnap.id ? { index: s.resumeFrom.index, round: s.resumeFrom.round } : null;
        mountFold(body, foldSnap, { renderArtifact: quietArtifact, tryCall: (code, expr) => callMany(code, [expr]).then((r) => r[0]), onReset: (r) => setResume(s, r), reset: rs });
      }
      if (traced) replayFeed(hasFold ? tuckSteps(body, { open: false }).inner : body, meta.grounding.events, { onAuditOpen: (id) => openAudit(id) });
      // A SOURCES-ONLY turn (authored by the sources) draws as one reading column of their own passages instead.
      const strandMode = meta.authored === "sources" && Array.isArray(meta.snips) && meta.snips.length > 0;
      for (const b of strandMode ? [] : artifactsOf(content)) {
        if (b.kind === "prose") { if (!showFace) prose(body, b.text); }
        else if (!(foldSnap && foldSnap.versions.length)) renderArtifact(body, b.artifact, s);
      }
      // The machine door's tool ledger — part of the message, so the steps the
      // agent ran survive a re-render, never only the live turn that made them.
      const acts = meta.grounding?.code && !traced ? meta.grounding.activity : null;
      if (Array.isArray(acts) && acts.length) {
        const list = el("div", "activity");
        for (const a of acts) list.append(el("div", "actrow", `${a.tool}${a.title ? " · " + a.title : ""}${a.status ? "  [" + a.status + "]" : ""}`));
        body.append(list);
      }
      // A turn that wrote nothing (a failure, an empty stream, a gap with no answer) gets a visible retry.
      const askForRetry = meta.index != null ? askBefore(s, meta.index) : null;
      const retryFn = askForRetry ? () => rerunAs(s.id, askForRetry, mode === "agent" ? "agent" : "chat", effortFor(s, meta.index)) : null;
      // A turn that FELL BACK to the strand (the model declined or failed) says so ABOVE the passages it drew instead.
      const declined = strandMode ? noticeList.filter((n) => n && n.fellBackFrom && (n.kind === "declined" || n.kind === "fold")) : [];
      if (declined.length) renderNotices(body, declined, retryFn);
      if (strandMode) { const sn = sensesEl(meta.grounding); if (sn) body.append(sn); renderStrand(body, meta.snips, { toast }); }
      else if (showFace) renderFacingPage(body, meta.grounding, content, { ...meta, gap: gapV, noticed: noticeList.length > 0, appAuthored: noticeList.some((n) => n && (n.kind === "alone" || n.kind === "no-sources")), retry: retryFn, sessionId: s?.id });
      else if (gapV) body.append(renderGap(gapV, { retry: retryFn }));
      // Recipes the sources declared, shown in the creators' own words (never retyped by the model), credited.
      renderSnips(body, meta.grounding?.snips, { toast });
      renderNotices(body, declined.length ? noticeList.filter((n) => !declined.includes(n)) : noticeList, retryFn);
      // the one "how this was answered" line sits right under the answer; the
      // (hover-only) actions come last
      if (showDisclosure && meta.grounding && meta.grounding.code) renderCodeDisclosure(body, meta.grounding, meta);
      else if (showDisclosure && meta.grounding && meta.grounding.generate) renderGenerateDisclosure(body, meta.grounding, meta);
      else if (showDisclosure && meta.grounding) renderDisclosure(body, meta.grounding, meta);
      if (meta.index != null) {
        // Quiet until hovered or focused (and on touch for the last / tapped message):
        // copy, retry, and a ⋯ menu holding the rest.
        const acts = el("div", "actions");
        const ask = askBefore(s, meta.index);
        acts.append(copyBtn(() => content));
        if (ask) acts.append(actBtn("retry", "Run this ask again, as a new turn", () => rerunAs(s.id, ask, mode === "agent" ? "agent" : "chat", effortFor(s, meta.index))));
        // CONVERT: a chat answer can be built (→ agent), an agent artifact can be
        // explained (→ chat) — the same ask re-run through the other engine. An
        // explain re-runs the grounded lane, so it keeps the effort the turn had.
        const more = [
          { label: "Continue in a new chat", onClick: () => continueFrom(s.id, meta.index) },
          { label: "Fork the chat from here", onClick: () => forkAt(s.id, meta.index) },
        ];
        if (mode === "chat" && ask) more.push({ label: "Build this (run through the Agent)", onClick: () => rerunAs(s.id, ask, "agent", effortFor(s, meta.index)) });
        else if (mode === "agent" && ask) more.push({ label: "Explain this (grounded chat answer)", onClick: () => rerunAs(s.id, ask, "chat", effortFor(s, meta.index)) });
        acts.append(moreBtn(more));
        body.append(acts);
      }
    } else {
      if (content) body.append(document.createTextNode(content));
      if (meta.index != null) {
        const acts = el("div", "actions");
        const other = mode === "agent" ? "chat" : "agent";
        acts.append(
          copyBtn(() => content),
          actBtn("edit", "Edit this message and re-run from it", () => editMessage(s.id, meta.index)),
          moreBtn([
            { label: "Fork the chat from here", onClick: () => forkAt(s.id, meta.index) },
            // RUN AS — per-message conversion: this ask, through the other engine.
            { label: "Run as " + other, onClick: () => rerunAs(s.id, sessions[s.id]?.messages?.[meta.index]?.content, other, effortFor(s, meta.index)) },
          ]),
        );
        body.append(acts);
      }
    }
    // On a touch screen there is no hover: tapping a message reveals its actions.
    wrap.addEventListener("click", (e) => { if (!e.target.closest("button, a, input, textarea, iframe, .disclosure, .srcpanel")) wrap.classList.toggle("reveal"); });
    wrap.append(av, body);
    return { wrap, body, seam };
  }
  // Attach a built message to the open thread; returns its body.
  function appendMsg(s, role, content, meta = {}) {
    const m = buildMsg(s, role, content, meta);
    if (m.seam) E.threadCol.append(m.seam);
    E.threadCol.append(m.wrap);
    E.thread.scrollTop = E.thread.scrollHeight;
    return m.body;
  }
  // The code turn's disclosure: the same collapsed block, but it reports what
  // the machine door DID — the lane, the folder, the tool steps, and the time —
  // so a code turn is as inspectable as a chat turn, and always says it ran
  // through the bridge (never opencode reached directly).
  function renderCodeDisclosure(body, rec, meta) {
    const box = el("div", "disclosure");
    const head = el("button", "disc-head");
    head.type = "button";
    head.append(
      el("span", "disc-caret", "▸"),
      el("span", "disc-title", "agent record"),
      el("span", "disc-sub", `${(rec.activity || []).length} tool step(s)`),
      el("span", "disc-line", rec.cwd || rec.lane || "machine door"),
    );
    const panel = el("div", "disc-panel");
    if (rec.agents && (rec.agents.dispositions || rec.agents.escalated)) {
      panel.append(el("div", "disc-label", "Sub-agents (the machine's composition)"));
      const ul = el("div", "disc-ungrounded");
      if (rec.agents.swarm && rec.agents.swarm.routed) {
        ul.append(el("div", "disc-text", `swarm · framed the task${rec.agents.swarm.meaning?.hard ? " · hard meaning" : ""}`));
      }
      for (const d of rec.agents.dispositions || []) {
        ul.append(el("div", "disc-text", `${d.agent} · ${d.unit}${d.walled ? "  [walled]" : d.address ? " · " + d.address : ""}`));
      }
      if (rec.agents.escalated) {
        ul.append(el("div", "disc-text", `escalation · frontier mouth at the wall (${(rec.agents.frontier?.model) || "claude"})`));
      }
      panel.append(ul);
    }
    if (rec.activity && rec.activity.length) {
      panel.append(el("div", "disc-label", "Tool activity"));
      const ul = el("div", "disc-ungrounded");
      for (const a of rec.activity) ul.append(el("div", "disc-text", `${a.tool}${a.title ? " · " + a.title : ""}${a.status ? " [" + a.status + "]" : ""}`));
      panel.append(ul);
    }
    panel.append(el("div", "disc-foot", `${meta.model || "heimdall"} · via heimdall → ${rec.lane || "machine door"}${rec.executed === false ? " · machine composed, mouth drew residue (no tools handed to a small model)" : " · tools executed"}${rec.cwd ? " · " + rec.cwd : ""}${rec.ms ? " · " + rec.ms + "ms" : ""}`));
    head.onclick = () => { const open = box.classList.toggle("open"); head.setAttribute("aria-expanded", open ? "true" : "false"); };
    box.append(head, panel);
    body.append(box);
  }
  // The generation turn's disclosure: the same collapsed block, but it reports
  // what penelope's generation system DID — the void it detected, the units it
  // wrote one prompt at a time, who filled each (field / hunt / mouth), and the
  // verdict — so a writing turn is as inspectable as a chat turn, and the fold
  // shows that writing happened across prompts, not one big draw.
  function renderGenerateDisclosure(body, rec, meta) {
    const box = el("div", "disclosure");
    const head = el("button", "disc-head");
    head.type = "button";
    const n = (rec.units || []).length;
    const stages = Object.entries(rec.stages || {})
      .map(([k, v]) => `${k}:${v}`)
      .join(" · ");
    head.append(
      el("span", "disc-caret", "▸"),
      el("span", "disc-title", "generation record"),
      el("span", "disc-sub", `${n} unit(s)`),
      el("span", "disc-line", `${rec.status || "unverified"}${stages ? " · " + stages : ""}`),
    );
    const panel = el("div", "disc-panel");
    if (rec.void) {
      panel.append(el("div", "disc-label", "Void"));
      const v = el("div", "disc-text");
      v.textContent = `${rec.void.kind} — ${rec.void.reason || ""}${rec.void.satisfy ? " · " + rec.void.satisfy : ""}${rec.void.source ? " · hunted " + rec.void.source : ""}`;
      panel.append(v);
    }
    if ((rec.units || []).length) {
      panel.append(el("div", "disc-label", "Units (one prompt each)"));
      const ul = el("div", "disc-ungrounded");
      for (const u of rec.units.slice(0, 12)) ul.append(el("div", "disc-text", u));
      panel.append(ul);
    }
    panel.append(el("div", "disc-label", "Per-stage outcome"));
    const ul2 = el("div", "disc-ungrounded");
    for (const [k, v] of Object.entries(rec.stages || {})) ul2.append(el("div", "disc-text", `${k}: ${v}`));
    if (!(rec.stages && Object.keys(rec.stages).length)) ul2.append(el("div", "disc-text", "no outcomes recorded"));
    panel.append(ul2);
    if (rec.verdict) panel.append(el("div", "disc-text", "verdict · " + rec.verdict));
    if (rec.materialization && (rec.materialization.folded || rec.materialization.widget)) {
      panel.append(el("div", "disc-label", "Materialization"));
      panel.append(el("div", "disc-text", `folded ${rec.materialization.folded || ""}${rec.materialization.widget ? " · widget " + rec.materialization.widget : ""}`));
    }
    panel.append(el("div", "disc-foot", `${meta.model || "penelope"} · generation via penelope's weave${rec.model ? " · " + rec.model : ""}`));
    head.onclick = () => { const open = box.classList.toggle("open"); head.setAttribute("aria-expanded", open ? "true" : "false"); };
    box.append(head, panel);
    body.append(box);
  }

  // The row a turn narrates itself in. It is the turn's OWN node: attached to the
  // thread only while its chat is open (open() hangs it back when you return).
  function liveBody(s, attach) {
    const m = buildMsg(s, "assistant", "", {});
    m.body.classList.add("live");
    m.body.append(el("div", "live-stat", "working…"));
    if (attach) { E.threadCol.append(m.wrap); E.thread.scrollTop = E.thread.scrollHeight; }
    return m;
  }
  // A chat's turn is already running: another one cannot start on top of it.
  function busy(id) {
    if (!inflight.has(id)) return false;
    toast("this chat is still working \u2014 stop it first");
    return true;
  }

  /* ---------------- engagements per message ---------------- */
  // The engagement key is "chat"/"code" on the wire; the SURFACE label for the
  // code engagement is "agent". Messages and the seam always carry the surface
  // value, so the internal key never leaks into the thread (a seam read
  // "agent → code" before this — the raw key showing through).
  function normMode(m) { return m === "code" || m === "agent" ? "agent" : "chat"; }
  // Which engine a stored message belongs to. New messages carry their mode;
  // legacy sessions derive it — an assistant turn that landed a code record is
  // an agent turn, and a user ask inherits the mode of the assistant turn that
  // answers it (falling back to chat).
  function modeOf(s, i) {
    const m = s?.messages?.[i];
    if (!m) return "chat";
    if (m.mode) return normMode(m.mode);
    if (m.role === "assistant") return m.grounding?.code ? "agent" : "chat";
    for (let j = i + 1; j < (s.messages?.length || 0); j++) {
      const n = s.messages[j];
      if (n.role === "assistant") return n.grounding?.code ? "agent" : "chat";
    }
    return "chat";
  }
  // CONVERT A TURN BETWEEN THE ENGAGEMENTS (chat ↔ agent): the same ask, run
  // through the other engine, as a new lane in the same thread. The original
  // turn and its record are never touched — a conversion only adds. The seam
  // renders the handoff, so the change of engine is visible, not silent.
  function rerunAs(id, content, targetMode, originalEffort = null) {
    const s = sessions[id]; if (!s || !content || busy(id)) return;
    targetMode = normMode(targetMode);
    setEngagement(targetMode === "agent" ? "code" : "chat");
    // A grounded (chat) re-run keeps the original turn's effort unless the
    // composer's control was moved since; an agent turn carries none.
    const effort = targetMode === "chat" ? takeEffort(originalEffort) : undefined;
    // …and keeps the answer mode the original ask ran in (the nearest earlier ask with the same words), unless the chip moved.
    const origAnswer = [...s.messages].reverse().find((x) => x.role === "user" && x.content === content && x.answerMode)?.answerMode || null;
    const answerMode = targetMode === "chat" ? takeAnswerMode(origAnswer) : undefined;
    s.messages.push({ role: "user", content, at: now(), mode: targetMode, converted: true, ...(effort ? { effort } : {}), ...(answerMode ? { answerMode } : {}) });
    const idx = s.messages.length - 1;
    s.updated = now();
    save("fold-chat:sessions", sessions);
    if (activeId === id) appendMsg(s, "user", content, { index: idx, mode: targetMode, converted: true });
    renderChats();
    if (targetMode === "agent") runCode(id);
    else run(id, false);
  }
  // The effort a stored turn ran with (null if it predates per-turn effort).
  function effortFor(s, index) { return web.effortOfTurn(s?.messages, index); }
  // Resolve the effort for a dispatch NOW and mark the control as "caught up":
  // from here on, the composer value only differs from a turn's if it is moved again.
  function takeAnswerMode(original = null) {
    const a = resolveAnswerMode({ original, composer: composerAnswer, changed: answerMoved });
    answerMoved = false;
    return a;
  }
  function takeEffort(original = null) {
    const e = web.resolveEffort({ original, composer: composerEffort, changed: effortMoved });
    effortMoved = false;
    return e;
  }
  function actBtn(label, title, onClick) {
    const b = el("button", "act", label);
    b.type = "button"; b.title = title; b.onclick = onClick;
    return b;
  }
  // copy (the text arrives lazily, so a re-render never copies a stale answer)
  function copyBtn(getText) {
    const b = actBtn("copy", "Copy this message", async () => {
      try { await navigator.clipboard.writeText(String(getText() ?? "")); b.textContent = "copied"; } catch (e) { b.textContent = "copy failed"; }
      setTimeout(() => { b.textContent = "copy"; }, 1300);
    });
    return b;
  }
  // the ⋯ button: everything that is not copy / retry / edit, one click away
  function moreBtn(items) {
    const b = el("button", "act more", "⋯");
    b.type = "button"; b.title = "More actions"; b.setAttribute("aria-label", "More actions"); b.setAttribute("aria-haspopup", "menu");
    b.onclick = () => menuAt(b, items);
    return b;
  }
  // The ask that produced the answer at `index`: the nearest preceding user turn.
  function askBefore(s, index) {
    for (let i = index - 1; i >= 0; i--) {
      const m = s?.messages?.[i];
      if (m?.role === "user" && m.content) return m.content;
    }
    return null;
  }

  /* ---------------- memory: edit / continue ---------------- */
  async function editMessage(id, index) {
    const s = sessions[id]; const m = s?.messages?.[index];
    if (!m || m.role !== "user" || busy(id)) return;
    const next = await askDialog({ title: "Edit message", value: m.content, okLabel: "Save" });
    if (next == null || !next || next === m.content || sessions[id] !== s || busy(id)) return;
    // The edited ask keeps the effort the original ran with, unless the person
    // has moved the composer's control since.
    const effort = takeEffort(web.effortOfTurn(s.messages, index));
    s.messages = s.messages.slice(0, index).concat([{ ...m, content: next, at: now(), effort, answerMode: takeAnswerMode(m.answerMode) }]);
    s.updated = now();   // a shortened chat must still be the NEWER copy when tabs merge
    save("fold-chat:sessions", sessions);
    open(id);
    // The edited message IS the question now; run it as it stands (not as a
    // "Continue." turn, which would answer the wrong thing).
    run(id, false);
  }
  function continueFrom(fromId, index) {
    const s = sessions[fromId]; if (!s) return;
    const id = sid();
    const effort = takeEffort(web.effortOfTurn(s.messages, index));
    sessions[id] = cloneSession(s, { id, title: (s.title || "chat") + " · continue", messages: s.messages.slice(0, index + 1).map((m) => ({ ...m })) });
    save("fold-chat:sessions", sessions);
    open(id);
    run(id, true, effort);
  }

  /* ---------------- run ---------------- */
  // The identity + memory pipeline: the fold holds who the person is, learns
  // it only when stated, carries it in the system context, and refuses to let
  // an ungrounded identity claim stand (resolution, never invention).
  let readerName = (() => { try { return localStorage.getItem("fold-chat:reader") || null; } catch { return null; } })();

  // The material this surface can ground against: the person's OWN messages.
  // The chat never touches the workspace, so what it carries is what they gave
  // it. Each message is a source with a stable tag (S1, S2, …).
  // MATERIAL is what the fold actually READ — the khora readings of attached
  // files, and pasted documents. Conversational turns are NOT material: a
  // greeting is not a claim, so it is never checked for grounding (the
  // holodeck's lesson). A message counts only when it carries a substantive
  // body of its own (a pasted document), never chit-chat.
  //
  // THE SHORT EXCHANGE IS THE EXCEPTION: when the whole conversation is small
  // enough to ride the context verbatim, the turns themselves ARE what the
  // model was given, so they are the material the answer is checked against —
  // a turn like "well?" is read against the thread it continues, never as
  // "nothing carried". The threshold is characters, because what matters is
  // whether the exchange fits the window, not how it was chopped into turns.
  const VERBATIM_MAX_CHARS = 1600;
  function conversationVerbatim(s) {
    const msgs = modelHistory(s.messages);
    const total = msgs.reduce((n, m) => n + String(m.content || "").length, 0);
    return msgs.length > 1 && total > 0 && total <= VERBATIM_MAX_CHARS;
  }
  function materialOf(s) {
    const out = [];
    for (const a of s.attachments || []) {
      if (a.reading) out.push({ ref: `attachment · ${a.name}`, source: a.name, text: a.reading });
    }
    const users = (s.messages || []).filter((x) => x.role === "user" && !x.attachment);
    // A person's QUESTION is not a source, and neither is the conversation. Only
    // a substantive PASTED DOCUMENT (a body of text they supplied — long, and
    // not a chat turn) is material. The dialogue is never cited as evidence.
    const pasted = users.filter((x) => {
      const t = String(x.content || "").trim();
      if (t.length < 400) return false;                 // a chat turn, not a document
      if (t.length < 800 && !/\n/.test(t)) return false; // one long sentence is still a question
      return true;
    });
    pasted.forEach((x, i) => out.push({ ref: `you · pasted ${i + 1}`, source: `S${i + 1}`, text: x.content }));
    return out;
  }
  // The mechanical S1: discourse fields COMPUTED from the conversation, no
  // model. Entities are the names the khora admitted (attachments) plus the
  // capitalised names seen in the turns — read off the material, never asked of
  // a model. Topic is the opening clause of the first substantive question;
  // flow is a count of the turns and their kinds; context is what is still
  // open (the last unanswered question, if the answer was a gap). Every value
  // is a projection of the store, so the summary can never disagree with the
  // record — and nothing here can invent an entity the material never named.
  function refreshSummaryMechanical(s) {
    if (!s?.summary) return;
    const msgs = (s.messages || []).filter((x) => x.role === "user" && x.content && !x.attachment);
    const first = msgs.find((x) => String(x.content).trim().length >= 24) || msgs[0];
    const topic = first ? String(first.content).trim().split(/[.?!\n]/)[0].slice(0, 120) : s.summary.topic;
    // Entities: names the khora admitted from attachments + capitalised names
    // in the person's own turns (a proper-noun run), deduped, bounded.
    const fromK = (s.attachments || []).flatMap((a) => (a.names || []));
    const fromTurns = msgs.flatMap((x) => (String(x.content).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []));
    const stop = new Set(["The", "This", "That", "When", "What", "Where", "Who", "How", "Why", "It", "I", "You", "We", "They", "Turn", "Remember", "Reply", "Write", "Please"]);
    const entities = [...new Set([...fromK, ...fromTurns].map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 40 && !stop.has(x)))].slice(0, 8);
    const flow = `${s.summary.turnCount} turn(s) · opening on "${truncate(topic || "", 60)}"`;
    // Context: what is still open — the last user question if its answer was a
    // gap ("no material carried" / a refusal), else null (nothing to carry).
    const lastRec = (s.summary.records || []).slice(-1)[0];
    const context = lastRec && (lastRec.unsupported?.length || lastRec.open?.length) ? `open: ${(lastRec.open?.length ? lastRec.open : lastRec.unsupported).join("; ")}` : s.summary.context;
    s.summary = { ...s.summary, topic: topic || s.summary.topic, flow, entities: entities.length ? entities : s.summary.entities, context: context || null, language: s.summary.language || (/\b(el|la|los|las|de)\b/i.test(String(first?.content || "")) ? null : "en") };
    // This can never lose a live entity (it only adds names the turns/khora
    // named) and never add an unsupported one — so the veto would always pass;
    // it is still run, so a future edit that breaks that property is caught.
    const check = FOLD.extractSummaryFindings(s.summary.entities || [], s.summary.entities || [], { records: s.summary.records || [], folds: s.summary.folds || [] });
    if (!check.ok) s.summary.refreshRefused = check.findings;
    s.updated = now();
    save("fold-chat:sessions", sessions);
  }

  const truncate = (x, n) => (String(x || "").length > n ? String(x).slice(0, n - 1) + "…" : String(x || ""));

  // The latest thing the person actually asked — the web search query.
  function lastUserText(s) {
    const m = [...(s.messages || [])].reverse().find((x) => x.role === "user");
    return String(m?.content || "").trim();
  }

  async function run(id = activeId, continuing = false, continueEffort = null) {
    const runId = newRun("chat");
    const s = sessions[id]; if (!s) return;
    if (busy(id)) return;
    // Every UI write below is for THIS chat's turn: it happens only while this
    // chat is the open one. The session record is always updated.
    const isLive = () => activeId === id;
    // A model is needed ONLY if a model call will actually be made (facing mode, a turn the model may write). With none
    // reachable the turn does not stop: Sources only, app-authored gaps, cards and fixed lines all need no model, and a
    // facing turn that read sources falls back to the strand below (noModelFallbackNotice).
    const m = models.find((x) => x.id === s.model) || selectedModel() || NO_MODEL;
    if (continuing) {
      const prevAsk = [...s.messages].reverse().find((x) => x.role === "user");
      s.messages.push({ role: "user", content: "Continue.", at: now(), effort: web.normEffort(continueEffort, composerEffort), answerMode: takeAnswerMode(prevAsk?.answerMode) });
    }
    // THIS TURN's effort: the one stamped on the ask when it was sent (or
    // re-run). It is read here, once, and never re-read from the composer, so
    // moving the control mid-turn or later cannot change a turn in flight or
    // already sent.
    const askMsg = [...s.messages].reverse().find((x) => x.role === "user");
    const effort = web.normEffort(askMsg?.effort, composerEffort);
    if (askMsg && !askMsg.effort) askMsg.effort = effort;
    // THIS TURN's answer mode, read once from the ask like effort: facing (the model writes from snipped
    // sources) or snips (Sources only — the model is not called at all).
    const answerMode = normAnswerMode(askMsg?.answerMode, composerAnswer);
    if (askMsg && !askMsg.answerMode) askMsg.answerMode = answerMode;
    s.effort = effort; // last-used, kept for older builds that read the session's effort
    // THE CONVERSATION FOLD (the holodeck's, vendored). The context window does
    // NOT grow with the conversation: the running summary + the addressable
    // records + a small recency window are what ride; the raw transcript beyond
    // that is never resent. `summary` is the store (append-only, persisted on
    // the session); buildTurnMessages projects it.
    if (!s.summary) s.summary = FOLD.emptySummary();
    const basePrompt = [PRESETS[s.preset]?.system, memory.systemContext({ readerName, facts: s.facts || {} })].filter(Boolean).join(" ");
    const said = lastUserText(s);
    // THE CONVERSATION IS A SOURCE (fold-chat-thread.js): the ask is read against the turns BEFORE it, before anything is
    // searched. "what?" / "why?" / "shorter" are about the previous answer (no search; the model may reply from that turn
    // alone, or — with nothing earlier — nothing is written); "i want a chewier one" is searched WITH the earlier topic; a
    // pronoun follow-up carries the last answer's referent (resolveQuestion). The person's words are never rewritten.
    const askAt = s.messages.lastIndexOf(askMsg);
    const lang0 = detectLang(said).lang;
    const follow = planTurn(said, askAt > 0 ? s.messages.slice(0, askAt) : [], { referents: s.referents || null, hints: hintsFor(lang0 === "unknown" ? "en" : lang0) });
    // A bare nudge ("well?") after an unanswered ask IS that ask again: the turn is read, searched and written as the earlier question
    // (follow.retry); the person's own "well?" stays what they said (the thread, the record's `said`).
    const question = follow.retry || said;
    const searchQ = follow.search || question;                       // what is SEARCHED (and what picks the quoted sentences)
    const threadTurn = follow.mode === "thread" ? follow.thread : null;
    // The transcript the MODEL may see: each turn carries only what its author
    // wrote — never a system note, a void, or a withdrawn-claim line.
    const history = modelHistory(s.messages);
    s.updated = now(); save("fold-chat:sessions", sessions);
    if (isLive()) setView(false);
    const row = liveBody(s, isLive());
    const body = row.body;
    // THE TURN'S LIVE FEED (the coding lane's renderer, fold-chat-agentfeed.js, fed by fold-chat-turnfeed.js): one row per
    // step as it happens — each source asked, each page read — with a ticking clock on the step in flight. It collapses
    // into the "how this was answered" line when the answer lands, and replays from `record.feed` after a reload.
    const tt = newTurnTrace({ question: lastUserText(s) });
    const turnEvents = [];
    const feed = createFeed(body, { live: true, onStop: () => flight.stop() });
    body.querySelector(".live-stat")?.remove();
    const feedPush = (evs) => { for (const e of evs) { turnEvents.push(e); try { feed.push(e); } catch (err) { try { console.error("[fold-chat] feed:", err); } catch {} } } };
    const ac = new AbortController();
    const flight = { ac, kind: "chat", label: "working…", startedAt: Date.now(), wrap: row.wrap, stage: "", stop: () => { ac.abort(); flight.stage = "stopping…"; if (isLive()) E.stage.textContent = "stopping…"; } };
    inflight.set(id, flight);
    flight.stage = m.sealed ? "sealed-external · working…" : client.isPageModel(m) ? "in this tab · working…" : "working…";
    if (isLive()) E.stage.textContent = flight.stage;
    refreshComposer(); renderChats();
    // The turn's exit, however it ends: drop its in-flight entry, unlock the
    // composer if this chat is open, and show the sidebar row at rest.
    const release = () => { pageSink = null; if (pageLoading && !pageEngine?.isLoaded()) pageLoading = null; try { feed.dispose(); } catch {} inflight.delete(id); refreshComposer(); renderChats(); if (isLive()) { E.stage.textContent = ""; E.input.focus(); } refreshMeter(); loadedPoller?.refresh(); };
    // Stopped (the Stop button, Escape, or the chat being deleted): the person's
    // message stays, and a quiet note rides message.notices — never `content`.
    const stopped = () => {
      body.classList.remove("live"); row.wrap.remove();
      const notices = [{ kind: "stopped", text: "Stopped \u2014 no answer was written." }];
      s.messages.push({ role: "assistant", content: "", at: now(), mode: "chat", notices });
      s.updated = now();
      if (sessions[id] !== s) return;   // deleted: the stash (for Undo) carries the note
      save("fold-chat:sessions", sessions);
      if (isLive()) appendMsg(s, "assistant", "", { index: s.messages.length - 1, notices, model: m.id, mode: "chat" });
    };
    // A turn that DIED (the bridge refused, a stream stalled, a bug past the model): it is never
    // a blank bubble and never a raw "error:" string that vanishes on reload. It is stored as a
    // typed note on its own message — with a retry — exactly like Stopped, and drawn if this chat is open.
    const failTurn = (err) => {
      try { console.error("[fold-chat] turn failed:", err); } catch {}
      body.classList.remove("live"); row.wrap.remove();
      const notices = [errorNotice(err)];
      s.messages.push({ role: "assistant", content: "", at: now(), mode: "chat", notices });
      s.updated = now();
      if (!isLive()) s.unseen = true;
      if (sessions[id] !== s) return;
      save("fold-chat:sessions", sessions);
      if (isLive()) { E.stage.textContent = ""; appendMsg(s, "assistant", "", { index: s.messages.length - 1, notices, model: m.id, mode: "chat" }); }
    };
    try {
    // DISCOURSE AWARENESS decides the pipeline before any search runs. A
    // generation turn is never front-loaded with a web search (that is what
    // turned "write an essay" into "what topics?"), and a greeting is never
    // searched or checked.
    const kind = classifyTurn(question, { hasMaterial: materialOf(s).length > 0 });
    // The live narration: every step the fold takes is shown while it takes it,
    // so the person sees the pipeline (classify → search → read → write →
    // check) rather than a frozen spinner. The blinking cursor follows the live
    // status line in the answer body, so it says what the fold is DOING (and
    // the tiny stage strip mirrors it).
    const say = (msg) => {
      flight.stage = msg;
      if (isLive()) E.stage.textContent = msg;
      const st = body.querySelector(".live-stat");
      if (st) st.textContent = msg;
    };
    const kindWord = { smalltalk: "greeting", generate: "writing request", research: "question of fact", chat: "conversation", compute: "calculation", transform: "your own text", code: "programming question", compose: "personal writing", advice: "advice" }[kind] || kind;
    say(`turn · ${kindWord}`);
    feedPush(startEvents(tt, { kindWord }));
    // ALWAYS GROUNDED, including a WRITING request: a "write about X and
    // compare" turn seeks sources first and writes from what was read — it is
    // never answered from parametric memory. The weave (ungrounded single-draw)
    // is retired from this path for that reason.
    let webPassages = [], webTrace = null, sourceBlock = null, webResults = [];
    // ALWAYS GROUNDED: every turn that makes or needs a claim seeks sources first. There
    // is no ungrounded/oracle path — the fold reads before it answers. (An
    // unavailable network is reported, not silently answered from parametric
    // memory.) The ONLY turns that skip the search are the ones with nothing to look
    // up: a greeting, arithmetic the fold computes itself, the person's own text to
    // translate or summarise, a programming how-to, a personal note (skipsSearch).
    const wantWeb = !skipsSearch(kind) && !!question && follow.mode === "web";
    // A live-data ask (weather, a price, a score, today's news) can only be answered from a
    // live source; with nothing read that establishes it the turn is a typed gap, not a guess.
    const liveHit = wantWeb && (kind === "research" || kind === "chat" || kind === "advice") ? liveAsk(question) : null;
    // AMBIGUITY: one bare word that names several things gets a lookup of the bare term, in
    // parallel with the search (the search reads ONE sense; this lists the others).
    let sensesProbe = null;
    const probeTerm = wantWeb && (kind === "research" || kind === "chat") ? senseTerm(question) : null;
    // The turn this is NOT a source of the answer, only of the list of senses: audited, time-boxed, never fatal.
    const noSources = () => wantWeb && !webPassages.length;
    if (wantWeb) {
      if (question) {
        say(`turn · ${kindWord} · searching the web…`);
        if (follow.kind === "retry") feedPush(lineEvent(tt, "Picked your earlier question back up", { tone: "info", note: `nothing was written for \u201c${question.slice(0, 90)}\u201d, so I'm answering it now` }));
        // Every step the search takes arrives as an onStep event and becomes a row of the turn's live feed
        // (fold-chat-turnfeed.js eventsForStep): each source asked with its own clock and result count or failure
        // reason, each page read with "kept N of M chars", an honest "waiting on …" line when something is slow.
        const onStep = (st) => feedPush(eventsForStep(tt, st));
        try {
          if (searchQ !== question) feedPush(lineEvent(tt, follow.kind === "carried" ? "Followed on from the last answer" : "Followed on from the conversation", { tone: "info", note: `searching for \u201c${searchQ.slice(0, 90)}\u201d` }));
          const nEnt = web.queriesFor(searchQ).length;
          const readFor = { fast: 2, balanced: Math.min(6, Math.max(3, nEnt)), deep: 6 }[effort] || 3;
          // The search is cancellable: its fetches carry this turn's signal, and the
          // await itself yields the moment Stop is pressed (or the chat deleted).
          if (probeTerm) sensesProbe = raceAbort(Promise.race([web.search("wikipedia", probeTerm, 0, { fetchImpl: withSignal(outbound.auditedFetch("web search", runId), ac.signal) }), new Promise((r) => setTimeout(() => r(null), 7000))]), ac.signal).catch(() => null);
          const w = await raceAbort(web.searchWeb(searchQ, { onStep, effort, read: readFor, memo: pageMemo, fetchImpl: withSignal(outbound.auditedFetch("web search", runId), ac.signal) }), ac.signal);
          webPassages = w.passages || [];
          webTrace = w.trace || null;
          webResults = w.results || [];
          if (webPassages.length) {
            sourceBlock = sourcesPrompt(webPassages) + (webPassages.some((p) => p.recipe) ? "\n\n" + CARD_PROMPT : "");
            say(`turn · ${kindWord} · read ${webPassages.length} source(s) · ${placeLabel(m)} · answering…`);
          }
        } catch (e) {
          if (ac.signal.aborted) throw e;
          webTrace = [{ scope: "web", ok: false, why: String(e?.message || e) }];
          feedPush(lineEvent(tt, "The search failed", { tone: "bad", note: String(e?.message || e).slice(0, 90) }));
          say(`turn · ${kindWord} · web search failed (${String(e?.message || e).slice(0, 40)}) · writing the answer…`);
        }
      }
    } else {
      say(kind === "generate" ? `turn · ${kindWord} · writing it now…` : `turn · ${kindWord} · ${placeLabel(m)} · writing the answer…`);
    }
    // A generate turn replaces the persona with the writer, it does not append
    // to it — the reading persona and the write instruction are opposite
    // directives and a small model hedges when handed both (measured: a
    // 265-char teaser with "fold persona + nudge" against a 2,200-char essay
    // from the nudge alone). The identity/facts line still rides, so the fold
    // never states a personal fact it was not given.
    const identityLine = memory.systemContext({ readerName, facts: s.facts || {} });
    // The asker's language rides every prompt (a transform is the exception: "translate X into
    // Spanish" is answered in Spanish whatever language the ask was written in).
    const langLine = kind === "transform" ? null : languageInstruction(question);
    const COMPUTE_BASE = "You are the voice of a calculator. The fold has ALREADY computed the answer exactly; your only job is to say it in a short, natural sentence.";
    const turnBase = kind === "generate" ? [GENERATE_NUDGE, identityLine, langLine].filter(Boolean).join("\n\n")
      : (kind === "transform" || kind === "code" || kind === "compose") ? [KIND_PROMPT[kind], identityLine, langLine].filter(Boolean).join("\n\n")
      : kind === "compute" ? [COMPUTE_BASE, langLine].filter(Boolean).join("\n\n")
      : [basePrompt, kind === "advice" ? KIND_PROMPT.advice : null, langLine].filter(Boolean).join(" ");
    // THE MODEL NEVER SPEAKS ALONE. NO SOURCES (search reached nothing readable, or threw): the model is not
    // asked; the fold draws the typed gap from the real search trace (fold-chat-gaps.js). A live-data ask is a
    // gap likewise. Everything below that could call the model goes through `callModel`, which is barred
    // (`modelBarred`) on a turn with no source, a Sources-only turn, and a kind the model may not answer alone.
    let plan = null;
    if (wantWeb && !webPassages.length) {
      plan = unsourcedPlan(UNSOURCED_ANSWERS, { live: !!liveHit });
      say(`turn · ${kindWord} · no sources reached · drawing the gap (not answering from memory)…`);
      feedPush(lineEvent(tt, "No source could be read", { tone: "bad", note: "drawing the gap \u2014 I won't answer from memory" }));
    }
    // SOURCES ONLY (answer mode "snips"): no model at all — the answer is the passages the pages gave, verbatim,
    // chosen with no model (structured block first, else the sentences that differ the ask), strung together.
    let strand = null, strandEmpty = false;
    if (answerMode === "snips" && wantWeb && webPassages.length) {
      strand = snipsOf(webPassages, searchQ);
      if (!strand.snips.length) { strand = null; strandEmpty = true; plan = unsourcedPlan(UNSOURCED_ANSWERS, { live: false }); }
      else { say(`turn · ${kindWord} · sources only · stringing ${strand.snips.length} passage(s) together (no model)…`); feedPush(lineEvent(tt, "Strung the sources' passages together", { tone: "ok", note: `${strand.snips.length} passage(s), their own words \u2014 no model` })); }
    }
    // A kind that searches nothing (greeting, arithmetic, your own text, code, personal writing) has no source:
    // the model may not answer it alone unless ALONE_KINDS (fold-chat-gaps.js) says so.
    // A follow-up about the previous answer, with that answer on the thread, is grounded in the THREAD: the model may reply.
    const aloneBarred = !wantWeb && !modelSpeaksAlone(kind) && !threadTurn;
    if (threadTurn) {
      sourceBlock = threadPrompt(threadTurn);
      say(`turn \u00b7 ${kindWord} \u00b7 following the conversation \u00b7 answering from turn ${threadTurn.turn}\u2026`);
      feedPush(lineEvent(tt, "Followed the conversation", { tone: "ok", note: `no search \u2014 answering from your earlier turn ${threadTurn.turn}` }));
    } else if (follow.mode === "cold-gap") feedPush(lineEvent(tt, "Nothing earlier to follow", { tone: "info", note: "no search, and the model is not asked" }));
    const modelBarred = !!(plan || strand || aloneBarred);
    let doorRefusal = null;   // set when Gary refuses the composed turn below: the model is then not asked (the turn falls back like any refused call)
    const callModel = (msgs, opts) => {
      if (modelBarred) throw new Error("the model is barred on this turn (it never speaks alone)");
      if (doorRefusal) throw doorRefusal;
      return client.chat(m.id, msgs, opts);
    };
    // COMPUTE: the value comes from the evaluator, never the model (II.9); the model only phrases it.
    const computed = kind === "compute" ? computeEvaluate(question) : null;
    if (computed && computed.ok) sourceBlock = `The fold's evaluator computed: ${computed.text}\nThis is exact. State the result to the person in one short, natural sentence, using exactly this value and only the numbers they gave. Do not do any other arithmetic and do not show other figures or steps.`;
    // THE MESSAGE ARRAY: one system message (base + past discourse + records +
    // source block), then at most a small recency window of raw messages, then
    // the question — never the whole transcript. A short exchange is the one
    // case sent whole: the bound is a budget, and what fits inside it is
    // carried verbatim, so a continuation like "well?" has the thread to read.
    const recencyWindow = conversationVerbatim(s) ? history.length : undefined;
    // GARY'S ORDER (fold-chat-gary.js composeTurn): one system message, the recent exchange, THE QUESTION LAST and verbatim. What the
    // reply hears about the conversation rides as plain facts (Terry Gross's flow reading, fold-chat-flow.js; the pathos archons' felt
    // shape of the recent answers, fold-chat-pathos.js) — only on a turn the model may write, and each fact is read by Gary first. A fold
    // Gary REFUSES is withheld, not shipped; a prompt too big for the window the model is loaded at is shrunk, never cut in the middle.
    let flowInfo = null, feltInfo = null;
    let messages = [];
    garyDoor.drain();   // this turn's decisions start empty (a stopped or failed earlier turn leaves none behind)
    if (!modelBarred) {
      const conversational = kind === "research" || kind === "chat" || kind === "advice" || !!threadTurn;
      feltInfo = conversational ? readFelt(s.messages.slice(0, askAt), { convo: id, memo: s.pathos }) : null;
      if (feltInfo && !feltInfo.gap) s.pathos = feltInfo.memo;
      flowInfo = conversational ? cuesFor({ act: follow.act || actOf(question), felt: feltInfo?.felt || null, pathosCue: feltInfo?.cue || null, door: garyDoor }) : null;
      const materialInView = modelSpeaksAlone(kind) ? undefined : webPassages.length + (threadTurn ? 1 : 0) + (computed && computed.ok ? 1 : 0) + materialOf(s).length;
      const fromWeb = !!webPassages.length && !threadTurn && !(computed && computed.ok);
      const composed = garyDoor.composeTurn({
        basePrompt: turnBase, cues: flowInfo?.cues || [], summary: s.summary, history: history.slice(0, -1), question, sourceBlock, recencyWindow,
        shrinkSource: fromWeb ? (maxChars) => sourcesPrompt(webPassages.map((p) => ({ ...p, text: String(p.text || "").slice(0, maxChars) }))) + (webPassages.some((p) => p.recipe) ? "\n\n" + CARD_PROMPT : "") : null,
      }, { model: m.id, maxTokens: 1024, material: materialInView });
      messages = composed.messages;
      if (composed.refused.length) doorRefusal = Object.assign(new Error("the prompt was withheld before it reached the model (" + composed.refused.map((f) => f.rule).join(", ") + ") \u2014 nothing was sent"), { status: 422 });
    }
    try {
      let skipModel = modelBarred, fellBack = null;
      let out = { text: "", tokens: 0 };
      // NO MODEL REACHABLE, and this turn would call one: fall back to the sources-only strand when sources were read
      // (the same way a gate refusal does); otherwise there is nothing honest to show, and the turn says why.
      if (!skipModel && m.none) {
        const why = noModelWhy({ bridgeUp: modelsUp, models, selectedId: s.model || null });
        const fb = wantWeb && webPassages.length ? snipsOf(webPassages, searchQ) : null;
        if (!fb || !fb.snips.length) throw Object.assign(new Error("no model \u2014 " + (why.text || "none is available")), modelsUp ? {} : { status: 0 });
        fellBack = noModelFallbackNotice(why, { from: answerMode });
        strand = fb; skipModel = true;
        feedPush(lineEvent(tt, "No model is reachable", { tone: "info", note: "so I'll show what the sources say" }));
        feedPush(lineEvent(tt, "Strung the sources' passages together", { tone: "ok", note: `${fb.snips.length} passage(s), their own words \u2014 no model` }));
      }
      // A model call that is REFUSED (the bridge's safety gate answers 403) or FAILS never ends the turn with
      // nothing when the turn has read sources: the app falls back to the Sources-only strand (no model, so no
      // gate), says why in its own words, and offers a retry. The gate's words are quoted, never paraphrased.
      const modelPlace = m.sealed ? "sealed-external" : client.isPageModel(m) ? "this tab" : "this machine";
      if (!skipModel) feedPush(beginStep(tt, "write", webPassages.length ? `Writing the answer from ${webPassages.length} source(s) \u00b7 ${m.id}` : `Writing the answer \u00b7 ${m.id}`, { verb: `Writing the answer (${m.id})`, slowAfter: 8000, slow: `waiting on ${m.id} (slow: a model on ${modelPlace} can take 10\u201320 s)` }));
      let firstToken = false;
      // A first load of an in-tab model rides this turn's own feed: one step, with web-llm's own progress words (percent + text).
      if (!skipModel && client.isPageModel(m)) {
        let stepOpen = false, lastPct = -10;
        pageSink = (p) => {
          const pct = Math.round((Number(p?.progress) || 0) * 100);
          if (!p || p.phase === "ready") { if (stepOpen) { stepOpen = false; feedPush(endStep(tt, "load", { title: `${m.name || m.id} is ready in this tab`, tone: "ok" })); } return; }
          if (!stepOpen) { stepOpen = true; feedPush(beginStep(tt, "load", `Loading ${m.name || m.id} in this tab (WebLLM)`, { verb: "Loading the model in this tab", slowAfter: 60000, slow: "still loading \u2014 a first download takes a while, and it only happens once" })); }
          if (pct >= lastPct + 10) { lastPct = pct; feedPush(noteEvent(tt, "load", `${pct}% \u00b7 ${String(p.text || "").slice(0, 90)}`)); }
          say(`turn \u00b7 ${kindWord} \u00b7 loading the model in this tab \u00b7 ${pct}%\u2026`);
        };
      }
      if (!skipModel) try { out = await callModel(messages, {
        base: bridge, privacy: "sealed-external", audit: { run: runId },
        onToken: (t) => {
          if (!firstToken) { firstToken = true; feedPush(noteEvent(tt, "write", "the first words are coming in")); }
          if (!body.dataset.streaming) {
            body.dataset.streaming = "1";
            for (const n of body.querySelectorAll(".live-stat")) n.remove();
          }
          body.append(document.createTextNode(t)); flight.stage = "answering…";
          if (isLive()) { E.thread.scrollTop = E.thread.scrollHeight; E.stage.textContent = "answering…"; }
        },
        signal: ac.signal,
      }); } catch (modelErr) {
        if (ac.signal.aborted || !wantWeb || !webPassages.length) throw modelErr;
        const fb = snipsOf(webPassages, searchQ);
        if (!fb.snips.length) throw modelErr;
        fellBack = declinedFallbackNotice(modelErr, { from: answerMode });
        strand = fb; skipModel = true; out = { text: "", tokens: 0 };
        for (const n of [...body.childNodes]) if (n.nodeType === 3) n.remove();   // any words the model had streamed are dropped, not shown
        delete body.dataset.streaming;
        feedPush(endStep(tt, "write", { title: `${m.id} did not answer`, tone: "bad", note: modelErr?.status === 403 ? "the safety gate said no" : String(modelErr?.message || modelErr).slice(0, 80) }));
        feedPush(lineEvent(tt, "Fell back to the sources", { tone: "ok", note: `${fb.snips.length} passage(s), their own words \u2014 no model, so no gate` }));
        say(`turn \u00b7 ${kindWord} \u00b7 the model declined \u00b7 showing the sources instead (${strand.snips.length} passage(s), no model)\u2026`);
      }
      if (ac.signal.aborted) throw abortError();
      if (!skipModel) feedPush(endStep(tt, "write", { title: `Wrote the answer \u00b7 ${m.id}`, tone: "ok", note: out.tokens ? `${out.tokens} token${out.tokens === 1 ? "" : "s"}` : "" }));
      if (isLive()) E.stage.textContent = "";
      body.classList.remove("live");
      // The fold's grounding: strip a self-citation the model invented, then
      // check the identity guard, then attribute the answer to the material the
      // conversation carries and build the record (disclosed when transparency
      // is on). The model proposes; the record decides.
      // A Sources-only turn's text IS the sources' words: it is never rewritten, scrubbed or scored.
      let text = strand ? strandText(strand.snips) : ground.stripSelfCitations(out.text).text;
      // System notes about this turn ride their OWN channel (message.notices),
      // never `content`: `content` is only what the model wrote.
      const notices = [];
      if (fellBack) notices.push(fellBack);
      // The tab's engine could not load the chosen model and answered with its small fallback: said, never hidden.
      if (out.fellBackFrom) notices.push({ kind: "fold", text: `${tabName(out.fellBackFrom)} would not load in this tab, so ${tabName(out.model)} answered instead (smaller; expect a plainer answer).` });
      // THE MODEL MAY NOT SHOW THE FOLD'S SCAFFOLDING, OR NAME A SOURCE THE PAGE DID NOT GIVE IT
      // (II.9). Source-block labels ([W1] …) are stripped from its text and the passages it pointed
      // at become real citation chips; the language is checked against the asker's; and every
      // "According to X" / "X says" / "per X" is verified against the turn's actual sources.
      const scaffold = strand ? { text, removed: 0, cited: [] } : stripScaffolding(text, webPassages);
      text = scaffold.text;
      const cited = scaffold.cited;
      let langAudit = null;
      if (text.trim() && kind !== "transform" && !strand) {
        const sl = sameLanguage(question, text);
        langAudit = { question: sl.question.lang, reply: sl.reply ? sl.reply.lang : null, same: sl.same, restated: false };
        if (!sl.same) {
          // The reply is in another language than the question: ask the model to restate ITS OWN draft
          // in the asker's (keeping every figure and name), check again, and say so if it still differs.
          say(`turn · restating the reply in ${sl.question.name}…`);
          try {
            const rs = await callModel(restateMessages(text, sl.question.name), { base: bridge, privacy: "sealed-external", audit: { run: runId }, signal: ac.signal, temperature: 0.2 });
            const fixed = stripScaffolding(String(rs.text || "").trim(), webPassages).text.trim();
            if (fixed && sameLanguage(question, fixed).same) { text = fixed; langAudit.restated = true; }
            else notices.push(languageNotice(sl.question, sl.reply, { restated: true }));
          } catch (e) {
            if (ac.signal.aborted) throw e;
            notices.push(languageNotice(sl.question, sl.reply));
          }
        }
      }
      const attr = strand ? { text, removed: [], kept: [] } : checkAttributions(text, { sources: webPassages, material: materialOf(s), userText: question });
      if (attr.removed.length) { text = attr.text; const an = attributionNotice(attr.removed); if (an) notices.push(an); }
      // COMPUTE: the model only worded a value the evaluator computed. If its wording dropped the
      // result or added a figure of its own, its wording is not shown (the record carries the computed line).
      if (computed && computed.ok && text.trim()) {
        const keep = answerKeeps(text, computed);
        if (!keep.ok) {
          notices.push({ kind: "computed", text: `The model's wording ${keep.hasResult ? "added a figure of its own" : "did not state the computed result"}, so it is not shown. The fold computed: ${computed.text}.` });
          text = "";
        }
      }
      // A content-refusal from the model ("I cannot / I do not have access to
      // personal information…") is a FAILURE, not an answer. The fold's job is
      // to report what the sources say; a model's policy reflex must never be
      // shown as the result. Replace it with the fold's own honest line.
      if (!strand && isRefusal(text)) {
        notices.push({
          kind: "refusal",
          text: webPassages.length
            ? "The model declined to answer from the sources it was given. This is a model-side refusal, not a finding — the sources were read; try again or rephrase."
            : "I couldn't reach any sources for this, and I won't answer from memory. Try rephrasing, or attach material you already have.",
          modelSaid: text.slice(0, 400),
        });
        text = "";   // the fold shows its own line; the refusal is not an answer and is not kept as one
      }
      const bad = text && !strand ? memory.ungroundedIdentity(text, { readerName, facts: s.facts || {} }) : null;
      if (bad) notices.push({ kind: "identity", text: memory.identityCorrection(bad, { readerName }) });
      const material = [
        ...materialOf(s),
        // a transform's material IS the person's own text: it is grounded against itself, not the web
        ...(kind === "transform" ? [{ ref: "your message", source: "your message", text: question }] : []),
        ...webPassages.map((p) => ({ ref: p.ref, source: p.source, text: String(p.text || "").slice(0, 12000) })),
        // a thread-grounded reply is held against the earlier turn it answers from
        ...(threadTurn ? [{ ref: "earlier in this chat", source: "turn " + threadTurn.turn, text: threadTurn.answer }] : []),
      ];
      // LIVE DATA: pages were read but nothing the model said is established by them (a weather page
      // is a snapshot, not a feed). The model's guess is not shown; the typed 'live' gap is drawn.
      let liveDrop = false;
      if (liveHit && !strand && webPassages.length && text.trim() && !ground.coverage(text, material).grounded) { liveDrop = true; text = ""; }
      // The app-authored words of a turn the model may not answer alone (a fixed line, or "no sources for this kind of ask").
      if (aloneBarred) { const at = follow.mode === "cold-gap" ? { notice: coldFollowUpNotice() } : aloneTurn(kind); if (at.notice) notices.push(at.notice); }
      if (threadTurn && text.trim()) notices.push(threadNotice(threadTurn));
      if (!text.trim() && !notices.length && !skipModel && !liveDrop) notices.push(emptyNotice({ tokens: out.tokens, model: m.id }));
      const turn = s.messages.filter((x) => x.role === "assistant").length + 1;
      const lastUser = [...s.messages].reverse().find((x) => x.role === "user");
      // Every turn but a greeting carries a grounding record — the fold is
      // always grounded, and the material is ONLY attachments, pasted
      // documents, and web passages. The conversation is never material.
      // A strand is never SCORED: its words are the sources', not a claim of ours (turnRecord gets an empty answer).
      const record = recordable(kind) ? ground.turnRecord(strand ? "" : text, material, { turn, question: lastUser?.content || "", model: m.id, sealed: !!m.sealed, effort }) : null;
      if (record && webTrace) record.web = webTrace;
      // Sentences the gate could not check because they are in another language than every source: a typed note, never a silent miss
      // (the gate compares wording, wording cannot cross a language, and the fold does not translate or call the sentence wrong).
      if (record && record.gaps && record.gaps.length) notices.push({ kind: "language-gap", text: ground.languageGapNote(record.gaps) });
      // What Gary, Terry Gross and the pathos archons did on this turn — rules, counts and the speech act, never the prompt's own words.
      { const decisions = garyDoor.drain();
        if (record) {
          if (decisions.length) record.gary = decisions;
          if (flowInfo) record.flow = { act: flowInfo.act, move: follow.kind === "move" || undefined, cues: flowInfo.cues.map((c) => c.from), ...(flowInfo.dropped.length ? { dropped: flowInfo.dropped } : {}) };
          if (feltInfo) record.pathos = { condition: feltInfo.condition, gap: feltInfo.gap || undefined, experiencer: feltInfo.experiencer?.who };
        } }
      // A creative turn (a poem, a story, an essay asked for) has no claims to
      // check: it keeps its search and its sources, but nothing of it is scored
      // — no void, no ✱, nothing recorded as "not supported by the material".
      if (record && !checkable(kind)) {
        if (kind === "generate") record.creative = true;
        record.noClaims = noClaimsLabel(kind) || "no claims checked";
        record.unsupported = { numbers: [], names: [] };
        record.ungrounded = [];
        record.line = `On record · turn ${turn} · ${kind === "generate" ? "creative" : kind} · no claims checked`;
      }
      if (record) record.nSources = webPassages.length + materialOf(s).length + (threadTurn ? 1 : 0);
      if (record && threadTurn) record.answeredFrom = { turn: threadTurn.turn, askIndex: threadTurn.askIndex, answerIndex: threadTurn.answerIndex };
      if (record && follow.kind !== "standalone") record.followed = { kind: follow.kind, said, searched: follow.search || null, carried: follow.carried || [], topic: follow.topic || null };
      if (record && strand) {
        record.authored = "sources"; record.answerMode = "snips";
        record.noClaims = "the sources' own words, unchanged \u2014 no model wrote this, so nothing is scored";
        record.unsupported = { numbers: [], names: [] }; record.ungrounded = [];
        record.line = `On record \u00b7 turn ${turn} \u00b7 sources only \u00b7 ${strand.snips.length} passage(s) quoted`;
        record.snipsN = strand.snips.length;
        if (fellBack) record.fellBackFrom = fellBack.fellBackFrom;
      } else if (record) {
        record.answerMode = "facing";
        // RECIPE CARDS: a page that declares a recipe is shown as its own card (verbatim, credited, linked);
        // the model was told not to retype it (CARD_PROMPT). The void stands down when cards were shown.
        const cards = recipeSnips(webPassages);
        if (cards.length) record.snips = cards;
      }
      if (record && computed && computed.ok) record.computed = { expr: computed.expr, value: computed.valueText, text: computed.text, kind: computed.kind, by: "the fold's evaluator" };
      if (record && cited.length) record.cited = cited;
      if (record && langAudit) record.language = langAudit;
      if (record && attr.removed.length) record.attributionsRemoved = attr.removed.slice(0, 8).map((r) => ({ name: r.name, reason: r.reason }));
      // The PROCESS this turn ran (disclosed in the process panel) — what the
      // fold DID, not what it grounded: classify → search → read → write → check.
      if (record) {
        record.kind = kind;
        record.process = [
          `classified · ${kindWord}`,
          `effort · ${web.EFFORT_LEVELS.find((l) => l.key === effort)?.label || effort} — ${web.EFFORT_LEVELS.find((l) => l.key === effort)?.note || ""}`,
          wantWeb
            ? (webPassages.length ? `searched the web · read ${webPassages.length} source(s)` : `searched the web · nothing readable`)
            : `no search · ${kind === "smalltalk" ? "greeting" : kind === "compute" ? "computed by the fold's evaluator" : kind === "transform" ? "your own text is the material" : kind === "code" ? "programming question" : "personal writing"}`,
          skipModel ? `no model call \u00b7 ${strand ? "answer mode: Sources only \u2014 the answer is the sources' own passages" + (strand.dropped.length ? ` (${strand.dropped.length} candidate(s) failed verification and were dropped)` : "") : plan ? (plan.gap === "live" ? "a live-data ask with nothing reachable" : "no source was reached \u2014 the model never speaks alone") : "this kind of turn has no source, and the model never speaks alone"}` : `wrote the answer \u00b7 ${m.sealed ? "sealed-external" : "local"}`,
          ...(follow.kind !== "standalone" ? [follow.mode === "thread" ? `followed the conversation \u00b7 no search \u00b7 answered from turn ${follow.thread.turn}` : follow.mode === "cold-gap" ? "a follow-up with nothing earlier to follow \u00b7 no search, no model" : `followed the conversation \u00b7 ${follow.kind} \u00b7 searched \u201c${String(follow.search || "").slice(0, 80)}\u201d`] : []),
          ...(computed && computed.ok ? [`computed · ${computed.text} (the fold's evaluator, not the model)`] : []),
          ...(scaffold.removed ? [`scaffolding · ${scaffold.removed} source label(s) removed from the model's text${cited.length ? ", " + cited.length + " shown as citations" : ""}`] : []),
          ...(langAudit ? [`language · asker ${langAudit.question}, reply ${langAudit.reply || "unknown"}${langAudit.same ? " — same" : langAudit.restated ? " — the model restated it" : " — differs, not fixed"}`] : []),
          ...(attr.removed.length ? [`attribution · removed ${attr.removed.length} unverifiable source name(s): ${[...new Set(attr.removed.map((r) => r.name))].slice(0, 3).join(", ")}`] : []),
          ...(liveDrop ? [`live data · the answer was not established by what was read, so it is not shown`] : []),
          ...(fellBack ? [`fell back \u00b7 the model did not answer (${fellBack.gate || "no model reachable"}) \u2014 drew the sources-only strand instead, no model`] : []),
          record.noClaims ? record.noClaims : record.hasMaterial ? `checked · the answer against the material carried` : `checked · no source carried`,
        ];
      }
      // THE FOLD ADVANCES (the holodeck's System-1/System-2 split): the turn's
      // mechanical fold line joins the running summary, and the turn's warrant
      // record joins the addressable store. Both are the STORE — append-only,
      // never truncated here; only the projection is bounded. This is what
      // makes the next turn carry discourse, not the transcript.
      const foldLine = FOLD.mechanicalFoldLine(question, text);
      const warrant = FOLD.buildWarrantRecord({
        turn,
        plane: "world",
        gist: foldLine,
        channels: [webPassages.length ? "web" : null, material.length ? "material" : null, "model"].filter(Boolean),
        refs: (record?.sources || []).map((r) => r.address),
        unsupported: record?.creative ? [] : [...(record?.unsupported?.numbers || []), ...(record?.unsupported?.names || [])],
        open: [],
      });
      s.summary = FOLD.addWarrantRecord(FOLD.advanceSummaryFold(s.summary, foldLine), warrant);
      // S1 SUMMARY — MECHANICAL, never a model call. Gary's own law (P80,
      // no-json-ask): JSON is the DECODER's job, never the prompt's, and asking
      // a small local model to summarise discourse as JSON is exactly the kind
      // of thing local models cannot do. So the discourse fields are COMPUTED
      // from the turns the way the fold line already is: entities from the
      // names the khora actually admitted, topic from the opening of the first
      // substantive turn, flow from the fold lines, context from what is still
      // open. No model, no JSON ask, no drift — the store only ever accrues.
      refreshSummaryMechanical(s);
      // EFFORT: the falsify pass (deep) re-checks every grounded claim — a 2–3
      // token anchor is demoted to weak, and the counts are named in the panel.
      if (record && effort === "deep" && record.coverage?.entries) {
        record.falsify = ground.falsify(record.coverage.entries);
        record.process.push(`falsified · ${record.falsify.supported} supported · ${record.falsify.weak} weak · ${record.falsify.unsupported} unsupported`);
      }
      // THE VOID — what the turn could NOT establish — is DATA on the record
      // (record.void), drawn as its own gap block. It is never appended to the
      // answer: `text` stays exactly what the model wrote. Fast skips it; a
      // creative turn has no claims, so it never has one.
      // A turn with NO ANSWER because nothing was reachable (or a live feed could not be reached) draws
      // its typed gap whatever the effort: the gap IS the turn. They are authored by the app from the
      // search trace (fold-chat-gaps.js), never by the model.
      const readList = webPassages.slice(0, 6).map((p) => {
        let domain = null; try { domain = new URL(String(p.url || p.source)).hostname.replace(/^www\./, ""); } catch {}
        const ref = String(p.ref || ""); return { title: (ref.includes(" \u2014 ") ? ref.slice(ref.indexOf(" \u2014 ") + 3) : ref).trim(), domain, url: p.url || null };
      });
      let gapReport = null;
      if (record && (plan || liveDrop)) {
        delete record.creative; delete record.noClaims;      // a gap is not "no claims to check"
        gapReport = (plan && plan.gap === "live") || liveDrop ? liveGap(webTrace, question, { read: liveDrop ? readList : [], what: liveHit?.what || null })
          : unreachedGap(webTrace, question);
        if (strandEmpty) gapReport.note = "Pages were read, but no passage of them could be quoted for this ask.";
      } else if (record && effort !== "fast" && !strand && text.trim() && !(record.snips && record.snips.length)) gapReport = voidReport(record, lastUser?.content || "", webPassages, webTrace);
      if (gapReport) {
        record.void = gapReport;
        record.process.push("void · " + voidText(gapReport));
      }
      if (record) { record.effort = effort; }
      // AMBIGUITY: a bare word that names several things — list the senses, app-authored, small, dismissible.
      if (record && sensesProbe) {
        const probe = await sensesProbe;
        const d = probe && probe.results ? disambiguationOf(probeTerm, probe.results) : null;
        if (d) {
          record.senses = { term: d.term, senses: d.senses, page: d.page, line: sensesLine(d, { english: ["en", "unknown"].includes(detectLang(question).lang) }) };
          record.process.push("senses · " + record.senses.line);
        }
      }
      // Don't persist the full passage bytes on every grounded sentence (the
      // record is stored on the message and re-stringified every turn; full
      // sourceText per sentence grows localStorage until saving silently
      // stops). The render only needs the short excerpt already in facing.
      if (record) {
        if (record.coverage?.entries) for (const e of record.coverage.entries) delete e.sourceText;
        if (record.sources) for (const s of record.sources) delete s.sourceText;
      }
      // The feed's last rows: the check (a model-written answer is held against what was read), then the one-line
      // ending that stays when the feed collapses into "how this was answered". Stored on the record, so a reload
      // replays the same rows with no timers.
      if (record && !strand && text.trim() && checkable(kind)) {
        const un = (record.unsupported?.numbers?.length || 0) + (record.unsupported?.names?.length || 0);
        feedPush(lineEvent(tt, "Checked the answer against what was read", { tone: un ? "warn" : "ok", note: un ? `${un} figure(s) or name(s) not found in the sources` : "every figure and name appears in the sources" }));
      }
      feedPush(doneEvents(tt, { ok: !(plan || liveDrop), title: summaryLine({ ms: Date.now() - flight.startedAt, nSources: webPassages.length, mode: strand ? "snips" : "facing", model: m.id, fellBack: fellBack ? (fellBack.kind === "fold" ? "nomodel" : "declined") : false, gap: !!(plan || liveDrop) }) }));
      if (record) record.feed = storeEvents(turnEvents, { max: 60 });
      const idx = s.messages.length;
      // Stored by author: a Sources-only turn is `authored: "sources"` with its verbatim snips (content = their plain
      // concatenation); every other turn's content is the model's, and exists only because a source was read.
      const storedSnips = strand ? strand.snips.map(storeSnip) : null;
      if (strand) { const chk = verifySnips(storedSnips, webPassages); if (!chk.ok) console.error("[fold-chat] a stored snip is not in its page — a bug:", chk.bad.map((b) => b.text.slice(0, 60))); }
      s.messages.push({ role: "assistant", content: text, at: now(), mode: "chat", answerMode, grounding: record, model: m.id, ...(strand ? { authored: "sources", snips: storedSnips } : {}), ...(fellBack ? { fellBackFrom: fellBack.fellBackFrom, answerMode: "snips" } : {}), ...(notices.length ? { notices } : {}) });
      s.sealed = !!m.sealed;
      s.updated = now();
      maybeName(s);
      // The referent record the NEXT turn's "him"/"it" resolves against (fold-chat-mind.js): what this turn's sources and answer named.
      try { s.referents = admitReferents(s.referents || emptyReferents(), { question, answer: strand ? "" : text, sources: webPassages.map((p) => ({ title: String(p.ref || "").includes(" \u2014 ") ? String(p.ref).slice(String(p.ref).indexOf(" \u2014 ") + 3) : String(p.ref || "") })) }); } catch (e) { /* the record is an aid, never a reason to lose a turn */ }
      // A reply that lands while another chat is open leaves a quiet mark on this
      // chat's row (cleared when it is opened) instead of drawing into that chat.
      if (!isLive()) s.unseen = true;
      save("fold-chat:sessions", sessions);
      row.wrap.remove();
      if (isLive()) appendMsg(s, "assistant", text, { sealed: m.sealed, index: idx, grounding: record, notices, model: m.id, mode: "chat", authored: strand ? "sources" : null, snips: storedSnips });
    } catch (err) {
      // A stop is a stop; ANYTHING else that died is stored as a typed, retry-able note on its own
      // message (failTurn) — whether or not this chat is the open one.
      if (ac.signal.aborted) stopped(); else failTurn(err);
    } finally {
      refreshMeter();
    }
    } catch (e) {
      // Only a stop reaches here (it was thrown out of the search): anything else
      // is a bug and must not be swallowed.
      if (ac.signal.aborted) stopped(); else failTurn(e);
    } finally {
      release();
    }
  }

  // The agent lane — the SAME thread, dispatched THROUGH heimdall to the
  // machine door. It is not a separate app: the user's message, the agent's
  // tool activity, and its answer all render inline in the one conversation
  // (in the agent's own register — teal rail, mode tag, terminal composer),
  // and the project's folder (cwd) binds the job so the machine door reads and
  // edits the same place the project stands. The model the door reasons with is
  // itself routed by heimdall (a `heimdall` provider pointing at the bridge's
  // /v1), so no model is reached outside the fold stack.
  const CODE_MODEL = { providerID: "heimdall", modelID: "qwen2.5-coder:1.5b" };
  function codeModelRef() { try { const v = JSON.parse(localStorage.getItem("fold-chat:codemodel") || "null"); return v || CODE_MODEL; } catch { return CODE_MODEL; } }
  function sessionCwd(s) { const c = s?.cwd || (s?.project ? projects[s.project]?.cwd : null) || null; if (c) taint.add(c, "folder path"); return c; }
  // The agent's round budget: how many times it may go again on what it saw.
  // Which pipeline ACTS: "compose" = penelope's code-agent (default; built for
  // small models), "khora" = the khora's open agent loop in its severed sandbox.
  function agentLane() { try { return localStorage.getItem("fold-chat:agentlane") === "khora" ? "khora" : "compose"; } catch { return "compose"; } }
  function agentModelName() { try { const v = JSON.parse(localStorage.getItem("fold-chat:codemodel") || "null"); return v?.modelID || null; } catch { return null; } }
  // Escalation to a SEALED remote model when local is busy / slow / empty. On by default.
  function agentEscalates() { try { return localStorage.getItem("fold-chat:agentescalate") !== "0"; } catch { return true; } }
  function agentRounds() { try { return Math.max(1, Math.min(6, parseInt(localStorage.getItem("fold-chat:agentrounds") || "3", 10) || 3)); } catch { return 3; } }
  // Inside the Fold card the preview is bare — the card's tabs already say what it is, and Folded has the copy button.
  function quietArtifact(host, art) {
    if (previewable(art.kind)) { const f = document.createElement("iframe"); f.sandbox = "allow-scripts"; f.srcdoc = art.code; f.className = "fv-frame"; f.title = "the live page"; host.append(f); }
    else host.append(el("pre", "art-code", art.code));
  }
  // "Reset from here": the person scrubbed the fold back to an attempt and chose it as the starting point. The NEXT agent turn
  // edits that attempt's code, not the newest one; the choice rides on the session until a turn consumes it or they undo it.
  function setResume(s, r) {
    if (!s) return;
    if (!r || !r.version) { s.resumeFrom = null; save("fold-chat:sessions", sessions); refreshComposer(); return; }
    s.resumeFrom = { foldId: r.foldId, index: r.index, round: r.version.round, kind: r.version.kind, code: r.version.code, at: now() };
    save("fold-chat:sessions", sessions);
    setEngagement("code");
    E.input.placeholder = `what should change? (starts from ${r.version.round === 0 ? "the earlier version" : "attempt " + r.version.round})`;
    E.input.focus();
  }
  async function runCode(id = activeId) {
    const s = sessions[id]; if (!s) return;
    if (busy(id)) return;
    const isLive = () => activeId === id;   // every UI write below is for the OPEN chat only
    const runId = newRun("agent");
    const cwd = sessionCwd(s);
    const task = s.messages[s.messages.length - 1].content;
    const row = liveBody(s, isLive());
    const body = row.body;
    // The feed IS the live status: no spinner line, no blinking cursor.
    body.classList.remove("live"); body.querySelector(".live-stat")?.remove();
    if (cwd) body.append(el("span", "chip folderchip", "📁 " + cwd));
    const ac = new AbortController();
    // The agent's own stop path (the feed's Stop button) is this same abort; the
    // composer's Stop, Escape, and deleting the chat all reach it through the entry.
    const flight = { ac, kind: "agent", label: "agent · working…", startedAt: Date.now(), wrap: row.wrap, stage: "agent · working…", stop: () => { ac.abort(); flight.stage = "agent · stopping…"; if (isLive()) E.stage.textContent = "agent · stopping…"; } };
    inflight.set(id, flight);
    if (isLive()) E.stage.textContent = flight.stage;
    refreshComposer(); renderChats();
    // THE FOLD — this run's artifact, its append-only log and its folded output, kept whole and shown live
    // (Artifact · Log · Folded). The agent loop writes to it as each attempt lands; the message keeps a snapshot.
    const resume = s.resumeFrom && s.resumeFrom.code ? s.resumeFrom : null;
    const fold = createFold({ task });
    if (resume) {
      addFoldVersion(fold, { round: 0, maker: { kind: "restored" }, code: resume.code, kind: resume.kind });
      addFoldLog(fold, { round: 0, stage: "fold", by: "app", title: `started from ${resume.round === 0 ? "an earlier version" : "attempt " + resume.round} of the last run`, detail: "you reset to that point", tech: `resumed from ${resume.foldId} event ${resume.index}`, ok: true });
    }
    const foldView = mountFold(body, fold, { live: true, renderArtifact: quietArtifact, tryCall: (code, expr) => callMany(code, [expr]).then((r) => r[0]), onReset: (r) => setResume(s, r) });
    const tuck = tuckSteps(body, { open: true });
    const feed = createFeed(tuck.inner, { live: true, onStop: () => flight.stop(), onRetry: () => rerunAs(id, task, "agent"), onAuditOpen: (auditId) => openAudit(auditId) });
    try {
      // THE LOOP (fold-chat-agent.js): dispatch to the machine door → run what
      // came back in a sandbox and LOOK → if it failed, go again with the
      // observed problem in the SAME door session, until it holds or the budget
      // is spent. A fenced behavioral test the person attached rides every
      // round as the REAL test. The door's session id is persisted the moment
      // it arrives, so a follow-up always continues the same session.
      const verification = client.extractVerification(task);
      // THE PIPELINES THAT FEED IT, each through heimdall:
      //   khora    reads the ask (/api/read — model-free reader)
      //   penelope composes the code (/api/code → the weave: swarm → field → hunt → mouth)
      //            — or, in the "loop" engine, the khora's own open agent loop (/api/agent)
      //   sandbox  runs what came back and measures it
      //   janus    rules on the measured facts (/api/reason) — the engine decides
      const lane = agentLane();
      const result = await runAgent({
        task, base: resume ? { code: resume.code, kind: resume.kind } : null, verification, signal: ac.signal, maxRounds: agentRounds(), sessionId: resume ? null : s.codeSessionId || null,
        actPipeline: lane === "khora" ? "khora" : "penelope",
        slowAfterMs: 75000,
        escalate: agentEscalates() ? async (prompt, o) => {
          const candidates = client.remoteCandidates(models);
          if (!candidates.length) throw new Error("no sealed remote model is available through heimdall");
          const t0 = Date.now();
          const out = await client.remoteCode(prompt, { candidates, prior: o.prior, base: bridge, signal: o.signal, onTry: o.onTry, run: runId, taint, mode: privacyMode(), redact: (t) => redactor.spans(t, { signal: o.signal }), readNames: async (t) => ((await client.read(t, { base: bridge, source: "deid", signal: o.signal }))?.referents || []).flatMap((r) => r.surfaces || []) });
          return { sessionId: null, text: out.text, ms: Date.now() - t0, lane: "sealed-remote", executed: false, model: out.model, audit: out.sent,
            activity: [...out.tried.map((t) => ({ tool: "remote", status: "failed", title: `${t.model}: ${t.error}` })), { tool: "remote", status: "done", title: out.model + " · sealed-external" }] };
        } : null,
        read: (t) => client.read(t, { base: bridge, source: "agent-task", sessionId: s.codeSessionId || null, signal: ac.signal }),
        derive: (spec, o) => client.reason(spec, { base: bridge, signal: o?.signal || ac.signal }),
        dispatch: async (prompt, o) => {
          let out;
          if (lane === "khora") {
            const t0 = Date.now();
            const sid = o.sessionId || ("ses_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
            const res = await client.agent(prompt, { base: bridge, model: agentModelName(), maxTurns: 6, sessionId: sid, signal: o.signal });
            out = client.agentAnswerOf(res, { sessionId: sid, ms: Date.now() - t0 });
          } else {
            out = await client.code(prompt, { base: bridge, title: s.title, model: codeModelRef(), sessionId: o.sessionId, cwd, verification: o.verification, signal: o.signal });
          }
          if (out.sessionId) { s.codeSessionId = out.sessionId; save("fold-chat:sessions", sessions); }
          return out;
        },
        observe: (code, o) => observeArtifact(code, { kind: o.kind, signal: ac.signal }),
        emit: (e) => { feed.push(e); addFoldEvent(fold, e); foldView.update(); },
        onVersion: (v) => { addFoldVersion(fold, v); foldView.update(); },
      });
      feed.dispose();
      tuck.settle({ keepOpen: false, label: "How it got here" });   // settled below if the run did not hold
      // Cross-check every request this run sent through heimdall against heimdall's
      // OWN ledger — what left, byte for byte, per the door it left through.
      const mine = outbound.byRun(runId).filter((e) => e.via === "heimdall");
      if (mine.length) { await outbound.verifyAll(mine.map((e) => e.id)).catch(() => {}); const auditEv = ({ type: "audit", at: result.ms, entries: outbound.byRun(runId).map((e) => ({ id: e.id, model: e.model, host: (e.verification && e.verification.host) || e.host, level: e.grade.level, sealed: e.grade.sealed, bytes: e.bytes, leaks: e.grade.leaks.length, verified: e.verification ? e.verification.verified : null, problems: e.verification?.problems || [], via: e.via, status: e.status })), summary: outbound.summary(outbound.byRun(runId)) }); feed.push(auditEv); result.events.push(auditEv); }
      if (!result.ok) tuck.settle({ keepOpen: true, label: "What happened" });   // a run that did not hold keeps its story open
      const art = result.artifact;
      const renderText = art ? (/```/.test(art) ? art : "```" + fenceLangFor(art) + "\n" + art + "\n```") : "";
      // No artifact is a NOTE about the run, on its own channel — not text the agent said.
      const agentNotices = result.stopped ? [{ kind: "stopped", text: art ? "Stopped \u2014 the agent was cut short." : "Stopped before the agent produced any code." }]
        : art ? [] : [{ kind: "agent", text: `the agent produced no code${result.error ? " — " + result.error : ""}` }];
      const lastRound = result.rounds[result.rounds.length - 1] || null;
      const codeRec = {
        code: true, cwd, lane: lastRound?.lane || "penelope-code-agent", events: result.events, ms: result.ms,
        outcome: result.ok ? "held" : result.stopped ? "stopped" : result.exhausted ? "exhausted" : "failed",
        activity: result.events.filter((e) => e.type === "tool").map((e) => ({ tool: e.tool, status: e.status, title: e.title })),
        executed: false,
        fold: foldSnapshot(fold),
      };
      const idx = s.messages.length;
      s.messages.push({ role: "assistant", content: renderText, at: now(), mode: "agent", codeSessionId: s.codeSessionId, cwd, grounding: codeRec, ...(agentNotices.length ? { notices: agentNotices } : {}) });
      s.updated = now();
      maybeName(s);
      if (!isLive() && !result.stopped) s.unseen = true;
      if (sessions[id] === s) save("fold-chat:sessions", sessions);
      row.wrap.remove();
      if (isLive()) appendMsg(s, "assistant", renderText, { index: idx, cwd, grounding: codeRec, notices: agentNotices, model: codeModelRef().modelID, mode: "agent" });
    } catch (err) {
      feed.dispose();
      if (isLive()) { E.stage.textContent = ""; body.append(el("div", "ar-foot bad", "error: " + err.message)); }
      else {
        row.wrap.remove();
        s.messages.push({ role: "assistant", content: "", at: now(), mode: "agent", notices: [{ kind: "agent", text: "error: " + err.message }] });
        s.updated = now(); s.unseen = true;
        if (sessions[id] === s) save("fold-chat:sessions", sessions);
      }
    } finally {
      s.iterate = false;
      if (resume && s.resumeFrom === resume) { s.resumeFrom = null; save("fold-chat:sessions", sessions); }   // a turn consumes the reset point it started from
      inflight.delete(id);
      refreshComposer(); renderChats();
      if (isLive()) { E.stage.textContent = ""; E.input.focus(); }
      refreshMeter();
    }
  }

  E.composer.onsubmit = (e) => {
    e.preventDefault();
    // While the OPEN chat's turn runs the button is Stop (see send.onclick) and
    // nothing new can be sent into it.
    if (life.composerLocked(inflight, activeId)) return;
    const text = E.input.value.trim();
    if (!text) return;
    E.input.value = ""; E.input.style.height = "auto";
    const s = sessions[activeId] || (newChat(), sessions[activeId]);
    // EFFORT IS CAPTURED HERE, at send, and stamped on the ask: it applies to
    // this turn only. (A code-door turn runs no grounded pipeline, so it carries none.)
    const grounded = !(engagement === "code" && isCodeTask(text));
    const effort = grounded ? takeEffort() : null;
    const answerMode = grounded ? takeAnswerMode() : null;
    s.messages.push({ role: "user", content: text, at: now(), mode: normMode(engagement), ...(effort ? { effort } : {}), ...(answerMode ? { answerMode } : {}) });
    // Learn the person's name only when they state it — never guessed.
    const learned = memory.extractStatedName(text);
    if (learned) { s.facts = { ...(s.facts || {}), name: learned }; readerName = learned; try { localStorage.setItem("fold-chat:reader", learned); } catch (e) {} }
    s.title = s.title === "New chat" ? text.slice(0, 46) : s.title;
    s.updated = now();
    save("fold-chat:sessions", sessions);
    setView(false);
    appendMsg(s, "user", text, { index: s.messages.length - 1, mode: normMode(engagement) });
    renderChats();
    // CODING ONLY GOES TO THE MACHINE DOOR. A research or writing question in
    // the Code engagement is NOT a code task: it goes through the grounded
    // path (search → spread → write), so the fold never answers a factual
    // question from the coder model's memory. Only a real code/files ask
    // dispatches to opencode.
    if (!grounded) runCode(s.id);
    else {
      run(s.id, false);
    }
  };
  // Send is Stop while the open chat has a turn in flight: a real button, so
  // Enter/Space work on it; Escape in the composer stops too (the textarea stays
  // focusable, read-only, while the turn runs). Aborting leaves the person's
  // message in place with a quiet "stopped" note on message.notices.
  E.send.addEventListener("click", (e) => { if (life.composerLocked(inflight, activeId)) { e.preventDefault(); stopOpenTurn(); } });
  E.composer.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && life.composerLocked(inflight, activeId) && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); stopOpenTurn(); }
  });
  E.input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!life.composerLocked(inflight, activeId)) E.composer.requestSubmit(); } });
  E.input.addEventListener("input", () => { E.input.style.height = "auto"; E.input.style.height = Math.min(E.input.scrollHeight, 200) + "px"; });

  /* ---------------- settings ---------------- */
  // The bridge, the preset, the theme, and the default mode — the surface's
  // configuration, kept out of the conversation sidebar.
  function applyPreset(next) {
    preset = next;
    try { localStorage.setItem("fold-chat:preset", preset); } catch (e) {}
    const s = sessions[activeId]; if (s) { s.preset = preset; save("fold-chat:sessions", sessions); }
  }
  // THEME: `fold-chat:theme` holds an explicit "light" or "dark"; with none
  // stored the page follows the system (prefers-color-scheme) and keeps
  // following it as it changes. The data-theme attribute is always the
  // resolved light/dark (index.html sets it before first paint).
  const systemDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function themePref() { try { const t = localStorage.getItem("fold-chat:theme"); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } }
  function applyTheme(pref) {
    try { if (pref === "light" || pref === "dark") localStorage.setItem("fold-chat:theme", pref); else localStorage.removeItem("fold-chat:theme"); } catch (e) {}
    const resolved = pref === "light" || pref === "dark" ? pref : (systemDark?.matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", resolved);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.append(meta); }
    meta.content = resolved === "dark" ? "#17171a" : "#ffffff";
  }
  systemDark?.addEventListener?.("change", () => { if (themePref() === "system") { applyTheme("system"); paintTheme(); } });
  function markOn(btn, on) { btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on ? "true" : "false"); }
  function paintTheme() {
    const cur = themePref();
    for (const b of E.setTheme.querySelectorAll("button")) markOn(b, b.dataset.theme === cur);
  }
  function paintModeSetting() { for (const b of E.setMode.querySelectorAll("button")) markOn(b, b.dataset.mode === engagement); }
  function paintTransparency() { for (const b of E.setTransparency.querySelectorAll("button")) markOn(b, b.dataset.transparency === (transparency ? "1" : "0")); }
  E.setTheme.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; applyTheme(b.dataset.theme); paintTheme(); };
  E.setMode.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; setEngagement(b.dataset.mode); paintModeSetting(); };
  E.setTransparency.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; setTransparency(b.dataset.transparency === "1"); paintTransparency(); };

  function openSettings() {
    for (const [k, p] of Object.entries(PRESETS)) if (!E.setPreset.querySelector(`option[value="${k}"]`)) E.setPreset.append(new Option(p.label, k));
    E.setBridge.value = bridge;
    E.setPreset.value = preset;
    if (E.setAgentLane) E.setAgentLane.value = agentLane();
    if (E.setAgentRounds) E.setAgentRounds.value = String(agentRounds());
    if (E.setAgentEscalate) E.setAgentEscalate.checked = agentEscalates();
    paintTheme(); paintModeSetting(); paintTransparency();
    E.setAbout.innerHTML = `bridge <b>${esc(bridge)}</b> · version <b>v0.1</b> · cloud models are <b>sealed-external</b> by default; raw workspace tokens never leave.`;
    updateBridgeStatus();
    refreshKeyStatus();
    E.settingsModal.hidden = false;
    E.setBridge.focus();
  }
  function closeSettings() { E.settingsModal.hidden = true; }
  function saveSettings() {
    const next = E.setBridge.value.trim();
    // The same-origin embedded heimdall is found, not stored: a stored copy would go stale on another port or host.
    if (next && client.bridgeBase(next) !== client.sameOriginBridge()) { try { localStorage.setItem("fold-chat:bridge", next); } catch (e) {} }
    applyPreset(E.setPreset.value);
    try { if (E.setAgentLane) localStorage.setItem("fold-chat:agentlane", E.setAgentLane.value); if (E.setAgentRounds) localStorage.setItem("fold-chat:agentrounds", E.setAgentRounds.value); if (E.setAgentEscalate) localStorage.setItem("fold-chat:agentescalate", E.setAgentEscalate.checked ? "1" : "0"); } catch (e) {}
    closeSettings();
    toast("settings saved");
    // The bridge may have moved — re-list the models it serves.
    if (next && client.bridgeBase(next) !== client.bridgeBase(bridge)) location.reload();
  }
  // The bridge line under the field: found / not found, and the gate it reports.
  function updateBridgeStatus() {
    if (!E.bridgeStatus) return;
    if (bridgeHello) E.bridgeStatus.innerHTML = `connected · <b>${esc(bridge)}</b> — every model and the sealed-external gate route here.`;
    else if (bridge && models.length) E.bridgeStatus.innerHTML = `connected · <b>${esc(bridge)}</b>.`;
    else E.bridgeStatus.innerHTML = `no bridge found — the model still runs in this tab. Start the Fold's own server (<b>npm run serve</b>: it carries heimdall at <b>/heimdall</b>), then Detect.`;
  }
  E.bridgeDetect.onclick = async () => {
    E.bridgeStatus.textContent = "looking for heimdall…";
    const found = await client.detectBridge({ override: E.setBridge.value.trim() || null });
    if (found.ok) {
      bridge = found.base; bridgeHello = found.hello;
      E.setBridge.value = bridge;
      if (bridge !== client.sameOriginBridge()) { try { localStorage.setItem("fold-chat:bridge", bridge); } catch (e) {} }
      await refreshModels();
      updateBridgeStatus();
      toast("heimdall found at " + bridge);
    } else {
      bridgeHello = null; updateBridgeStatus(); toast("no heimdall found (this server's /heimdall, then the legacy local bridge)");
    }
  };
  // Provider keys: posted to the localhost bridge, stored server-side (beside
  // `heimdall key`), and never kept in this page. The field is cleared on save.
  const KEY_TONE_COLOR = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)" };
  // Show a plain-language result (headline + lines) in the status box; `actions` are [{label, run}] buttons under it.
  function showKeyStatus({ tone = "warn", headline = "", lines = [] }, actions = []) {
    const box = E.keyStatus; if (!box) return;
    box.textContent = "";
    if (headline) { const h = el("div", "", headline); h.style.fontWeight = "600"; h.style.color = KEY_TONE_COLOR[tone] || ""; box.append(h); }
    for (const l of lines) box.append(el("div", "", l));
    if (actions.length) {
      const bar = el("div"); bar.style.marginTop = "6px";
      for (const a of actions) { const b = el("button", "btn", a.label); b.type = "button"; b.style.marginRight = "6px"; b.onclick = a.run; bar.append(b); }
      box.append(bar);
    }
  }
  // Where each stored key stands: stored, and — separately — LOADED by the running heimdall (a key saved by the
  // terminal after heimdall started is stored but not loaded until heimdall reloads or restarts).
  async function refreshKeyStatus() {
    if (!E.keyStatus) return;
    try {
      const j = await client.listProviderKeys({ base: bridge });
      const stored = j.providers || [];
      if (!stored.length) { showKeyStatus({ tone: "warn", headline: "", lines: ["No provider keys saved on this machine yet. Paste one above and press Save: it is tested right away and you will see what it unlocks."] }); return; }
      const lines = []; const actions = []; let notLoaded = false;
      for (const p of stored) {
        const st = client.keyLoadState(p.provider, { stored, models });
        const nm = p.provider === "anthropic" ? "Anthropic" : p.provider === "openai" ? "OpenAI" : p.provider;
        if (st.state === "loaded") lines.push(`${nm} ${p.masked || ""}: saved and loaded. heimdall offers ${st.models.length} model${st.models.length === 1 ? "" : "s"} (${st.models.join(", ")}), and the Fold's online help can use ${st.models.length === 1 ? "it" : "them"}.`);
        else { notLoaded = true; lines.push(`${nm} ${p.masked || ""}: saved, but heimdall has not loaded it yet, so no ${nm} model is available. Press "Load now"; if that does not help, restart heimdall (stop it, then: heimdall up). The key is saved, nothing is lost.`); }
        actions.push({ label: `Test ${nm} again`, run: () => testKey(p.provider) });
      }
      if (notLoaded) actions.unshift({ label: "Load now", run: loadKeysNow });
      showKeyStatus({ tone: notLoaded ? "warn" : "ok", headline: "", lines }, actions);
    } catch { showKeyStatus({ tone: "warn", headline: "", lines: ["heimdall is not answering — start the Fold's own server (npm run serve) to store keys."] }); }
  }
  async function loadKeysNow() {
    try { await client.reloadProviderKeys({ base: bridge }); await refreshModels(); toast("heimdall reloaded its keys"); }
    catch (e) {
      showKeyStatus({ tone: "warn", headline: "heimdall could not reload the keys", lines: e.status === 404
        ? ["The heimdall that is running started before this feature and cannot reload. Restart it (stop it, then: heimdall up). The key is saved, nothing is lost."]
        : [String(e.message || e)] });
      return;
    }
    refreshKeyStatus();
  }
  async function testKey(provider) {
    showKeyStatus({ tone: "warn", headline: "Testing…", lines: ["Asking the provider whether the saved key works (one tiny request)."] });
    try {
      const j = await client.testProviderKey(provider, { base: bridge });
      await refreshModels();
      const d = client.describeKeyResult(provider, j, { models });
      showKeyStatus(d, [{ label: "Test again", run: () => testKey(provider) }]);
    } catch (e) {
      showKeyStatus({ tone: "warn", headline: "Could not test the key", lines: [e.status === 404 ? "This heimdall is an older version and cannot test keys. Restart it (stop it, then: heimdall up) to get the check." : String(e.message || e)] });
    }
  }
  async function saveProviderKey(provider, input) {
    const key = (input.value || "").trim();
    if (!key) { toast("enter a key first"); input.focus(); return; }
    const btn = E.settingsModal.querySelector(`button[data-provider="${provider}"]`);
    const row = btn?.closest(".keyrow");
    if (btn) { btn.classList.remove("saved", "err"); btn.textContent = "Testing…"; btn.disabled = true; }
    if (row) row.classList.remove("saved");
    showKeyStatus({ tone: "warn", headline: "Testing the key…", lines: ["Received. Sending one tiny test request to the provider to see whether it works."] });
    try {
      const j = await client.setProviderKey(provider, key, { base: bridge });
      input.value = ""; // the page never keeps the key
      await refreshModels(); // the model list (and the online-escalation candidates) pick up the new provider now, no reload
      const d = client.describeKeyResult(provider, j, { models });
      if (btn) {
        btn.textContent = d.ok ? "✓ works" : d.tone === "bad" ? "✕ rejected" : "saved, not confirmed";
        btn.classList.add(d.ok ? "saved" : d.tone === "bad" ? "err" : "warn");
      }
      if (row && d.ok) row.classList.add("saved");
      toast(d.ok ? `${provider} key works` : d.headline);
      showKeyStatus(d, d.tone === "bad" ? [] : [{ label: "Test again", run: () => testKey(provider) }]);
    } catch (e) {
      if (btn) { btn.classList.add("err"); btn.textContent = "Save"; }
      showKeyStatus({ tone: "bad", headline: `Could not reach heimdall to save the ${provider} key`, lines: [String(e.message || e), "Start heimdall (heimdall up), then press Save again. Nothing was sent to the provider."] });
      toast(String(e.message || e));
    } finally { if (btn) btn.disabled = false; }
  }
  for (const [provider, input] of [["anthropic", E.keyAnthropic], ["openai", E.keyOpenai]]) {
    const btn = E.settingsModal.querySelector(`button[data-provider="${provider}"]`);
    if (btn) btn.onclick = () => saveProviderKey(provider, input);
    if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveProviderKey(provider, input); } });
    if (input && btn) input.addEventListener("input", () => { btn.textContent = "Save"; btn.classList.remove("saved", "err", "warn"); });
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
    E.railEvidence.setAttribute("aria-pressed", open ? "true" : "false");
    if (!open) return;
    E.drawer.innerHTML = "";
    const f = await client.frontier({ base: bridge }).catch(() => null);
    const led = await client.ledger({ base: bridge }).catch(() => null);
    await refreshMeter();
    const c = meterInfo?.counts || {};
    const head = el("div");
    head.innerHTML = `<div class="drawer-head"><h3>secure chat with outside models</h3></div><p>${esc(f?.gate || "the bridge reports no frontier gate yet.")}</p>
      <p class="invariant"><b>WHAT LEFT THIS MACHINE</b> — ${esc(describeSummary(outbound.summary()))}</p>
      <p>local ${c["deterministic/local"] ?? 0} · remote ${c["open remote"] ?? 0} · frontier ${c.frontier ?? 0} · external tokens ${meterInfo?.externalTokens ?? 0}</p>`;
    const x = closeButton(); x.setAttribute("aria-label", "Close evidence"); x.onclick = () => toggleDrawer();
    head.querySelector(".drawer-head").append(x);
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
    renderOutbound(E.drawer, drawerFocus);
    drawerFocus = null;
    E.drawer.append(el("p", "drawer-foot", "The Fold · chat v0.1 · models routed by heimdall · every request goes sealed-external by default"));
  }
  let drawerFocus = null;
  let drawerOpener = null;
  async function openAudit(id) {
    drawerFocus = id;
    if (E.drawer.style.display === "none") await toggleDrawer(); else { await toggleDrawer(); await toggleDrawer(); }
    E.drawer.querySelector(`[data-audit-entry="${id}"]`)?.scrollIntoView({ block: "center" });
  }

  // THE OUTBOUND LEDGER, readable: every request that left this machine, how it
  // was graded, the exact content, and whether heimdall's own ledger agrees.
  function renderOutbound(container, focusId) {
    const sec = el("section", "outbound");
    const head = el("div", "ob-head");
    head.append(el("h4", "", "what left this machine"));
    const actions = el("span", "ob-actions");
    const verifyAll = el("button", "ob-btn", "verify all against heimdall");
    verifyAll.onclick = async () => { verifyAll.disabled = true; verifyAll.textContent = "verifying…"; await outbound.verifyAll(outbound.list().filter((e) => e.via === "heimdall").map((e) => e.id)); await openAudit(null); };
    const exp = el("button", "ob-btn", "export JSON");
    exp.onclick = () => { const b = new Blob([outbound.exportJson()], { type: "application/json" }); const a = el("a"); a.href = URL.createObjectURL(b); a.download = "fold-outbound-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    const clr = el("button", "ob-btn", "clear");
    clr.onclick = () => { outbound.clear(); openAudit(null); };
    actions.append(verifyAll, exp, clr);
    head.append(actions);
    sec.append(head);
    const list = outbound.list().slice(-40).reverse();
    if (!list.length) { sec.append(el("p", "empty-hint", "nothing has left this machine in this session — local models, local reads and the khora never leave it.")); container.append(sec); return; }
    const LV = { gate: "raw", masked: "masked", abstract: "abstract", worlds: "worlds", direct: "direct" };
    for (const e of list) {
      const row = el("div", "ob-row" + (e.grade.leaks.length ? " leak" : "")); row.dataset.auditEntry = e.id;
      const top = el("div", "ob-top");
      top.append(el("span", "ob-t", String(e.at).slice(11, 19)), el("span", "ob-badge lv-" + e.grade.level, LV[e.grade.level] || e.grade.level), el("span", "ob-who", (e.model || "") + (e.host ? " · " + e.host : "") + (e.via === "direct" ? "" : e.verification?.host ? " → " + e.verification.host : "")), el("span", "ob-bytes", formatBytes(e.bytes)));
      const v = e.verification;
      top.append(el("span", "ob-ver " + (v?.verified === true ? "ok" : v?.verified === false ? "bad" : "na"), v?.verified === true ? "✓ heimdall agrees" : v?.verified === false ? "✗ disagrees" : e.via === "direct" ? "direct" : "unverified"));
      if (e.grade.leaks.length) top.append(el("span", "ob-leak", `⚠ ${e.grade.leaks.length} leak${e.grade.leaks.length === 1 ? "" : "s"}`));
      row.append(top);
      const det = el("div", "ob-det"); det.hidden = e.id !== focusId;
      det.append(el("div", "ob-line", `${e.purpose || e.kind}${e.run ? " · " + e.run : ""} · ${e.status}${e.error ? " — " + e.error : ""}`));
      for (const n of e.grade.notes) det.append(el("div", "ob-note", n));
      for (const l of e.grade.leaks) det.append(el("div", "ob-leakline", `⚠ ${l.type}: ${l.kind || l.term || ""}${l.detail ? " — " + l.detail : ""}`));
      det.append(el("div", "ob-sub", "provenance"));
      det.append(el("div", "ob-line", e.segments.map((sg) => `${sg.role} · ${sg.provenance} · ${sg.chars} chars`).join("  |  ")));
      if (e.worlds) det.append(el("div", "ob-line", `world set ${e.worlds.setId} · slot ${e.worlds.slot} of ${e.worlds.n} — the real world is not recorded anywhere that is sent`));
      det.append(el("div", "ob-sub", "exact content sent"));
      for (const m of e.messages) { const pre = el("pre", "ob-pre"); pre.textContent = `[${m.role}]\n` + String(m.content).slice(0, 6000) + (String(m.content).length > 6000 ? `\n… (${String(m.content).length - 6000} more chars)` : ""); det.append(pre); }
      if (v) det.append(el("div", "ob-line " + (v.verified ? "ob-okline" : "ob-badline"), v.verified ? `heimdall's ledger: same content · host ${v.host} · ${v.bytes} B on the wire · sha256 ${String(v.wireSha256 || "").slice(0, 16)}… · HTTP ${v.status ?? "?"}` : "not verified: " + v.problems.join("; ")));
      const vb = el("button", "ob-btn", v ? "verify again" : "verify against heimdall"); vb.onclick = async () => { vb.disabled = true; await outbound.verify(e.id); openAudit(e.id); };
      det.append(vb);
      top.onclick = () => { det.hidden = !det.hidden; };
      row.append(det);
      sec.append(row);
    }
    container.append(sec);
  }

  /* ---------------- collapsible sections ---------------- */
  // Only the Projects section collapses, and only once it has projects in it: an
  // empty section is a heading, and the chat list is never worth hiding.
  const projectsSec = document.querySelector('.sec[data-sec="projects"]');
  const projectsHead = projectsSec?.querySelector(".sec-head");
  if (projectsSec && collapsed.projects) projectsSec.classList.add("collapsed");
  if (projectsHead) projectsHead.onclick = (e) => {
    if (e.target.closest("button") || !projectsHead.dataset.collapsible) return;
    projectsSec.classList.toggle("collapsed");
    projectsHead.setAttribute("aria-expanded", projectsSec.classList.contains("collapsed") ? "false" : "true");
    collapsed.projects = projectsSec.classList.contains("collapsed"); save("fold-chat:collapse", collapsed);
  };
  function paintSections() {
    if (!projectsHead) return;
    const has = Object.keys(projects).length > 0;
    projectsHead.classList.toggle("collapsible", has);
    if (has) {
      projectsHead.dataset.collapsible = "1";
      if (!projectsHead.hasAttribute("tabindex")) activatable(projectsHead);
      projectsHead.setAttribute("aria-expanded", projectsSec.classList.contains("collapsed") ? "false" : "true");
    } else {
      delete projectsHead.dataset.collapsible;
      projectsHead.removeAttribute("tabindex"); projectsHead.removeAttribute("role"); projectsHead.removeAttribute("aria-expanded");
      projectsSec.classList.remove("collapsed");
    }
  }

  /* ---------------- rail / topbar ---------------- */
  // On a phone the rail + sidebar are one overlay drawer: ☰ opens it; the scrim,
  // Escape, the ✕-style toggle, picking a chat or any rail action closes it. On
  // wider screens none of this applies (the .nav-open class is only styled in
  // the phone media query).
  const phone = window.matchMedia ? window.matchMedia("(max-width: 720px)") : null;
  function setNav(openIt) { root.classList.toggle("nav-open", !!openIt); E.topMenu?.setAttribute("aria-expanded", openIt ? "true" : "false"); }
  if (E.topMenu) E.topMenu.onclick = () => { setNav(true); E.railToggle.focus(); };
  if (E.scrim) E.scrim.onclick = () => setNav(false);
  $("nav")?.addEventListener("click", (e) => { const b = e.target.closest(".rail button"); if (b && b.id !== "railToggle") setNav(false); });
  // An explicit ✕ on the open phone drawer (it was only closable by the sidebar
  // icon, the scrim, or Escape). Hidden on wide screens by CSS.
  const navClose = el("button", "navclose"); navClose.type = "button"; navClose.id = "navClose";
  navClose.title = "Close menu"; navClose.setAttribute("aria-label", "Close menu");
  navClose.innerHTML = CLOSE_SVG;
  navClose.onclick = () => { setNav(false); E.topMenu?.focus(); };
  $("nav")?.querySelector(".rail")?.append(navClose);
  // Escape layers: a menu / dialog / popup above closes ONLY itself (menuAt and the
  // effort menu stop or mark the event); then the nav drawer; then the Evidence drawer.
  const overlayOpen = () => !!document.querySelector(".modal:not([hidden]), .pop, .epop");
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || overlayOpen()) return;
    if (root.classList.contains("nav-open")) { setNav(false); E.topMenu?.focus(); return; }
    if (E.drawer.style.display !== "none") { e.preventDefault(); toggleDrawer(); (drawerOpener || E.railEvidence).focus?.(); }
  });
  // The keyboard must not cover the composer: on a phone the app is exactly as
  // tall as the visual viewport (dvh in the CSS is the fallback).
  if (window.visualViewport) {
    const fit = () => { if (phone?.matches) root.style.setProperty("--app-h", window.visualViewport.height + "px"); else root.style.removeProperty("--app-h"); };
    window.visualViewport.addEventListener("resize", fit);
    window.visualViewport.addEventListener("scroll", fit);
    phone?.addEventListener?.("change", fit);
    fit();
  }
  E.railToggle.onclick = () => {
    if (phone?.matches) { setNav(false); return; }
    E.side.classList.toggle("hide"); markOn(E.railToggle, !E.side.classList.contains("hide"));
  };
  if (E.topNew) E.topNew.onclick = newChat;
  { const chatsNew = $("chatsNew"); if (chatsNew) chatsNew.onclick = newChat; }   // the + beside the Chats header: the same handler (an empty current chat is reused)
  E.railSearch.onclick = async () => {
    const q = await askDialog({ title: "Search chats", value: search, placeholder: "Search titles", okLabel: "Search" });
    if (q == null) return;
    search = q.trim();
    renderChats();
  };
  E.railEvidence.onclick = (e) => { e.preventDefault(); drawerOpener = e.currentTarget; toggleDrawer(); };
  // A live window on every external call and how it was anonymized (its own module: its own button, panel and styles).
  mountMonitor({ outbound });
  E.topFocus.onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.(); };
  // (The per-thread "Process" toggle is gone: grounding is always on, and the
  // per-answer "how this was answered" line is collapsed by default. A thread
  // whose stored `grounding` is false still hides it; the global Transparency
  // setting is the switch.)
  // THE TURN CHIP — what the NEXT message will be, in one control in the composer:
  //   mode    Chat answers from the routed models; Agent hands the ask to the
  //           machine door (read → derive → execute → retain)
  //   effort  how hard the fold works: fast / balanced / deep (levers in web.EFFORT)
  //             fast      one web search, 2 reads, loose gate, no void — quick
  //             balanced  full scopes + swarm gate + on-topic reads + void (default)
  //             deep      read 6+, strict swarm, and an explicit FALSIFY pass: every
  //                       grounded claim is re-checked, weak/unsupported ones named
  // Effort is stamped on the ask when it is SENT (submit handler, run()), so moving
  // it never reaches back into a turn already sent; the chip remembers the last
  // choice (`fold-chat:effort`). In Agent the effort row is not offered: effort
  // only shapes a grounded turn. The lock says every request goes sealed-external.
  const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const CARET_SVG = '<svg class="e-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"/></svg>';
  const MODES = [["chat", "Chat", "answers from the routed models, grounded on the web"], ["code", "Agent", "hands the ask to the machine door and lands real artifacts"]];
  const turnChip = el("button", "echip");
  turnChip.type = "button"; turnChip.id = "turnBtn";
  turnChip.setAttribute("aria-haspopup", "menu"); turnChip.setAttribute("aria-expanded", "false");
  turnChip.innerHTML = `<span class="e-lock">${LOCK_SVG}</span><span class="e-v"></span>${CARET_SVG}`;
  if (E.turnSlot) E.turnSlot.append(turnChip);
  let turnPop = null;
  function effortLevel(k) { return web.EFFORT_LEVELS.find((l) => l.key === k) || web.EFFORT_LEVELS[1]; }
  function paintTurn() {
    const isAgent = engagement === "code";
    const lvl = effortLevel(composerEffort);
    const ans = ANSWER_MODES.find((a) => a.key === composerAnswer) || ANSWER_MODES[0];
    turnChip.querySelector(".e-v").textContent = isAgent ? "Agent" : "Chat · " + lvl.label + (composerAnswer === "snips" ? " · Sources only" : "");
    const what = isAgent ? "Agent — the machine door" : `Chat — effort ${lvl.label} (${lvl.note}); answer: ${ans.label} (${ans.note})`;
    const tip = `This turn: ${what}. Sealed-external. Effort and answer mode apply to the message you send next, and to that message only.`;
    turnChip.dataset.answer = composerAnswer;
    paintHint();
    turnChip.title = tip;
    turnChip.setAttribute("aria-label", tip + " Change.");
    turnChip.dataset.effort = composerEffort;
    turnChip.dataset.mode = isAgent ? "code" : "chat";
  }
  function setEffort(k) {
    const next = web.normEffort(k, composerEffort);
    if (next !== composerEffort) effortMoved = true;
    composerEffort = next;
    try { localStorage.setItem("fold-chat:effort", composerEffort); } catch (e) {}
    paintTurn();
  }
  function setAnswerMode(k) {
    const next = normAnswerMode(k, composerAnswer);
    if (next !== composerAnswer) answerMoved = true;
    composerAnswer = next;
    try { localStorage.setItem("fold-chat:answerMode", composerAnswer); } catch (e) {}
    paintTurn();
  }
  function closeTurnMenu(refocus = false) {
    if (!turnPop) return;
    turnPop.remove(); turnPop = null;
    turnChip.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", turnAway, true);
    if (refocus) turnChip.focus();
  }
  function turnAway(e) { if (turnPop && !turnPop.contains(e.target) && !turnChip.contains(e.target)) closeTurnMenu(); }
  function openTurnMenu() {
    if (turnPop) { closeTurnMenu(true); return; }
    const pop = el("div", "epop");
    pop.setAttribute("role", "menu"); pop.setAttribute("aria-label", "This turn");
    const row = (h, items, current, onPick, attr) => {
      pop.append(el("div", "epop-h", h));
      for (const it of items) {
        const b = el("button"); b.type = "button";
        b.setAttribute("role", "menuitemradio"); b.setAttribute("aria-checked", it.key === current ? "true" : "false");
        b.dataset[attr] = it.key;
        b.append(el("b", "", it.label), el("span", "", it.note));
        b.onclick = () => { onPick(it.key); closeTurnMenu(true); };
        pop.append(b);
      }
    };
    row("Mode", MODES.map(([key, label, note]) => ({ key, label, note })), engagement, (k) => setEngagement(k), "mode");
    if (engagement !== "code") row("Effort · this message", web.EFFORT_LEVELS, composerEffort, (k) => setEffort(k), "effort");
    if (engagement !== "code") row("Answer · this message", ANSWER_MODES, composerAnswer, (k) => setAnswerMode(k), "answer");
    pop.append(el("div", "epop-f", "Sealed-external: every request goes through heimdall's gate."));
    pop.addEventListener("keydown", (e) => {
      const items = [...pop.querySelectorAll("button")];
      const i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); closeTurnMenu(true); }
      else if (e.key === "Tab") closeTurnMenu();
    });
    document.body.append(pop);
    turnPop = pop;
    turnChip.setAttribute("aria-expanded", "true");
    // Open upward from the chip (the composer sits at the bottom), clamped to
    // the viewport so it is whole at phone width.
    const r = turnChip.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pr.width - 8)) + "px";
    pop.style.top = (r.top - pr.height - 8 >= 8 ? r.top - pr.height - 8 : Math.min(r.bottom + 8, window.innerHeight - pr.height - 8)) + "px";
    document.addEventListener("mousedown", turnAway, true);
    (pop.querySelector('[aria-checked="true"]') || pop.querySelector("button")).focus();
  }
  turnChip.onclick = openTurnMenu;
  // (The globe is gone: every turn except a greeting searches the web before it
  // answers — there is no switch to show, and an always-on indicator is noise.)
  // Attachments are READ THROUGH THE KHORA, never forwarded raw. The file's
  // bytes go to the bridge's read door (→ the khora's model-free constitutional
  // reader), and only the READING (referents, relations, basis) enters the
  // thread and the model's context. The raw file never leaves this page.
  E.attach.onclick = () => {
    const pick = document.createElement("input");
    pick.type = "file";
    pick.accept = ".txt,.md,.csv,.tsv,.json,.html,.js,.mjs,.srt,.vtt,.eml,.log";
    pick.onchange = async () => {
      const file = pick.files?.[0];
      if (!file) return;
      E.stage.textContent = "reading · the khora reads the attachment (model-free)…";
      try {
        const raw = await file.text();
        taint.addFromText(raw, "local-read"); taint.add(file.name, "filename");
        const reading = await client.read(raw, { base: bridge, source: file.name, sessionId: sessions[activeId]?.codeSessionId || null });
        const s = sessions[activeId] || (newChat(), sessions[activeId]);
        const note = readingNote(file.name, raw.length, reading);
        s.attachments = [...(s.attachments || []), { name: file.name, bytes: raw.length, referents: (reading.referents || []).length, relations: (reading.relations || []).length }];
        // The reading rides the history as grounded material — never the raw
        // file. The model receives what the khora read, not what was uploaded.
        s.messages.push({ role: "user", content: note, at: now(), attachment: file.name });
        s.updated = now();
        save("fold-chat:sessions", sessions);
        appendMsg(s, "user", note, { attachment: file.name });
        E.stage.textContent = "";
        toast(`read ${file.name} through the khora — ${(reading.referents || []).length} referent(s), ${(reading.relations || []).length} relation(s)`);
      } catch (err) {
        E.stage.textContent = "";
        toast("khora read failed: " + err.message);
      }
    };
    pick.click();
  };

  /** Render a khora reading (EORead@1) as a grounded note for the thread —
   *  referents, relations, basis; the raw bytes are never shown or sent. */
  function readingNote(name, bytes, r) {
    const refs = (r.referents || []).map((x) => (x.surfaces || []).join("/")).filter(Boolean).slice(0, 20);
    const rels = (r.relations || []).map((x) => `${x.end1 ?? x.subject ?? ""} ${x.label ?? x.relation ?? ""} ${x.end2 ?? x.object ?? ""}`.trim()).filter(Boolean).slice(0, 20);
    return [
      `[attachment read by the khora · ${name} · ${bytes} bytes]`,
      `basis: ${r.basis || "constitutional read"}`,
      refs.length ? `referents: ${refs.join(", ")}` : "referents: none admitted",
      rels.length ? `relations: ${rels.join("; ")}` : "relations: none admitted",
      (r.stagesNotRun || []).length ? `stages not run: ${(r.stagesNotRun || []).join(", ")}` : "",
    ].filter(Boolean).join("\n");
  }

  /* ---------------- other tabs ---------------- */
  // Each tab holds the whole sessions map; localStorage is shared. When another
  // tab writes, merge what it wrote into THIS tab's maps (life.mergeSessions:
  // newer `updated` wins, a chat only the other tab has is kept, a deleted id
  // stays dead) IN PLACE, so the open chat and any running turn survive (a
  // running chat keeps its local object), then redraw. The merge itself never
  // writes back; the next save() merges the same way.
  function syncFromStorage() {
    const tombs = loadTombs();
    const ch = life.applyInPlace(sessions, life.mergeSessions(sessions, load("fold-chat:sessions", {}) || {}, tombs, { keep: [...inflight.keys()] }));
    life.applyInPlace(projects, life.mergeSessions(projects, load("fold-chat:projects", {}) || {}, tombs));
    // A chat deleted in the other tab: its running turn here is cancelled too.
    for (const id of ch.removed) inflight.get(id)?.ac.abort();
    if (filterProject && !projects[filterProject]) filterProject = null;
    if (activeId && ch.removed.includes(activeId)) {
      const next = life.nextAfterDelete(sessions, { id: activeId, filterProject, search });
      if (next.clearSearch) search = "";
      if (next.id) open(next.id); else closeThread();
    } else if (activeId && ch.replaced.includes(activeId)) open(activeId);
    renderProjects(); renderChats();
  }
  window.addEventListener("storage", (e) => {
    if (e.storageArea && e.storageArea !== localStorage) return;
    if (e.key === null || e.key === "fold-chat:sessions" || e.key === "fold-chat:projects" || e.key === DELETED_KEY) syncFromStorage();
  });

  /* ---------------- boot ---------------- */
  applyTheme(themePref());
  renderProjects();
  paintTurn();
  // The tab's own models are listed FIRST, without waiting for any probe: the app boots and can answer with no bridge at all.
  // Then auto-detect the bridge (a custom override, the same-origin embedded /heimdall, then the legacy local port) and list
  // whatever it serves besides. A page served from GitHub Pages finds the person's own heimdall this way, with no URL to type.
  refreshModels({ pageOnly: true }).catch(() => {});
  client.detectBridge({ override: opts.bridge || localStorage.getItem("fold-chat:bridge") || null }).then((found) => {
    if (found.ok) { bridge = found.base; bridgeHello = found.hello; }
    refreshModels().then(() => {
      // Husks first (never-used "New chat" rows older than ten minutes), then the
      // most recent chat. NO chats is the welcome state — a reload after deleting
      // the last chat must not conjure an empty one; the first send creates it.
      const husks = life.pruneStaleEmpties(sessions, { minAgeMs: 10 * 60 * 1000 });
      if (husks.length) { tombstone(husks); save("fold-chat:sessions", sessions); }
      const first = life.byRecent(Object.values(sessions))[0];
      if (first) open(first.id); else closeThread();
      refreshMeter();
      updateBridgeStatus();
      startLoadedPoller();
    });
  });
}