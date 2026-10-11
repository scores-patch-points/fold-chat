// prep.mjs — builds the data every nav mock embeds.   node docs/playback/nav/prep.mjs   (no network, no model)
//
// REAL inputs only (nothing is invented; every quoted string is a substring of a recorded page line):
//   docs/playback/structure/data/t0.json    <- docs/playback/fixtures/turns.json [0]            "who invented the telephone?"   (3 sources)
//   docs/playback/structure/data/wall.json  <- eval/ants/falsify-checks/f3/real-b.json [10]      "Is the Great Wall ... visible from space?" (6 sources, 2 laps)
// Both are the structure stage's trims of recorded turns (see docs/playback/structure/prep.mjs); this script adds:
//   - per-line subject|verb|object atoms, cut by the app's own deriveGraph (run as shipped, via the same export shim)
//   - claim -> evidence rows (which source line states which run of the answer)
//   - name -> other places it appears (a plain case-sensitive string search over every kept line)
//   - per-source SITE TOKENS (sitestyle.mjs) from the REAL cached HTML of the same domain when eval/*/cache has one
//   - text-fragment link-outs
// Output: docs/playback/nav/data/scenarios.json
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
import { prepare, extractSiteTokens, validateTokens, firstStylesheetHref } from "./sitestyle.mjs";
import { typeOf } from "../../../fold-chat-present.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HERE, "../../..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "navshim-"));
for (const f of ["fold-chat-present.js", "fold-chat-eot.js", "fold-chat-lang.js", "fold-chat-ground.js", "fold-chat-falsify-answer.js"]) fs.symlinkSync(path.join(ROOT, f), path.join(tmp, f));
fs.symlinkSync(path.join(ROOT, "vendor"), path.join(tmp, "vendor"));
fs.writeFileSync(path.join(tmp, "pv.mjs"), fs.readFileSync(path.join(ROOT, "fold-chat-presentview.js"), "utf8") + "\nexport { deriveGraph };\n");
globalThis.document = { createElement() { return {}; }, addEventListener() {} }; globalThis.localStorage = { getItem() { return null; } };
const { deriveGraph } = await import(pathToFileURL(path.join(tmp, "pv.mjs")).href);

// ---- which cached REAL page stands for which domain's look (an own page when the cache has one; a labelled stand-in otherwise)
const CACHE = path.join(ROOT, "eval/snips/cache");
// Site look is a property of the SITE, not of one page: for each domain use the cached page of that domain whose own inline
// css + metas give the most tokens (the production relay would read the page it fetched, plus its first stylesheet).
const STAND_IN = { "skyatnightmagazine.com": "bbc.com" };       // BBC Sky at Night Magazine: no cached page of its own; the BBC page is the nearest REAL sibling. Labelled in the UI.
let hostIndex = null;
function pagesOfHost(host) {
  if (!hostIndex) {
    hostIndex = new Map();
    for (const f of fs.readdirSync(CACHE)) {
      if (!f.endsWith(".json")) continue;
      let j; try { j = JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8")); } catch { continue; }
      if (!/html/.test(j.ctype || "") || /holodeck/.test(j.url)) continue;
      let h; try { h = new URL(j.url).hostname.replace(/^www\./, ""); } catch { continue; }
      if (!hostIndex.has(h)) hostIndex.set(h, []);
      hostIndex.get(h).push(path.join(CACHE, f.replace(".json", ".body")));
    }
  }
  return hostIndex.get(host) || [];
}
const richest = new Map();
function richestPage(host) {
  if (richest.has(host)) return richest.get(host);
  let best = null;
  for (const f of pagesOfHost(host)) {
    if (!fs.existsSync(f)) continue;
    const html = fs.readFileSync(f, "utf8"); const prepared = prepare({ html });
    const found = extractSiteTokens({ html, prepared, domain: host, theme: "light" }, { typeOf }).meta.found + extractSiteTokens({ html, prepared, domain: host, theme: "dark" }, { typeOf }).meta.found;
    if (!best || found > best.found) best = { html, prepared, found, file: path.basename(f) };
  }
  richest.set(host, best); return best;
}
function looksFor(domain) {
  const host = domain.replace(/^www\./, "");
  const own = richestPage(host), alt = !own && STAND_IN[host] ? richestPage(STAND_IN[host]) : null, pg = own || alt;
  const out = { basis: own ? "own cached page" : alt ? "stand-in: " + STAND_IN[host] : "no cached page: SITE_TYPE or neutral", page: pg ? pg.file : null };
  for (const theme of ["light", "dark"]) {
    const r = extractSiteTokens({ html: pg ? "" : "", prepared: pg ? pg.prepared : null, domain: host, theme }, { typeOf });
    const bad = validateTokens(r.tokens); if (bad.length) throw new Error(domain + " " + bad.join(";"));
    out[theme] = { tokens: r.tokens, scheme: r.meta.scheme, from: r.meta.from, found: r.meta.found, contrast: r.meta.contrast };
  }
  const ty = typeOf(host); out.fav = { ch: ty.fav || (host[0] || "?").toUpperCase(), bg: ty.favBg, fg: ty.favFg };
  out.stylesheet = pg ? firstStylesheetHref(pg.html, "https://" + (alt ? STAND_IN[host] : host) + "/") : null;
  return out;
}

const STOP = new Set(["the", "a", "an"]);
const SENT_RE = /(?<=[.!?])\s+(?=[\p{Lu}\d"“(])/u;
const sentenceIn = (line, needle) => { const parts = line.split(SENT_RE); const n = String(needle || "").toLowerCase(); return parts.find((p) => n && p.toLowerCase().includes(n)) || parts.find((p) => p.length > 24) || line; };
const words = (s) => s.split(/\s+/).filter(Boolean);
const enc = (s) => encodeURIComponent(s).replace(/-/g, "%2D").replace(/,/g, "%2C");
function fragment(url, sentence) {
  const w = words(sentence); if (w.length < 2) return url;
  const start = w.slice(0, Math.min(5, w.length)).join(" "), end = w.slice(-Math.min(5, w.length)).join(" ");
  const clean = (x) => x.replace(/[“”"]/g, "");
  return url.replace(/#.*$/, "") + "#:~:text=" + (w.length <= 10 ? enc(clean(sentence)) : enc(clean(start)) + "," + enc(clean(end)));
}
function atomsOf(sentence, ask) {
  const G = deriveGraph([{ text: sentence, url: "https://x.test/", ref: "x" }], ask); const r = G.rows[0]; if (!r) return null;
  const groups = []; let i = 0; const { toks, roles } = r;
  while (i < toks.length) {
    const role = roles[i];
    if (role === "s" || role === "v" || role === "o") { let j = i; for (let k = i + 1; k < toks.length; k++) { if (roles[k] === role) j = k; else if (roles[k] === "f") continue; else break; } groups.push({ role, text: toks.slice(i, j + 1).join(" ") }); i = j + 1; } else i++;
  }
  const pick = (role) => groups.filter((g) => g.role === role).map((g) => g.text);
  return { s: pick("s"), v: pick("v"), o: pick("o"), flags: { question: /\?\s*$/.test(r.sentence) } };
}

function build(file, id) {
  const d = JSON.parse(fs.readFileSync(path.join(HERE, "../structure/data", file), "utf8"));
  const sources = d.sources.map((s) => ({
    id: s.id, domain: s.domain, site: s.site, title: s.title, url: s.url, chars: s.chars, kept: s.kept, via: s.via, clipped: !!s.clipped, lap: s.lap,
    lines: s.lines.map((l) => ({ t: l.t })), look: looksFor(s.domain),
  }));
  // atoms for every kept line's first-or-needed sentence are cut on demand below; cache by (src,line,sentence)
  const atomCache = new Map();
  const atomFor = (src, line, sentence) => { const k = src + "|" + line + "|" + sentence; if (!atomCache.has(k)) atomCache.set(k, atomsOf(sentence, d.ask)); return atomCache.get(k); };
  const claims = d.syn.map((c) => {
    const rows = [], seen = new Map();
    for (const r of c.runs) {
      const ln = sources[r.src].lines[r.line]?.t; if (!ln) continue;
      const k = r.src + "|" + r.line;
      if (!seen.has(k)) {
        const sentence = sentenceIn(ln, r.srcText); const row = { src: r.src, line: r.line, sentence, phrases: [], atoms: atomFor(r.src, r.line, sentence), frag: fragment(sources[r.src].url, sentence), also: [] };
        seen.set(k, row); rows.push(row);
      }
      const row = seen.get(k); if (!row.phrases.includes(r.srcText)) row.phrases.push(r.srcText);
      for (const a of r.also || []) if (!row.also.includes(a)) row.also.push(a);
    }
    if (c.cite && !seen.has(c.cite.src + "|" + c.cite.line)) {
      const ln = sources[c.cite.src].lines[c.cite.line]?.t; if (ln) { const sentence = sentenceIn(ln, c.cite.text); rows.push({ src: c.cite.src, line: c.cite.line, sentence, phrases: [c.cite.text], atoms: atomFor(c.cite.src, c.cite.line, sentence), frag: fragment(sources[c.cite.src].url, sentence), also: [], cite: true }); }
    }
    return { i: c.i, text: c.text, grounded: !!(c.coverage && c.coverage.grounded), why: c.coverage?.why || null, rows };
  });
  // names: every bind that really occurs in >= 2 sources by plain string search over the kept lines
  const entities = [];
  for (const b of d.binds) {
    const occ = [];
    sources.forEach((s) => s.lines.forEach((l, li) => { let at = l.t.indexOf(b.label); while (at >= 0) { const sentence = sentenceIn(l.t, b.label); if (!occ.some((o) => o.src === s.id && o.line === li && o.sentence === sentence)) occ.push({ src: s.id, line: li, sentence, frag: fragment(s.url, sentence) }); at = l.t.indexOf(b.label, at + b.label.length); } }));
    const srcs = [...new Set(occ.map((o) => o.src))];
    if (srcs.length >= 2) entities.push({ label: b.label, srcs, occ });
  }
  // a longer label that contains a shorter one ("Great Wall of China" ⊃ "Great Wall") keeps both; the rail shows the longer first
  entities.sort((a, b) => b.srcs.length - a.srcs.length || b.label.length - a.label.length);
  return { id, ask: d.ask, answer: d.answer, sources, claims, entities, failed: d.failed };
}


// ---------------------------------------------------------------- COMPOSED scenarios: real cached HTML, answer = verbatim snips (never rewritten)
// These are NOT recorded turns. Each is built from pages in eval/snips/cache so the source layers have real, different sites
// (a recorded turn's sources are mostly not in the cache). Page text = <h1/h2/h3/p/li> text of the cached HTML, the most
// relevant lines kept (keyword overlap with the ask, plus any line holding a name), in page order.
const decode = (t) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
function pageLines(html) {
  const s = html.replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const out = [];
  for (const m of s.matchAll(/<(p|li|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi)) { const t = decode(m[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(); if (t.length >= 30) out.push(t); }
  return out;
}
const BOILER = /cookie|outdated browser|log ?in|subscribe|sign up|©|copyright|swipe|to cite|cite this|MLA style|research source|quizzes|explore|our editors|nobel prize announcements|x research|photo from|photographer|trusted destination|manage alfred|academic institutions have|outreach organisations|last updated|medically reviewed|\bAll Quizzes\b|\[\d+\]/i;
function composed({ id, ask, pages, answer, agree, names }) {
  const askStems = new Set((ask.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).map((w) => w.slice(0, 5)));
  const sources = pages.map((pg, si) => {
    const all = pageLines(fs.readFileSync(path.join(CACHE, pg.file + ".body"), "utf8")).filter((l) => !BOILER.test(l) && l.length <= 700);
    const score = (l) => { const w = (l.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).map((x) => x.slice(0, 5)); return w.filter((x) => askStems.has(x)).length + (names.some((n) => l.includes(n)) ? 2 : 0) + (pg.must?.some((m) => l.includes(m)) ? 9 : 0); };
    const idx = all.map((l, i) => [i, score(l)]).filter(([, sc]) => sc > 0).sort((a, b) => b[1] - a[1]).slice(0, pg.keep || 10).map(([i]) => i).sort((a, b) => a - b);
    const lines = idx.map((i) => ({ t: all[i] }));
    const total = all.reduce((a, l) => a + l.length, 0), kept = lines.reduce((a, l) => a + l.t.length, 0);
    return { id: si, domain: pg.domain, site: pg.site, title: pg.title, url: pg.url, chars: total, kept, via: "cached page text", clipped: false, lap: 0, lines, look: looksFor(pg.domain) };
  });
  const find = (src, needle) => { const li = sources[src].lines.findIndex((l) => l.t.includes(needle)); if (li < 0) throw new Error(`composed ${id}: "${needle}" not in source ${src} (${sources[src].lines.map((l) => l.t.slice(0, 40)).join(" | ")})`); return li; };
  const atomCache = new Map();
  const atomFor = (sentence) => { if (!atomCache.has(sentence)) atomCache.set(sentence, atomsOf(sentence, ask)); return atomCache.get(sentence); };
  const row = (src, li, needle, phrases, extra = {}) => { const sentence = sentenceIn(sources[src].lines[li].t, needle); return { src, line: li, sentence, phrases, atoms: atomFor(sentence), frag: fragment(sources[src].url, sentence), also: [], ...extra }; };
  const claims = answer.map((a, i) => {
    const li = find(a.src, a.text), sentence = sentenceIn(sources[a.src].lines[li].t, a.text);
    if (sentence !== a.text) throw new Error(`composed ${id}: answer sentence is not a whole sentence: ${sentence}`);
    const rows = [row(a.src, li, a.text, [a.text], { cite: true })];
    for (const g of agree[i] || []) { const lj = find(g.src, g.needle); rows.push(row(g.src, lj, g.needle, g.phrases || [g.needle])); }
    return { i, text: a.text, grounded: true, why: null, rows };
  });
  const entities = [];
  for (const label of names) {
    const occ = [];
    sources.forEach((s) => s.lines.forEach((l, li) => { if (l.t.includes(label)) { const sentence = sentenceIn(l.t, label); if (!occ.some((o) => o.src === s.id && o.line === li && o.sentence === sentence)) occ.push({ src: s.id, line: li, sentence, frag: fragment(s.url, sentence) }); } }));
    const srcs = [...new Set(occ.map((o) => o.src))]; if (srcs.length >= 2) entities.push({ label, srcs, occ });
  }
  entities.sort((a, b) => b.srcs.length - a.srcs.length || b.label.length - a.label.length);
  return { id, composed: true, ask, answer: answer.map((a) => a.text), sources, claims, entities, failed: [] };
}
const COMPOSED = [
  composed({
    id: "nose", ask: "How do I stop a nosebleed?",
    pages: [
      { file: "70a069f0cadfa56af009c77d31c2f467321d4e54", domain: "nhs.uk", site: "NHS", title: "Nosebleed", url: "https://www.nhs.uk/conditions/nosebleed/", must: ["lean forward", "pinch your nose", "10 to 15", "blood vessels"] },
      { file: "df235667ec172b59c2fcb6f58271275a31e2a411", domain: "wikihow.com", site: "wikiHow", title: "3 Ways to Stop a Nose Bleed", url: "https://www.wikihow.com/Stop-a-Nose-Bleed", must: ["To stop a nose bleed", "Compress the nose", "blood vessels"] },
    ],
    answer: [
      { src: 1, text: "To stop a nose bleed, start by tilting your head forward so the blood drains out your nostril and not down your throat." },
      { src: 1, text: "Then, pinch the lower fleshy end of your nose between your index finger and thumb and hold it like that for 10 minutes." },
    ],
    agree: [[{ src: 0, needle: "sit down and lean forward", phrases: ["lean forward", "head tilted forward"] }], [{ src: 0, needle: "pinch your nose just above your nostrils", phrases: ["pinch your nose"] }]],
    names: ["blood vessels", "nose bleed", "nosebleed"],
  }),
  composed({
    id: "curie", ask: "What did Marie Curie win the Nobel Prize for?",
    pages: [
      { file: "554f2df8649b15f99405f3f70452b647cec56764", domain: "britannica.com", site: "Britannica", title: "Marie Curie | Biography, Nobel Prize, Accomplishments, & Facts", url: "https://www.britannica.com/biography/Marie-Curie", must: ["In 1903 they won the Nobel Prize for Physics"] },
      { file: "12abdf0ee343021fa068271df472df5dd9fa0844", domain: "nobelprize.org", site: "NobelPrize.org", title: "MARIE CURIE", url: "https://www.nobelprize.org/stories/women-who-changed-science/marie-curie/", must: ["radiation phenomena", "isolation of radium", "Pierre Curie"] },
      { file: "5182140debdde924d9bddbb76dc711f617357974", domain: "nobelprize.org", site: "NobelPrize.org", title: "Marie Curie – Biographical", url: "https://www.nobelprize.org/prizes/physics/1903/marie-curie/biographical/", must: ["isolation of polonium"] },
    ],
    answer: [
      { src: 0, text: "In 1903 they won the Nobel Prize for Physics for discovering radioactivity." },
      { src: 0, text: "In 1911 she won the Nobel Prize for Chemistry for isolating pure radium." },
    ],
    agree: [[{ src: 1, needle: "For her research in “radiation phenomena,” Curie became, in 1903", phrases: ["radiation phenomena", "1903"] }], [{ src: 1, needle: "In 1911, for the isolation of radium", phrases: ["1911", "isolation of radium"] }, { src: 2, needle: "isolation of polonium", phrases: ["radium"] }]],
    names: ["Pierre Curie", "Henri Becquerel", "Marie Curie", "radium", "polonium"],
  }),
];

const out = { built: "prep.mjs", scenarios: [build("wall.json", "wall"), build("t0.json", "t0"), ...COMPOSED] };
fs.mkdirSync(path.join(HERE, "data"), { recursive: true });
fs.writeFileSync(path.join(HERE, "data/scenarios.json"), JSON.stringify(out));
for (const s of out.scenarios) {
  console.log(s.id, "|", s.sources.length, "sources,", s.claims.length, "claims,", s.entities.length, "entities");
  for (const x of s.sources) console.log("   ", x.domain.padEnd(26), x.look.basis.padEnd(44), "light found", x.look.light.found + "/12", x.look.light.tokens.paper, x.look.dark.tokens.paper, x.look.light.scheme + "/" + x.look.dark.scheme);
  for (const c of s.claims) console.log("   claim", c.i, c.grounded ? "grounded" : "UNGROUNDED(" + c.why + ")", c.rows.map((r) => `s${r.src}:l${r.line} atoms=${r.atoms ? r.atoms.s.length + "/" + r.atoms.v.length + "/" + r.atoms.o.length : "-"}`).join(" "));
  for (const e of s.entities) console.log("   name", JSON.stringify(e.label), "in", e.srcs.join(","), "(" + e.occ.length + " sentences)");
}
// every quoted string must be a substring of a recorded line
const wallRaw = fs.readFileSync(path.join(HERE, "../structure/data/wall.json"), "utf8") + fs.readFileSync(path.join(HERE, "../structure/data/t0.json"), "utf8");
for (const s of out.scenarios) for (const c of s.claims) for (const r of c.rows) { if (!s.sources[r.src].lines[r.line].t.includes(r.sentence)) throw new Error("not verbatim: " + r.sentence); }
console.log("verbatim check ok");
