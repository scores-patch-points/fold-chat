// fold-chat-foldview.js — the viewer for a FOLD (fold-chat-fold.js): one card, three views.
//
//   Actions    the log of ACTIONS — what was done, in order (read, write, edit, try, check, fix); every edit is a real +/− diff
//   EOT        the log of CONTENT that was folded — penelope's Provenance@2 shape: sources, events, parents, byte ranges
//   Folded     the folded content itself — the HTML (or whatever language) as source, optionally with who wrote each line
//   Live       the folded content running — the interactive page, with attempt chips to step back through earlier drafts
//
// ONE CURSOR runs through all four. The slim row under the title scrubs through the EOT (event by event); every view shows
// the fold AS OF that event — Live runs the attempt that existed then, Folded shows its source, Actions and EOT dim what had
// not happened yet. "Reset from here" hands that point back to the app: the next change starts from that attempt, not the newest.
//
// It is a plain DOM component: mountFold(host, fold, opts) returns { update(), root }. While a run is in
// progress the app calls update() after every change and the card follows along (the active tab re-renders
// in place; the Log tab keeps scrolling to the newest entry unless you have scrolled up to read).
//
// Words: the default text is plain language ("code writer", "test page", "online AI"); the technical names
// (penelope, khora, janus, sandbox, sealed-external…) are on hover and in the "details" of each entry.

import { artifactOf, foldedLines, authorship } from "./fold-chat-fold.js";
import { eotFromFold, describeEvent, versionAtCursor, codeOfEvent } from "./fold-chat-eot.js";
import { FOLDVIEW_CSS, FOLDVIEW_STYLE_ID } from "./fold-chat-foldview.css.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** Who, in words a person knows — the real name on hover. */
export function whoLabel(by) {
  const b = String(by || "");
  if (b === "penelope") return { text: "code writer", tip: "penelope — the generation pipeline running on this computer" };
  if (b === "khora") return { text: "reader", tip: "khora — reads your request" };
  if (b === "janus") return { text: "checker", tip: "janus — rules on what was measured" };
  if (b === "sandbox") return { text: "test page", tip: "the sandbox — opens the page and clicks every button" };
  if (b.startsWith("remote:")) return { text: "online AI", tip: `${b.slice(7) || "a remote model"} — reached through heimdall's sealed gate` };
  if (b === "app") return { text: "Fold", tip: "recorded by the app itself" };
  return { text: b || "—", tip: b };
}
export function makerLabel(maker) {
  if (!maker) return { text: "—", tip: "" };
  if (maker.kind === "penelope") return { text: "local writer", tip: "penelope — the code lane on this computer" };
  if (maker.kind === "remote") return { text: "online AI", tip: `${maker.model || "remote model"} — sealed-external` };
  if (maker.kind === "agent-loop") return { text: "agent loop", tip: "khora's agent loop" };
  if (maker.kind === "restored") return { text: "earlier version", tip: "restored from a point in an earlier fold" };
  return { text: String(maker.kind || "—"), tip: "" };
}
const STAGE_WORD = { read: "Read", arrange: "Plan", draw: "Write", edit: "Edit", fold: "Fold", observe: "Try", verify: "Check", repair: "Fix", escalate: "Help", retry: "Wait", done: "Result" };
const STATUS = { running: ["working…", "run"], held: ["it works", "ok"], "gave-up": ["not working yet", "bad"], stopped: ["stopped", "mut"], failed: ["failed", "bad"] };

function ensureStyle() {
  if (document.getElementById(FOLDVIEW_STYLE_ID)) return;
  const s = document.createElement("style"); s.id = FOLDVIEW_STYLE_ID; s.textContent = FOLDVIEW_CSS; document.head.append(s);
}

/** A quiet, collapsible home for the step-by-step transcript: `inner` is where the feed goes, `settle()` folds it shut once the run is done. */
export function tuckSteps(host, { open = true, label = "How it got here" } = {}) {
  ensureStyle();
  const root = document.createElement("details"); root.className = "fv-steps"; root.open = open;
  const sum = document.createElement("summary"); sum.textContent = label;
  const inner = el("div", "fv-steps-in");
  root.append(sum, inner); host.append(root);
  return { root, inner, setLabel(t) { sum.textContent = t; }, settle({ keepOpen = false, label: t = null } = {}) { if (t) sum.textContent = t; root.open = !!keepOpen; } };
}

/**
 * @param host   element to append the card to
 * @param fold   a fold (live object or revived snapshot)
 * @param opts   { renderArtifact(host, {kind, lang, title, code}) — the app's own preview card (copy / collapse / iterate), optional,
 *                 tab: initial tab, live: bool }
 */
export function mountFold(host, fold, { renderArtifact = null, tab = "live", live = false, onReset = null, reset = null } = {}) {
  ensureStyle();
  const root = el("div", "fv" + (live ? " fv-live" : ""));
  const head = el("div", "fv-head");
  const title = el("span", "fv-title", "Fold");
  const chip = el("span", "fv-chip");
  const tabs = el("div", "fv-tabs", ""); tabs.setAttribute("role", "tablist");
  const body = el("div", "fv-body");
  head.append(title, chip, el("span", "fv-sp"), tabs);
  const scrub = el("div", "fv-scrub"); scrub.hidden = true;
  const prev = el("button", "fv-step", "‹"); prev.type = "button"; prev.title = "one event back (← on the slider)";
  const next = el("button", "fv-step", "›"); next.type = "button"; next.title = "one event forward (→ on the slider)";
  const range = document.createElement("input"); range.type = "range"; range.min = "0"; range.className = "fv-range"; range.setAttribute("aria-label", "scrub through the EOT");
  const where = el("span", "fv-where");
  const resetBtn = el("button", "fv-reset", "Reset from here"); resetBtn.type = "button"; resetBtn.hidden = true;
  const marker = el("span", "fv-marker"); marker.hidden = true;
  scrub.append(prev, range, next, where, resetBtn, marker);
  root.append(head, scrub, body);
  host.append(root);

  let active = tab, cursor = null, resetMark = reset && reset.index != null ? { index: reset.index, round: reset.round ?? null } : null, stick = true, logFilter = "all", openEdits = new Set(), eotMode = "chain", showWho = false, openEvt = new Set(), showSources = false, openCode = null;
  const TABS = [["live", "Live"], ["actions", "Actions"], ["eot", "EOT"], ["folded", "Folded"]];
  const btn = {};
  for (const [k, label] of TABS) {
    const b = el("button", "fv-tab", label); b.type = "button"; b.setAttribute("role", "tab");
    b.onclick = () => { active = k; render(); };
    btn[k] = b; tabs.append(b);
  }

  // The EOT of the fold, rebuilt only when the fold has changed; trace[i] says which action and attempt events[i] came from.
  let memo = { key: null, eot: null, trace: [] };
  function eotNow() {
    const key = `${fold.log.length}:${fold.versions.length}:${fold.status}`;
    if (memo.key !== key) { const trace = []; let eot; try { eot = eotFromFold(fold, { trace }); } catch { eot = { provenance: { events: [], sources: [], addressSpace: {} }, schema: "?", giver: "" }; } memo = { key, eot, trace }; }
    return memo;
  }
  const lastIndex = () => Math.max(0, eotNow().eot.provenance.events.length - 1);
  const cursorAt = () => (cursor == null ? lastIndex() : Math.min(cursor, lastIndex()));
  const scrubbed = () => cursor != null && cursor < lastIndex();
  const seqAtCursor = () => { const t = eotNow().trace[cursorAt()]; return t ? t.seq : 0; };
  /** The attempt the cursor is looking at: while following the run, the artifact; once scrubbed, the attempt that existed at that event. */
  const versionOf = () => (scrubbed() ? versionAtCursor(fold, eotNow().trace, cursorAt()) : artifactOf(fold));
  const lastEventOfRound = (round) => { const tr = eotNow().trace; let k = -1; tr.forEach((t, i) => { if (t.round === round) k = i; }); return k; };
  const roundName = (v) => (v.round === 0 ? "the starting point" : `attempt ${v.round}`);
  function moveTo(i) { cursor = i >= lastIndex() ? null : Math.max(0, i); render(); }

  function paintHead() {
    const [word, cls] = STATUS[fold.status] || [fold.status, "mut"];
    chip.textContent = word; chip.className = "fv-chip fv-" + cls;
    const n = fold.versions.filter((v) => v.round > 0).length;
    title.textContent = n ? `Fold · ${n} attempt${n === 1 ? "" : "s"}` : "Fold";
    for (const [k, label] of TABS) {
      btn[k].classList.toggle("on", k === active); btn[k].setAttribute("aria-selected", k === active ? "true" : "false");
      btn[k].textContent = label;
      btn[k].title = { actions: `the log of actions — what was done, in order (${fold.log.length})`, eot: `the log of content that was folded — penelope's Provenance@2 shape (${eotNow().eot.provenance.events.length} events)`, folded: "the folded content itself — the source", live: "the folded content running — interact with it" }[k];
    }
    paintScrub();
  }

  // ── the cursor ──
  function paintScrub() {
    const P = eotNow(), N = P.eot.provenance.events.length;
    scrub.hidden = N < 3;
    if (scrub.hidden) return;
    range.max = String(N - 1); range.value = String(cursorAt());
    const t = P.trace[cursorAt()], entry = t && t.seq ? fold.log.find((e) => e.seq === t.seq) : null;
    const at = scrubbed();
    where.textContent = `${String(cursorAt() + 1).padStart(2, "0")} / ${N} · ${entry ? entry.title : "the ask"}`;
    where.title = at ? "the fold as of this event — drag, or use ← →" : "following the newest event";
    scrub.classList.toggle("on", at);
    prev.disabled = cursorAt() <= 0; next.disabled = !at;
    const v = at ? versionAtCursor(fold, P.trace, cursorAt()) : null;
    const canReset = !!onReset && at && !!v;
    resetBtn.hidden = !canReset;
    if (canReset) resetBtn.title = `the next change starts from ${roundName(v)} — not the newest attempt`;
    marker.hidden = !resetMark;
    if (resetMark) {
      marker.textContent = "";
      marker.append(`next change starts from ${resetMark.round === 0 ? "the earlier version" : "attempt " + resetMark.round} · `);
      const undo = el("button", "fv-undo", "undo"); undo.type = "button";
      undo.onclick = () => { resetMark = null; onReset?.(null); render(); };
      marker.append(undo);
    }
  }
  range.oninput = () => moveTo(Number(range.value));
  prev.onclick = () => moveTo(cursorAt() - 1);
  next.onclick = () => moveTo(cursorAt() + 1);
  resetBtn.onclick = () => {
    const P = eotNow(), k = cursorAt(), v = versionAtCursor(fold, P.trace, k);
    if (!v || !onReset) return;
    resetMark = { index: k, round: v.round };
    onReset({ index: k, eventId: P.eot.provenance.events[k]?.event_id || null, seq: P.trace[k]?.seq ?? 0, version: v, foldId: fold.id });
    render();
  };

  /** The attempt chips: click one to pin it, click the newest to follow the live run again. Shared by Artifact and Folded. */
  function chipsRow(v) {
    const chips = el("div", "fv-chips");
    if (fold.versions.length < 2) return chips;   // one attempt needs no picker
    for (const x of fold.versions) {
      const b = el("button", "fv-vchip" + (v && x.n === v.n ? " on" : "") + (x.held ? " held" : ""), x.round === 0 ? "start" : `attempt ${x.round}`); b.type = "button";
      b.title = `${makerLabel(x.maker).text} · ${x.lines} lines${x.held ? " · this one works" : ""}`;
      b.onclick = () => moveTo(x === fold.versions[fold.versions.length - 1] ? Infinity : lastEventOfRound(x.round));   // jumping to an attempt is moving the cursor to its last event
      chips.append(b);
    }
    return chips;
  }

  // ── Live ──
  function paintLive() {
    body.textContent = "";
    if (!fold.versions.length) { body.append(el("div", "fv-empty", fold.status === "running" ? "Waiting for the first draft… the Actions tab shows what's happening." : "No draft was produced.")); return; }
    const v = versionOf();
    if (!v) { body.append(el("div", "fv-empty", "Nothing had been written yet at this point.")); return; }
    const chips = chipsRow(v);
    const mk = makerLabel(v.maker);
    const stat = v.diffStat && v.round > 0 && fold.versions.indexOf(v) > 0 ? ` · +${v.diffStat.added} −${v.diffStat.removed} vs before` : "";
    const verdict = v.round === 0 ? "restored — nothing has been checked yet" : v.held ? "works — every check passed" : v.problems.length ? `${v.problems.length} problem${v.problems.length === 1 ? "" : "s"} found` : fold.status === "running" ? "being checked…" : "not verified";
    chips.append(el("span", "fv-cap", `${mk.text}${stat} · ${verdict}`));
    chips.lastChild.title = mk.tip;
    body.append(chips);
    const holder = el("div", "fv-art");
    const art = { kind: v.kind === "html" ? "html" : "js", lang: v.kind === "html" ? "html" : "js", title: v.kind === "html" ? "Preview" : "Code", code: v.code };
    if (renderArtifact) renderArtifact(holder, art); else if (v.kind === "html") { const f = document.createElement("iframe"); f.sandbox = "allow-scripts"; f.srcdoc = v.code; holder.append(f); } else holder.append(el("pre", "fv-code", v.code));
    body.append(holder);
    if (v.problems.length && !v.held) { const ul = el("ul", "fv-problems"); for (const p of v.problems.slice(0, 5)) ul.append(el("li", "", p)); if (v.problems.length > 5) ul.append(el("li", "fv-dim", `… and ${v.problems.length - 5} more`)); body.append(ul); }
  }

  // ── Actions ──
  const FILTERS = [["all", "everything"], ["edits", "edits"], ["problems", "problems"]];
  function paintActions() {
    const prevTop = body.scrollTop, wasAtEnd = stick;
    body.textContent = "";
    const bar = el("div", "fv-filters");
    for (const [k, label] of FILTERS) { const b = el("button", "fv-filter" + (k === logFilter ? " on" : ""), label); b.type = "button"; b.onclick = () => { logFilter = k; render(); }; bar.append(b); }
    bar.append(el("span", "fv-cap", "append-only — nothing here is rewritten"));
    body.append(bar);
    let list = fold.log;
    if (logFilter === "edits") list = list.filter((e) => e.stage === "edit" || e.stage === "fold" || e.stage === "draw");
    if (logFilter === "problems") list = list.filter((e) => e.ok === false);
    if (!list.length) body.append(el("div", "fv-empty", logFilter === "all" ? "Nothing yet." : "Nothing matches."));
    let lastRound = null;
    for (const e of list) {
      if (e.round !== lastRound && e.round != null && e.round > 0) { body.append(el("div", "fv-round", `attempt ${e.round}`)); lastRound = e.round; }
      const at = scrubbed(), sq = seqAtCursor();
      const row = el("div", "fv-row " + (e.ok === true ? "ok" : e.ok === false ? "bad" : "mut") + (at && e.seq > sq ? " future" : "") + (at && e.seq === sq ? " cur" : ""));
      row.onclick = (ev) => { if (ev.target.closest("button, summary, details")) return; const tr = eotNow().trace; let k = 0; tr.forEach((t, i) => { if (t.seq <= e.seq) k = i; }); moveTo(k); };
      row.append(el("span", "fv-seq", String(e.seq).padStart(2, "0")), el("span", "fv-glyph", e.ok === true ? "✓" : e.ok === false ? "✗" : "·"));
      const main = el("div", "fv-main");
      const top = el("div", "fv-line");
      const st = el("span", "fv-stage", STAGE_WORD[e.stage] || e.stage); st.title = e.stage;
      const w = whoLabel(e.by); const who = el("span", "fv-who", w.text); who.title = w.tip;
      top.append(st, el("span", "fv-t", e.title), who, el("span", "fv-time", (e.at / 1000).toFixed(0) + "s"));
      main.append(top);
      if (e.detail) main.append(el("div", "fv-detail", e.detail));
      if (e.stage === "edit" && e.edit && e.edit.versionN) {
        const ver = fold.versions.find((x) => x.n === e.edit.versionN);
        if (ver && ver.hunks.length) {
          const t = el("button", "fv-more", openEdits.has(e.seq) ? "hide the edit" : `show the edit (${ver.hunks.length} change${ver.hunks.length === 1 ? "" : "s"})`); t.type = "button";
          t.onclick = () => { openEdits.has(e.seq) ? openEdits.delete(e.seq) : openEdits.add(e.seq); render(); };
          main.append(t);
          if (openEdits.has(e.seq)) { const pre = el("div", "fv-diff"); for (const h of ver.hunks) { for (const l of h.lines) pre.append(el("div", "fv-d fv-d-" + l.op, (l.op === "add" ? "+ " : l.op === "del" ? "− " : "  ") + l.line)); pre.append(el("div", "fv-d fv-d-gap", "⋯")); } main.append(pre); }
        }
      }
      if (e.tech) { const d = el("details", "fv-tech"); d.append(el("summary", "", "details"), el("code", "", e.tech)); main.append(d); }
      row.append(main); body.append(row);
    }
    // keep following the newest entry while the run is live, unless the person scrolled up to read
    if (scrubbed()) body.querySelector(".fv-row.cur")?.scrollIntoView({ block: "nearest" });
    else if (live && wasAtEnd) body.scrollTop = body.scrollHeight; else body.scrollTop = prevTop;
  }
  body.addEventListener("scroll", () => { stick = body.scrollTop + body.clientHeight >= body.scrollHeight - 24; });

  // ── EOT ──  the log of CONTENT that was folded
    /** The code an event stands for, in full: a diff shows the whole file with every change marked; a range shows exactly those bytes. */
  function codePanel(c) {
    const box = el("div", "fv-codebox"); box.onclick = (e) => e.stopPropagation();
    const head = el("div", "fv-codehead");
    const cap = c.kind === "diff" ? `attempt ${c.round}${c.from != null ? ` vs attempt ${c.from}` : " — the first draft"} · +${c.added} −${c.removed} · the whole file, changes marked`
      : c.kind === "range" ? `attempt ${c.round} · lines ${c.startLine}–${c.endLine} · bytes ${c.bytes[0]}–${c.bytes[1]}`
      : `attempt ${c.round} · the whole file · ${c.lines} lines`;
    const plain = c.kind === "diff" ? c.diff.filter((d) => d.op !== "del").map((d) => d.line).join("\n") : c.text;
    const copy = el("button", "fv-filter", "copy"); copy.type = "button";
    copy.onclick = async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(plain); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy"), 1200); } catch {} };
    head.append(el("span", "fv-cap", cap), copy);
    const pre = el("div", "fv-codelines");
    if (c.kind === "diff") {
      let n = 0;
      for (const d of c.diff) { if (d.op !== "del") n++; const r = el("div", "fv-cl fv-cl-" + d.op); r.append(el("span", "fv-n", d.op === "del" ? "" : String(n)), el("span", "fv-sign", d.op === "add" ? "+" : d.op === "del" ? "−" : " "), el("span", "fv-src", d.line || " ")); pre.append(r); }
    } else {
      const ls = c.text.replace(/\n$/, "").split("\n");
      ls.forEach((t, k) => { const r = el("div", "fv-cl"); r.append(el("span", "fv-n", String(c.startLine + k)), el("span", "fv-sign", " "), el("span", "fv-src", t || " ")); pre.append(r); });
    }
    box.append(head, pre);
    return box;
  }
  const STAGE_CLS = { intent: "a", prior: "a", read: "a", ground: "a", arrange: "b", "draw-request": "b", draw: "c", hunt: "c", fold: "d", verify: "e", repair: "f", materialize: "d", ibid: "a", void: "a" };
  function paintEot() {
    body.textContent = "";
    const eot = eotNow().eot, P = eot.provenance;
    const srcs = new Map(P.sources.map((x) => [x.source_id, x]));
    const bar = el("div", "fv-filters");
    for (const [k, label] of [["chain", "events"], ["raw", "raw JSON"]]) { const b = el("button", "fv-filter" + (k === eotMode ? " on" : ""), label); b.type = "button"; b.onclick = () => { eotMode = k; render(); }; bar.append(b); }
    const copy = el("button", "fv-filter", "copy"); copy.type = "button";
    copy.onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(eot, null, 2)); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy"), 1200); } catch {} };
    const dl = el("button", "fv-filter", "download .eot.json"); dl.type = "button";
    dl.onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(eot, null, 2)], { type: "application/json" })); a.download = (fold.id || "fold") + ".eot.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
    bar.append(copy, dl);
    body.append(bar);
    const meta = el("div", "fv-eotmeta");
    meta.textContent = `${eot.schema} › ${P.schema} · ${P.events.length} events · ${P.sources.length} sources · addresses are ${P.addressSpace.unit}s of the ${P.addressSpace.artifact} · given by ${eot.giver}`;
    meta.title = "ids are derived exactly as penelope derives them: prefix_ + the first 20 hex of sha256 of the canonical JSON";
    body.append(meta);
    if (eotMode === "raw") { const pre = el("pre", "fv-code fv-raw"); pre.textContent = JSON.stringify(eot, null, 2); body.append(pre); return; }
    const sb = el("button", "fv-more", showSources ? "hide the sources" : `show the sources (${P.sources.length})`); sb.type = "button"; sb.onclick = () => { showSources = !showSources; render(); }; body.append(sb);
    if (showSources) { const t = el("div", "fv-srcs"); for (const x of P.sources) { const r = el("div", "fv-src-row"); r.append(el("span", "fv-id", x.source_id.slice(4, 12)), el("span", "fv-sk", x.kind), el("span", "fv-sl", String(x.locator)), el("span", "fv-sm", x.anchor ? `${x.anchor.start}–${x.anchor.end}` + (x.meta?.maker ? " · " + (x.meta.maker.kind === "remote" ? "remote:" + (x.meta.maker.model || "") : x.meta.maker.kind) : "") : "")); t.append(r); } body.append(t); }
    const list = el("div", "fv-evts");
    P.events.forEach((ev, i) => {
      const d = describeEvent(ev, srcs);
      const at = scrubbed(), ci = cursorAt();
      const row = el("div", "fv-ev " + (d.ok === true ? "ok" : d.ok === false ? "bad" : "mut") + (at && i > ci ? " future" : "") + (at && i === ci ? " cur" : "") + (resetMark && resetMark.index === i ? " mark" : ""));
      const top = el("div", "fv-evline");
      const idEl = el("span", "fv-id", d.short); idEl.title = "show this event's JSON";
      idEl.onclick = (e2) => { e2.stopPropagation(); openEvt.has(ev.event_id) ? openEvt.delete(ev.event_id) : openEvt.add(ev.event_id); render(); };
      top.append(el("span", "fv-evn", String(i + 1).padStart(2, "0")), idEl, el("span", "fv-evstage fv-s-" + (STAGE_CLS[d.stage] || "a"), d.stage));
      if (d.transform) top.append(el("span", "fv-evt", d.transform));
      if (d.unit) top.append(el("span", "fv-evunit", "unit " + d.unit));
      if (d.range) top.append(el("span", "fv-evr", d.range));
      if (d.ok !== null) top.append(el("span", "fv-evok", d.ok ? "✓" : "✗"));
      const sub = el("div", "fv-evsub");
      if (d.source) sub.append(el("span", "", "from " + d.source));
      if (d.parent) sub.append(el("span", "", "← " + d.parent));
      const note = ev.detail?.note || ev.detail?.check || ev.detail?.what; if (note) sub.append(el("span", "fv-evnote", String(note).slice(0, 140)));
      row.append(top, sub);
      const code = codeOfEvent(fold, ev, srcs);
      if (code) top.append(el("span", "fv-codetag", code.kind === "diff" ? `code · +${code.added} −${code.removed}` : code.kind === "range" ? `code · lines ${code.startLine}–${code.endLine}` : `code · ${code.lines} lines`));
      row.onclick = () => { openCode = code && openCode !== i ? i : null; moveTo(i); };   // click an event: the cursor goes there and the code it stands for opens under it; its id shows the raw JSON
      if (code && openCode === i) row.append(codePanel(code));
      if (openEvt.has(ev.event_id)) { const pre = el("pre", "fv-code fv-raw"); pre.textContent = JSON.stringify(ev, null, 2); row.append(pre); }
      list.append(row);
    });
    body.append(list);
    if (scrubbed()) list.querySelector(".fv-ev.cur")?.scrollIntoView({ block: "nearest" }); else if (live) body.scrollTop = body.scrollHeight;
  }

  // ── Folded ──  the folded content itself: the source, in whatever language it is
  function paintFolded() {
    body.textContent = "";
    const v = versionOf();
    if (!v) { body.append(el("div", "fv-empty", fold.versions.length ? "Nothing had been written yet at this point." : "Nothing to fold yet.")); return; }
    const lines = foldedLines(fold, v);
    const who = authorship(lines);
    const chips = chipsRow(v); chips.append(el("span", "fv-cap", `${v.kind === "html" ? "HTML" : v.kind === "js" ? "JavaScript" : v.kind} · ${v.lines} lines · folded up to ${roundName(v)}${scrubbed() ? " (the cursor is back in time — ‹ › or drag to move it)" : ""}`)); body.append(chips);
    const bar = el("div", "fv-filters");
    const tg = el("button", "fv-filter" + (showWho ? " on" : ""), "who wrote each line"); tg.type = "button"; tg.onclick = () => { showWho = !showWho; render(); };
    const copy = el("button", "fv-filter", "copy the code"); copy.type = "button";
    copy.onclick = async () => { try { await navigator.clipboard.writeText(lines.map((l) => l.text).join("\n")); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy the code"), 1200); } catch {} };
    bar.append(tg, copy); body.append(bar);
    const COLORS = ["var(--fv-a)", "var(--fv-b)", "var(--fv-c)", "var(--fv-d)"];
    const colorOf = new Map(who.map((a, i) => [a.maker, COLORS[i % 4]]));
    if (showWho) {
      const share = el("div", "fv-share");
      who.forEach((a, i) => { const x = el("i"); x.style.width = (a.share * 100).toFixed(1) + "%"; x.style.background = COLORS[i % 4]; x.title = `${a.maker}: ${a.lines} lines`; share.append(x); });
      body.append(share);
      const leg = el("div", "fv-legend");
      who.forEach((a, i) => { const m = a.maker.startsWith("remote:") ? { text: "online AI", tip: a.maker } : makerLabel({ kind: a.maker }); const sp = el("span", "", `${m.text} wrote ${a.lines} line${a.lines === 1 ? "" : "s"} (${Math.round(a.share * 100)}%)`); sp.title = m.tip; const dot = el("i"); dot.style.background = COLORS[i % 4]; sp.prepend(dot); leg.append(sp); });
      body.append(leg);
    }
    const pre = el("div", "fv-fold" + (showWho ? "" : " fv-plain"));
    let prevKey = null;
    for (const l of lines) {
      const mk = l.maker?.kind === "remote" ? "remote:" + (l.maker.model || "") : l.maker?.kind || "?";
      const key = mk + "|" + l.round + "|" + (l.unit || "");
      if (showWho && l.unit && (prevKey === null || !prevKey.endsWith("|" + l.unit))) pre.append(el("div", "fv-unit", `unit · ${l.unit}`));
      const row = el("div", "fv-fl"); if (showWho) row.style.setProperty("--m", colorOf.get(mk) || "var(--fv-a)");
      row.append(el("span", "fv-n", String(l.n)));
      if (showWho) { const g = el("span", "fv-gut", key !== prevKey ? `attempt ${l.round}` : ""); g.title = makerLabel(l.maker).tip; row.append(g); }
      row.append(el("span", "fv-src", l.text || " "));
      pre.append(row); prevKey = key;
    }
    body.append(pre);
  }

  function render() {
    paintHead();
    if (active === "live") paintLive(); else if (active === "actions") paintActions(); else if (active === "eot") paintEot(); else paintFolded();
  }
  render();
  return {
    root,
    /** Call after the fold changed. A live artifact follows the latest attempt unless you pinned an earlier one. */
    update() { render(); },
    show(tabName) { active = tabName; render(); },
    /** The host moved or cleared the reset point (for example the next turn consumed it). */
    setReset(mark) { resetMark = mark ? { index: mark.index ?? null, round: mark.round ?? null } : null; render(); },
  };
}
