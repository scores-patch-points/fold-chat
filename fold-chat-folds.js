// fold-chat-folds.js — FOLDS: the agent's artifact threads, beside the chat. A fold is one artifact and its whole making:
// an append-only log of EOT assemblies (the model's, the app's, the person's). The log IS the fold — reopening one replays
// its set-down assemblies into a fresh kernel, deterministically. The workspace is a terminal-like session on the left
// (the ask, each assembly's units and who filled them, follow-ups, edits, undos) and the artifact's canvas on the right.
// Making goes through the block kit's weave (library → box → hunt → mouth, unit by unit); the model is whichever the
// chat would use (the in-tab model when nothing else answers). Nothing here writes HTML for the model to fill.
import * as client from "./fold-chat-client.js";
import { render } from "./fold-blocks.js";
import { createKernel } from "./fold-blocks-kernel.js";
import { monologue } from "./fold-blocks-make.js";
import { editorFor, editEOT, editableParts } from "./fold-blocks-edit.js";
import { createMemory, contentWords } from "./fold-blocks-weave.js";
import { longKind, urlOf, runEssay, runExtract, addSection, replaceInArtifact, extendEssay } from "./fold-chat-longform.js";
import { createWorkspace, treeOf, applyEdits, parseEdits, diffLines, diffStat, snapshot as wsSnapshot } from "./fold-chat-workspace.js";
// THE APP'S OWN FALSIFIER — the same organ the answer lane uses. A made page is
// not trusted because it renders; its CLAIMS are falsified against the material
// that was read, and a failing claim sends the turn back (REC↬NUL) to be corrected.
import { falsifyAnswer, claimSentences, FAILING } from "./fold-chat-falsify-answer.js";

const KEY = "fold-chat:folds@1";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "fd_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// PHEROMONE TRAILS — the ant's memory over the log. A path that led to a held page
// is reinforced; a path that soured is marked down; every deposit lets all trails
// evaporate a little, so stale ground is forgotten. The hunt then follows the
// strongest trail first. (Ant-swarm protocol: deposit · evaporate · follow.)
const TRAIL_KEY = "fold-chat:trails@1";
const EVAPORATE = 0.85;
const loadTrails = () => { try { return JSON.parse(localStorage.getItem(TRAIL_KEY)) || {}; } catch { return {}; } };
const saveTrails = (t) => { try { localStorage.setItem(TRAIL_KEY, JSON.stringify(t)); } catch {} };
const pheromone = (k) => { try { return loadTrails()[k] || 0; } catch { return 0; } };
const domainKey = (m) => String((m && (m.source || m.url)) || "").replace(/^https?:\/\//i, "").split(/[/?#:]/)[0].toLowerCase();
/** Lay a batch of trails: evaporate once, then add. A negative amount sours the ground. */
function trail(keys, amount = 1) {
  const t = loadTrails();
  for (const k of Object.keys(t)) { t[k] *= EVAPORATE; if (Math.abs(t[k]) < 0.05) delete t[k]; }
  for (const k of keys) t[k] = (t[k] || 0) + amount;
  saveTrails(t); return t;
}
// THE OPERATORS (organs/cube.mjs): every act is one, and the log carries which.
const OPG = Object.freeze({ NUL: "∅", SIG: "○", INS: "●", SEG: "｜", CON: "⋈", SYN: "△", DEF: "⊢", EVA: "⊨", REC: "↬" });
const opg = (e) => (e && e.op && OPG[e.op] ? `<span class="fs-op" title="${esc(e.op)}">${OPG[e.op]}</span>` : "");const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + "m" : s < 86400 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d"; };
/** An ask that makes a thing (a page, a widget, a document) rather than asks a question. Declared words; when unsure: no. */
export function isMakeAsk(text) {
  const q = String(text || "").toLowerCase();
  if (longKind(text)) return true;
  return /\b(make|build|create|design|draft|write|set up|spin up|generate|mock up)\b/.test(q) && /\b(site|website|page|landing|widget|calculator|converter|estimator|tool|document|doc|guide|report|memo|handbook|brief|one-pager|flyer|menu)\b/.test(q);
}

const CSS = `
.main.folding > :not(.topbar):not(.foldspace){display:none!important}
.main.folding .topchat{display:none!important}
.foldspace{flex:1;min-height:0;min-width:0;display:grid;grid-template-columns:minmax(300px,420px) minmax(0,1fr);border-top:1px solid var(--line)}
.fs-sess,.fs-canvas{min-width:0}
.fs-ask{overflow-wrap:anywhere}
.fs-log>*{flex:none}.fs-step{align-self:stretch}.fs-step-h .fs-by{align-self:center;height:auto;line-height:1.2}
.fs-sess{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line);background:var(--bg)}
.fs-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line)}
.fs-head b{flex:1}
.fs-head b{font-size:var(--fs-md);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fs-chip{font:600 var(--fs-xs)/1 var(--mono);color:var(--ag-deep);background:var(--ag-soft);border-radius:var(--r-pill);padding:4px 8px;white-space:nowrap}
.fs-sp{flex:1}
.fs-btn{height:32px;padding:0 12px;border-radius:var(--r-pill);border:1px solid var(--line2);background:var(--bg);font-size:var(--fs-sm);white-space:nowrap}
.fs-btn:hover{background:var(--side2)}.fs-btn.on{background:var(--link);border-color:var(--link);color:var(--on-link)}
.fs-btn.go{background:var(--ag);border-color:var(--ag);color:#fff;font-weight:600}
.fs-log{flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;font:var(--fs-sm)/1.5 var(--mono)}
.fs-ask{color:var(--ink);font-weight:600}.fs-ask::before{content:"› ";color:var(--ag)}
.fs-step{border-left:2px solid var(--line2);padding:2px 0 2px 10px;display:flex;flex-direction:column;gap:4px}
.fs-step.ok{border-color:var(--ok)}.fs-step.bad{border-color:var(--bad)}.fs-step.live{border-color:var(--ag)}
.fs-step-h{display:flex;gap:8px;align-items:baseline;align-content:flex-start;flex-wrap:wrap}.fs-step-h>*{white-space:nowrap}.fs-step-h .fs-by{color:#fff}.fs-step-h b{color:var(--ink)}.fs-step-h span{color:var(--mut)}
.fs-by{font:700 10.5px/1.2 var(--mono);color:#fff;border-radius:4px;padding:2px 5px;white-space:nowrap;display:inline-block}
.fs-by.model,.fs-by.mouth{background:var(--ag)}.fs-by.app,.fs-by.box{background:#5f5f6b}.fs-by.you{background:var(--link)}.fs-by.library{background:#7c3aed}.fs-by.hunt{background:#a16207}.fs-by.gap,.fs-by.wall{background:var(--bad)}
.fs-units{display:none;flex-direction:column;gap:2px;margin-top:2px}.fs-step.open .fs-units{display:flex}
.fs-u{display:grid;grid-template-columns:minmax(80px,auto) minmax(0,1fr) auto;gap:6px;align-items:baseline;font-size:var(--fs-xs)}
.fs-u .k{color:var(--mut)}.fs-u .v{color:var(--ink);font-family:var(--sans);overflow-wrap:anywhere}.fs-u .s{grid-column:2/4;color:var(--bad);font-family:var(--sans)}
.fs-err{color:var(--bad);font-family:var(--sans)}.fs-note{color:var(--mut);font-family:var(--sans)}
.fs-tog{border:0;background:none;color:var(--link);padding:0;font:inherit;cursor:pointer}
.fs-undo{border:1px solid var(--line2);background:var(--bg);border-radius:var(--r-pill);font:var(--fs-xs) var(--sans);padding:2px 8px}
.fs-comp{border-top:1px solid var(--line);padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.fs-comp textarea{border:1.5px solid var(--ag);border-radius:var(--r-lg);padding:10px 12px;font:var(--fs-md)/1.5 var(--mono);resize:none;background:var(--bg);color:var(--ink);min-height:58px}
.fs-comp .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.fs-sel{font:var(--fs-xs)/1.4 var(--mono);color:var(--link);background:color-mix(in srgb,var(--link) 10%,var(--bg));border-radius:var(--r-pill);padding:3px 8px}
.fs-status{font:var(--fs-xs)/1.4 var(--sans);color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fs-comp .inrow{display:flex;gap:8px;align-items:flex-end}.fs-comp .inrow textarea{flex:1;min-width:0}
.fs-canvas{display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--side2)}
.fs-cbar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border-bottom:1px solid var(--line);flex-wrap:wrap}
.fs-frame{flex:1;min-height:0;padding:12px;display:flex}.fs-frame iframe{flex:1;border:0;border-radius:var(--r-md);background:#fff;box-shadow:var(--shadow)}
.fs-eot{flex:1;min-height:0;overflow:auto;margin:12px;background:var(--bg);border-radius:var(--r-md);padding:12px;font:var(--fs-xs)/1.55 var(--mono);white-space:pre-wrap;color:var(--ink)}
.fs-empty{margin:auto;max-width:420px;text-align:center;color:var(--mut);font-size:var(--fs-md);line-height:1.55;padding:24px}
.fs-ed{border-top:1px solid var(--line);padding:12px 14px;display:flex;flex-direction:column;gap:8px;max-height:46%;overflow:auto;background:var(--bg);font-family:var(--sans)}
.fs-ed label{display:flex;flex-direction:column;gap:3px;font-size:var(--fs-xs);font-weight:600;color:var(--ink2)}
.fs-ed input,.fs-ed select,.fs-ed textarea{font:var(--fs-sm) var(--sans);border:1px solid var(--field-line);border-radius:var(--r-sm);padding:7px 9px;background:var(--bg);color:var(--ink)}
.fd-item{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;text-align:left;padding:7px 10px;border-radius:var(--r-md);font-size:var(--fs-md);color:var(--ink2)}
.fd-item:hover,.fd-item.on{background:var(--side2);color:var(--ink)}.fd-item .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fd-item .k{font:var(--fs-2xs)/1 var(--mono);color:var(--ag-deep)}
@media (max-width:1180px){.foldspace{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr)}.fs-sess{border-right:0}.foldspace[data-view="session"] .fs-canvas{display:none}.foldspace[data-view="canvas"] .fs-sess{display:none}.fs-vt{display:inline-flex!important}}
.fs-vt{display:none}`;

const CODE_CSS = `
.fs-code{display:grid;grid-template-columns:minmax(140px,220px) minmax(0,1fr);height:100%;min-height:0}
.fs-tree{overflow:auto;border-right:1px solid var(--line);padding:6px;display:flex;flex-direction:column;gap:1px}
.fs-tbtn{text-align:left;font:var(--fs-xs)/1.4 var(--mono);color:var(--ink2);background:none;border:0;border-radius:var(--r-sm);padding:4px 7px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fs-tbtn:hover{background:var(--side2)}.fs-tbtn.on{background:var(--side2);color:var(--ink);font-weight:600}
.fs-cview{display:flex;flex-direction:column;min-width:0;min-height:0}
.fs-ch{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line);font:600 var(--fs-sm) var(--mono);color:var(--ink2)}
.fs-file{flex:1;overflow:auto;margin:0;padding:12px;font:var(--fs-sm)/1.5 var(--mono);white-space:pre;color:var(--ink)}
.fs-chg{padding:8px 10px;border-bottom:1px solid var(--line)}
.fs-chg-h{display:flex;gap:8px;align-items:center;font:var(--fs-xs) var(--mono);color:var(--mut);margin-bottom:4px}
.fs-diff{margin:0;padding:8px;background:var(--side2);border-radius:var(--r-sm);font:var(--fs-xs)/1.45 var(--mono);white-space:pre;overflow:auto}
.fs-think{padding:5px 10px;margin:2px 0 2px 10px;border-left:2px solid var(--line2);color:var(--ink2);font:var(--fs-sm)/1.5 var(--sans)}
.fs-think .t{color:var(--ink)}
.fs-think .w{color:var(--mut);font:var(--fs-xs)/1.45 var(--mono);margin-top:1px}
.fs-think.bad{border-left-color:var(--bad)}
.fs-think.bad .t{color:var(--bad)}
.fs-op{display:inline-block;width:1.1em;text-align:center;color:var(--acc-deep);font-weight:700;margin-right:2px}
.fs-think .lbl{color:var(--mut);font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.06em}
.fs-think .st{margin-top:3px;white-space:pre-wrap;font:var(--fs-sm)/1.5 var(--mono);color:var(--ink2);max-height:260px;overflow:auto}
.fs-think.streaming .st::after{content:"▮";color:var(--acc-deep);animation:fsblink 1s steps(1) infinite;margin-left:1px}
@keyframes fsblink{50%{opacity:0}}
`;

export function mountFolds({ main, list, newBtn = null, railBtn = null, getModelId, toast = () => {}, onOpen = () => {}, onClose = () => {}, research = null }) {
  if (!document.getElementById("fold-folds-style")) { const st = document.createElement("style"); st.id = "fold-folds-style"; st.textContent = CSS + CODE_CSS; document.head.append(st); }
  let folds = []; try { folds = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { folds = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(folds.map((f) => ({ ...f, log: f.log.slice(-400) })))); } catch {} };
  const memory = createMemory();
  const queue = [];
  let cur = null, kernel = null, running = null, live = null, sel = null, editMode = false, tab = "preview", ed = null, edErr = [];
  const space = document.createElement("section"); space.className = "foldspace"; space.hidden = true; space.setAttribute("aria-label", "Fold");
  main.append(space);

  function rebuild(f) { const k = createKernel(); for (const e of f.log) if (e.ok && e.text && e.kind === "assembly") k.submit(e.text, { by: e.by, label: e.label }); return k; }
  function renderList() {
    if (!list) return;
    list.innerHTML = folds.length ? "" : `<div class="fs-note" style="padding:6px 10px;font-size:var(--fs-sm)">No folds yet</div>`;
    for (const f of [...folds].sort((a, b) => b.updated - a.updated)) {
      const b = document.createElement("button"); b.type = "button"; b.className = "fd-item" + (cur && cur.id === f.id && !space.hidden ? " on" : "");
      b.innerHTML = `<span class="t">${esc(f.title)}</span><span class="k">${esc(f.kind || "")}</span><span class="k">${ago(f.updated)}</span>`;
      b.onclick = () => open(f.id); list.append(b);
    }
  }
  function complete(signal0) {
    const model = getModelId?.();
    return async (messages, { maxTokens, signal, onToken, stop } = {}) => {
      if (!model) throw new Error("no model is available to draw with");
      const sys = messages.filter((x) => x.role === "system").map((x) => x.content).join("\n\n"), rest = messages.filter((x) => x.role !== "system");
      const msgs = sys && rest.length ? [{ ...rest[0], content: sys + "\n\n" + rest[0].content }, ...rest.slice(1)] : rest;
      const cut = new AbortController(); let acc = "", ended = false; const sig = signal || signal0; const fwd = () => cut.abort(); sig?.addEventListener("abort", fwd, { once: true });
      try {
        const r = await client.chat(model, msgs, { maxTokens, signal: cut.signal, temperature: 0.2, totalTimeoutMs: 300000,
          onToken: (t) => { acc += t; onToken?.(t); if (!ended && (stop === "line" ? /\S[^\n]*\n/.test(acc.replace(/^\s*```[^\n]*\n/, "")) : /(^|\n)\s*!EVA[^\n]*\n/i.test(acc))) { ended = true; cut.abort(); } } });
        return r.text;
      } catch (e) { if (ended) return acc; throw e; } finally { sig?.removeEventListener("abort", fwd); }
    };
  }
  const push = (e) => { cur.log.push({ at: Date.now(), ...e }); cur.updated = Date.now(); save(); };
  // STREAMING: the model's thinking, LIVE — a streaming entry grows as tokens
  // arrive (throttled repaint), then stays on the record as what it thought.
  let streamTimer = null;
  const streamInto = (label, op) => {
    cur.log.push({ at: Date.now(), kind: "think", by: "fold", op: op || "SIG", label, text: "", streaming: true });
    const idx = cur.log.length - 1;
    paint();
    return (t) => { cur.log[idx].text += String(t ?? ""); if (!streamTimer) streamTimer = setTimeout(() => { streamTimer = null; paint(); }, 120); };
  };
  const endStream = () => { const e = cur.log[cur.log.length - 1]; if (e && e.streaming) { e.streaming = false; paint(); } };

  function stripFence(s) { const m = String(s || "").match(/```[a-zA-Z]*\n([\s\S]*?)```/); return (m ? m[1] : String(s || "")).trim(); }
  // A BEHAVIOUR (a timer, a game, an animation) is not a value the block kit can
  // compute — the fold writes it as ONE self-contained page (SYN), RUNS it and
  // OBSERVES what it does (EVA), records the finding (REC), and re-opens (NUL)
  // with the finding as the atom until it holds. The loop is the agent.
  async function buildApp(text, draw, signal, finding = null, prior = null, onToken = null, material = null, outline = null) {
    const fix = finding ? `\n\nYour previous page FAILED when it was run: ${finding}. Write a version without that failure.` : "";
    const base = prior ? `\n\nHere is the current page. Change it as asked and keep everything else working:\n\`\`\`html\n${String(prior).slice(0, 8000)}\n\`\`\`` : "";
    const plan = outline ? `\n\nA plan for the page (follow it):\n${String(outline).slice(0, 1400)}` : "";
    const src = material && material.length ? `\n\nUse these REAL sources for the content; do not invent facts, and put each source's url on the page (a link or a small credit):\n${material.map((m, i) => `[${i + 1}] ${m.source} — ${m.url}\n${String(m.text || "").slice(0, 900)}`).join("\n\n")}` : "";
    const out = await draw([
      { role: "system", content: "You write ONE complete, self-contained HTML document that actually works when opened in a browser. Inline CSS and JavaScript only; no external files; no prose. Use only facts from the sources you are given, when sources are given." },
      { role: "user", content: `Build this, as one working page: ${text}\n\nOutput only the HTML document, inside a single fenced code block.${plan}${src}${base}${fix}` },
    ], { maxTokens: 2200, signal, onToken });
    const html = stripFence(out);
    return /<\s*(!doctype|html|body|div|button|script|canvas|svg|input|main|section)/i.test(html) ? html : null;
  }

  // EVA by observation: run the page in a hidden sandboxed frame and SEE what it
  // does — errors on its own surface, whether it rendered, and whether anything
  // changed over time (a behaviour is only real if it moves).
  function observePage(html, { ms = 1200, timeout = 7000 } = {}) {
    return new Promise((resolve) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;height:600px;border:0";
      const inject = `<script>(function(){var e=[];window.onerror=function(m){e.push(String(m));};function snap(){try{return String((document.body&&document.body.innerText)||"");}catch(x){return "";}}window.addEventListener("load",function(){var a=snap();setTimeout(function(){try{parent.postMessage({__observe:1,err:e,t0:a,t1:snap(),nodes:document.getElementsByTagName("*").length,tags:(document.body&&document.body.innerHTML||"").length},"*");}catch(x){}},${ms});});setTimeout(function(){try{parent.postMessage({__observe:1,err:e,t0:snap(),t1:snap(),nodes:document.getElementsByTagName("*").length},"*");}catch(x){}},${ms + 800});})();<\/script>`;
      const srcdoc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + inject) : /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (m) => m + inject) : inject + html;
      const done = (d) => { window.removeEventListener("message", onMsg); clearTimeout(to); try { frame.remove(); } catch { /* gone */ } resolve(d); };
      const onMsg = (ev) => { if (ev.source !== frame.contentWindow) return; const d = ev.data || {}; if (d.__observe) done(d); };
      window.addEventListener("message", onMsg);
      const to = setTimeout(() => done({ err: ["observation timed out"], t0: "", t1: "", nodes: 0 }), timeout);
      frame.srcdoc = srcdoc; document.body.appendChild(frame);
    });
  }

  // READ THE ASK — the fold's real thinking, not a lookup. The model is asked to
  // say what the ask IS (action, object, deliverable, what it needs, what a thing
  // that satisfies it would do), as facts it can reason from. The app then routes
  // by that reading. Nothing here is a canned template.
  async function readAsk(ask, draw, signal, onToken, prev = null) {
    const ctx = prev ? `You already built this. The ask is a CHANGE to it.\n\nWhat exists now — title "${prev.title}":\n\`\`\`html\n${String(prev.html || "").slice(0, 1600)}\n\`\`\`\n\n` : "";
    const out = await draw([
      { role: "system", content: "You read an ask and think out loud about what it is and what it should become. Think briefly, like a person sizing up the job before starting. There is no menu of categories — induce the kind from the ask itself." },
      { role: "user", content: `${ctx}The ask: "${ask}"\n\nThink out loud in a few short lines, then end with exactly these labelled lines:\nWHAT: <what this ask is — the kind of thing it wants, induced from the ask, not chosen from a list>\nSATISFY: <one sentence: what a thing that satisfies this ask would actually DO>\nNEEDS: <what it needs that a self-contained page could not invent itself — inputs, or a live data source, or time to run, or nothing>` },
    ], { maxTokens: 400, signal, onToken });
    const grab = (k) => { const m = new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, "im").exec(out); return m ? m[1].trim().replace(/^["']|["']$/g, "") : null; };
    const r = { what: grab("WHAT"), satisfy: grab("SATISFY"), needs: grab("NEEDS") };
    return (r.what || r.satisfy) ? r : null;
  }

  /** The page's PROSE: strip script/style/comments/tags, decode the basics. */
  function pageText(htmlValue) {
    return String(htmlValue || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  /** Falsify the page's claims against what was read — the app's own organ. Returns
   *  the failing claims (unsupported / contested / weak); null when there is no material. */
  function gatePage(htmlValue, material) {
    if (!material || !material.length) return null;
    const sentences = claimSentences(pageText(htmlValue)).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 5).slice(0, 40);
    if (!sentences.length) return null;
    let r; try { r = falsifyAnswer(sentences, material); } catch { return null; }
    return { summary: r.summary, failed: r.claims.filter((c) => FAILING.has(c.verdict)) };
  }
  /** Climb the cube: grain = the ask's own words; terrain = the ask in its want;
   *  domain = the kind of thing it is, broadly. Returns the refined SEARCH subject. */
  function refineSubject(text, want, rung) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (rung === "terrain") { const w = want && (want.satisfy || want.what); return `${t}${w ? " — " + String(w).slice(0, 120) : ""}`; }
    if (rung === "domain") return `${t} reference example`;
    return t;
  }
  // THE PIPELINE — one turn, the whole movement, streamed, operator-tagged:
  //   (1) what does the person want?      DEF — read the ask (induced)
  //   (2) go find examples                SIG — web: engines → readers → passages
  //   (3) does that change the want?      DEF — re-read against the material
  //   (4) outline what we'd need          SEG — the pieces, from the material
  //   (5) inventory the pieces we have    CON — sources / codebase / model; name lacks
  //   (6) weave it together               SYN → EVA(observe) → REC → NUL (recursion)
  async function runPipeline(text, ac) {
    const draw = complete(ac.signal);
    const slice = (s) => String(s ?? "");
    const prev = (cur.artifact && cur.artifact.kind === "app") ? { title: cur.title, html: cur.artifact.html } : null;
    const prior = (cur.artifact && cur.artifact.kind === "app") ? cur.artifact.html : null;
    const behaviour = /\b(countdown|timer|stopwatch|clock|animation|game|carousel|slideshow|chart|plot|canvas)\b/i.test(text);
    const overlapFrac = (a, b) => { const A = new Set(contentWords(a || "")), B = new Set(contentWords(b || "")); if (!A.size || !B.size) return 1; let n = 0; for (const w of A) if (B.has(w)) n += 1; return n / A.size; };
    // THE SPIRAL: the six stages, taken on a rung of the cube. A contradiction at
    // (3) loops back to re-read the want; a lack at (5) loops back to search the
    // ground differently — the subject refined and the rung climbed
    // (grain → terrain → domain). Bounded: two climbs, then it weaves with what it has.
    const RUNGS = ["grain", "terrain", "domain"];
    let depth = 0, subject = text, reading = null, want = null, material = null, outline = "", need = null;
    const visitedRungs = [];
    for (;;) {
      visitedRungs.push(RUNGS[depth]);
      // (1) WHAT DOES THE PERSON WANT?  (re-read on a climb)
      let r1 = null;
      const itok = streamInto(depth === 0 ? "(1) what does the person want?" : `(↬ ${RUNGS[depth]}) re-reading the want`, "DEF");
      try { r1 = await readAsk(text, draw, ac.signal, itok, prev); } catch { r1 = null; }
      endStream();
      if (r1 && (r1.what || r1.satisfy)) reading = r1;
      const mono = monologue(text, reading);
      for (const l of mono.lines) push({ kind: "think", by: "fold", op: "DEF", text: l.say, why: l.why, ok: !l.bad });
      paint();
      if (!mono.satisfiable) { push({ kind: "note", by: "app", op: "REC", text: "", ok: false, errors: [{ code: "cannot satisfy", msg: mono.why }] }); return; }
      // (2) GO FIND EXAMPLES — on the current rung's subject
      material = null;
      if (typeof research === "function") {
        const htok = streamInto(`(2) going to find examples — ${RUNGS[depth]}`, "SIG");
        try {
          const w = await research(subject, { onStep: (s) => { if (s.phase === "searching") htok(`\nsearch ${s.scope}: ${s.q}`); else if (s.phase === "found") htok(`\n${s.engine} · ${s.n} result(s)`); else if (/snippet|reading|read/.test(s.phase)) htok(`\nread ${s.url || s.site || ""}`); } });
          material = ((w && w.passages) || []).map((p) => ({ source: p.source || p.ref || p.domain || p.url, url: p.url, text: p.text || p.snippet || "" })).filter((m) => m.text).slice(0, 6);
          material.sort((a, b) => pheromone("src:" + domainKey(b)) - pheromone("src:" + domainKey(a))); // follow the trail: ground that held before leads
        } catch { material = null; }
        endStream();
        push({ kind: "think", by: "app", op: "SIG", text: material && material.length ? `found ${material.length} source(s) on the ${RUNGS[depth]}: ${material.map((m) => m.source).join(", ")}` : "no examples found — I'll build from the model alone", ok: true });
        paint();
      }
      // (3) DOES THIS CHANGE WHAT THEY WANT?
      want = reading; let contradiction = null;
      if (material && material.length) {
        const rtok = streamInto("(3) does this change what they want?", "DEF");
        let reread = null;
        try { reread = await readAsk(text, draw, ac.signal, rtok, null, material); } catch { reread = null; }
        endStream();
        if (reread && (reread.what || reread.satisfy)) {
          want = reread;
          push({ kind: "think", by: "fold", op: "DEF", text: `re-read against the material: ${reread.what || reread.satisfy}` });
          if (reading && reading.what && reread.what && overlapFrac(reading.what, reread.what) < 0.34) contradiction = reread.what;
        }
      }
      // (4) OUTLINE WHAT WE'D NEED
      const otok = streamInto("(4) outlining what's needed", "SEG");
      outline = "";
      try {
        outline = await draw([
          { role: "system", content: "You plan a single self-contained web page. Be concrete and short; no preamble." },
          { role: "user", content: `The ask: ${text}\n${want && want.satisfy ? `It is satisfied when: ${want.satisfy}\n` : ""}${material && material.length ? `Real sources:\n${material.map((m, i) => `[${i + 1}] ${m.source} — ${slice(m.text).slice(0, 140)}`).join("\n")}\n` : ""}\nList the pieces the page needs, one per line — its sections and the facts to show (use the sources). Then one line: NEEDS: <what you lack, or "nothing">.` },
        ], { maxTokens: 400, signal: ac.signal, onToken: otok });
      } catch { /* no outline */ }
      endStream();
      // (5) INVENTORY THE PIECES
      const haveL = [], lackL = [];
      if (material && material.length) haveL.push(`${material.length} source(s)`); else lackL.push("sources");
      if (cur.codebase) haveL.push("a codebase");
      haveL.push("the in-tab model");
      const needsLine = /^\s*NEEDS:\s*(.+)$/im.exec(outline || "");
      need = needsLine && !/^\s*nothing\b/i.test(needsLine[1]) ? needsLine[1].trim() : null;
      push({ kind: "think", by: "app", op: "CON", text: `have: ${haveL.join(", ")}${lackL.length || need ? ` · lack: ${[...lackL, need].filter(Boolean).join(", ")}` : ""}` });
      paint();
      // THE LOOP-BACK EDGES (bounded): a contradiction climbs to re-read the want;
      // a lack climbs to search the ground differently. Two climbs, then weave.
      if (depth < RUNGS.length - 1 && contradiction) {
        depth += 1; subject = refineSubject(text, want, RUNGS[depth]);
        push({ kind: "think", by: "fold", op: "REC", text: `↬ the material contradicts the want (“${slice(contradiction).slice(0, 90)}”) — climbing to the ${RUNGS[depth]}: asking again.` });
        paint(); continue;
      }
      if (depth < RUNGS.length - 1 && need) {
        depth += 1; subject = `${refineSubject(text, want, RUNGS[depth])} ${need}`;
        push({ kind: "think", by: "fold", op: "REC", text: `↬ lack “${slice(need).slice(0, 80)}” — climbing to the ${RUNGS[depth]}, hunting it.` });
        paint(); continue;
      }
      break;
    }
    // (6) WEAVE IT TOGETHER — and REC↬NUL when the observation fails.
    let finding = null, html = null, held = false;
    for (let round = 1; round <= 3; round += 1) {
      live = { label: round === 1 ? "weaving it together" : "re-weaving with the finding", units: [] };
      push({ kind: "think", by: "fold", op: "SYN", text: round === 1 ? "(6) weaving it together." : `(REC↬) re-weaving with the finding — round ${round}.` });
      paint();
      const wtok = streamInto(round === 1 ? "weaving" : "re-weaving", "SYN");
      try { html = await buildApp(text, draw, ac.signal, finding, prior, wtok, material, outline); } catch { html = null; }
      endStream();
      if (!html) { push({ kind: "note", by: "app", op: "REC", text: "", ok: false, errors: [{ code: "empty", msg: "the model returned no page" }] }); break; }
      cur.artifact = { kind: "app", html, title: text.slice(0, 48) };
      push({ kind: "assembly", by: "model", op: "SYN", label: "the page", text: html, ok: true });
      paint();
      const obs = await observePage(html);
      finding = obs.err && obs.err.length ? `the page threw: ${obs.err[0]}`
        : (obs.nodes < 4 ? "the page rendered nothing"
          : (behaviour && String(obs.t0).trim() === String(obs.t1).trim() ? "nothing changes over time — the behaviour is not running" : null));
      push({ kind: "assembly", by: "app", op: "EVA", label: finding ? "observed: " + finding : "observed: it runs and holds", text: `errors ${obs.err?.length || 0} · nodes ${obs.nodes} · changed ${String(obs.t0) !== String(obs.t1)}`, ok: !finding });
      paint();
      // GATE THE CLAIMS (the app's falsifier): a page that renders is not yet a
      // page that holds — falsify what it asserts against the material that was read.
      if (!finding && material && material.length) {
        const gate = gatePage(html, material);
        if (gate && gate.failed.length) {
          finding = `the page asserts ${gate.failed.length} thing(s) the sources do not support: ${gate.failed.slice(0, 3).map((c) => `“${slice(c.s).slice(0, 90)}”`).join("; ")} — assert only what the sources hold`;
          push({ kind: "think", by: "app", op: "EVA", text: `claims: ${gate.summary.backed}/${gate.summary.claims} backed · ${gate.failed.length} failing`, why: finding, ok: false });
        } else if (gate) {
          push({ kind: "think", by: "app", op: "EVA", text: `claims: ${gate.summary.backed}/${gate.summary.claims} backed by the sources`, ok: true });
        }
        paint();
      }
      if (!finding) { held = true; toast("Held — the sources hold and it runs."); break; }
      push({ kind: "note", by: "app", op: "REC", text: "", ok: false, errors: [{ code: "finding", msg: finding }] });
      paint();
      if (round === 3) toast("Left open — the observation still fails after 3 rounds.");
    }
    // LAY THE TRAIL: reinforce the path that held (the rungs climbed, the sources
    // read); sour the ground that gave nothing. The next turn follows the strongest.
    const srcKeys = (material || []).map((m) => "src:" + domainKey(m)).filter((k) => k !== "src:");
    const keys = [...visitedRungs.map((r) => "rung:" + r), ...srcKeys];
    if (keys.length) {
      trail(keys, held ? 1 : -0.6);
      push({ kind: "think", by: "app", op: "EVA", text: held ? `pheromone: reinforced ${keys.join(", ")}` : `pheromone: soured ${keys.join(", ")} — that ground gave nothing`, ok: held });
      paint();
    }
  }

  async function runAsk(text) {
    if (!cur || running) return;
    const ac = new AbortController(); running = ac;
    if (!kernel && cur.log.some((e) => e.kind === "assembly" && e.ok && e.text)) kernel = rebuild(cur);
    const first = !cur.artifact || !(cur.artifact.html || cur.artifact.doc);
    const lk = cur.artifact ? cur.artifact.kind : (!kernel ? longKind(text) : null);
    push({ kind: "ask", by: "you", text: "", ask: text, ok: true, op: "NUL" });
    if (first && cur.title === "New fold") cur.title = text.slice(0, 48);
    // SHOW IT IMMEDIATELY. The first thing is a model call (the reading) and the
    // first call is the slow one — so paint the ask and a working line BEFORE the
    // await, never a blank screen until the model speaks.
    live = { label: "reading the ask", units: [] }; paint();
    // THE PIPELINE: (1) what does the person want → (2) find examples → (3) does
    // that change the want → (4) outline → (5) inventory → (6) weave; REC↬NUL at
    // any point. One turn, the whole movement, streamed and operator-tagged.
    if (!lk && !cur.codebase) {
      await runPipeline(text, ac);
      running = null; live = null; paint(); renderList();
      return;
    }
    live = { label: first ? "reading the ask" : "following up", units: [] }; paint();
    try {
      if (lk) {
        const onStep = (e) => { const { artifact, ...rest } = e; push({ kind: "assembly", ...rest }); if (artifact) cur.artifact = { ...cur.artifact, ...artifact, kind: lk }; live.units = []; paint(); };
        const onLive = (l) => { live.label = l; paint(); };
        cur.kind = lk;
        const lit = /["\u201c']([^"\u201d']+)["\u201d']\s*(?:to|with|into|\u2192|->)\s*["\u201c']([^"\u201d']+)["\u201d']/i.exec(text);
        const addM = lk === "essay" && /\b(add|include|another|new)\b[^.]*?\bsection\b\s*(?:on|about|called|titled|for)?\s*[:"\u201c]?\s*(.+?)["\u201d]?\s*$/i.exec(text);
        const cx = complete(ac.signal);
        if (!cur.artifact || (lk === "extract" && urlOf(text) && !lit)) {
          const r = lk === "essay" ? await runEssay(text, { complete: cx, signal: ac.signal, onStep, onLive }) : await runExtract(text, { signal: ac.signal, onStep, onLive });
          if (r.html) cur.artifact = { kind: lk, html: r.html, files: r.files || [], doc: r.doc };
          toast(r.ok ? (lk === "essay" ? "Essay written from sources." : "Page parsed.") : "It did not hold. The record says why.");
        } else if (lit) {
          const r = replaceInArtifact(cur.artifact, lit[1], lit[2]);
          if (r) cur.artifact = r;
          push({ kind: "assembly", by: "app", label: `replace \u201c${lit[1]}\u201d \u2192 \u201c${lit[2]}\u201d`, text: "", ok: !!r, errors: r ? [] : [{ code: "not changed", msg: `\u201c${lit[1]}\u201d does not appear`, fix: "" }], notes: r ? ["a literal replacement is app-owned: no model was asked"] : [] });
        } else if (lk === "essay" && /\b(longer|lengthen|expand|extend|more (detail|depth|sections)|add \d+ more|go deeper|\d[\d,]*\s*words|\d+\s*(sections|parts))\b/i.test(text)) {
          const n = await extendEssay(cur.artifact.doc, text, { complete: cx, signal: ac.signal, onStep, onLive });
          if (n) toast(`Added ${n} section${n === 1 ? "" : "s"}.`);
        } else if (addM) {
          await addSection(cur.artifact.doc, addM[2].trim(), { complete: cx, signal: ac.signal, onStep, onLive });
        } else if (lk === "essay" && text.length <= 70 && !/[?]$/.test(text)) {
          await addSection(cur.artifact.doc, text.replace(/^(add|write|cover|include)\s+(a\s+)?(section\s+)?(on|about)?\s*/i, "").replace(/[.!]+$/, ""), { complete: cx, signal: ac.signal, onStep, onLive });
        } else { push({ kind: "note", by: "app", text: "", ok: false, errors: [{ code: "not changed", msg: lk === "essay" ? "Follow-ups here: make it longer, 1500 words, add 4 more sections, change \u201cx\u201d to \u201cy\u201d, or add a section on <topic>." : "Follow-ups here: change \u201cx\u201d to \u201cy\u201d, or paste another URL to parse." }] });
        }
      } else { push({ kind: "note", by: "app", text: "", ok: false, errors: [{ code: "no path", msg: "this ask reached no builder" }] }); }
    } catch (e) { push({ kind: "note", by: "app", text: "", ok: false, errors: [{ code: "failed", msg: String(e?.message || e) }] }); }
    finally { const stopped = ac.signal.aborted; running = null; live = null; if (ed) openEditor(ed.name); paint(); renderList(); if (stopped) queue.length = 0; else if (queue.length) runAsk(queue.shift()); }
  }
  function openEditor(name) { const x = kernel && editorFor(kernel, name); ed = x ? { ...x, values: Object.fromEntries(x.fields.map((f) => [f.key, f.value])), rows: x.room ? x.room.rowsText : null } : null; edErr = []; }
  function applyEdit() {
    if (!ed || !kernel) return; const e = editEOT(kernel, ed.name, ed.values, ed.rows); if (!e) return;
    const v = kernel.submit(e.text, { by: "you", label: `edit ${ed.name}` });
    push({ kind: "assembly", by: "you", label: `edit ${ed.name}`, text: e.text, ok: v.ok, errors: v.errors, inverse: v.ok ? e.inverse : null });
    if (v.ok) { const words = contentWords((cur.log.find((x) => x.kind === "ask")?.ask || "") + " " + (cur.kind || "")); for (const f of ed.fields) { const now = String(ed.values[f.key] ?? "").trim(); if (now === f.value) continue; const shape = `${ed.type}.${f.key}`; if (f.value) memory.reject(shape, f.value, "you replaced it"); if (now) memory.keep(shape, now, words, "you"); } openEditor(ed.name); }
    else edErr = v.errors;
    paint();
  }
  function undo(i) { const en = cur.log[i]; if (!en?.inverse || en.undone) return; const v = kernel.submit(en.inverse, { by: "you", label: "undo" }); if (v.ok) en.undone = true; push({ kind: "assembly", by: "you", label: `undo · ${en.label}`, text: en.inverse, ok: v.ok, errors: v.errors }); if (ed) openEditor(ed.name); paint(); }

  let frame = null, frameHtml = "";
  function paint() {
    if (!cur || space.hidden) return;
    const oldTa = space.querySelector(".fs-comp textarea");
    const keepComp = oldTa?.value ?? "";
    const hadFocus = !!oldTa && document.activeElement === oldTa, selA = oldTa?.selectionStart ?? 0, selB = oldTa?.selectionEnd ?? 0;
    const hasArt = kernel && kernel.names().some((n) => n.type === "app" || n.type !== "room");
    const html = cur.artifact?.html || (hasArt ? render(kernel.model()) : "");
    const started = !!(kernel || cur.artifact || cur.codebase);
    const entries = cur.log.map((e, i) => {
      if (e.kind === "ask") return `<div class="fs-ask">${esc(e.ask)}</div>`;
      if (e.kind === "think") {
        const say = e.say ? `<span class="t">${esc(e.say)}</span>` : (e.label ? `<span class="lbl">${esc(e.label)}</span>` : "");
        const body = e.text ? `<div class="st">${esc(e.text)}</div>` : "";
        return `<div class="fs-think${e.ok === false ? " bad" : ""}${e.streaming ? " streaming" : ""}">${opg(e)}<span class="fs-by fold">fold</span> ${say}${e.why ? `<div class="w">${esc(e.why)}</div>` : ""}${body}</div>`;
      }
      const units = (e.units || []).map((u) => `<div class="fs-u"><span class="k">${esc(u.key)}</span><span class="v">${esc(u.value || "(empty)")}</span><span class="fs-by ${esc(u.by)}">${esc(u.by)}</span>${u.address ? `<span></span><span class="s" style="color:var(--mut)">${esc(u.address)}</span>` : ""}${(u.scars || []).map((s) => `<span></span><span class="s">✗ ${esc(s)}</span>`).join("")}</div>`).join("");
      const drawn = (e.units || []).filter((u) => u.by === "mouth").length;
      return `<div class="fs-step ${e.ok ? "ok" : "bad"}" data-i="${i}"><div class="fs-step-h"><span class="fs-by ${esc(e.by)}">${esc(e.by)}</span>${opg(e)}<b>${esc(e.label || e.kind)}</b><span>${e.ok ? (e.undone ? "set down · undone" : "set down") : "not set down"}</span>${e.units?.length ? `<span>${drawn}/${e.units.length} drawn</span><button type="button" class="fs-tog" data-tog="${i}">units</button>` : ""}${e.inverse && e.ok && !e.undone && !running ? `<button type="button" class="fs-undo" data-undo="${i}">undo</button>` : ""}</div>${(e.errors || []).map((x) => `<div class="fs-err">${esc(x.code)} · ${esc(x.msg)}</div>`).join("")}${(e.notes || []).map((n) => `<div class="fs-note">${esc(n)}</div>`).join("")}<div class="fs-units">${units}</div></div>`;
    }).join("");
    const liveHtml = (live ? `<div class="fs-step live open"><div class="fs-step-h"><span class="fs-by model">model</span><b>${esc(live.label)}</b><span>working…</span></div><div class="fs-units">${live.units.map((u) => `<div class="fs-u"><span class="k">${esc(u.key)}</span><span class="v">${esc(u.value || "…")}</span><span class="fs-by ${esc(u.by)}">${esc(u.by)}</span></div>`).join("")}</div></div>` : "") + queue.map((q) => `<div class="fs-ask" style="opacity:.6">${esc(q)}<span class="fs-note"> · queued</span></div>`).join("");
    const parts = kernel ? editableParts(kernel) : [];
    const edHtml = ed ? `<div class="fs-ed"><b style="font:600 var(--fs-sm) var(--mono)">${esc(ed.name)} · ${esc(ed.type)}</b>${ed.fields.map((f) => `<label>${esc(f.key)}${f.options ? `<select data-f="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(o)}"${o === ed.values[f.key] ? " selected" : ""}>${esc(o || "(default)")}</option>`).join("")}</select>` : `<input data-f="${esc(f.key)}" value="${esc(ed.values[f.key] ?? "")}">`}</label>`).join("")}${ed.room ? `<label>records of ${esc(ed.room.name)} (${esc(ed.room.fields.join(" | "))})<textarea data-rows="1" rows="4">${esc(ed.rows || "")}</textarea></label>` : ""}${edErr.map((x) => `<div class="fs-err">${esc(x.code)} · ${esc(x.msg)}</div>`).join("")}<div class="row" style="display:flex;gap:6px"><button type="button" class="fs-btn on" data-apply="1">Check and apply</button><button type="button" class="fs-btn" data-edclose="1">Close</button></div></div>` : "";
    // THE CODEBASE: a worktree on the left, one file on the right, seen as a
    // PROJECTION (the bytes now) or as the LOG of changes that produced it.
    let codeView = "";
    if (cur.codebase && tab === "code") {
      const names = Object.keys(cur.codebase.files).sort();
      const tgt = cur.codeTarget || names[0];
      const content = tgt ? String(cur.codebase.files[tgt] ?? "") : "";
      const changes = (cur.codeChanges || []).filter((c) => c.path === tgt);
      const mode = cur.codeMode || "projection";
      const body = mode === "log"
        ? (changes.length
          ? changes.map((c, i) => { const d = diffLines(c.before, c.after); const st = diffStat(d); return `<div class="fs-chg"><div class="fs-chg-h"><span class="fs-by ${esc(c.by)}">${esc(c.by)}</span><b>${esc(c.label || c.op)}</b>${i === 0 ? "" : `<span>+${st.added} −${st.removed}</span>`}</div><pre class="fs-diff">${d.filter((h) => h.op !== "ctx" && h.op !== "same").map((h) => (h.op === "add" ? "+ " : h.op === "del" ? "- " : "  ") + esc(h.text)).join("\n")}</pre></div>`; }).join("")
          : `<div class="fs-empty">No changes recorded for ${esc(tgt || "this file")} yet.</div>`)
        : `<pre class="fs-file">${esc(content)}</pre>`;
      codeView = `<div class="fs-code"><div class="fs-tree">${names.map((p) => `<button type="button" class="fs-tbtn${p === tgt ? " on" : ""}" data-cf="${esc(p)}">${esc(p)}</button>`).join("")}</div><div class="fs-cview"><div class="fs-ch"><b>${esc(tgt || "")}</b><span class="fs-sp"></span><button type="button" class="fs-btn${mode === "projection" ? " on" : ""}" data-cmode="projection">Projection</button><button type="button" class="fs-btn${mode === "log" ? " on" : ""}" data-cmode="log">Log (${changes.length})</button></div>${body}</div></div>`;
    }
    if (!space.firstChild) space.innerHTML = `<div class="fs-sess"></div><div class="fs-canvas"></div>`;
    if (!space.dataset.view) space.dataset.view = "session";
    const sessEl = space.querySelector(".fs-sess"), canvasEl = space.querySelector(".fs-canvas");
    sessEl.innerHTML = `<div class="fs-head"><span class="fs-chip">fold</span><b>${esc(cur.title)}</b>${cur.kind ? `<span class="fs-chip">${esc(cur.kind)}</span>` : ""}<span class="fs-sp"></span><button type="button" class="fs-btn fs-vt" data-view="canvas">Preview →</button><button type="button" class="fs-btn" data-new="1" title="New fold">＋ New</button><button type="button" class="fs-btn" data-close="1" title="Back to chat">Chat</button></div>
      <div class="fs-log" aria-live="polite">${entries || `<div class="fs-empty">Describe what this fold should make: a website, a widget, a document, a sourced essay, or paste a URL to pull its tables and lists. Each part is built and checked one small piece at a time, and every step is kept here.</div>`}${liveHtml}</div>${edHtml}
      <div class="fs-comp">${sel && kernel ? `<div class="row"><span class="fs-sel">◎ ${esc(sel)}</span><button type="button" class="fs-tog" data-unsel="1">clear</button></div>` : ""}<div class="inrow"><textarea rows="2" aria-label="${started ? "Follow up on this fold" : "What should this fold make"}">${esc(keepComp)}</textarea>${running ? `<button type="button" class="fs-btn" data-stop="1">Stop</button>` : `<button type="button" class="fs-btn go" data-send="1">${started ? "Follow up" : "Make it"}</button>`}</div>
        ${!started ? `<div class="row">${["auto", "website", "widget", "document"].map((k) => `<button type="button" class="fs-btn${(cur.kindPick || "auto") === k ? " on" : ""}" data-kind="${k}">${k}</button>`).join("")}</div>` : ""}</div>`;
    const ckey = [tab, editMode, html, parts.length, tab === "eot" ? cur.log.length : 0, cur.codebase ? [cur.codeTarget, cur.codeMode, (cur.codeChanges || []).length].join(",") : ""].join("|");
    if (canvasEl.__key !== ckey) { canvasEl.__key = ckey; canvasEl.innerHTML = `<div class="fs-cbar"><button type="button" class="fs-btn fs-vt" data-view="session">← Session</button><button type="button" class="fs-btn${tab === "preview" ? " on" : ""}" data-tab="preview">Preview</button><button type="button" class="fs-btn${tab === "eot" ? " on" : ""}" data-tab="eot">EOT</button>${cur.codebase ? `<button type="button" class="fs-btn${tab === "code" ? " on" : ""}" data-tab="code">Code</button>` : ""}<span class="fs-sp"></span>${parts.length ? `<button type="button" class="fs-btn${editMode ? " on" : ""}" data-edit="1">${editMode ? "Editing · click a part" : "Edit"}</button>` : ""}${html ? `<button type="button" class="fs-btn" data-dl="1">Download HTML</button>` : ""}${(cur.artifact?.files || []).map((f, i) => `<button type="button" class="fs-btn" data-file="${i}">${esc(f.name)}</button>`).join("")}</div>
        ${tab === "code" && cur.codebase ? codeView : tab === "eot" ? `<pre class="fs-eot">${esc(cur.log.filter((e) => e.ok && e.text).map((e) => `# ${e.by} · ${e.label}\n${e.text}`).join("\n\n") || "(nothing set down yet)")}</pre>` : html ? `<div class="fs-frame"><iframe title="The fold's artifact" sandbox="allow-scripts allow-forms"></iframe></div>` : `<div class="fs-empty">The artifact appears here as its parts pass.</div>`}`;
      frame = canvasEl.querySelector("iframe"); if (frame) { frame.srcdoc = html; frameHtml = html; } }
    const log = space.querySelector(".fs-log"); log.scrollTop = log.scrollHeight;
    const ta = space.querySelector(".fs-comp textarea");
    if (hadFocus) { ta.focus(); try { ta.setSelectionRange(selA, selB); } catch {} }
    ta.onkeydown = (ev) => { if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); send(); } };
    space.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { space.dataset.view = b.dataset.view; paint(); }));
    space.querySelectorAll("[data-kind]").forEach((b) => (b.onclick = () => { cur.kindPick = b.dataset.kind === "auto" ? null : b.dataset.kind; paint(); }));
    space.querySelectorAll("[data-tog]").forEach((b) => (b.onclick = () => b.closest(".fs-step").classList.toggle("open")));
    space.querySelectorAll("[data-undo]").forEach((b) => (b.onclick = () => undo(+b.dataset.undo)));
    space.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; paint(); }));
    space.querySelectorAll("[data-cf]").forEach((b) => (b.onclick = () => { cur.codeTarget = b.dataset.cf; paint(); }));
    space.querySelectorAll("[data-cmode]").forEach((b) => (b.onclick = () => { cur.codeMode = b.dataset.cmode; paint(); }));
    space.querySelectorAll("[data-f]").forEach((x) => (x.oninput = x.onchange = () => { ed.values[x.dataset.f] = x.value; }));
    const rows = space.querySelector("[data-rows]"); if (rows) rows.oninput = () => { ed.rows = rows.value; };
    const on = (sel2, fn) => { const x = space.querySelector(sel2); if (x) x.onclick = fn; };
    on("[data-send]", send); on("[data-stop]", () => running?.abort()); on("[data-close]", close); on("[data-new]", () => create());
    on("[data-unsel]", () => { sel = null; paint(); }); on("[data-apply]", applyEdit); on("[data-edclose]", () => { ed = null; paint(); });
    on("[data-edit]", () => { editMode = !editMode; paint(); });
    space.querySelectorAll("[data-file]").forEach((b) => (b.onclick = () => { const f = cur.artifact.files[+b.dataset.file]; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([f.text], { type: f.mime })); a.download = f.name; a.click(); }));
    on("[data-dl]", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([frameHtml], { type: "text/html" })); a.download = (cur.title || "fold").replace(/[^\w-]+/g, "-").slice(0, 40) + ".html"; a.click(); });
  }
  function send() { const ta = space.querySelector(".fs-comp textarea"); const t = ta?.value.trim(); if (!t) return; ta.value = ""; if (running) { queue.push(t); paint(); toast("Queued. It runs when the current step finishes."); return; } runAsk(t); }
  window.addEventListener("message", (ev) => {
    if (!frame || ev.source !== frame.contentWindow) return; const d = ev.data || {};
    if (d.fold === "ready") { frame.contentWindow.postMessage({ fold: "edit", on: editMode }, "*"); frame.contentWindow.postMessage({ fold: "select", name: sel }, "*"); }
    if (d.fold === "pick" && d.name) { sel = d.name; openEditor(d.name); paint(); }
  });

  function open(id) {
    const f = folds.find((x) => x.id === id); if (!f) return;
    if (!running) queue.length = 0;
    if (running && cur && cur.id !== id) { toast("This fold is still working; stop it first."); return; }
    space.innerHTML = ""; space.dataset.view = "session"; cur = f; kernel = f.log.some((e) => e.kind === "assembly" && e.ok && e.text) ? rebuild(f) : null; sel = null; ed = null; editMode = false; tab = "preview";
    space.hidden = false; main.classList.add("folding"); onOpen(f); paint(); renderList();
    setTimeout(() => space.querySelector(".fs-comp textarea")?.focus(), 0);
  }
  function create(ask = null) {
    if (running) { toast("A fold is still working; stop it first."); return null; }
    const f = { id: uid(), title: ask ? ask.slice(0, 48) : "New fold", kind: ask ? longKind(ask) : null, created: Date.now(), updated: Date.now(), log: [] };
    folds.push(f); save(); open(f.id);
    if (ask) runAsk(ask);
    return f.id;
  }
  function close() { space.hidden = true; main.classList.remove("folding"); onClose(); renderList(); }
  // A CODEBASE: files loaded into a workspace (fold-chat-workspace.js). Seen two
  // ways, per file — as a PROJECTION (the bytes now) and as the LOG (the changes
  // that produced them). The file is a fold of its own change history.
  function setCodebase(files = {}) {
    const ws = createWorkspace(files);
    if (!cur) create();
    cur.codebase = ws;
    cur.codeChanges = Object.keys(ws.files).sort().map((p) => ({ at: Date.now(), path: p, op: "add", before: "", after: ws.files[p], by: "you", label: "imported" }));
    cur.codeTarget = Object.keys(ws.files).find((p) => /(^|\/)(index\.html|README\.md|package\.json)$/i.test(p)) || Object.keys(ws.files).sort()[0] || null;
    cur.codeMode = "projection";
    tab = "code";
    push({ kind: "codebase", by: "you", label: `codebase · ${Object.keys(ws.files).length} files`, ok: true });
    paint(); renderList();
    return cur.id;
  }
  if (newBtn) newBtn.onclick = () => create();
  if (railBtn) railBtn.onclick = () => (space.hidden ? (folds.length ? open([...folds].sort((a, b) => b.updated - a.updated)[0].id) : create()) : close());
  renderList();
  return { create, setCodebase, open, close, isOpen: () => !space.hidden, list: () => folds.map((f) => ({ id: f.id, title: f.title, kind: f.kind })) };
}
