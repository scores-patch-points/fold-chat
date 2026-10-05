// fold-chat-web.js — web search and page reading, like the holodeck's.
//
// No server relays anything. The holodeck searches the sources that answer a
// browser directly with no key (GitHub, Wikipedia, the Internet Archive, and
// the open scholarly graph — OpenAlex, Crossref), reads a page directly when
// the site allows it, and when a site refuses a cross-origin read falls
// through to a small chain of public CORS proxies and text readers — each a
// third party that fetched the page for this browser, which the trace names.
//
// This is the same mechanism, lean and testable (browser + node; tests inject
// fetch). It returns the holodeck's result shape:
//   { title, url, snippet, source, meta, kind }
// and a combined { results, more, engine } per scope.

export const SCOPES = Object.freeze([
  { id: "web", label: "Web · open search", ask: "Search the open web (DuckDuckGo/Brave via the relay)" },
  { id: "wikipedia", label: "Wikipedia", ask: "Search Wikipedia articles" },
  { id: "github", label: "GitHub", ask: "Search GitHub repositories" },
  { id: "archive", label: "Internet Archive", ask: "Search books, documents and recordings" },
  { id: "openalex", label: "Papers · OpenAlex", ask: "Search research papers (OpenAlex)" },
  { id: "crossref", label: "Papers · Crossref", ask: "Search research papers (Crossref)" },
]);

// The Cloudflare Worker relay (the fold's own; the khora reads through it too).
// It does the SERVER-side fetch the static page cannot: DuckDuckGo/Brave web
// search and CORS-open page reads, keyless, and it writes no logs. See
// holodeck-proxy/ in this workspace.
export const FOLD_RELAY = "https://holodeck-proxy.prometheoid.workers.dev";

// A page the site refuses to hand the browser is fetched through one of these,
// in parallel; the trace names which. The FOLD'S OWN RELAY is first — it is a
// server-side fetch with CORS open, so reads are reliable rather than a roll of
// the dice against a string of public proxies.
export const CORS_PROXIES = [
  (u) => `${FOLD_RELAY}/raw?url=${encodeURIComponent(u)}`,
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  (u) => "https://cors.eu.org/" + u,
  (u) => "https://thingproxy.freeboard.io/fetch/" + u,
];
// A page whose article exists only after its own scripts run cannot be read as
// HTML, but a server-side text reader (r.jina.ai) hands back the text.
export const TEXT_READERS = [
  (u) => "https://r.jina.ai/" + u,
  (u) => "https://api.microlink.io/?meta=false&text=true&url=" + encodeURIComponent(u),
];

const decode = (s) => String(s ?? "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
// Leftover wikitext scaffolding that survives as text: {{templates}}, {|tables|}, [[links]].
function cleanText(t) {
  return String(t ?? "")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\{\|[\s\S]*?\|\}/g, " ")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/[ \t]+/g, " ").replace(/ *\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
// Non-content subtrees: scripts, chrome, references, tables/infoboxes, media.
const DROP_SEL = "script,style,head,nav,footer,noscript,sup.reference,table,figure,figcaption,.mw-editsection,.navbox,.infobox,.metadata,.reflist,.reference,.toc,style";
// The blocks that carry article prose: paragraphs, list items, headings.
const BLOCK_SEL = "p, li, h1, h2, h3, h4, blockquote, dd";

/** HTML → the article's PROSE BLOCKS, one per line-pair. This is the grammar
 *  step: parse the tree (the browser's own HTML grammar), drop the non-content
 *  subtrees (references, infoboxes, tables, chrome), then keep the prose blocks
 *  (paragraphs, list items, headings) as SEPARATE blocks — so a later snip is a
 *  sentence inside a real paragraph, never a flattened blob whose first match
 *  lands in a citation footer. Browser: DOMParser. Node: a <p>/<li> walk. */
function htmlToBlocks(raw) {
  const s = String(raw ?? "");
  if (typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(s, "text/html");
      for (const n of doc.querySelectorAll(DROP_SEL)) n.remove();
      const scope = doc.querySelector("#mw-content-text, article, main, [role=main]") || doc.body;
      const blocks = [];
      if (scope) for (const n of scope.querySelectorAll(BLOCK_SEL)) {
        if (blocks.length >= 400) break;              // bound the walk
        const t = one(n.textContent);
        if (t.length >= 40) blocks.push(t);
      }
      if (blocks.length) return cleanText(blocks.join("\n\n").slice(0, 40000));
      const t = one(scope ? scope.textContent : doc.documentElement.textContent);
      if (t.length >= 40) return cleanText(t.slice(0, 40000));
    } catch (e) {}
  }
  // Node fallback: pull <p>/<li> blocks (the falsifier proved this isolates the
  // prose and drops the reference footer).
  const blocks = [...s.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => one(decode(m[2].replace(/<(sup|style|script|table|figure)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "))))
    .filter((t) => t.length >= 40);
  if (blocks.length) return cleanText(blocks.join("\n\n"));
  return cleanText(decode(s.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|head|nav|footer)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")));
}
const stripTags = htmlToBlocks;
const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const first = (v) => (Array.isArray(v) ? v[0] : v) || "";

const fetchT = (fetchImpl, u, ms, headers, extSignal) => {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), ms);
  const onAbort = () => c.abort();
  if (extSignal) { if (extSignal.aborted) c.abort(); else extSignal.addEventListener("abort", onAbort, { once: true }); }
  const o = { signal: c.signal, headers: { ...(headers || {}) } };
  return fetchImpl(u, o).finally(() => { clearTimeout(id); if (extSignal) extSignal.removeEventListener("abort", onAbort); });
};

async function getJson(fetchImpl, url, who) {
  let r;
  try { r = await fetchT(fetchImpl, url, 30000); } catch (e) { throw new Error(who + " did not answer" + (e && e.name === "AbortError" ? " in time." : ".")); }
  let j = null; try { j = await r.json(); } catch (e) {}
  return { r, j };
}

/** Open-web search through the fold's Cloudflare Worker relay: the Worker does
 *  the server-side DuckDuckGo/Brave fetch (keyless, CORS-open) that a static
 *  browser page cannot. This is what actually finds a people/records/anything
 *  query the five API scopes miss. */
async function duckSearch(q, { fetchImpl = fetch, page = 0 } = {}) {
  const url = `${FOLD_RELAY}/search?scope=web&q=` + encodeURIComponent(q);
  const { r, j } = await getJson(fetchImpl, url, "Web search");
  if (!r.ok || !j) throw new Error("Web search answered " + (r.status || "nothing"));
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "web"; } };
  const results = (Array.isArray(j.results) ? j.results : []).map((x) => ({
    title: one(x.title || ""), url: x.url || "",
    snippet: one(x.snippet || "").slice(0, 300),
    source: x.source || host(x.url), meta: "", kind: "web",
  })).filter((x) => x.title && /^https?:/i.test(x.url));
  return { results: results.slice(0, 20), more: results.length >= 20, engine: (j.engine || "DuckDuckGo") };
}

/** Search one scope, page-based. Returns { results, more, engine }. */
export async function search(scope, q, page = 0, { fetchImpl = fetch } = {}) {
  if (scope === "web") return duckSearch(q, { fetchImpl, page });
  if (scope === "github") {
    const { r, j } = await getJson(fetchImpl, "https://api.github.com/search/repositories?per_page=20&page=" + (page + 1) + "&q=" + encodeURIComponent(q), "GitHub");
    if (r.status === 403 || r.status === 429) throw new Error("GitHub is limiting searches from this browser.");
    if (!r.ok || !j) throw new Error("GitHub answered " + r.status + ".");
    const k = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));
    return { results: (j.items || []).map((x) => ({ title: x.full_name, url: x.html_url, snippet: x.description || "", source: "GitHub", meta: ["★ " + k(x.stargazers_count), x.language, x.pushed_at ? "updated " + x.pushed_at.slice(0, 4) : ""].filter(Boolean).join(" · "), kind: "github" })), more: (page + 1) * 20 < Math.min(j.total_count || 0, 1000), engine: "GitHub" };
  }
  if (scope === "wikipedia") {
    const { r, j } = await getJson(fetchImpl, "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=20&sroffset=" + page * 20 + "&srsearch=" + encodeURIComponent(q), "Wikipedia");
    if (!r.ok || !j) throw new Error("Wikipedia answered " + r.status + ".");
    return { results: ((j.query && j.query.search) || []).map((x) => ({ title: x.title, url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(x.title.replace(/ /g, "_")), snippet: stripTags(x.snippet), source: "Wikipedia", meta: x.wordcount ? x.wordcount.toLocaleString() + " words" : "", kind: "wikipedia" })), more: !!j.continue, engine: "Wikipedia" };
  }
  if (scope === "openalex") {
    const { r, j } = await getJson(fetchImpl, "https://api.openalex.org/works?search=" + encodeURIComponent(q) + "&per-page=20&page=" + (page + 1), "OpenAlex");
    if (!r.ok || !j) throw new Error("OpenAlex answered " + r.status + ".");
    const results = (j.results || []).map((w) => {
      const src = (w.primary_location && w.primary_location.source && w.primary_location.source.display_name) || "";
      const doi = (w.doi || "").replace(/^https?:\/\/doi\.org\//i, "");
      const oa = (w.best_oa_location && w.best_oa_location.pdf_url) || null;
      const landing = w.landing_page_url || (doi ? "https://doi.org/" + doi : "");
      return { title: w.title || w.display_name || "Untitled", url: oa || landing, snippet: oaAbstract(w.abstract_inverted_index).slice(0, 300), source: src || "OpenAlex", meta: [w.publication_year, w.cited_by_count ? "cited " + w.cited_by_count : "", doi ? "doi:" + doi : ""].filter(Boolean).join(" · "), kind: "paper", doi: doi || null };
    });
    return { results, more: page * 20 + results.length < ((j.meta && j.meta.count) || 0), engine: "OpenAlex" };
  }
  if (scope === "crossref") {
    const { r, j } = await getJson(fetchImpl, "https://api.crossref.org/works?query.bibliographic=" + encodeURIComponent(q) + "&rows=20&offset=" + page * 20, "Crossref");
    if (!r.ok || !j) throw new Error("Crossref answered " + r.status + ".");
    const msg = j.message || {};
    const results = (msg.items || []).map((it) => {
      const doi = it.DOI || "";
      const year = (it.issued && it.issued["date-parts"] && it.issued["date-parts"][0] && it.issued["date-parts"][0][0]) || "";
      const jrn = (it["container-title"] && it["container-title"][0]) || "";
      return { title: (it.title && it.title[0]) || "Untitled", url: "https://doi.org/" + doi, snippet: stripTags(it.abstract || "").slice(0, 300), source: jrn || "Crossref", meta: [year, it["is-referenced-by-count"] ? "cited " + it["is-referenced-by-count"] : "", doi ? "doi:" + doi : ""].filter(Boolean).join(" · "), kind: "paper", doi: doi || null };
    });
    return { results, more: page * 20 + results.length < Math.min(msg["total-results"] || 0, 10000), engine: "Crossref" };
  }
  const { r, j } = await getJson(fetchImpl, "https://archive.org/advancedsearch.php?output=json&rows=20&page=" + (page + 1) + "&q=" + encodeURIComponent(q) + ["identifier", "title", "description", "mediatype", "year", "creator"].map((f) => "&fl%5B%5D=" + f).join(""), "The Internet Archive");
  if (!r.ok || !j || !j.response) throw new Error("The Internet Archive answered " + r.status + ".");
  return { results: (j.response.docs || []).map((d) => ({ title: first(d.title) || d.identifier, url: "https://archive.org/details/" + d.identifier, snippet: stripTags(Array.isArray(d.description) ? d.description.join(" ") : d.description).slice(0, 300), source: first(d.creator) || "Internet Archive", meta: [d.mediatype, d.year].filter(Boolean).join(" · "), kind: "archive" })), more: page * 20 + (j.response.docs || []).length < (j.response.numFound || 0), engine: "Internet Archive" };
}

function oaAbstract(inv) {
  if (!inv || typeof inv !== "object") return "";
  const pos = [];
  for (const w of Object.keys(inv)) for (const i of inv[w]) pos[i] = w;
  return pos.join(" ");
}

/** Read a page's text: direct first, then the public proxies, then the text
 *  readers. Returns { ok, text, title, via, url } — `via` names who fetched it
 *  (a third party learns the address when a proxy/reader is used). */
export async function readText(url, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const titleOf = (raw) => oneLine(((String(raw).match(/<title[^>]*>([^<]*)/i) || [])[1] || ""));
  // Read a body but STOP at MAX_RAW: a full `r.text()` can buffer many MB of a
  // directory/proxy page before we slice it; streaming bounds memory so the
  // browser tab cannot OOM on the multi-entity read fan-out.
  const MAX_RAW = 600000;
  const readCapped = async (res) => {
    if (!res.body) return await res.text();
    const reader = res.body.getReader();
    const chunks = [];
    let len = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const part = new TextDecoder().decode(value);
      chunks.push(part); len += part.length;
      if (len > MAX_RAW) { try { await reader.cancel(); } catch (e) {} break; }
    }
    return chunks.join("").slice(0, MAX_RAW);
  };
  const attempt = async (target, via, ctl) => {
    const r = await fetchT(fetchImpl, target, timeoutMs, null, ctl ? ctl.signal : null);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const raw = await readCapped(r);
    let text = stripTags(raw);
    // r.jina.ai / microlink wrap the text; unwrap.
    if (/^\s*\{/.test(raw)) { try { const j = JSON.parse(raw); text = stripTags((j.data && (j.data.text || j.data.content)) || ""); } catch (e) {} }
    else if (raw.includes("Markdown Content:")) text = raw.split("Markdown Content:").slice(1).join("Markdown Content:").trim();
    if (text.length < 40) throw new Error("too short");
    if (text.length > 24000) text = text.slice(0, 24000);
    return { ok: true, text, title: titleOf(raw) || oneLine(text.split("\n")[0]).slice(0, 80), via, url };
  };
  try { return await attempt(url, "direct", null); } catch (e) {}
  // Fire the proxy/reader chain but ABORT the losers once one wins — otherwise
  // every losing attempt keeps its buffered body (up to MAX_RAW) alive until
  // it times out, multiplying memory across the batch.
  const firstOf = async (makers) => {
    const ctl = new AbortController();
    // A failed attempt becomes null (via .catch); only a REAL non-null result
    // counts — so race on values, ignoring nulls, and abort the rest once one
    // wins. (Promise.any would grab the first resolved null and drop the win.)
    let done = false;
    return await new Promise((resolve) => {
      let pending = makers.length;
      for (const mk of makers) {
        mk(ctl)
          .then((v) => { if (v && !done) { done = true; ctl.abort(); resolve(v); } else if (--pending === 0) resolve(null); })
          .catch(() => { if (--pending === 0) resolve(null); });
      }
    });
  };
  const viaProxy = await firstOf(CORS_PROXIES.map((p, i) => (ctl) => attempt(p(url), i === 0 ? "the fold's relay" : "a public proxy", ctl)));
  if (viaProxy) return viaProxy;
  const viaReader = await firstOf(TEXT_READERS.map((rd) => (ctl) => attempt(rd(url), "a text reader", ctl)));
  if (viaReader) return viaReader;
  return { ok: false, text: "", title: "", via: null, url, error: "unreachable" };
}

/** Resolve as soon as any promise fulfills; if none do, resolve [] (no reject). */
async function allSettledFirst(promises) {
  return new Promise((resolve) => {
    let pending = promises.length, done = false;
    if (!pending) return resolve([]);
    for (const p of promises) p.then((v) => { if (v && !done) { done = true; resolve([v]); } else if (--pending === 0) resolve([]); }, () => { if (--pending === 0) resolve([]); });
  });
}

/** Proper-noun entities in a question (the names the ask is ABOUT). Empty when
 *  the ask has no names. Used by queriesFor (per-entity searches) and by the
 *  on-topic gate (which results to READ). */
const PROPER_NOUN_RE = /(?<![\p{L}\p{N}])(\p{Lu}[\p{L}\p{N}.'-]*(?:\s+[\p{Lu}][\p{L}\p{N}.'-]*)*)/gu;
const PROPER_STOP = new Set(["Compare", "Contrast", "The", "And", "What", "Which", "Tell", "How", "When", "Where", "Who", "Find", "Show", "Give", "Also", "Between", "From", "With", "About"]);
function properNouns(q) {
  return [...String(q ?? "").matchAll(PROPER_NOUN_RE)].map((m) => m[1].trim()).filter((t) => t.length > 2 && !PROPER_STOP.has(t));
}
export function entitiesOf(q) { return [...new Set(properNouns(q))].slice(0, 6); }

/** Split a comparison/list question into per-entity queries so a "Compare the
 *  founding of Canberra, Brasília, Ottawa, Washington" is searched as each city,
 *  not one bag of words whose top hit is whatever page happens to contain all of
 *  them (measured: the whole-question query returned "Snowden disclosures"). */
export function queriesFor(query) {
  const q = String(query ?? "").trim();
  if (!q) return [];
  const uniq = [...new Set(properNouns(q))];
  if (uniq.length >= 2) return uniq.slice(0, 4);
  return [q];
}

/** A people-record / relationship source, or a page that says a relation in
 *  words: "board of directors", "investor", "married", "serves on", and the
 *  people-record domains. This is the framing that separates "Spencer Liff"
 *  (a film-list mention) from "Zachary Liff — investor" (a record). */
const RELATION_RE = /\b(board of directors|board|chair|president|co-?founder|founder|director|owner|partner|married|spouse|wife|husband|son|daughter|father|mother|brother|sister|cousin|investor|real estate|ceo|executive|managing|principal|chairman|invests?|serves? (?:on|as)|leads?|runs?|founded|co-?owns?|executive director|general counsel|capital(?: city)?|established)\b/i;
const PEOPLE_RECORD_RE = /\b(spokeo|whitepages|mylife|elementix|linkedin|boards?|leadership|people|records|profiles?|directory|reputation|biograph)\b/i;

/** THE SWARM — three independent framings of a candidate result contend; a snip
 *  matters iff they CONVERGE. This is the difference that makes a difference:
 *  not mere mention ("Liff" in a film list — a difference that makes no
 *  difference), but co-reference of the ask's named subjects in a people-record/
 *  relationship source. Each framing is independent; dissent is disclosed.
 *
 *    identity — the exact named entity is present ("zachary liff"), or the one
 *               subject of a single-name ask
 *    coref    — TWO or more of the ask's named subjects co-occur (judy + liff,
 *               liff + nashville): the strongest signal for a relationship
 *    record   — the page is a people-record/relationship source or says a
 *               relation in words
 *
 *  Convergence: a multi-subject ask needs coref AND (identity OR record) — so a
 *  page naming "Spencer Liff" (coref 1, not a record) dies, while "Judy Liff,
 *  Nashville" (coref 2, a record) lives. A single-subject ask needs identity. */
export function framings(r, entities = []) {
  if (!entities.length) return { identity: true, coref: true, record: true, matters: true, present: [] };
  const hay = one(String(r.title || "") + " " + String(r.snippet || "") + " " + String(r.url || "")).toLowerCase();
  const multi = entities.filter((e) => String(e).split(/\s+/).length >= 2 && e.length > 3);
  const single = entities.filter((e) => String(e).split(/\s+/).length === 1 && e.length > 2);
  const surnames = multi.flatMap((e) => String(e).split(/\s+/).slice(1));
  const subjects = [...new Set([...multi, ...surnames, ...single])].filter((s) => s.length > 2);
  const present = subjects.filter((s) => hay.includes(String(s).toLowerCase()));
  const identity = multi.some((e) => hay.includes(String(e).toLowerCase()))
    || (!multi.length && single.some((e) => hay.includes(String(e).toLowerCase())));
  const coref = present.length >= 2;
  const record = PEOPLE_RECORD_RE.test(hay) || RELATION_RE.test(hay);
  const matters = multi.length ? (coref && (identity || record)) : identity;
  return { identity, coref, record, matters, present: present.slice(0, 4) };
}

/** Is a search result ON-TOPIC for the ask? The swarm's verdict. */
export function onTopic(r, entities = []) {
  return framings(r, entities).matters;
}

/** Search several scopes at once, then read the top results into passages the
 *  turn can be grounded on. Returns { results, passages, trace }. A multi-entity
 *  question is searched per entity and merged, so the passages are about the
 *  entities asked for. Only ON-TOPIC results are read — the rest are skipped
 *  and named in the trace, never fetched. */
export const EFFORT = {
  // fast: one web search, 2 reads, no swarm gate, no entity split
  fast: { scopes: ["web"], read: 2, gate: false },
  // balanced: full scopes + per-entity split + swarm gate (the default)
  balanced: { scopes: ["web", "wikipedia", "github", "archive", "openalex", "crossref"], read: 3, gate: true },
  // deep: all scopes, MANY reads, the swarm gate (same as balanced — the harder
  // thinking happens in the FALSIFY pass on the claims, not by starving reads),
  // plus the falsify pass which re-checks every grounded claim.
  deep: { scopes: ["web", "wikipedia", "github", "archive", "openalex", "crossref"], read: 6, gate: true, strict: false, falsify: true },
};

export async function searchWeb(query, { scopes = EFFORT.balanced.scopes, read = EFFORT.balanced.read, effort = "balanced", perScope = 4, fetchImpl = fetch, onStep = null } = {}) {
  const cfg = EFFORT[effort] || EFFORT.balanced;
  scopes = cfg.scopes;
  read = cfg.read;
  const step = (s) => { if (onStep) { try { onStep(s); } catch (e) {} } };
  const trace = [];
  const results = [];
  const queries = queriesFor(query);
  // The OPEN-WEB scope searches the FULL natural query — DDG/Brave handle the
  // whole ask best ("Judy Liff Zachary Liff Nashville" surfaces people records;
  // a split "Judy" returns Wikipedia). The API scopes (Wikipedia, GitHub, …)
  // search PER ENTITY, because a bag-of-words query to them returns whatever
  // page happens to mention all the names (measured: "Snowden disclosures").
  const scopesFor = () => {
    const out = [{ q: query, s: "web" }];
    for (const q of queries) for (const s of scopes) if (s !== "web") out.push({ q, s });
    return out;
  };
  const settled = [];
  for (const { q, s } of scopesFor()) {
    step({ phase: "searching", scope: s, q });
    try {
      const out = await search(s, q, 0, { fetchImpl });
      trace.push({ scope: s, q, engine: out.engine, n: out.results.length, ok: true });
      step({ phase: "found", scope: s, q, engine: out.engine, n: out.results.length });
      settled.push(out.results.map((r) => ({ ...r, _q: q })).slice(0, perScope));
    } catch (e) {
      trace.push({ scope: s, q, ok: false, why: String(e.message || e) });
      step({ phase: "failed", scope: s, q, why: String(e.message || e) });
      settled.push([]);
    }
  }
  for (const list of settled) results.push(...list);
  // Read the top few into passages (the material the answer is grounded on).
  // Pages that answer a browser directly come first (Wikipedia articles read
  // as HTML); DOI/journal links often only serve PDFs or refuse cross-origin
  // reads, so they are tried last — and every read is time-boxed so one slow
  // host cannot hold the turn.
  const rank = (r) => (r.kind === "web" || /wikipedia\.org\/wiki\//.test(r.url) ? 0 : /(^|\.)doi\.org|pdf|\.pdf$/i.test(r.url) ? 3 : /github\.com/.test(r.url) ? 2 : 1);
  const ordered = [...results].sort((a, b) => rank(a) - rank(b));
  const readable = ordered.filter((r) => rank(r) < 3);
  const poolAll = readable.length ? readable : ordered;
  // ON-TOPIC GATE: only candidates that actually mention the named entities are
  // read. Off-topic results are skipped (and named in the trace), never fetched
  // — this is what keeps the fold from reading "Judy (film)" for a Judy Liff ask.
  const entities = entitiesOf(query);
  // The swarm gate is an EFFORT lever: fast skips it (reads whatever ranks top);
  // balanced uses the standard convergence; deep requires the strict quorum —
  // for a multi-subject ask that means identity AND co-reference AND record.
  let pool = poolAll;
  let skippedOff = 0;
  if (cfg.gate) {
    const hasMulti = entities.some((e) => String(e).split(/\s+/).length >= 2);
    const ok = (r) => {
      const f = framings(r, entities);
      if (!cfg.strict) return f.matters;
      // DEEP strict: co-reference AND a people-record/relation source. Exact
      // identity is too brittle for middle initials ("Zachary P Liff"), so the
      // deep bar is coref && record for a multi-subject ask, identity && record
      // for a one-name ask.
      return hasMulti ? (f.coref && f.record) : (f.identity && f.record);
    };
    pool = poolAll.filter(ok);
    skippedOff = poolAll.length - pool.length;
    if (skippedOff > 0) {
      const why = {};
      for (const r of poolAll) if (!ok(r)) {
        const f = framings(r, entities);
        why[f.identity && f.coref ? "identity" : f.coref ? "coref-only" : f.identity ? "identity-only" : "none"] = (why[f.identity && f.coref ? "identity" : f.coref ? "coref-only" : f.identity ? "identity-only" : "none"] || 0) + 1;
      }
      trace.push({ scope: "topic", ok: true, skippedOff, engine: "swarm gate", strict: !!cfg.strict, dissent: why });
      step({ phase: "skipped", n: skippedOff });
    }
  }
  // Diversify: take the best result PER query first (so each entity asked for
  // gets its own passage), then fill from the rest. Without this a single
  // entity's article can fill every read slot.
  const chosen = [], usedUrl = new Set(), perQuery = new Map();
  for (const r of pool) {
    if (!r.url || usedUrl.has(r.url)) continue;
    const q = r._q ?? "";
    if ((perQuery.get(q) || 0) >= 1) continue;
    perQuery.set(q, 1); usedUrl.add(r.url); chosen.push(r);
  }
  for (const r of pool) { if (!r.url || usedUrl.has(r.url)) continue; if (chosen.length >= read) break; usedUrl.add(r.url); chosen.push(r); }
  const want = Math.min(read, chosen.length, 5);
  // Read with BOUNDED concurrency: each read parses a whole HTML document
  // (DOMParser) in the browser tab, and parsing many big pages at once OOMs the
  // renderer. Read a few at a time.
  const reads = [];
  const CONC = 2;
  for (let i = 0; i < chosen.length; i += CONC) {
    const batch = chosen.slice(i, i + CONC);
    const done = await Promise.all(batch.map(async (r) => {
      step({ phase: "reading", url: r.url, site: r.source, title: r.title });
      const rd = await readText(r.url, { fetchImpl, timeoutMs: 8000 });
      step({ phase: rd.ok ? "read" : "unread", url: r.url, site: r.source, title: r.title, via: rd.via, chars: rd.ok ? rd.text.length : 0 });
      return { r, rd };
    }));
    reads.push(...done);
  }
  const passages = [];
  for (const { r, rd } of reads) {
    if (rd.ok && passages.length < want) { passages.push({ ref: r.source + " — " + r.title, source: r.url, text: rd.text, via: rd.via, url: r.url }); trace.push({ read: r.url, via: rd.via, chars: rd.text.length }); }
    else if (rd.ok) trace.push({ read: r.url, via: rd.via, chars: rd.text.length, skipped: true });
    else trace.push({ read: r.url, via: null, ok: false });
  }
  return { results, passages, trace };
}
