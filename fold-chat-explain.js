// fold-chat-explain.js — "explain this", pure.
//
// What the action used to do: re-run the ASK that produced the message through
// the grounded chat lane (rerunAs → run). For an agent artifact that meant the
// original task ("make a pomodoro timer with Start, Pause and Reset buttons")
// was web-searched and answered AGAIN — the artifact itself was never the
// subject. See docs/explain-this.md for the measured before-behaviour.
//
// What it does now, in order of preference, deciding from the message's OWN
// record and never by re-running anything:
//
//   artifact-outline   an agent artifact: a MECHANICAL outline read off the code
//                      (title, controls, functions, handlers, external refs,
//                      sizes) + what the run actually VERIFIED (from the stored
//                      `grounding.events`) + plainly what was NOT. No model, no
//                      network: instant, nothing leaves the machine. An optional
//                      "go deeper" step is described by deeperRequest(): a LOCAL
//                      general model, never a coder, never a sealed one by
//                      default, and always through client.chat so the audit hook
//                      sees the bytes.
//   answer-record      a chat answer: WHY it is what it is, from the turn's
//                      record — sources used, grounded sentences vs the mouth's
//                      own prose, the unsupported figures, the void.
//   generation-record  penelope's writing turn: the units, stages, verdict.
//   agent-no-artifact  a stopped/failed agent turn: what happened, honestly.
//   nothing            there is nothing to explain, and it says so.
//
// DOM-free, IO-free, never throws on stored data of any shape. Every string that
// came from code or from a record is untrusted: toHtml() escapes all of it.

import { artifactsOf } from "./fold-chat-artifacts.js";
import { kindOf } from "./fold-chat-agent.js";
import { isChatModel, isEmbedModel, tierOf } from "./fold-chat-client.js";
import { normVoid, voidLabel } from "./fold-chat-channels.js";

/** The most of an artifact the outline will read. Beyond this the outline says
 *  it covered a prefix; it never stalls the page on a pasted megabyte. */
export const MAX_SCAN = 300000;
const MAX_TAG = 4000;          // an unterminated tag is abandoned after this many chars
const CAP = { controls: 40, headings: 12, functions: 60, handlers: 40, external: 40, ids: 40, features: 30 };
/** Most code the optional model step will be handed (a small local model). */
export const MAX_DEEP_CODE = 12000;

const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const plural = (n, a, b) => `${n} ${n === 1 ? a : (b || a + "s")}`;
const bytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? (n / 1024).toFixed(1) + " KB" : n + " B");
const isRemote = (u) => /^(https?:)?\/\//i.test(String(u));
const isArr = Array.isArray;

/* ───────────────────────── mechanical outline ───────────────────────── */

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; } catch { return m; } }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const WS = /\s/;
const NAME_CH = /[\w:-]/;

/** One tag starting at s[i] === "<". { end, name, closing, attrs } or null when
 *  it is not a well-formed tag (so the "<" is just text). Linear and bounded. */
function parseTagAt(s, i) {
  let j = i + 1, closing = false;
  if (s[j] === "/") { closing = true; j++; }
  if (!/[a-zA-Z]/.test(s[j] || "")) return null;
  let k = j;
  while (k < s.length && NAME_CH.test(s[k])) k++;
  const name = s.slice(j, k).toLowerCase();
  const attrs = Object.create(null);
  const limit = Math.min(s.length, i + MAX_TAG);
  while (k < limit) {
    while (k < limit && (WS.test(s[k]) || s[k] === "/")) k++;
    if (k >= limit) break;
    if (s[k] === ">") return { end: k + 1, name, closing, attrs };
    const a = k;
    while (k < limit && !WS.test(s[k]) && s[k] !== "=" && s[k] !== ">" && s[k] !== "/") k++;
    if (k === a) { k++; continue; }
    const an = s.slice(a, k).toLowerCase();
    while (k < limit && WS.test(s[k])) k++;
    let v = "";
    if (s[k] === "=") {
      k++;
      while (k < limit && WS.test(s[k])) k++;
      const q = s[k];
      if (q === '"' || q === "'") {
        const e = s.indexOf(q, k + 1);
        if (e < 0 || e >= limit) return null;          // an unterminated quote: not a tag
        v = s.slice(k + 1, e); k = e + 1;
      } else {
        const b = k;
        while (k < limit && !WS.test(s[k]) && s[k] !== ">") k++;
        v = s.slice(b, k);
      }
    }
    if (an && !(an in attrs)) attrs[an] = decode(v);
  }
  return null;
}

/** Split an HTML document into its markup (comments, scripts and styles taken
 *  out), its script blocks and its style blocks. Never throws. */
function splitHtml(src, notes) {
  const low = src.toLowerCase();
  const n = src.length;
  const out = [], scripts = [], styles = [];
  let i = 0, malformed = 0;
  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { out.push(src.slice(i)); break; }
    out.push(src.slice(i, lt));
    if (low.startsWith("<!--", lt)) {
      const e = low.indexOf("-->", lt + 4);
      if (e < 0) { notes.push("an unterminated comment swallowed the rest of the file"); break; }
      i = e + 3; continue;
    }
    const isScript = low.startsWith("<script", lt) && /[\s>\/]/.test(low[lt + 7] || ">");
    const isStyle = !isScript && low.startsWith("<style", lt) && /[\s>\/]/.test(low[lt + 6] || ">");
    if (isScript || isStyle) {
      const tag = parseTagAt(src, lt);
      if (!tag) { malformed++; out.push("<"); i = lt + 1; continue; }
      const closeTag = isScript ? "</script" : "</style";
      const close = low.indexOf(closeTag, tag.end);
      const body = src.slice(tag.end, close < 0 ? n : close);
      if (close < 0) notes.push(`an unterminated <${isScript ? "script" : "style"}> runs to the end of the file`);
      (isScript ? scripts : styles).push({ attrs: tag.attrs, body });
      out.push(" ");
      if (close < 0) break;
      const gt = src.indexOf(">", close);
      i = gt < 0 ? n : gt + 1;
      continue;
    }
    out.push("<"); i = lt + 1;
  }
  if (malformed) notes.push(plural(malformed, "malformed tag") + " skipped");
  return { markup: out.join(""), scripts, styles };
}

/** Blank out comments (keeping strings) so a commented-out call is not counted. */
export function blankComments(js) {
  const s = String(js ?? "");
  const out = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === "/" && d === "/") { const e = s.indexOf("\n", i); const stop = e < 0 ? n : e; i = stop; continue; }
    if (c === "/" && d === "*") { const e = s.indexOf("*/", i + 2); const stop = e < 0 ? n : e + 2; out.push(" "); i = stop; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && s[j] !== c && s[j] !== "\n") { if (s[j] === "\\") j++; j++; }
      j = Math.min(j + 1, n);
      out.push(s.slice(i, j)); i = j; continue;
    }
    if (c === "`") {
      let j = i + 1;
      while (j < n && s[j] !== "`") { if (s[j] === "\\") j++; j++; }
      j = Math.min(j + 1, n);
      out.push(s.slice(i, j)); i = j; continue;
    }
    out.push(c); i++;
  }
  return out.join("");
}

const FEATURES = [
  ["timers", /\b(setInterval|setTimeout|requestAnimationFrame)\s*\(/g],
  ["canvas drawing", /\.getContext\s*\(/g],
  ["local storage", /\b(localStorage|sessionStorage|indexedDB)\b|document\s*\.\s*cookie/g],
  ["network requests", /\b(fetch\s*\(|XMLHttpRequest|new\s+WebSocket|sendBeacon|EventSource)/g],
  ["keyboard input", /["'`](keydown|keyup|keypress)["'`]|\.onkey(down|up|press)\b/g],
  ["mouse/touch/pointer input", /["'`](mousedown|mouseup|mousemove|pointerdown|pointermove|touchstart|touchmove|wheel)["'`]/g],
  ["audio", /\b(new\s+Audio\s*\(|AudioContext|speechSynthesis)\b/g],
  ["randomness", /\bMath\s*\.\s*random\s*\(/g],
  ["dates/clock", /\b(Date\s*\.\s*now\s*\(|new\s+Date\s*\(|performance\s*\.\s*now\s*\()/g],
  ["clipboard", /\bnavigator\s*\.\s*clipboard\b/g],
  ["device APIs", /\bnavigator\s*\.\s*(geolocation|mediaDevices|bluetooth|usb|serial)\b/g],
  ["dynamic code (eval / new Function / document.write)", /\b(eval\s*\(|new\s+Function\s*\(|document\s*\.\s*write\s*\()/g],
  ["modules (import/export)", /^\s*(import\s[^;\n]{0,200}\sfrom\s|import\s*["']|export\s+(default|const|function|class|\{))/gm],
];
const DOM_RE = /\b(document|window)\s*\./;

function analyzeJs(code, out) {
  const js = blankComments(code);
  // functions & classes
  const names = new Set();
  const grab = (re, group = 1) => { for (const m of js.matchAll(re)) { if (names.size < CAP.functions) names.add(m[group]); else break; } };
  grab(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]{0,60})\s*\(/g);
  grab(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]{0,60})\s*=\s*(?:async\s+)?(?:function\b|\([^()]{0,200}\)\s*=>|[A-Za-z_$][\w$]{0,40}\s*=>)/g);
  grab(/\bclass\s+([A-Za-z_$][\w$]{0,60})/g);
  for (const nme of names) if (!out.functions.includes(nme) && out.functions.length < CAP.functions) out.functions.push(nme);

  // variables bound to elements, so a handler can name its target
  const vars = new Map();
  for (const m of js.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]{0,40})\s*=\s*(?:document\s*\.\s*)?(getElementById|querySelector)\(\s*(["'`])([^"'`\n]{1,80})\3\s*\)/g)) {
    vars.set(m[1], m[2] === "getElementById" ? "#" + m[4] : m[4]);
  }
  const seen = new Set();
  const addHandler = (event, target, fn) => {
    const key = `${event}|${target}|${fn || ""}`;
    if (seen.has(key) || out.handlers.length >= CAP.handlers) return;
    seen.add(key); out.handlers.push({ event, target, fn: fn || null });
  };
  for (const m of js.matchAll(/getElementById\(\s*(["'`])([^"'`\n]{1,60})\1\s*\)\s*\.\s*addEventListener\(\s*(["'`])([\w:-]{1,30})\3(?:\s*,\s*([A-Za-z_$][\w$.]{0,50})\s*[,)])?/g)) addHandler(m[4], "#" + m[2], m[5]);
  for (const m of js.matchAll(/querySelector(?:All)?\(\s*(["'`])([^"'`\n]{1,60})\1\s*\)\s*\.\s*addEventListener\(\s*(["'`])([\w:-]{1,30})\3(?:\s*,\s*([A-Za-z_$][\w$.]{0,50})\s*[,)])?/g)) addHandler(m[4], m[2], m[5]);
  for (const m of js.matchAll(/\b([A-Za-z_$][\w$]{0,40})\s*\.\s*addEventListener\(\s*(["'`])([\w:-]{1,30})\2(?:\s*,\s*([A-Za-z_$][\w$.]{0,50})\s*[,)])?/g)) addHandler(m[3], vars.get(m[1]) || m[1], m[4]);
  for (const m of js.matchAll(/\b([A-Za-z_$][\w$]{0,40})\s*\.\s*on([a-z]{3,20})\s*=\s*(?:([A-Za-z_$][\w$.]{0,50})\s*[;\n,)]|)/g)) addHandler(m[2], vars.get(m[1]) || m[1], m[3]);

  // external reaches from script
  const ext = (via, url) => { if (out.external.length < CAP.external && !out.external.some((e) => e.via === via && e.url === url)) out.external.push({ via, url, remote: isRemote(url) }); };
  for (const m of js.matchAll(/\bfetch\s*\(\s*(["'`])([^"'`\n]{1,200})\1/g)) ext("fetch", m[2]);
  if (/\bfetch\s*\(\s*[^"'`\s)]/.test(js)) ext("fetch", "(a computed address)");
  for (const m of js.matchAll(/new\s+WebSocket\s*\(\s*(["'`])([^"'`\n]{1,200})\1/g)) ext("websocket", m[2]);
  for (const m of js.matchAll(/\.open\s*\(\s*["'](?:GET|POST|PUT|DELETE|PATCH)["']\s*,\s*(["'`])([^"'`\n]{1,200})\1/g)) ext("xhr", m[2]);
  for (const m of js.matchAll(/\bimport\s+[^'"`;]{0,200}?from\s*(["'])([^"'\n]{1,200})\1|\bimport\s*\(\s*(["'])([^"'\n]{1,200})\3|\bimport\s*(["'])([^"'\n]{1,200})\5/g)) ext("import", m[2] || m[4] || m[6]);
  for (const m of js.matchAll(/\bimportScripts\s*\(\s*(["'])([^"'\n]{1,200})\1/g)) ext("importScripts", m[2]);

  for (const [label, re] of FEATURES) {
    const hits = (js.match(re) || []).length;
    if (hits && !out.features.some((f) => f.label === label) && out.features.length < CAP.features) out.features.push({ label, hits });
    else if (hits) { const f = out.features.find((x) => x.label === label); f.hits += hits; }
  }
  if (DOM_RE.test(js) || /\bgetElementById\b|\bquerySelector/.test(js)) out.touchesPage = true;
}

const CTRL_TEXT_TAGS = new Set(["button", "a", "summary", "label", "option"]);
const HEAD_TAGS = new Set(["h1", "h2", "h3"]);
const MEDIA_TAGS = { img: "image", video: "video", audio: "audio", iframe: "frame", source: "media", embed: "embed", object: "object" };

function innerText(markup, lowMarkup, tag) {
  const win = 600;
  const rel = lowMarkup.slice(tag.end, tag.end + win).indexOf("</" + tag.name);
  const stop = rel >= 0 ? tag.end + rel : (() => { const nx = markup.indexOf("<", tag.end); return nx < 0 || nx > tag.end + win ? tag.end + win : nx; })();
  return clip(decode(markup.slice(tag.end, stop).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]{0,500}>/g, "")), 60);
}

/**
 * The mechanical outline of an artifact, read off the text alone — no model, no
 * DOM, no network. Deterministic. Never throws, whatever it is handed.
 *   kind  "html" | "js" | "text" | "empty" (default: kindOf(code))
 * Returns { kind, chars, lines, truncated, scanned, title, headings, controls,
 *   inputs, ids, functions, handlers, features, external, counts, sizes,
 *   touchesPage, notes, summary }.
 */
export function outlineOf(code, { kind = null } = {}) {
  const full = typeof code === "string" ? code : code == null ? "" : String(code);
  const truncated = full.length > MAX_SCAN;
  const src = truncated ? full.slice(0, MAX_SCAN) : full;
  const k = kind || kindOf(src);
  const o = {
    kind: k, chars: full.length, lines: full ? full.split("\n").length : 0, truncated, scanned: src.length,
    title: null, headings: [], controls: [], inputs: [], ids: [], functions: [], handlers: [], features: [], external: [],
    counts: { buttons: 0, links: 0, inputs: 0, selects: 0, textareas: 0, forms: 0, canvases: 0, svgs: 0, images: 0, tags: 0, scripts: 0, styles: 0, inlineHandlers: 0 },
    sizes: { total: full.length, markup: 0, css: 0, js: 0 },
    touchesPage: false, notes: [], summary: "",
  };
  if (truncated) o.notes.push(`the outline covers the first ${bytes(MAX_SCAN)} of ${bytes(full.length)} — the rest was not read`);
  try {
    if (k === "html") outlineHtml(src, o);
    else if (k === "js") { o.sizes.js = src.length; analyzeJs(src, o); }
    else if (k === "text") { o.sizes.markup = src.length; }
  } catch (e) {
    o.notes.push("the outline hit unexpected input and is partial: " + clip(e?.message, 80));
  }
  o.summary = outlineSummary(o);
  return o;
}

function outlineHtml(src, o) {
  const { markup, scripts, styles } = splitHtml(src, o.notes);
  o.sizes.markup = markup.length;
  o.counts.scripts = scripts.length; o.counts.styles = styles.length;
  o.sizes.css = styles.reduce((n, s) => n + s.body.length, 0);
  const lowM = markup.toLowerCase();
  const labelFor = new Map();
  const pending = [];
  const ids = new Set();
  const ext = (via, url) => { if (url && o.external.length < CAP.external && !o.external.some((e) => e.via === via && e.url === url)) o.external.push({ via, url: clip(url, 200), remote: isRemote(url) }); };

  let i = 0;
  const n = markup.length;
  let guard = 0;
  while (i < n && guard++ < 200000) {
    const lt = markup.indexOf("<", i);
    if (lt < 0) break;
    const tag = parseTagAt(markup, lt);
    if (!tag) { i = lt + 1; continue; }
    i = tag.end;
    if (tag.closing) continue;
    o.counts.tags++;
    const a = tag.attrs, nm = tag.name;
    if (a.id && ids.size < CAP.ids) ids.add(clip(a.id, 40));
    for (const an of Object.keys(a)) if (/^on[a-z]{3,20}$/.test(an)) { o.counts.inlineHandlers++; if (o.handlers.length < CAP.handlers) o.handlers.push({ event: an.slice(2), target: a.id ? "#" + a.id : "<" + nm + ">", fn: clip(a[an], 50) || null }); }
    if (nm === "title" && o.title == null) o.title = innerText(markup, lowM, tag) || null;
    else if (HEAD_TAGS.has(nm)) { if (o.headings.length < CAP.headings) { const t = innerText(markup, lowM, tag); if (t) o.headings.push({ level: +nm[1], text: t }); } }
    else if (nm === "label") { const t = innerText(markup, lowM, tag); if (a.for && t) labelFor.set(a.for, t); }
    else if (nm === "form") { o.counts.forms++; if (a.action) ext("form action", a.action); }
    else if (nm === "canvas") o.counts.canvases++;
    else if (nm === "svg") o.counts.svgs++;
    else if (nm === "link" && a.href) ext(String(a.rel || "link").toLowerCase().includes("stylesheet") ? "stylesheet" : "link", a.href);
    else if (nm === "a") {
      o.counts.links++;
      if (a.href && /^(https?:)?\/\//i.test(a.href)) ext("link", a.href);
      if (o.controls.length < CAP.controls && a.href && a.href.startsWith("#") && a.href.length > 1) o.controls.push({ tag: "a", type: "anchor", label: innerText(markup, lowM, tag) || a.href, id: a.id || null });
    }
    if (MEDIA_TAGS[nm] && a.src) ext(MEDIA_TAGS[nm], a.src);
    if (nm === "img") o.counts.images++;
    if (nm === "button" || (nm === "input" && /^(button|submit|reset|image)$/i.test(a.type || "")) || a.role === "button") {
      o.counts.buttons++;
      if (o.controls.length < CAP.controls) {
        const label = nm === "button" || a.role === "button" ? innerText(markup, lowM, tag) : "";
        o.controls.push({ tag: nm, type: a.type || (nm === "button" ? "button" : null), label: label || a.value || a["aria-label"] || a.title || a.name || a.id || "(unlabelled)", id: a.id || null });
      }
    } else if (nm === "input" || nm === "select" || nm === "textarea") {
      if (nm === "input" && /^hidden$/i.test(a.type || "")) continue;
      o.counts[nm === "input" ? "inputs" : nm === "select" ? "selects" : "textareas"]++;
      if (o.inputs.length < CAP.controls) o.inputs.push({ tag: nm, type: nm === "input" ? (a.type || "text").toLowerCase() : nm, label: a["aria-label"] || a.placeholder || a.title || a.name || "", id: a.id || null, forLabel: null });
    }
  }
  for (const inp of o.inputs) { if (inp.id && labelFor.has(inp.id)) inp.forLabel = labelFor.get(inp.id); inp.label = inp.forLabel || inp.label || inp.id || "(unlabelled)"; }
  o.ids = [...ids];

  // script blocks: external src, inline JS analysed, data blocks counted apart
  const jsParts = [];
  for (const s of scripts) {
    const t = String(s.attrs.type || "").toLowerCase();
    if (s.attrs.src) ext("script", s.attrs.src);
    const isJs = !t || /javascript|ecmascript|^module$/.test(t);
    if (isJs && s.body.trim()) jsParts.push(s.body);
    else if (!isJs && s.body.trim()) o.notes.push(`a data block of type ${clip(t, 30)} (${bytes(s.body.length)}) is not code`);
  }
  const js = jsParts.join("\n;\n");
  o.sizes.js = js.length;
  if (js) analyzeJs(js, o);
  if (/<!doctype html/i.test(src.slice(0, 200)) === false && !/^\s*<html[\s>]/i.test(src) && o.counts.tags > 0) o.notes.push("a fragment, not a full document (no <!doctype html>) — a browser will still render it");
}

/** One mechanical sentence that says what the outline found. */
export function outlineSummary(o) {
  if (!o || o.kind === "empty") return "There is no code here.";
  let head;
  if (o.kind === "html") {
    const c = o.counts;
    head = o.title ? `A web page titled “${o.title}”` : "A web page with no <title>";
    const parts = [];
    if (c.buttons) parts.push(plural(c.buttons, "button"));
    if (c.inputs + c.selects + c.textareas) parts.push(plural(c.inputs + c.selects + c.textareas, "input field"));
    if (c.canvases) parts.push(plural(c.canvases, "canvas", "canvases"));
    if (c.svgs) parts.push(plural(c.svgs, "SVG graphic"));
    if (c.images) parts.push(plural(c.images, "image"));
    if (c.forms) parts.push(plural(c.forms, "form"));
    if (parts.length) head += ": " + parts.join(", ");
    else if (!c.tags) head = "No recognisable markup";
  } else if (o.kind === "js") head = "A script";
  else head = "Plain text, not code";
  const rest = [];
  if (o.functions.length) rest.push(plural(o.functions.length, "function") + (o.functions.length >= CAP.functions ? "+" : ""));
  if (o.handlers.length) rest.push(plural(o.handlers.length, "event handler"));
  rest.push(`${bytes(o.chars)}, ${plural(o.lines, "line")}`);
  return head + "; " + rest.join("; ") + ".";
}

/* ───────────────────────── what the run verified ───────────────────────── */

const SANDBOX = new Set(["loads without errors", "renders something visible", "controls respond", "console", "runs as code", "observation"]);

/**
 * Read a stored agent trace (`grounding.events`) into plain facts about the
 * artifact that was FINALLY kept — only the round that produced it, since a
 * later round that returned nothing says nothing about it.
 * Never throws; a missing/garbled trace yields { hasTrace:false }.
 */
export function verificationOf(events, { outcome = null } = {}) {
  const evs = (isArr(events) ? events : []).filter((e) => e && typeof e === "object" && typeof e.type === "string");
  const v = {
    hasTrace: evs.length > 0, task: null, outcome: outcome || null, budget: null, rounds: 0, artifactRound: null,
    kind: null, lane: null, model: null, executed: null, checks: [], gate: null,
    janus: { state: "none", held: 0, refuted: 0, error: null }, requirements: [], read: null,
    escalated: null, remoteModels: [], audit: null, findings: [], error: null, stopped: false,
    verified: [], failed: [], info: [], notVerified: [],
  };
  if (!evs.length) { v.notVerified.push("No run record is stored for this message (an older message, or the record was dropped), so nothing can be said about how it was checked.", "Whether it works, or does what was asked, has not been established by anything stored here."); return v; }

  const roundsMap = new Map();
  let cur = null;
  for (const e of evs) {
    if (e.type === "start") { v.task = typeof e.task === "string" ? e.task : null; v.budget = Number(e.maxRounds) || null; }
    else if (e.type === "requirements") v.requirements = isArr(e.terms) ? e.terms.map(String) : [];
    else if (e.type === "read") v.read = e.error ? { error: String(e.error) } : { referents: e.referents || 0, relations: e.relations || 0, gaps: e.gaps || 0 };
    else if (e.type === "round") { cur = { n: Number(e.round) || roundsMap.size + 1, acted: null, checks: [], gate: null, derive: null, observed: false, escalate: null }; roundsMap.set(cur.n, cur); }
    else if (e.type === "acted" && cur) cur.acted = e;
    else if (e.type === "observing" && cur) cur.observed = true;
    else if (e.type === "check" && cur) { const c = { name: String(e.name ?? ""), ok: e.ok === true ? true : e.ok === false ? false : null, detail: e.detail ? String(e.detail) : null }; if (SANDBOX.has(c.name)) cur.checks.push(c); else cur.gate = c; }
    else if (e.type === "derive" && cur) cur.derive = e;
    else if (e.type === "escalate") { v.escalated = { why: e.why || null, reason: e.reason ? String(e.reason) : null }; if (cur) cur.escalate = e; }
    else if (e.type === "repair") v.findings = isArr(e.findings) ? e.findings.map(String) : v.findings;
    else if (e.type === "stopped") v.stopped = true;
    else if (e.type === "error") v.error = String(e.message ?? "the door did not answer");
    else if (e.type === "done") { v.outcome = v.outcome || (e.ok ? "held" : e.exhausted ? "exhausted" : "failed"); if (!e.ok && isArr(e.findings)) v.findings = e.findings.map(String); if (e.ok) v.findings = []; }
    else if (e.type === "audit") {
      const entries = isArr(e.entries) ? e.entries : [];
      const s = e.summary || {};
      v.audit = {
        requests: entries.length, bytes: Number(s.bytes) || entries.reduce((n, x) => n + (Number(x?.bytes) || 0), 0),
        hosts: isArr(s.hosts) ? s.hosts.map((h) => (h && h.host) || String(h)) : [...new Set(entries.map((x) => x?.host).filter(Boolean))],
        leaks: Number(s.leaks) || entries.reduce((n, x) => n + (Number(x?.leaks) || 0), 0),
        disagree: entries.filter((x) => x && x.verified === false).length, verified: entries.filter((x) => x && x.verified === true).length,
        models: [...new Set(entries.map((x) => x?.model).filter(Boolean))],
      };
    }
  }
  const rounds = [...roundsMap.values()];
  v.rounds = rounds.length;
  v.remoteModels = [...new Set(rounds.filter((r) => r.acted && r.acted.lane === "sealed-remote").map((r) => r.acted.model).filter(Boolean))];
  if (!v.outcome) v.outcome = v.stopped ? "stopped" : v.error ? "failed" : "unknown";
  // the round that produced the kept artifact: the LAST one whose answer was a page or a script
  const art = [...rounds].reverse().find((r) => r.acted && (r.acted.kind === "html" || r.acted.kind === "js"));
  if (!art) return finishVerification(v);
  v.artifactRound = art.n; v.kind = art.acted.kind; v.lane = art.acted.lane || null; v.model = art.acted.model || null; v.executed = art.acted.executed === false ? false : (art.acted.executed ?? null);
  v.checks = art.checks; v.gate = art.gate;
  const d = art.derive;
  if (d) {
    if (d.error) v.janus = { state: "unreachable", held: 0, refuted: 0, error: String(d.error) };
    else v.janus = { state: d.ok ? "held" : "refuted", held: Number(d.held) || 0, refuted: Number(d.refuted) || 0, error: null };
  } else v.janus = { state: art.observed ? "not-run" : "none", held: 0, refuted: 0, error: null };
  return finishVerification(v);
}

const SAYS = {
  "loads without errors": "It loaded in a hidden, sandboxed frame without throwing an error",
  "renders something visible": "It rendered something visible once loaded",
  "controls respond": "Its controls were clicked once each and no click threw an error",
};

function finishVerification(v) {
  const ok = (name) => v.checks.find((c) => c.name === name && c.ok === true);
  const L = (c) => (c.detail ? ` (${clip(c.detail, 140)})` : "");
  for (const c of v.checks) {
    if (c.ok === true) v.verified.push((SAYS[c.name] || c.name) + L(c));
    else if (c.ok === false) v.failed.push(`${c.name}${L(c)}`);
    else v.info.push(`${c.name}${L(c)}`);
  }
  if (v.gate) {
    const mine = /behavioral test/i.test(v.gate.name);
    if (v.gate.ok === true) v.verified.push(mine ? "The behavioral test you attached passed" : "penelope's generation gate passed (a check on how the code was written, not a test of this page's behavior)");
    else if (v.gate.ok === false) v.failed.push(`${v.gate.name}${L(v.gate)}`);
  }
  if (v.janus.state === "held") {
    v.verified.push(`janus ruled on the measured facts and found every claim held${v.janus.held ? ` (${v.janus.held} held, none refuted)` : ""}` + (v.requirements.length ? `, including that the page shows what the ask named: ${v.requirements.map((t) => "“" + t + "”").join(", ")}` : ""));
  } else if (v.janus.state === "refuted") v.failed.push(`janus refuted ${plural(v.janus.refuted, "claim")} (${v.janus.held} held)`);
  else if (v.janus.state === "unreachable") v.info.push("janus could not be reached, so the verdict is the measured facts alone: " + clip(v.janus.error, 100));
  else if (v.artifactRound && v.janus.state === "not-run") v.info.push("no janus ruling ran for this artifact");

  // what the checks did NOT cover — stated as plainly as what they did
  if (v.artifactRound == null) {
    v.notVerified.push("There is no page or script among this run's answers, so nothing was run or checked.");
    return v;
  }
  if (v.outcome === "held") { /* the stated verdict is below; held is only what the checks measure */ }
  if (v.outcome === "exhausted") v.notVerified.push(`The run gave up after ${plural(v.rounds, "round")}: this is the LAST attempt, and it still had problems${v.findings.length ? ": " + v.findings.map((f) => clip(f, 140)).join(" · ") : ""}`);
  if (v.outcome === "stopped") v.notVerified.push("The run was stopped before it finished, so the checks may not be complete.");
  if (v.outcome === "failed" && v.error) v.notVerified.push("The run ended on an error: " + clip(v.error, 160));
  if (v.gate && /behavioral test/i.test(v.gate.name)) v.notVerified.push("Beyond your attached test, nothing compared its behavior to what you wanted.");
  else v.notVerified.push("Whether it actually does what you meant. No test of its behavior was attached; the checks above only measure that it loads, draws, and survives being clicked — nothing (neither a person nor a model) judged its logic or its results.");
  const clicked = v.checks.find((c) => c.name === "controls respond");
  if (clicked && clicked.ok === true && /clicked \d+; 0 changed/.test(clicked.detail || "")) v.notVerified.push("None of the clicks visibly changed the page, so whether the controls do anything is unconfirmed.");
  v.notVerified.push("Only the first 12 controls were clicked, once each, in a hidden 900×640 frame over a few seconds: typing into fields, keyboard use, repeated use, timers running to completion and later states were not exercised.");
  v.notVerified.push("Appearance, layout on a phone, accessibility and browser differences were not checked.");
  if (!ok("loads without errors") && v.checks.length) v.notVerified.push("It did not pass the load check, so nothing after loading was established.");
  if (v.executed === false) v.notVerified.push("The code was composed, not executed by the generator; the only execution was the fold's own sandbox run described above.");
  return v;
}

/* ───────────────────────── the explanation ───────────────────────── */

const sec = (id, heading, lines, tone) => ({ id, heading, lines: lines.filter((l) => l != null && l !== ""), ...(tone ? { tone } : {}) });
const LANE_LOCAL = Object.freeze({ model: null, leavesMachine: false, label: "Explained from the stored record, on this device — no model, nothing sent anywhere." });

function sectionsForArtifact(o, v) {
  const out = [];
  out.push(sec("what", "What it is", [o.summary, ...(o.headings.length ? ["Headings: " + o.headings.map((h) => "“" + h.text + "”").join(", ")] : []),
    o.kind === "js" && !o.touchesPage ? "It never touches the page (no document or window access), so running it would show nothing on screen." : null]));
  const use = [];
  if (o.controls.length) use.push("Controls: " + o.controls.map((c) => "“" + c.label + "”" + (c.tag === "a" ? " (link)" : "")).join(", "));
  if (o.inputs.length) use.push("Inputs: " + o.inputs.map((x) => `${x.label} (${x.type})`).join(", "));
  if (o.features.some((f) => f.label === "keyboard input")) use.push("It also listens for keyboard input.");
  if (o.features.some((f) => f.label === "mouse/touch/pointer input")) use.push("It also listens for mouse, touch or pointer input.");
  if (!use.length) use.push(o.kind === "html" ? "No buttons, links or input fields were found in the markup; it may be display-only, or build its interface with script." : "No interface was found.");
  out.push(sec("use", "How to use it", use));
  const built = [];
  if (o.handlers.length) built.push("Reacts to: " + o.handlers.slice(0, 12).map((h) => `${h.event} on ${h.target} → ${h.fn || "(inline function)"}`).join("; ") + (o.handlers.length > 12 ? `; +${o.handlers.length - 12} more` : ""));
  if (o.functions.length) built.push("Functions: " + o.functions.slice(0, 20).join(", ") + (o.functions.length > 20 ? `, +${o.functions.length - 20} more` : ""));
  if (o.features.length) built.push("Uses: " + o.features.map((f) => f.label).join(", "));
  const s = o.sizes; built.push(`Size: ${bytes(s.total)}${s.markup && o.kind === "html" ? ` · markup ${bytes(s.markup)}` : ""}${s.css ? ` · CSS ${bytes(s.css)}` : ""}${s.js ? ` · script ${bytes(s.js)}` : ""}`);
  out.push(sec("built", "How it is built", built));
  const remote = o.external.filter((e) => e.remote), local = o.external.filter((e) => !e.remote);
  const ex = [];
  if (remote.length) ex.push("Reaches the network: " + remote.slice(0, 8).map((e) => `${e.via} ${clip(e.url, 80)}`).join("; ") + (remote.length > 8 ? `; +${remote.length - 8} more` : ""));
  if (local.length) ex.push("Refers to files it does not carry (they will not resolve in the preview): " + local.slice(0, 6).map((e) => `${e.via} ${clip(e.url, 60)}`).join("; "));
  if (!ex.length) ex.push("It refers to nothing outside itself — no network address, no outside file.");
  if (o.features.some((f) => f.label.startsWith("dynamic code"))) ex.push("It builds code at run time (eval / new Function / document.write), which this outline cannot see into.");
  out.push(sec("external", "What it reaches for", ex, remote.length || o.features.some((f) => f.label.startsWith("dynamic")) ? "warn" : null));
  if (o.notes.length) out.push(sec("notes", "About this outline", o.notes, "warn"));

  if (v.hasTrace) {
    if (v.verified.length) out.push(sec("verified", "What the run verified", v.verified, "ok"));
    if (v.failed.length) out.push(sec("failed", "What failed", v.failed, "bad"));
    if (v.info.length) out.push(sec("info", "Noted, not a pass or a fail", v.info));
  }
  out.push(sec("not", "What was NOT verified", v.notVerified, "warn"));
  const left = [];
  if (v.audit) left.push(`${plural(v.audit.requests, "request")} left this machine during the run${v.audit.hosts.length ? " (" + v.audit.hosts.join(", ") + ")" : ""}, ${bytes(v.audit.bytes)} in all; ${v.audit.leaks ? v.audit.leaks + " flagged as a leak" : "no leaks flagged"}${v.audit.disagree ? `; heimdall's own ledger DISAGREED on ${v.audit.disagree}` : ""}.`);
  if (v.escalated) left.push(`The run went to a sealed remote model (${v.escalated.why || "escalated"}${v.escalated.reason ? ": " + clip(v.escalated.reason, 100) : ""})${v.remoteModels.length ? " — " + v.remoteModels.join(", ") : ""}; only the task text and the last attempt's code were sent, through heimdall's sealed-external gate.`);
  if (left.length) out.push(sec("left", "What left this machine to make it", left, v.escalated ? "warn" : null));
  return out;
}

function headlineForArtifact(o, v) {
  if (!v.hasTrace) return "No run record is stored for this artifact. Below is what the code itself shows; nothing can be said about how it was checked.";
  const n = plural(v.rounds, "round");
  if (v.outcome === "held") return `The run says it holds up under its checks (${n}) — and only those checks; see what was not verified.`;
  if (v.outcome === "exhausted") return `This is the last attempt of a run that did NOT pass its own checks after ${n}.`;
  if (v.outcome === "stopped") return "The run was stopped before it finished; this is what it had produced.";
  if (v.outcome === "failed") return "The run ended on an error; this is the last artifact it had produced.";
  return "The run's outcome is not recorded.";
}

/** The messages of an assistant turn as an index → the stored record, safely. */
function turnAt(messages, index) {
  const m = isArr(messages) && Number.isInteger(index) && index >= 0 ? messages[index] : null;
  return m && typeof m === "object" ? m : null;
}
const isAgentTurn = (m) => m.mode === "agent" || m.mode === "code" || !!m.grounding?.code;

/** Which artifacts the message carries, as the surface would draw them. */
function artifactsIn(content) {
  try { return artifactsOf(String(content ?? "")).filter((b) => b.kind === "artifact" && b.artifact).map((b) => b.artifact); } catch { return []; }
}

/**
 * Decide what "explain this" does for the message at `index`, and do it — from
 * the stored record alone. Returns a plan the surface only has to show:
 *   { strategy, headline, sections:[{id,heading,lines,tone?}], lane, ask,
 *     deeper:{available,label,model,reason}|null, outline?, verification? }
 * `models` (the bridge's list) is only used to say whether the optional model
 * step is available; nothing is called here.
 */
export function planExplain({ messages, index, models = [] } = {}) {
  const m = turnAt(messages, index);
  if (!m) return nothing("There is no message at that position, so there is nothing to explain.");
  if (m.role !== "assistant") return nothing("This is your own message — there is nothing to explain in it. (To run the ask again, use “run as chat / agent”.)");
  const g = m.grounding && typeof m.grounding === "object" ? m.grounding : null;
  const content = String(m.content ?? "");
  const askFrom = () => { for (let i = index - 1; i >= 0; i--) { const u = messages[i]; if (u?.role === "user" && u.content && !u.converted) return String(u.content); } return null; };

  if (isAgentTurn(m)) {
    const ev = isArr(g?.events) ? g.events : [];
    const v = verificationOf(ev, { outcome: g?.outcome || null });
    const ask = v.task || askFrom();
    const arts = artifactsIn(content);
    const art = arts.find((a) => a.kind === "html") || arts.find((a) => a.kind === "code") || arts[0] || null;
    if (!art || !art.code.trim()) {
      const lines = [];
      if (v.hasTrace) {
        lines.push(`The run ${v.outcome === "stopped" ? "was stopped" : v.outcome === "failed" ? "ended on an error" : v.outcome === "exhausted" ? "gave up" : "ended"} after ${plural(v.rounds, "round")} with no page or script to keep.`);
        if (v.error) lines.push("Error: " + clip(v.error, 200));
        if (v.findings.length) lines.push("What it last found wrong: " + v.findings.map((f) => clip(f, 140)).join(" · "));
      } else {
        const note = isArr(m.notices) ? m.notices.find((x) => x?.text) : null;
        lines.push(note?.text ? "The fold's note on this turn: " + clip(note.text, 200) : "This agent turn carries no code and no run record.");
      }
      lines.push("Nothing was re-run to produce this — to try again, use “run as agent” on your message or Try again on the run.");
      return { strategy: "agent-no-artifact", headline: "There is no artifact here, so there is nothing to explain — only what happened.", sections: [sec("what", "What happened", lines, "warn")], lane: LANE_LOCAL, ask, deeper: null, verification: v };
    }
    const outline = outlineOf(art.code, { kind: art.kind === "html" ? "html" : /^(js|javascript|ts|tsx|jsx)$/.test(art.lang) ? "js" : art.kind === "code" ? "js" : "text" });
    if (art.kind === "code" && !/^(js|javascript|ts|tsx|jsx)$/.test(art.lang)) outline.notes.push(`this is ${art.lang || "code"}, not JavaScript — only its size is outlined mechanically`);
    const sections = sectionsForArtifact(outline, v);
    if (ask) sections.unshift(sec("ask", "What was asked", [clip(ask, 300)]));
    if (arts.length > 1) sections.push(sec("more", "More in this message", [`${arts.length - 1} further artifact(s) were not outlined: ${arts.slice(1).map((a) => a.title).join(", ")}`], "info"));
    return {
      strategy: "artifact-outline", headline: headlineForArtifact(outline, v), sections, lane: LANE_LOCAL, ask,
      deeper: deeperAvailability(models, { codeChars: art.code.length }), outline, verification: v,
      artifact: { kind: art.kind, lang: art.lang, title: art.title, chars: art.code.length },
      code: art.code,                  // handed to deeperRequest() only if the person asks to go deeper
    };
  }

  if (g && g.generate) return generationPlan(g, content, m);
  if (g && !g.code) return answerPlan(g, content, m);
  if (!content.trim()) return nothing("This message is empty, so there is nothing to explain.", m);
  return nothing("This message carries no process record (an older turn, or one with nothing checked), so there is nothing to explain beyond what it says. Nothing was re-run.", m);
}

function nothing(reason, m = null) {
  const notes = isArr(m?.notices) ? m.notices.filter((n) => n?.text).map((n) => "The fold's note: " + clip(n.text, 200)) : [];
  return { strategy: "nothing", headline: "Nothing to explain.", sections: [sec("why", "Why", [reason, ...notes])], lane: LANE_LOCAL, ask: null, deeper: null, refusal: { reason } };
}

function answerPlan(g, content, m) {
  const notices = isArr(m.notices) ? m.notices.filter((n) => n && n.text) : [];
  if (!content.trim()) {
    const v = normVoid(g.void);
    const lines = notices.map((n) => `${n.kind === "refusal" ? "The model declined" : "Note"}: ${clip(n.text, 240)}`);
    if (v) lines.push("The gap: " + voidLabel(v));
    if (!lines.length) lines.push("The turn produced no text.");
    return { strategy: "nothing", headline: "There is no answer to explain — only why there is none.", sections: [sec("why", "Why there is no answer", lines, "warn")], lane: LANE_LOCAL, ask: null, deeper: null, refusal: { reason: "empty answer" } };
  }
  const facing = g.facing && typeof g.facing === "object" ? g.facing : { sources: [], response: [] };
  const sources = isArr(facing.sources) ? facing.sources : [];
  const response = isArr(facing.response) ? facing.response : [];
  const total = response.length || g.coverage?.total || 0;
  const grounded = response.length ? response.filter((r) => r && r.grounded).length : g.coverage?.grounded || 0;
  const own = response.filter((r) => r && !r.grounded && r.text);
  const out = [];
  const kindLine = g.creative ? "A creative request: the fold searched and kept the sources, but checked no claims." : g.kind === "research" ? "A question of fact: sources were searched and read before anything was written." : g.kind === "generate" ? "A writing request: written from the sources it read." : "An ordinary turn.";
  out.push(sec("kind", "What kind of turn", [kindLine, g.effort ? "Effort: " + g.effort : null]));
  const src = [];
  if (!g.hasMaterial) src.push("No source material was carried into this turn, so no sentence could be checked: the answer stands on the model alone.");
  else {
    src.push(`${plural(sources.length, "source passage")} ${sources.length === 1 ? "backs" : "back"} ${grounded} of its ${plural(total, "sentence")}.`);
    for (const s of sources.slice(0, 8)) src.push({ text: `${s.n || "S"} · ${s.domain || s.label || "source"}${s.cite > 1 ? ` · cited ${s.cite}×` : ""}${s.text ? " — “" + clip(s.text, 110) + "”" : ""}`, href: s.url && /^https?:\/\//i.test(s.url) ? s.url : null });
  }
  out.push(sec("sources", "Where it came from", src));
  const sent = [];
  if (g.hasMaterial && total) {
    sent.push(`${grounded} of ${total} sentence${total === 1 ? "" : "s"} trace to a source passage; ${own.length} ${own.length === 1 ? "is" : "are"} the model's own wording with no source behind ${own.length === 1 ? "it" : "them"}.`);
    for (const r of own.slice(0, 6)) sent.push("Own wording: “" + clip(r.text, 140) + "”");
    if (own.length > 6) sent.push(`+${own.length - 6} more`);
  }
  if (g.falsify) {
    const f = g.falsify;
    sent.push(`The adversarial re-check: ${f.supported} firmly supported · ${f.weak} on a weak anchor · ${f.unsupported} unsupported.`);
    for (const e of (isArr(f.entries) ? f.entries : []).filter((x) => x.verdict === "weak").slice(0, 4)) sent.push("Weakly anchored: “" + clip(e.text, 120) + "”");
  }
  const un = g.unsupported || {};
  if ((un.numbers || []).length || (un.names || []).length) sent.push("Not found in any source: " + [...(un.numbers || []).map((x) => String(x)), ...(un.names || []).map((x) => String(x))].slice(0, 12).join(", "));
  out.push(sec("sentences", "Sentence by sentence", sent, own.length || (un.numbers || []).length || (un.names || []).length ? "warn" : "ok"));
  const v = normVoid(g.void);
  if (v) out.push(sec("void", "What it could not establish", [voidLabel(v), v.question ? "Still open: “" + v.question + "”" : null, ...(isArr(v.closeBy) && v.closeBy.length ? ["To close it: " + v.closeBy.join(", or ")] : [])], "warn"));
  const web = isArr(g.web) ? g.web : [];
  const reads = web.filter((w) => w && w.read), failed = web.filter((w) => w && w.ok === false);
  const how = isArr(g.process) ? g.process.map((p) => String(p)) : [];
  if (web.length) how.push(`${plural(reads.length, "page")} read${failed.length ? `; ${plural(failed.length, "search/read")} failed` : ""}`);
  if (how.length) out.push(sec("how", "How it was made", how));
  const lim = ["“Traces to a source” means a run of this sentence's words was found in a passage the fold read. That is word overlap, not proof the claim is true, and not proof the source is right."];
  if (g.effort === "fast") lim.push("Fast effort skips the gap check, so a missing-source gap would not have been reported.");
  else if (g.effort !== "deep") lim.push("The adversarial re-check runs only at deep effort.");
  if (g.creative) lim.push("This was a creative turn: nothing in it was checked.");
  out.push(sec("not", "What this does not tell you", lim, "warn"));
  const arts = artifactsIn(content).filter((a) => a.kind === "html" || a.kind === "code");
  const plan = { strategy: "answer-record", headline: g.hasMaterial ? `${grounded} of ${total} sentences are tied to a source the fold read; the rest are the model's own words.` : "This answer is not tied to any source.", sections: out, lane: LANE_LOCAL, ask: null, deeper: null };
  if (arts.length) plan.sections.push(sec("code", "It also contains code", [`${arts[0].title}: ${outlineOf(arts[0].code, { kind: arts[0].kind === "html" ? "html" : "js" }).summary}`, "The grounding above covers the prose, not whether the code works."], "info"));
  return plan;
}

function generationPlan(g, content, m) {
  const lines = [];
  if (g.void) lines.push("Void it detected: " + clip(typeof g.void === "string" ? g.void : `${g.void.kind || "gap"} — ${g.void.reason || ""}`, 200));
  if (isArr(g.units) && g.units.length) lines.push(`Written one unit at a time (${g.units.length}): ` + g.units.slice(0, 8).map((u) => clip(u, 60)).join(" · "));
  if (g.stages && typeof g.stages === "object") lines.push("Stages: " + Object.entries(g.stages).map(([k, x]) => `${k}:${x}`).join(" · "));
  if (g.verdict) lines.push("Verdict: " + clip(g.verdict, 160));
  if (!lines.length) lines.push("The generation record is empty.");
  return { strategy: "generation-record", headline: "How this was written, from its generation record.", sections: [sec("how", "How it was written", lines), sec("not", "What this does not tell you", ["The record says how the text was assembled, not that its claims are true."], "warn")], lane: LANE_LOCAL, ask: null, deeper: null };
}

/* ───────────────────────── the optional model step ───────────────────────── */

/** Pick a model for the optional prose step. Never a coder, never an embedder,
 *  never a sealed/outside model unless the caller says so, and only a model on
 *  this device unless the caller allows a linked host. */
export function pickExplainModel(models, { allowFleet = false, allowSealed = false } = {}) {
  const list = (isArr(models) ? models : []).filter((m) => m && m.id && isChatModel(m) && !isEmbedModel(m));
  const tier = (m) => (m.sealed ? "frontier" : m.tier || tierOf(m));
  const order = ["local", ...(allowFleet ? ["fleet"] : []), ...(allowSealed ? ["remote", "frontier"] : [])];
  for (const t of order) { const hit = list.find((m) => tier(m) === t && (allowSealed || !m.sealed)); if (hit) return { model: hit, tier: t, leavesMachine: t !== "local" }; }
  return null;
}

function deeperAvailability(models, { codeChars = 0 } = {}) {
  const pick = pickExplainModel(models);
  const sends = `${bytes(Math.min(codeChars, MAX_DEEP_CODE))} of the code${codeChars > MAX_DEEP_CODE ? ` (the first ${bytes(MAX_DEEP_CODE)} of ${bytes(codeChars)})` : ""}`;
  if (!pick) return { available: false, model: null, label: "Go deeper", reason: "No general-purpose model is running on this device (only a code, embedding or outside model is listed), so the outline above is all there is. Code is never sent to an outside model for this.", sends };
  return { available: true, model: pick.model.id, label: `Go deeper — ${pick.model.id}, on this device`, reason: null, sends: `${sends} to ${pick.model.id} on this device; nothing leaves the machine` };
}

const DEEP_SYSTEM = "You explain a small program to someone who did not write it. You are given the program and the facts that were MEASURED about it. Use only those. Say what it does, how a person uses it, and how it is put together, in plain English under 180 words. Do not say it works unless the facts say what was checked. If something is unclear from the code, say so instead of guessing.";

/**
 * The request for the optional model step — built, not sent. The caller must
 * send it with client.chat (so the audit hook sees every byte) and label the
 * result as the model's reading. `ok:false` says why not; nothing is ever
 * silently redirected to another model.
 *   chat(req.model, req.messages, { base, privacy: req.privacy, audit: req.audit, ... })
 */
export function deeperRequest({ models, code, plan = null, allowFleet = false, allowSealed = false, run = null } = {}) {
  const text = String(code ?? "");
  if (!text.trim()) return { ok: false, reason: "There is no code to explain." };
  const pick = pickExplainModel(models, { allowFleet, allowSealed });
  if (!pick) return { ok: false, reason: "No suitable model: a general-purpose model on this device is required (never a code model, and no outside model unless explicitly allowed)." };
  const o = plan?.outline || outlineOf(text);
  const v = plan?.verification || null;
  const shown = text.length > MAX_DEEP_CODE ? text.slice(0, MAX_DEEP_CODE) + "\n/* … truncated … */" : text;
  const facts = [
    "Measured facts:",
    "- " + o.summary,
    ...(v?.verified?.length ? v.verified.map((x) => "- verified: " + x) : ["- nothing about its behavior was verified"]),
    ...(v?.failed?.length ? v.failed.map((x) => "- FAILED: " + x) : []),
  ].join("\n");
  const parts = [
    { role: "system", content: DEEP_SYSTEM, provenance: "template" },
    { role: "user", content: facts + "\n\nThe program:\n```\n" + shown + "\n```\n\nExplain it.", provenance: "generated" },
  ];
  return {
    ok: true, model: pick.model.id, tier: pick.tier, leavesMachine: pick.leavesMachine, privacy: "sealed-external",
    messages: parts.map(({ role, content }) => ({ role, content })),
    audit: { segments: parts.map((p) => ({ role: p.role, chars: p.content.length, provenance: p.provenance })), purpose: "explain artifact", run },
    truncated: text.length > MAX_DEEP_CODE, temperature: 0.2, maxTokens: 500,
    label: `A reading by ${pick.model.id}${pick.leavesMachine ? " (NOT on this device)" : " (on this device)"} — a model's reading of the code, not a verified fact`,
  };
}

/* ───────────────────────── rendering (strings only) ───────────────────────── */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** The plan as plain text — for copying. */
export function toText(plan) {
  const out = [plan.headline || ""];
  for (const s of plan.sections || []) { out.push("", s.heading.toUpperCase()); for (const l of s.lines) out.push("- " + (typeof l === "string" ? l : l.text)); }
  out.push("", plan.lane?.label || "");
  return out.join("\n").trim();
}

/**
 * The plan as an HTML string, EVERY value escaped (the code and the stored
 * record are untrusted). Reuses the disclosure block's own classes so it needs
 * no new CSS. Links are emitted only for http(s) urls.
 */
export function toHtml(plan) {
  const rows = [`<div class="disc-text"><strong>${esc(plan.headline)}</strong></div>`];
  for (const s of plan.sections || []) {
    rows.push(`<div class="disc-label" data-tone="${esc(s.tone || "")}">${esc(s.heading)}</div>`);
    rows.push('<div class="disc-ungrounded">' + s.lines.map((l) => {
      if (typeof l === "string") return `<div class="disc-text">${esc(l)}</div>`;
      return `<div class="disc-text">${l.href && /^https?:\/\//i.test(l.href) ? `<a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.text)}</a>` : esc(l.text)}</div>`;
    }).join("") + "</div>");
  }
  rows.push(`<div class="disc-foot">${esc(plan.lane?.label || "")}</div>`);
  return `<div class="disclosure open explain-card" data-strategy="${esc(plan.strategy)}"><div class="disc-panel">${rows.join("")}</div></div>`;
}
