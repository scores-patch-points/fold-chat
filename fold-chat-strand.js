// fold-chat-strand.js — SOURCES ONLY: the answer is the sources' own words, strung together.
// Pure: no DOM, no IO, no model. NO MODEL CALL IS MADE FOR A STRAND.
//
// The rule behind both answer modes: the model never speaks alone. In "Facing page" mode the model's
// response is drawn FROM snipped sources; in "Sources only" mode there is no model at all — the reply is
// the passages the read pages gave, VERBATIM, each with its citation, credit and link:
//
//   1. a structured block the PAGE declares, in order of preference:
//        a recipe (fold-chat-snip.js `snipOfPassage`), a HowTo, an FAQPage, a QAPage's acceptedAnswer
//        (all schema.org JSON-LD: `declaredBlocksFromHtml`), a Wikipedia article's LEAD;
//   2. otherwise the sentences `impressionOf` (fold-chat-impression.js) already picks as differing the
//      ask — adjacent sentences merged into one passage, an ellipsis wherever text was skipped.
//   3. strung together in source-rank order (the order the passages were read), de-duplicated.
//
// EVERY SNIP IS VERIFIABLE: `verifySnip` checks that a snip's words occur in the page text it came from
// (whitespace-normalised, never reworded). A snip that does not verify is a bug and is DROPPED, never
// shown (`snipsOf` returns it in `dropped`). The only words on screen that are not the sources' are the
// app-authored labels ("from <site>") and typed gap notes.
//
// DECLARED, NOT MEASURED (Constitution II.11 — each with its giver): the per-passage and total character
// budgets below are declared defaults (a screenful per source, a few screenfuls in all); the merge gap is
// "a sentence boundary": two kept sentences are one passage only when nothing but whitespace lies between.

import { impressionOf, sentencesWithOffsets } from "./fold-chat-impression.js";
import { snipOfPassage } from "./fold-chat-snip.js";

export const STRAND = Object.freeze({
  perPassageChars: 700,    // how much of one source a strand quotes (impression budget)
  totalChars: 3600,        // all of it, so a stored turn stays small
  maxPassages: 5,          // sources quoted
  maxItems: 12,            // Q&A pairs / how-to steps quoted from one declared block
  leadChars: 600,          // a Wikipedia lead
});

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const host = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
const isWiki = (u) => /^https?:\/\/[a-z-]+\.wikipedia\.org\/wiki\//i.test(String(u || ""));
const titleOf = (p) => { const r = String(p?.ref ?? ""); return (r.includes(" — ") ? r.slice(r.indexOf(" — ") + 3) : r).trim(); };
const siteOf = (p) => { const r = String(p?.ref ?? ""); const s = r.includes(" — ") ? r.slice(0, r.indexOf(" — ")) : ""; return host(p?.url || p?.source) || s; };

// ── structured blocks a page declares (JSON-LD) ────────────────────────────
const cleanHtml = (v) => String(v ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/\s+/g, " ").trim();
const typesOf = (n) => [].concat(n?.["@type"] || []).map((t) => String(t).replace(/^.*\//, ""));
const nameOf = (v) => [].concat(v || []).map((x) => (typeof x === "string" ? cleanHtml(x) : x && x.name ? cleanHtml(x.name) : "")).filter(Boolean).join(", ");
const stepsOf = (v) => [].concat(v || []).flatMap((x) => (typeof x === "string" ? [cleanHtml(x)] : x && x.itemListElement ? stepsOf(x.itemListElement) : x && (x.text || x.name) ? [cleanHtml(x.text || x.name)] : [])).filter(Boolean);

/** The HowTo / FAQPage / QAPage blocks a page declares in JSON-LD (a Recipe is read by fold-chat-web.js
 *  `recipeDataFromHtml`). Returns [{ kind:'howto'|'faq'|'qa', name, author, items:[string] }] — `items` are the
 *  page's own strings, each a unit that can be quoted whole (a step; "Q? — A"). Pure; never throws. */
export function declaredBlocksFromHtml(raw) {
  const html = String(raw ?? "");
  if (!/ld\+json/i.test(html)) return [];
  const out = [];
  const walk = (n) => {
    if (Array.isArray(n)) { for (const x of n) walk(x); return; }
    if (!n || typeof n !== "object") return;
    const types = typesOf(n);
    if (types.includes("HowTo")) {
      const items = stepsOf(n.step);
      if (items.length) out.push({ kind: "howto", name: cleanHtml(n.name), author: nameOf(n.author), items: items.slice(0, STRAND.maxItems) });
    }
    if (types.includes("FAQPage")) {
      const items = [].concat(n.mainEntity || []).map((q) => {
        const a = q?.acceptedAnswer?.text ?? [].concat(q?.acceptedAnswer || [])[0]?.text;
        const qq = cleanHtml(q?.name), aa = cleanHtml(a);
        return qq && aa ? `${qq} — ${aa}` : "";
      }).filter(Boolean);
      if (items.length) out.push({ kind: "faq", name: cleanHtml(n.name), author: nameOf(n.author), items: items.slice(0, STRAND.maxItems) });
    }
    if (types.includes("QAPage")) {
      const q = n.mainEntity && typeof n.mainEntity === "object" ? [].concat(n.mainEntity)[0] : null;
      const acc = q && ([].concat(q.acceptedAnswer || [])[0] || null);
      const qq = cleanHtml(q?.name), aa = cleanHtml(acc?.text);
      if (qq && aa) out.push({ kind: "qa", name: qq, author: nameOf(acc?.author) || nameOf(n.author), items: [aa] });
    }
    if (n["@graph"]) walk(n["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    walk(j);
  }
  return out.slice(0, 4);
}

// ── building snips ─────────────────────────────────────────────────────────
function recipeText(r) {
  return [r.title, [...(r.ingredients || [])].join("\n"), [...(r.steps || [])].map((x, i) => `${i + 1}. ${x}`).join("\n")].filter(Boolean).join("\n");
}

function snipFrom(p, pi, base) {
  return {
    n: "S" + (pi + 1), p: pi,
    source: p.url || p.source || null, title: titleOf(p), site: siteOf(p),
    shadow: p.shadow ? { hash: p.shadow.hash || null, chars: p.shadow.chars || null } : null,
    ellipsisBefore: false, ellipsisAfter: false, range: null,
    ...base,
  };
}

/** Passage-text groups: the sentences impressionOf keeps, with adjacent ones merged (nothing but whitespace
 *  between them) and the ellipsis flags set where text was skipped. Ranges are in `text` coordinates. */
function groupsOf(text, question, budget) {
  const t = String(text ?? "");
  if (!t.trim()) return [];
  const whole = t.trim().length <= budget;
  const imp = whole ? { shadow: { segments: [{ start: 0, end: t.length }] } } : impressionOf(t, question, { budget, lead: true });
  const segs = (imp.shadow?.segments || []).filter((g) => g.end > g.start).sort((a, b) => a.start - b.start);
  const groups = [];
  for (const g of segs) {
    const last = groups[groups.length - 1];
    if (last && /^\s*$/.test(t.slice(last.end, g.start))) last.end = g.end;
    else groups.push({ start: g.start, end: g.end });
  }
  const trimmed = t.trimEnd().length;
  return groups.map((g) => {
    const lead = t.slice(g.start, g.end).search(/\S/);
    const start = g.start + Math.max(0, lead);
    return { start, end: g.end, ellipsisBefore: start > t.search(/\S/), ellipsisAfter: g.end < trimmed };
  }).filter((g) => t.slice(g.start, g.end).trim());
}

/** The leading sentences of a text (a Wikipedia lead), up to `chars`. Ranges in `text` coordinates. */
function leadOf(text, chars) {
  const t = String(text ?? "");
  const sents = sentencesWithOffsets(t);
  if (!sents.length) return null;
  let end = sents[0].end;
  for (let i = 1; i < sents.length; i++) {
    if (sents[i].end - sents[0].start > chars || !/^\s*$/.test(t.slice(end, sents[i].start))) break;
    end = sents[i].end;
  }
  return { start: sents[0].start, end, ellipsisBefore: false, ellipsisAfter: end < t.trimEnd().length };
}

/** The strand of a turn: snips drawn VERBATIM from the passages, in source-rank order, de-duplicated.
 *  Returns { snips, dropped } — `dropped` are candidates that failed `verifySnip` (a bug, never shown). */
export function snipsOf(passages, question, { limits = STRAND } = {}) {
  const list = (Array.isArray(passages) ? passages : []).slice(0, limits.maxPassages);
  const snips = [], dropped = [], seen = [];
  let chars = 0;
  const add = (p, pi, s) => {
    if (!verifySnip(s, p)) { dropped.push(s); return; }
    const key = norm(s.text).toLowerCase();
    if (!key || seen.some((k) => k === key || k.includes(key) || key.includes(k))) return;
    if (snips.length && chars + s.text.length > limits.totalChars) return;
    seen.push(key); chars += s.text.length; snips.push(s);
  };
  list.forEach((p, pi) => {
    const text = String(p?.text ?? "");
    // 1. a structured block the page declares
    const rc = snipOfPassage(p);
    if (rc) {
      add(p, pi, snipFrom(p, pi, { kind: "recipe", text: recipeText(rc), credit: rc.credit.author || rc.credit.publisher || rc.credit.site || siteOf(p), title: rc.title || titleOf(p), card: rc }));
      return;
    }
    const block = (Array.isArray(p?.declared) ? p.declared : [])[0];
    if (block) {
      const body = block.kind === "howto" ? block.items.map((x, i) => `${i + 1}. ${x}`).join("\n") : block.items.join("\n");
      add(p, pi, snipFrom(p, pi, { kind: block.kind, text: (block.name && block.kind === "howto" ? block.name + "\n" : "") + body, credit: block.author || siteOf(p), title: block.name || titleOf(p), items: block.items, name: block.name || "" }));
      return;
    }
    // 2. a Wikipedia lead
    if (isWiki(p?.url || p?.source) && text.trim()) {
      const g = leadOf(text, limits.leadChars);
      if (g) { add(p, pi, snipFrom(p, pi, { kind: "lead", text: norm(text.slice(g.start, g.end)), credit: siteOf(p), range: { start: g.start, end: g.end }, ellipsisBefore: g.ellipsisBefore, ellipsisAfter: g.ellipsisAfter })); return; }
    }
    // 3. the sentences that differ the ask, adjacent ones merged
    for (const g of groupsOf(text, question, limits.perPassageChars)) {
      add(p, pi, snipFrom(p, pi, { kind: "passage", text: norm(text.slice(g.start, g.end)), credit: siteOf(p), range: { start: g.start, end: g.end }, ellipsisBefore: g.ellipsisBefore, ellipsisAfter: g.ellipsisAfter }));
    }
  });
  return { snips, dropped };
}

/** The plain concatenation of the verbatim snip text — what `message.content` holds for a sources-only turn
 *  (the sources' words, not the model's; later turns and the conversation fold read it). */
export function strandText(snips) {
  return (Array.isArray(snips) ? snips : []).map((s) => String(s?.text ?? "")).filter(Boolean).join("\n\n");
}

/** Does a snip's text occur in the page text it came from? Whitespace-normalised, case-exact, never reworded.
 *  A structured snip checks each of its own units against the block the page declared (or the passage text). */
export function verifySnip(snip, passage) {
  if (!snip || !passage) return false;
  const hay = norm(passage.text);
  const has = (x) => { const n = norm(x); return !!n && hay.includes(n); };
  if (snip.kind === "recipe") {
    const r = passage.recipe; if (!r) return false;
    const c = snip.card || {};
    const own = new Set([...(r.ingredients || []), ...(r.steps || [])].map(norm));
    const items = [...(c.ingredients || []), ...(c.steps || [])];
    return items.length > 0 && items.every((x) => own.has(norm(x)) || has(x));
  }
  if (snip.kind === "howto" || snip.kind === "faq" || snip.kind === "qa") {
    const blocks = Array.isArray(passage.declared) ? passage.declared : [];
    const own = new Set(blocks.flatMap((b) => b.items || []).map(norm));
    const items = snip.items || [];
    return items.length > 0 && items.every((x) => own.has(norm(x)) || has(x));
  }
  return has(snip.text);
}

/** Check every stored snip against the passages it claims to come from (`snip.p` indexes the passages).
 *  { ok, bad:[snip…] } — a snip that does not verify is a bug. */
export function verifySnips(snips, passages) {
  const bad = (Array.isArray(snips) ? snips : []).filter((s) => !verifySnip(s, (passages || [])[s.p]));
  return { ok: bad.length === 0, bad };
}

/** The credit line under a snip: "from en.wikipedia.org" — app-authored, never the model's. */
export function creditText(s) {
  if (!s) return "";
  const who = s.credit && s.credit !== s.site ? s.credit : "";
  return who ? `${who} · ${s.site || "source"}` : `from ${s.site || s.title || "the source"}`;
}

// ── the stored shape ───────────────────────────────────────────────────────
/** A snip as stored on the message: plain data, small. (The recipe card is kept whole — it is the card's own data.) */
export function storeSnip(s) {
  const { n, p, kind, text, source, title, site, credit, range, shadow, ellipsisBefore, ellipsisAfter, card, items, name } = s;
  return { n, p, kind, text, source, title, site, credit, range, shadow, ellipsisBefore, ellipsisAfter, ...(card ? { card } : {}), ...(items ? { items } : {}), ...(name ? { name } : {}) };
}

/** May this STORED assistant message carry model-written (non-notice) content? The invariant: only when the turn
 *  had at least one source, or its kind is one the model may answer alone (ALONE_KINDS), or it is sources-authored
 *  (then its content must be backed by snips). Messages that predate the rule (no `nSources` on the record) and
 *  the agent lane are out of scope. */
export function contentAllowed(msg, aloneKinds = []) {
  if (!msg || msg.role !== "assistant") return true;
  if (!String(msg.content ?? "").trim()) return true;
  if (msg.mode === "agent") return true;
  if (msg.authored === "sources") return Array.isArray(msg.snips) && msg.snips.length > 0 && strandText(msg.snips).replace(/\s+/g, " ").trim() === String(msg.content).replace(/\s+/g, " ").trim();
  const rec = msg.grounding;
  if (!rec || rec.generate || rec.code) return true;
  if (typeof rec.nSources !== "number") return true;
  return rec.nSources > 0 || aloneKinds.includes(rec.kind);
}
