// pipeline.mjs — SNIP-FIRST, NO MODEL. search -> gate -> read -> candidate snips by rung -> strand (+ typed gaps).
//   node eval/snips/pipeline.mjs [--ids a,b] [--classes recipe,code] [--limit N] [--force] [--no-fallback] [--no-gate]
// Writes data/out/<id>.json (everything the judge needs) and data/pages/<hash>.txt (the page text the offsets address).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { searchWeb, EFFORT, readText, applyGate, entitiesOf, recipeDataFromHtml } from "./app/fold-chat-web.js";
import { impressionOf, sentencesWithOffsets } from "./app/fold-chat-impression.js";
import { emptyReferents, admitReferents, resolveQuestion, searchQueries } from "./app/fold-chat-mind.js";
import { parseBrave, parseDdg } from "./app/fold-chat-engines.js";
import { get, makeFetch, closeNet, STATS, FOLD_RELAY } from "./lib/net.mjs";
import { tokens, coverage, relevant, gnorm, squash, visibleNorm, decodeEntities } from "./lib/text.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "data", "out"), PAGES = path.join(here, "data", "pages");
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(PAGES, { recursive: true });
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf("--" + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);

// declared pipeline constants (PREREG: declared, not measured — II.11)
export const CFG = Object.freeze({ readTarget: 5, readAttempts: 9, impressionBudget: 700, leadMax: 700, strandCap: 2500, coverageFloor: 0.6, lexK: 3, structuredTextCap: 1800 });
const VOLATILE = [
  /\b(today|tonight|right now|at the moment|this (morning|afternoon|evening|week|weekend)|latest|breaking|near me|yesterday|tomorrow|live (score|stream|traffic))\b/i,
  /\b(current|currently|now)\b\s*(price|weather|score|traffic|temperature|time|rate|exchange|stock|conditions)?/i && /\b(current (price|weather|score|traffic|temperature|time|rate|exchange rate|stock)|right now|\bnow\b\??$)/i,
  /(hoy|ahora mismo|esta noche|en este momento|aujourd'hui|maintenant|ce soir|en ce moment|heute|jetzt gerade|heute abend|aktuell|hoje|agora|esta noite|сегодня|сейчас|в данный момент|اليوم|الآن|الليلة|आज|अभी|今天|现在|今晚|当前|目前|今日|今夜|現在|ただ今)/i,
];
export const isVolatile = (t) => VOLATILE.some((re) => re.test(String(t)));

const HINTS = { personalPronouns: ["he", "him", "his", "she", "her", "hers", "él", "ella", "他", "她", "elle", "il", "er", "sie"], titles: ["mr", "mrs", "ms", "dr", "sir"] };

// ── candidate selection: the app's own ordering/gate/diversify from searchWeb (copied; searchWeb itself reads inside) ────────────
const rankOf = (r) => (r.kind === "web" || /wikipedia\.org\/wiki\//.test(r.url) ? 0 : /(^|\.)doi\.org|pdf|\.pdf$/i.test(r.url) ? 3 : /github\.com/.test(r.url) ? 2 : 1);
function chooseReads(results, query, cfg = EFFORT.balanced) {
  const ordered = [...results].sort((a, b) => rankOf(a) - rankOf(b));
  const readable = ordered.filter((r) => rankOf(r) < 3);
  const poolAll = readable.length ? readable : ordered;
  const g = applyGate(poolAll, entitiesOf(query), query, cfg);
  const chosen = [], used = new Set(), perQuery = new Map();
  for (const r of g.pool) { if (!r.url || used.has(r.url)) continue; const q = r._q ?? ""; if ((perQuery.get(q) || 0) >= 1) continue; perQuery.set(q, 1); used.add(r.url); chosen.push(r); }
  for (const r of g.pool) { if (!r.url || used.has(r.url)) continue; if (chosen.length >= CFG.readAttempts) break; used.add(r.url); chosen.push(r); }
  return { chosen: chosen.slice(0, CFG.readAttempts), gate: { skippedOff: g.skippedOff, why: g.why, fallback: g.fallback, pool: g.pool.length, all: poolAll.length } };
}

// ── search with the labelled transports ─────────────────────────────────────────────────────────────────────────────────────────
EFFORT.snip = { scopes: EFFORT.balanced.scopes, read: 0, gate: true };
async function engineFallback(q, doFallback) {
  const tries = [];
  if (!doFallback) return { results: [], tries };
  const E = [["brave", "chromium", (qq) => `https://search.brave.com/search?q=${encodeURIComponent(qq)}&source=web`, parseBrave], ["ddg", "chromium", (qq) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(qq)}`, parseDdg], ["ddg", "node", (qq) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(qq)}`, parseDdg]];
  for (const [id, transport, urlOf, parse] of E) {
    const r = await get(urlOf(q), { transport, cacheFailures: false });
    let n = 0, why = r.status >= 200 && r.status < 300 ? null : (r.error || "HTTP " + r.status);
    if (!why) { const p = parse(r.body.toString("utf8")); n = (p.results || []).length; if (p.blocked) why = "challenge"; else if (!n) why = p.shape || "no results"; if (n) { tries.push({ engine: id, transport, ms: r.ms, n, why: null, cached: !!r.cached }); return { results: p.results.slice(0, 20).map((x) => ({ title: x.title, url: x.url, snippet: (x.snippet || "").slice(0, 300), source: (() => { try { return new URL(x.url).hostname.replace(/^www\./, ""); } catch { return "web"; } })(), meta: "", kind: "web" })), engine: `${id}/${transport}`, tries }; } }
    tries.push({ engine: id, transport, ms: r.ms, n, why, cached: !!r.cached });
  }
  return { results: [], tries };
}

async function doSearch(query, fetchImpl, doFallback) {
  const out = { attempts: [], transport: null, ms: 0 };
  let res = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    res = await searchWeb(query, { effort: "snip", fetchImpl });
    const web = res.trace.find((t) => t.scope === "web");
    out.attempts.push({ attempt, ms: Date.now() - t0, web: web ? { ok: web.ok, n: web.n ?? 0, why: web.why || null, engine: web.engine } : null, trace: res.trace.filter((t) => t.scope).map((t) => ({ scope: t.scope, ok: t.ok, n: t.n, why: t.why })) });
    if (web && web.ok && (web.n || 0) > 0) { out.transport = "relay"; break; }
    if (attempt === 1) await sleep(5000);
  }
  let results = res.results;
  if (out.transport !== "relay") {
    const fb = await engineFallback(query, doFallback);
    out.fallback = fb.tries;
    if (fb.results.length) { out.transport = "engine:" + fb.engine; results = [...fb.results.map((r) => ({ ...r, _q: query })), ...results]; }
    else out.transport = results.length ? "api-only" : "none";
  }
  out.apiOnly = out.transport === "api-only";
  return { results, search: out };
}

// ── structured extraction (rung a) ──────────────────────────────────────────────────────────────────────────────────────────────
const cleanS = (v) => decodeEntities(String(v ?? "").replace(/<br\s*\/?>|<\/p>|<\/li>|<\/pre>|<\/div>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/[ \t ]+/g, " ").replace(/ *\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const nameOf = (v) => arr(v).map((x) => (typeof x === "string" ? cleanS(x) : x && x.name ? cleanS(x.name) : "")).filter(Boolean).join(", ");
const typesOf = (n) => arr(n["@type"]).map((t) => String(t).replace(/^.*\//, ""));
function jsonLdNodes(raw) {
  const nodes = [], strings = new Set();
  const flat = (v) => decodeEntities(String(v ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const walk = (n) => { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== "object") { if (typeof n === "string") { strings.add(cleanS(n)); strings.add(flat(n)); strings.add(String(n).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()); strings.add(String(n)); } return; } if (n["@type"]) nodes.push(n); for (const v of Object.values(n)) walk(v); };
  for (const m of String(raw).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { try { j = JSON.parse(m[1].trim().replace(/[\u0000-\u001f]+/g, " ")); } catch { continue; } }
    walk(j);
  }
  return { nodes, strings };
}
// a declared block is on the ask when its name carries at least ONE of the ask's content tokens (a 34% share rejected 'make pancakes from scratch' recipes: the block names say 'Pancakes' only)
const onAsk = (askToks, text) => coverage(askToks, text).hit.length >= 1;
const metaOf = (raw) => { const out = []; for (const m of String(raw).matchAll(/<meta\b[^>]*>/gi)) { const t = m[0]; const nm = (/(?:name|property)=["']([^"']+)["']/i.exec(t) || [])[1]; const ct = (/content=["']([^"']*)["']/i.exec(t) || [])[1]; if (nm && ct != null && /^(description|og:description|twitter:description|author|article:published_time|article:modified_time)$/i.test(nm)) out.push([nm.toLowerCase(), cleanS(ct)]); } return out; };
const creditOf = (node, url, meta) => {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const m = Object.fromEntries(meta || []);
  return { author: nameOf(node && node.author) || m["author"] || "", publisher: nameOf(node && node.publisher), site: host, datePublished: (node && node.datePublished) || m["article:published_time"] || "", dateModified: (node && node.dateModified) || m["article:modified_time"] || "" };
};
const cap = (items, max = CFG.structuredTextCap) => { const out = []; let n = 0, truncated = false; for (const x of items) { if (n + x.length > max && out.length) { truncated = true; break; } out.push(x); n += x.length; } return { items: out, truncated }; };

export function structuredOf(raw, askToks, url) {
  const snips = [];
  if (!raw) return { snips, strings: new Set(), types: [] };
  const { nodes, strings } = jsonLdNodes(raw);
  const meta = metaOf(raw);
  const types = [...new Set(nodes.flatMap(typesOf))];
  const add = (rung, node, title, lines, items, extra = {}) => snips.push({ rung, kind: "structured", title, credit: creditOf(node, url, meta), lines, items, text: lines.join("\n"), chars: lines.join("\n").length, ...extra });
  // Recipe — the app's own extractor (what exists)
  const rec = recipeDataFromHtml(raw);
  if (rec && onAsk(askToks, rec.name)) {
    const ing = cap(rec.ingredients, 1800), st = cap(rec.steps, 3500);
    const lines = [`Recipe: ${rec.name}`, rec.yield ? `Yield: ${rec.yield}` : "", [rec.prep && "Prep " + rec.prep, rec.cook && "Cook " + rec.cook, rec.total && "Total " + rec.total].filter(Boolean).join(" · "), "Ingredients:", ...ing.items.map((x) => "- " + x), "Steps:", ...st.items.map((x, i) => `${i + 1}. ${x}`)].filter(Boolean);
    snips.push({ rung: "a.recipe", kind: "structured", title: rec.name, credit: { author: rec.author, publisher: rec.publisher, site: (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })(), datePublished: "", dateModified: "" }, lines, items: [rec.name, ...ing.items, ...st.items], text: lines.join("\n"), chars: lines.join("\n").length, nIngredients: rec.ingredients.length, nSteps: rec.steps.length, truncated: ing.truncated || st.truncated });
  }
  for (const n of nodes) {
    const ty = typesOf(n);
    if (ty.includes("HowTo")) {
      const steps = []; const walk = (v) => arr(v).forEach((x) => { if (typeof x === "string") steps.push(cleanS(x)); else if (x && x.itemListElement) walk(x.itemListElement); else if (x && (x.text || x.name)) steps.push(cleanS(x.text || x.name)); });
      walk(n.step);
      const nm = cleanS(n.name);
      if (steps.length >= 2 && onAsk(askToks, nm)) { const s = cap(steps, 3500); add("a.howto", n, nm, [`How to: ${nm}`, ...s.items.map((x, i) => `${i + 1}. ${x}`)], [nm, ...s.items], { nSteps: steps.length, truncated: s.truncated }); }
    }
    if (ty.includes("FAQPage")) {
      const qa = arr(n.mainEntity).filter((q) => q && q.name && q.acceptedAnswer && q.acceptedAnswer.text).map((q) => ({ q: cleanS(q.name), a: cleanS(q.acceptedAnswer.text) }));
      const scored = qa.map((x) => ({ ...x, c: coverage(askToks, x.q) })).filter((x) => x.c.share >= 0.5 && x.c.hit.length >= Math.min(2, askToks.length)).sort((x, y) => y.c.share - x.c.share).slice(0, 2);
      if (scored.length) add("a.faq", n, scored[0].q, scored.flatMap((x) => [`Q: ${x.q}`, `A: ${x.a}`]), scored.flatMap((x) => [x.q, x.a]), { nFaqTotal: qa.length });
    }
    if (ty.includes("QAPage") || ty.includes("Question")) {
      const q = ty.includes("Question") ? n : arr(n.mainEntity).find((x) => x && x.acceptedAnswer || x && x.suggestedAnswer);
      if (q && q.name) {
        const answers = [...arr(q.acceptedAnswer), ...arr(q.suggestedAnswer)].filter((a) => a && a.text);
        const best = answers.sort((a, b) => (+b.upvoteCount || 0) - (+a.upvoteCount || 0))[0];
        const accepted = arr(q.acceptedAnswer)[0];
        const ans = accepted && accepted.text ? accepted : best;
        if (ans && coverage(askToks, cleanS(q.name)).share >= 0.4) add("a.qa", q, cleanS(q.name), [`Q: ${cleanS(q.name)}`, `${accepted && accepted.text ? "Accepted answer" : "Top answer"}${ans.upvoteCount != null ? ` (${ans.upvoteCount} votes)` : ""}:`, cleanS(ans.text)], [cleanS(q.name), cleanS(ans.text)], { accepted: !!(accepted && accepted.text), votes: ans.upvoteCount ?? null });
      }
    }
    if (ty.includes("Product")) {
      const nm = cleanS(n.name);
      if (nm && onAsk(askToks, nm)) {
        const offers = arr(n.offers)[0] || {}; const rate = n.aggregateRating || {};
        const lines = [`Product: ${nm}`, n.brand ? `Brand: ${nameOf(n.brand)}` : "", offers.price != null ? `Price: ${offers.price} ${offers.priceCurrency || ""}`.trim() : (offers.lowPrice != null ? `Price from: ${offers.lowPrice} ${offers.priceCurrency || ""}`.trim() : ""), offers.availability ? `Availability: ${String(offers.availability).replace(/^.*\//, "")}` : "", rate.ratingValue ? `Rating: ${rate.ratingValue} (${rate.reviewCount || rate.ratingCount || "?"} reviews)` : "", n.description ? cleanS(n.description).slice(0, 400) : ""].filter(Boolean);
        add("a.product", n, nm, lines, [nm, ...(n.description ? [cleanS(n.description).slice(0, 400)] : [])], { price: offers.price ?? offers.lowPrice ?? null, currency: offers.priceCurrency || null });
      }
    }
    if (ty.some((t) => /Event$/.test(t))) {
      const nm = cleanS(n.name);
      if (nm && onAsk(askToks, nm)) { const loc = arr(n.location)[0] || {}; add("a.event", n, nm, [`Event: ${nm}`, n.startDate ? `Starts: ${n.startDate}` : "", n.endDate ? `Ends: ${n.endDate}` : "", loc.name ? `Where: ${cleanS(loc.name)}` : (typeof loc === "string" ? `Where: ${loc}` : "")].filter(Boolean), [nm], { startDate: n.startDate || null }); }
    }
    if (ty.some((t) => /^(Article|NewsArticle|BlogPosting|WebPage|TechArticle|ScholarlyArticle|DefinedTerm|AboutPage|FAQPage|CollectionPage)$/.test(t))) {
      const d = cleanS(n.description || n.abstract || "");
      if (d.length >= 60) add("a.article", n, cleanS(n.headline || n.name || ""), [d], [d], {});
    }
  }
  const md = meta.find(([k, v]) => /description/.test(k) && v.length >= 60);
  if (md) add("a.meta", null, "", [md[1]], [md[1]], {});
  // de-duplicate identical text
  const seen = new Set(); const uniq = snips.filter((s) => { const k = squash(s.text); if (seen.has(k)) return false; seen.add(k); return true; });
  return { snips: uniq, strings: new Set([...strings, ...meta.map(([, v]) => v)]), types };
}

// ── prose rungs (b, c, d) ─────────────────────────────────────────────────────────────────────────────────────────────────────
const mergeSegs = (text, segs) => {
  const s = [...segs].sort((a, b) => a.start - b.start); const out = [];
  for (const g of s) {
    const prev = out[out.length - 1];
    if (prev && g.start <= prev.end) { prev.end = Math.max(prev.end, g.end); continue; }
    if (prev && /^\s*$/.test(text.slice(prev.end, g.start)) && g.start - prev.end <= 2) { prev.end = g.end; continue; }
    out.push({ start: g.start, end: g.end });
  }
  return out.map((g) => ({ ...g, text: text.slice(g.start, g.end) }));
};
const proseStartOf = (text) => (/^Recipe: /.test(text) && text.indexOf("\n\n") > 0 ? text.indexOf("\n\n") + 2 : 0);
function snipFromSegs(rung, text, segs, extra = {}) {
  const merged = mergeSegs(text, segs);
  if (!merged.length) return null;
  const shown = merged.map((g) => g.text).join(" … ");
  return { rung, kind: "prose", segments: merged, text: shown, chars: shown.length, ...extra };
}
function leadOf(text, isWiki) {
  if (!isWiki) return null;
  const lines = text.split("\n"); let off = 0, para = null;
  for (const ln of lines) { const st = off; off += ln.length + 1; if (ln.trim().length >= 60 && !/^=+ /.test(ln)) { para = { start: st, end: st + ln.length }; break; } }
  if (!para) return null;
  const sents = sentencesWithOffsets(text.slice(para.start, para.end)); let end = para.start;
  for (const s of sents) { const e = para.start + s.end; if (end > para.start && e - para.start > CFG.leadMax) break; end = e; }
  return snipFromSegs("b", text, [{ start: para.start, end }]);
}
function impressionSnip(text, query, lead) {
  const ps = proseStartOf(text), body = text.slice(ps);
  if (body.length < 20) return null;
  const e = impressionOf(body, query, { budget: CFG.impressionBudget, lead });
  return snipFromSegs(lead ? "c" : "c.nolead", text, e.shadow.segments.map((g) => ({ start: g.start + ps, end: g.end + ps })), { kept: e.shadow.kept, pageChars: e.shadow.chars, recalled: e.shadow.recalled, whole: e.shadow.kept === e.shadow.chars && e.shadow.chars > 0, rawSegs: e.shadow.segments.map((g) => ({ start: g.start + ps, end: g.end + ps })) });
}
function lexicalSnip(text, askToks, k = CFG.lexK) {
  const ps = proseStartOf(text); const sents = sentencesWithOffsets(text.slice(ps)).map((s) => ({ ...s, start: s.start + ps, end: s.end + ps })).filter((s) => { const n = s.text.split(/\s+/).length; return (s.text.length >= 25 && n <= 80) || /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s.text) && s.text.length >= 8 && s.text.length <= 300; });
  const scored = sents.map((s, i) => ({ s, i, c: coverage(askToks, s.text).hit.length })).filter((x) => x.c >= 1).sort((a, b) => b.c - a.c || a.i - b.i);
  const pick = []; let used = 0;
  for (const x of scored) { if (pick.length >= k) break; if (used + x.s.text.length > CFG.impressionBudget && pick.length) continue; pick.push(x.s); used += x.s.text.length; }
  return pick.length ? snipFromSegs("d", text, pick.map((s) => ({ start: s.start, end: s.end }))) : null;
}

// ── mechanical verbatim checks ────────────────────────────────────────────────────────────────────────────────────────────────
function verify(snip, page) {
  if (snip.kind === "prose") {
    const exact = snip.segments.every((g) => page.text.slice(g.start, g.end) === g.text && g.text.length > 0);
    const vis = page.visible;
    const residue = snip.segments.some((g) => /&#?\w{2,8};/.test(g.text));
    const corroborated = vis == null ? null : snip.segments.every((g) => vis.includes(squash(g.text)));
    return { exact, corroborated, entityResidue: residue };
  }
  const declared = page.declared;
  const exact = snip.items.every((it) => declared && declared.has(it));
  const vis = page.visible;
  const hit = vis == null ? null : snip.items.filter((it) => vis.includes(squash(it))).length / Math.max(1, snip.items.length);
  return { exact, corroborated: hit == null ? null : hit >= 0.99, corroboratedShare: hit, entityResidue: snip.items.some((x) => /&#?\w{2,8};/.test(x)) };
}

// ── the strand (policy S1) ────────────────────────────────────────────────────────────────────────────────────────────────────
const dedupe = (snips) => { const out = []; for (const s of snips) { const k = squash(s.text); if (out.some((o) => { const ok = squash(o.text); return ok === k || ok.includes(k) || k.includes(ok); })) continue; out.push(s); } return out; };
export function strandS1(cands, pages) {
  const out = [];
  for (const p of pages) {
    const mine = cands.filter((c) => c.srcIdx === p.srcIdx);
    const structured = mine.filter((c) => /^a\.(recipe|howto|faq|qa|product|event)$/.test(c.rung));
    if (structured.length) { out.push(...structured.slice(0, 2)); continue; }
    const b = mine.find((c) => c.rung === "b"), c = mine.find((x) => x.rung === "c");
    if (b) out.push(b);
    if (c) {
      if (b) { const bs = b.segments; const rest = (c.rawSegs || c.segments).filter((g) => !bs.some((x) => g.start >= x.start && g.end <= x.end)); if (rest.length) { const t = p.text; const sn = snipFromSegs("c", t, rest); if (sn) { Object.assign(sn, { srcIdx: c.srcIdx, url: c.url, title: c.title, site: c.site, via: c.via, credit: c.credit, id: c.id + "'", check: c.check }); out.push(sn); } } }
      else out.push(c);
    }
    if (!b && !c) { const d = mine.find((x) => x.rung === "a.article" || x.rung === "a.meta"); if (d) out.push(d); }
  }
  const ded = dedupe(out); const shown = []; let n = 0;
  for (const s of ded) { if (n + s.chars > CFG.strandCap && shown.length) break; shown.push(s); n += s.chars; }
  return shown;
}
const byRung = (cands, test) => dedupe(cands.filter((c) => test(c.rung)));

// ── one ask ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function runAsk(ask, { record = null, doFallback = true, gate = true } = {}) {
  const t0 = Date.now();
  const said = ask.text;
  let resolution = null, query = said;
  if (ask.followUpOf && record) { resolution = resolveQuestion(said, record, { hints: HINTS }); query = searchQueries(resolution)[0] || said; }
  const tape = []; const fetchImpl = makeFetch(tape);
  const res = { id: ask.id, class: ask.class, lang: ask.language, text: said, query, resolution: resolution && { reason: resolution.reason, carried: resolution.carried, resolved: resolution.resolved }, startedAt: new Date().toISOString() };
  res.volatile = { said: isVolatile(said), cue: VOLATILE.findIndex((re) => re.test(said)) };
  const s0 = Date.now();
  const { results, search } = await doSearch(query, fetchImpl, doFallback);
  res.search = search; res.searchMs = Date.now() - s0;
  res.netSearchMs = tape.filter((x) => /holodeck-proxy\.prometheoid\.workers\.dev\/search|api\.php|api\.github|archive\.org|openalex|crossref|duckduckgo|brave/.test(x.target)).reduce((a, x) => a + (x.ms || 0), 0);
  const { chosen, gate: gateInfo } = chooseReads(results, query);
  res.results = results.slice(0, 12).map((r) => ({ url: r.url, title: r.title, source: r.source, kind: r.kind })); res.nResults = results.length; res.gate = gateInfo;
  // read
  const pages = []; const reads = []; let readNet = 0;
  for (const c of chosen) {
    if (pages.length >= CFG.readTarget) break;
    tape.length = 0;
    const r0 = Date.now();
    let rd; try { rd = await readText(c.url, { fetchImpl, timeoutMs: 12000 }); } catch (e) { rd = { ok: false, error: String(e.message || e), via: null }; }
    const okTape = tape.filter((x) => x.status >= 200 && x.status < 300);
    const msRead = tape.reduce((a, x) => a + (x.ms || 0), 0); readNet += msRead;
    const rec = { url: c.url, title: c.title, source: c.source, rank: chosen.indexOf(c), ok: !!rd.ok, via: rd.via || null, error: rd.error || null, ms: msRead, wallMs: Date.now() - r0, transports: [...new Set(tape.map((x) => x.transport))], statuses: tape.map((x) => x.status) };
    if (rd.ok) {
      const rawEntry = okTape.find((x) => x.target === c.url) || okTape.find((x) => x.target.includes(encodeURIComponent(c.url)));
      const apiEntry = okTape.find((x) => /\/w\/api\.php/.test(x.target));
      const raw = rawEntry ? rawEntry.body.toString("utf8") : null;
      const isWiki = /^https?:\/\/[a-z-]+\.wikipedia\.org\/wiki\//.test(c.url) && rd.via === "direct" && !raw;
      const page = { srcIdx: pages.length, url: c.url, title: rd.title, source: c.source, via: rd.via, text: rd.text, raw, isWiki, visible: raw ? visibleNorm(raw) : isWiki && apiEntry ? squash((() => { try { const j = JSON.parse(apiEntry.body.toString("utf8")); const p = Object.values(j.query.pages)[0]; return p.extract || ""; } catch { return ""; } })()) : null };
      rec.chars = rd.text.length; rec.rawBytes = raw ? raw.length : 0; rec.isWiki = isWiki; rec.pageHash = sha(c.url + "|" + rd.text); rec.srcIdx = page.srcIdx;
      fs.writeFileSync(path.join(PAGES, rec.pageHash + ".txt"), rd.text);
      pages.push(page);
    }
    reads.push(rec);
  }
  res.reads = reads; res.readNetMs = readNet;
  // candidates
  const c0 = Date.now();
  const askToks = tokens(query);
  res.askTokens = askToks;
  const cands = [];
  for (const p of pages) {
    const base = { srcIdx: p.srcIdx, url: p.url, title: p.title, site: (() => { try { return new URL(p.url).hostname.replace(/^www\./, ""); } catch { return ""; } })(), via: p.via };
    const st = structuredOf(p.raw, askToks, p.url); p.declared = st.strings; p.types = st.types;
    const list = [...st.snips, leadOf(p.text, p.isWiki), impressionSnip(p.text, query, true), impressionSnip(p.text, query, false), lexicalSnip(p.text, askToks)].filter(Boolean);
    list.forEach((s, k) => { Object.assign(s, { ...base, id: `${p.srcIdx}.${s.rung}${k}`, credit: { site: base.site, ...(s.credit || {}) } }); s.check = verify(s, p); cands.push(s); });
  }
  res.pageInfo = pages.map((p) => ({ srcIdx: p.srcIdx, url: p.url, title: p.title, via: p.via, chars: p.text.length, isWiki: p.isWiki, ldTypes: p.types, hasRaw: !!p.raw }));
  res.candidates = cands;
  const S1 = strandS1(cands, pages);
  res.strands = { S1, a: byRung(cands, (r) => r.startsWith("a.")), b: byRung(cands, (r) => r === "b"), c: byRung(cands, (r) => r === "c"), cNoLead: byRung(cands, (r) => r === "c.nolead"), d: byRung(cands, (r) => r === "d") };
  res.snipMs = Date.now() - c0;
  // gaps
  const text = S1.map((s) => s.text).join("\n");
  const cov = coverage(askToks, text);
  res.coverage = { share: cov.share, hit: cov.hit, n: cov.n };
  let gap = null;
  if (gate && (isVolatile(said) || isVolatile(query))) gap = { kind: "live-data", article: "IV.3 not-present: no live source", why: "the ask carries a live-data cue; a read page is not a live feed" };
  else if (!results.length) gap = { kind: "no-search", why: "search returned nothing (" + search.transport + ")" };
  else if (!pages.length) gap = { kind: "no-readable-source", why: "no result could be read" };
  else if (!S1.length) gap = { kind: "no-snip", why: "no sentence in the read pages differs the ask" };
  else if (cov.share < CFG.coverageFloor) gap = { kind: "off-topic", why: `the strand covers ${(cov.share * 100).toFixed(0)}% of the ask's content words (floor ${CFG.coverageFloor * 100}%)` };
  res.gap = gap;
  res.shown = gap ? null : S1.map((s) => s.id);
  res.totalMs = Date.now() - t0; res.netMs = res.netSearchMs + readNet;
  return res;
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const { asks } = JSON.parse(fs.readFileSync(path.join(here, "asks.json"), "utf8"));
  const ids = (arg("ids", "") || "").split(",").filter(Boolean), classes = (arg("classes", "") || "").split(",").filter(Boolean);
  let todo = asks.filter((a) => (!ids.length || ids.includes(a.id)) && (!classes.length || classes.includes(a.class)));
  // a follow-up runs after its turn A
  todo = [...todo.filter((a) => !a.followUpOf), ...todo.filter((a) => a.followUpOf)];
  const limit = +(arg("limit", 0)) || todo.length; todo = todo.slice(0, limit);
  const doFallback = !argv.includes("--no-fallback"), gate = !argv.includes("--no-gate");
  let n = 0;
  for (const a of todo) {
    const unresolved = argv.includes("--unresolved");
    const f = path.join(OUT, a.id + (unresolved ? "__raw" : "") + ".json");
    let pass1 = null;
    if (fs.existsSync(f) && argv.includes("--retry-search-failed")) { const prev = JSON.parse(fs.readFileSync(f, "utf8")); if (prev.search && ["none", "api-only"].includes(prev.search.transport) && !prev.pass1) pass1 = { transport: prev.search.transport, nResults: prev.nResults, gap: prev.gap && prev.gap.kind, at: prev.startedAt }; else { n++; continue; } }
    else if (fs.existsSync(f) && !argv.includes("--force")) { n++; continue; }
    let record = null;
    if (a.followUpOf && !unresolved) {
      const fa = path.join(OUT, a.followUpOf + ".json");
      if (!fs.existsSync(fa)) { console.log("skip", a.id, "(no turn A)"); continue; }
      const A = JSON.parse(fs.readFileSync(fa, "utf8")); const first = asks.find((x) => x.id === a.followUpOf);
      record = admitReferents(emptyReferents(), { question: first.text, answer: (A.strands.S1 || []).map((s) => s.text).join("\n"), sources: (A.reads || []).filter((r) => r.ok).map((r) => ({ title: r.title })) }, { hints: HINTS });
    }
    const t = Date.now();
    let out;
    try { out = await runAsk(a, { record, doFallback, gate }); if (pass1) out.pass1 = pass1; if (unresolved) out.unresolved = true; }
    catch (e) { out = { id: a.id, class: a.class, error: String(e.stack || e).slice(0, 500) }; }
    fs.writeFileSync(f, JSON.stringify(out));
    n++;
    console.log(`[${n}/${todo.length}] ${a.id} ${out.error ? "ERROR " + out.error.split("\n")[0] : `search=${out.search.transport} reads=${out.reads.filter((r) => r.ok).length}/${out.reads.length} strand=${out.strands.S1.length} ${out.gap ? "GAP:" + out.gap.kind : "shown"}`} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
  console.log("net:", JSON.stringify({ network: STATS.network, cacheHits: STATS.cacheHits, byTransport: STATS.byTransport }));
  await closeNet();
}
