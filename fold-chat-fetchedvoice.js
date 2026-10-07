// fold-chat-fetchedvoice.js — FETCHED VOICES (docs/VOICE.md stage 5): voices beyond the archon canon. Pure: no DOM, no IO, no clock; the search, the page read, the clock
// and the hash are INJECTED. Ant C6, 2026-10-06; pre-registration eval/ants/C6-PREREG.md; results eval/ants/C6-RESULTS.md.
//
// The rule of the canon, extended: an archon with no verified words is named and refused, never ventriloquized. For a person the web search surfaces, a page is admitted to a
// per-session VOICE BANK only if its text is the PERSON'S OWN WORDS in a source that attributes them to that person. Not a biography ABOUT them, not a quote farm, not an
// "AI blog" of what they "would say". The decision is MECHANICAL (host class, title cues, author evidence, pronoun and person statistics, quote density); no model decides.
//
//   classifyPage({ person, url, html|text, title, opts })  → { verdict: "own"|"unsure"|"refuse", reasons:[…], attribution:{ tier, evidence:[…] }, features, standing }
//   fetchVoice({ person, url, read, now, hash, fw })       → { verdict, reasons, entry? }       read(url) → { ok, html?, text?, title?, url?, via?, status? }
//   voicesFor({ person, search, read, now, hash, fw, limits }) → { entries, trail }             a person → searched pages → classified, ranked by host kind
//   createFetchedBank({ fw })                              the per-session bank: admit(entry), archons() (fold-chat-voice buildIndex shape), bank() (quoteFromBank shape), verify()
//
// DECLARED, not measured (II.11): every threshold in VOICE_FETCH and the tables below. Giver: C6 author's priors, 2026-10-06; thresholds are NOT fitted to the battery.
// English-only cues (pronouns, "by", title patterns): in another language the gate is typed-silent (attribution and host rules still apply; fp = 0 → never "own").

import * as ground from "./fold-chat-ground.js";
import { sentencesWithOffsets } from "./fold-chat-impression.js";
import { dropReason as primaryDrop, kindOf } from "./fold-chat-primary.js";

export const VOICE_FETCH = Object.freeze({
  giver: "C6 author's priors, 2026-10-06; declared, not measured (II.11)",
  maxChars: 40000,          // body statistics are taken over this many characters
  maxStore: 400000,         // text kept for an admitted voice
  fpOwn: 6,                 // first-person pronouns per 1000 words that make a text speak AS the person
  nmThird: 4,               // surname mentions per 1000 words for a text that talks ABOUT them
  quoteShare: 0.25,         // share of characters inside quotation marks that makes a quote compilation
  attrLines: 3,             // "— Name" attribution lines that make a quote compilation
  bioRate: 1.5,             // biography cues per 1000 words
  headingChars: 600,        // how much of the opening a name must appear in to count as a heading
  bylineChars: 1500,        // how far into the body a "By <Name>" byline is looked for
  sentMin: 40, sentMax: 320,
  termsMax: 60,
  maxPages: 4, maxResults: 8, maxQueries: 2,
});

// ─────────────── declared tables ───────────────

/** Quote aggregators and the like: never a voice (misattribution is the norm; even a "sourced" compilation is a pointer, not their text). */
export const QUOTE_FARMS = Object.freeze([
  /(^|\.)(brainyquote\.com|goodreads\.com|azquotes\.com|quotefancy\.com|wikiquote\.org|quotes\.net|quotationspage\.com|thinkexist\.com|keepinspiring\.me|quotegarden\.com|searchquotes\.com|quotery\.com|quotepark\.com|inspiringquotes\.us|izquotes\.com|picturequotes\.com|quoteinvestigator\.com|allgreatquotes\.com|successories\.com|bookroo\.com|filmsite\.org)$/i,
]);
/** Primary-text archives that fold-chat-primary.js's "any wiki-something host is a mirror" rule would drop (measured live 2026-10-06: Wikisource, which docs/VOICE.md names as a source, is dropped by it). A volunteer-transcribed
 *  text on these hosts is the AUTHOR'S text; the attribution and voice rules still apply to it. */
export const ARCHIVE_ALLOW = Object.freeze([/(^|\.)wikisource\.org$/i]);
const dropReason = (url) => (ARCHIVE_ALLOW.some((re) => re.test(hostOf(url))) ? null : primaryDrop(url));
/** Personal-publishing platforms: a person's own writing can live there, but only an author field that names them admits it (a heading is not enough). */
export const PLATFORMS = Object.freeze([/(^|\.)(medium\.com|substack\.com|blogspot\.[a-z.]+|wordpress\.com|tumblr\.com|beehiiv\.com|ghost\.io|github\.io)$/i]);
const ORG_WORDS = /\b(foundation|library|institute|press|project|university|archive|archives|review|society|committee|administration|staff|editors?|editorial|department|office|council|museum|college|publishing|publications?|magazine|journal|news|times|post|company|inc|ltd|llc|team|authors?|contributors?|privacy|cloudflare|wikimedia|combinator|admin|webmaster)\b/i;
const GENRE = /\b(address|speech|letter|essay|lecture|oration|sermon|declaration|inaugural|manifesto|treatise)\b/;
const TITLE_CUES = Object.freeze([
  [/\b(what|how)\s+(would|did|might|could)\s+[^.?!]{1,60}\b(say|think|do|respond|react|feel)\b/i, "hypothetical_title"],
  [/\bwould\s+(say|think|tell|do)\b/i, "hypothetical_title"],
  [/\b\d{1,3}\+?\s+(?:[\w'’-]+\s+){0,3}quotes\b/i, "quote_listicle_title"],
  [/\b(?:best|top|famous|greatest|inspiring|popular)\s+(?:[\w'’-]+\s+){0,3}quotes\b/i, "quote_listicle_title"],
  [/\bquotes?\s+(?:by|from|of|about)\b/i, "quote_listicle_title"],
  [/\b(?:the\s+)?(?:wisdom|lessons|teachings|philosophy|secrets|principles)\s+(?:of|from)\s+/i, "secondary_genre_title"],
  [/\bfor\s+modern\s+(?:life|times|leaders?|living)\b/i, "secondary_genre_title"],
]);

// ─────────────── small helpers ───────────────

const hostOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const fold = (s) => String(s ?? "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
const words = (t) => String(t ?? "").match(/[\p{L}][\p{L}'’]*/gu) || [];
const decode = (s) => String(s ?? "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return " "; } }).replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return " "; } });
const strip = (s) => decode(String(s ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Split a person's name into { given:[…], surname, full } (suffixes dropped). Folded (accent- and case-insensitive). */
export function nameParts(person) {
  const toks = fold(typeof person === "object" && person ? person.name : person).replace(/[.,]/g, " ").split(/\s+/).filter(Boolean).filter((t) => !["jr", "sr", "ii", "iii", "iv", "the", "dr", "mr", "mrs", "st", "saint"].includes(t));
  if (!toks.length) return { given: [], surname: "", full: "" };
  return { given: toks.slice(0, -1), surname: toks[toks.length - 1], full: toks.join(" ") };
}

/** Does an author string name the person? Surname AND a given name (or its initial). Handles "Last, First" and "Name, Emperor of Rome". */
export function authorMatches(author, person) {
  if (person && typeof person === "object" && Array.isArray(person.aliases) && person.aliases.some((al) => authorMatches(author, al))) return true;
  const p = nameParts(person); if (!p.surname) return false;
  const a = new Set(fold(author).replace(/[.,]/g, " ").split(/\s+/).filter(Boolean));
  if (!a.has(p.surname)) return false;
  if (!p.given.length) return true;
  return p.given.some((g) => a.has(g) || [...a].some((t) => t.length === 1 && t === g[0]));
}
const looksLikePerson = (author) => { const a = String(author || "").trim(); return /\p{Lu}/u.test(a) && words(a).length >= 2 && words(a).length <= 6 && !ORG_WORDS.test(a); };

// ─────────────── html → text and metadata ───────────────

export function htmlToText(html) {
  let h = String(html ?? "");
  h = h.replace(/<!--[^]*?-->/g, " ").replace(/<(script|style|noscript|svg|template|iframe)[^>]*>[^]*?<\/\1>/gi, " ").replace(/<(nav|footer|header|aside|form)\b[^>]*>[^]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br|ul|ol|table|blockquote)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  return decode(h).split("\n").map((l) => l.replace(/[ \t ]+/g, " ").trim()).filter(Boolean).join("\n");
}

/** Authorship markup in an HTML page: <title>, <h1>, meta author / og:type / article:author, JSON-LD author, rel=author / itemprop=author. */
export function extractMeta(html) {
  const h = String(html ?? "");
  const out = { title: "", h1: "", authors: [], ogType: null, siteName: null };
  const t = /<title[^>]*>([^]*?)<\/title>/i.exec(h); if (t) out.title = strip(t[1]);
  const h1 = /<h1[^>]*>([^]*?)<\/h1>/i.exec(h); if (h1) out.h1 = strip(h1[1]);
  const metas = [...h.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const attr = (tag, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag); return m ? decode(m[2] ?? m[3]) : null; };
  for (const m of metas) {
    const n = (attr(m, "name") || attr(m, "property") || "").toLowerCase(), c = attr(m, "content");
    if (!c) continue;
    if (n === "author" || n === "article:author" || n === "dc.creator" || n === "dc.contributor" || n === "citation_author" || n === "twitter:creator") out.authors.push({ kind: "meta_author", value: c.trim() });
    if (n === "og:type") out.ogType = c.trim();
    if (n === "og:site_name") out.siteName = c.trim();
  }
  for (const m of h.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi)) {
    try {
      const walk = (o) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) return o.forEach(walk);
        const a = o.author ?? o.creator;
        for (const x of [].concat(a ?? [])) { const v = typeof x === "string" ? x : x?.name; if (v) out.authors.push({ kind: "jsonld_author", value: String(v).trim() }); }
        Object.values(o).forEach(walk);
      };
      walk(JSON.parse(m[1]));
    } catch {}
  }
  for (const m of h.matchAll(/<(a|span|div|p)\b[^>]*(?:rel\s*=\s*["']author["']|itemprop\s*=\s*["']author["']|class\s*=\s*["'][^"']*\b(?:byline|author)\b[^"']*["'])[^>]*>([^]*?)<\/\1>/gi)) {
    const v = strip(m[2]); if (v && v.length < 80) out.authors.push({ kind: "markup_author", value: v.replace(/^by\s+/i, "") });
  }
  return out;
}

const GUT_START = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i;
const GUT_END = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG/i;
/** Project Gutenberg plain text: header fields and the body without the licence boilerplate. */
export function gutenberg(text) {
  const t = String(text ?? "");
  const head = t.slice(0, 4000);
  if (!/project gutenberg/i.test(head)) return null;
  const f = (k) => { const m = new RegExp(`^${k}:[ \\t]*(.+)$`, "im").exec(head); return m ? m[1].trim() : null; };
  const s = GUT_START.exec(t), e = GUT_END.exec(t);
  const body = t.slice(s ? s.index + s[0].length : 0, e ? e.index : t.length).replace(/^\s+/, "");
  return { author: f("Author"), title: f("Title"), translator: f("Translator"), body };
}

// ─────────────── features ───────────────

const FP = new Set(["i", "me", "my", "mine", "myself", "we", "us", "our", "ours", "ourselves"]);
const TP = new Set(["he", "him", "his", "himself", "she", "her", "hers", "herself"]);
const BIO = [/\bwas born\b/gi, /\bborn (?:in|on|at)\b/gi, /\(\s*(?:c\.\s*)?\d{3,4}\s*[–—-]\s*\d{3,4}\s*\)/g, /\b(?:he|she) (?:died|studied|married|moved|became|served|worked|wrote|published|returned|left|joined)\b/gi, /\b(?:his|her) (?:life|career|death|early life|childhood|family|legacy|works?|writings?)\b/gi, /\bis (?:an?|the) (?:\w+\s){0,3}(?:philosopher|physicist|writer|poet|statesman|president|emperor|essayist|theologian|scientist|activist|author)\b/gi];

/** Mechanical statistics of a page body for a named person. Pure; `body` is plain text. */
export function featuresOf(body, person, cfg = VOICE_FETCH) {
  const text = String(body ?? "").slice(0, cfg.maxChars);
  const ws = words(text); const n = Math.max(1, ws.length);
  const p = nameParts(person);
  let fp = 0, tp = 0, nm = 0, thou = 0;
  for (const w0 of ws) {
    const w = w0.replace(/’/g, "'");
    const base = w.split("'")[0];
    if ((base === "I" && (w === "I" || /^I'(m|ve|ll|d)$/.test(w))) || (base !== "I" && FP.has(base.toLowerCase()) && base.toLowerCase() !== "i")) fp++;
    else if (TP.has(base.toLowerCase())) tp++;
    const lw = fold(base);
    if (p.surname && lw === p.surname) nm++;
    if (lw === "thou" || lw === "thy" || lw === "thee") thou++;
  }
  const per = (x) => (x * 1000) / n;
  // quotation share: characters inside “…” or "…" spans of plausible length
  let qchars = 0;
  for (const m of text.matchAll(/“([^”]{12,1500})”|"([^"\n]{12,1500})"/g)) qchars += m[0].length;
  const attrLines = (text.match(/^\s*[—–-]{1,2}\s*\p{Lu}[\p{L}.'’ -]{2,40}\s*$/gmu) || []).length + (text.match(/[”"]\s*[—–-]{1,2}\s*\p{Lu}[\p{L}.'’-]+(?:\s\p{Lu}[\p{L}.'’-]+){0,3}\s*$/gmu) || []).length;
  let bio = 0; for (const re of BIO) bio += (text.match(re) || []).length;
  const lines = text.split("\n").filter(Boolean);
  return { words: ws.length, fp: per(fp), tp: per(tp), nm: per(nm), thou: per(thou), quoteShare: text.length ? qchars / text.length : 0, attrLines, bio: per(bio), lines: lines.length, medianLine: lines.map((l) => l.length).sort((a, b) => a - b)[Math.floor(lines.length / 2)] || 0 };
}

// ─────────────── the decision ───────────────

/**
 * Is this page the person's OWN words? html and/or text; `title` optional. Mechanical. `opts.arm`: "full" (default) | "hosts_only" (dropped host → refuse, everything else
 * accepted: the baseline) | "features_only" (every host table off) | "features_blind" (host tables off AND the other-author rule off: text statistics, title cues and name evidence only). The verdict, the typed reasons, and the evidence travel together; nothing here is a model's word.
 */
export function classifyPage({ person, url, html = null, text = null, title = null, cfg = VOICE_FETCH, arm = "full" } = {}) {
  const reasons = [], evidence = [];
  const host = hostOf(url);
  const meta = html ? extractMeta(html) : { title: "", h1: "", authors: [], ogType: null, siteName: null };
  let body = text != null ? String(text) : html ? htmlToText(html) : "";
  const gut = gutenberg(body);
  if (gut) { body = gut.body; if (gut.author) evidence.push({ kind: "gutenberg_author", value: gut.author }); }
  const ttl = String(title || meta.title || gut?.title || "");
  const standing = { host, hostKind: kindOf(host).id, url, tier: "fetched", chars: body.length };
  const out = (verdict, why, attribution, features) => ({ verdict, reasons: Array.isArray(why) ? why : [why].filter(Boolean), attribution: attribution || { tier: "none", evidence }, features: features || null, standing: { ...standing, attribution: attribution?.tier || "none" }, title: ttl, body });

  // 1. the host
  if (arm !== "features_only" && arm !== "features_blind") {
    const platform = PLATFORMS.some((re) => re.test(host));
    const drop = platform ? null : dropReason(url);
    if (drop) return out("refuse", `host:${drop.why}`);
    if (QUOTE_FARMS.some((re) => re.test(host))) return out("refuse", "host:quote_farm");
    standing.platform = platform || undefined;
  }
  if (arm === "hosts_only") return out(body.length >= 200 ? "own" : "refuse", body.length >= 200 ? "hosts_only:accepted" : "unreadable");
  if (body.replace(/\s/g, "").length < 200) return out("refuse", "too_short");

  // 2. the title
  for (const [re, why] of TITLE_CUES) if (re.test(ttl) || re.test(meta.h1)) return out("refuse", `title:${why}`);

  // 3. author evidence
  for (const a of meta.authors) evidence.push(a);
  const by = /(?:^|\n)[ \t]*(?:[Ww]ritten[ \t]+)?[Bb]y[ \t]+(\p{Lu}[\p{L}.'’-]*(?:[ \t]+\p{Lu}[\p{L}.'’-]*){1,3})[ \t\r]*(?=\n|$|[,.;|])/u.exec(body.slice(0, cfg.bylineChars));
  if (by) evidence.push({ kind: "byline", value: by[1].trim() });
  const p = nameParts(person);
  const matched = evidence.filter((e) => authorMatches(e.value, person));
  const others = evidence.filter((e) => !authorMatches(e.value, person) && looksLikePerson(e.value) && !/^(admin|staff|editor)/i.test(e.value));
  for (const e of evidence) e.matches = authorMatches(e.value, person);
  if (!matched.length && others.length && arm !== "features_blind") return out("refuse", `author_is_other:${others[0].value}`, { tier: "other", evidence });
  let tier = "none";
  if (matched.length) tier = "strong";
  else {
    const label = host.replace(/\.[a-z.]+$/, "").split(".").pop() || "";   // registrable label, e.g. paulgraham
    const lab = fold(label).replace(/[^a-z]/g, "");
    if (p.surname && (lab === p.surname || (p.given.length && (lab === p.given[0] + p.surname || lab === p.given[0][0] + p.surname)))) { tier = "host_is_person"; evidence.push({ kind: "host_is_person", value: host, matches: true }); }
    else {
      const open = fold(ttl + " " + meta.h1 + " " + body.slice(0, cfg.headingChars));
      if (p.surname && open.includes(p.surname) && (!p.given.length || p.given.some((g) => open.includes(g)))) { tier = "heading"; evidence.push({ kind: "heading", value: p.full, matches: true }); }
      else if (p.surname && GENRE.test(fold(ttl + " " + meta.h1)) && new RegExp(`(^|[^a-z])${p.surname}([^a-z]|$)`).test(fold(ttl + " " + meta.h1))) { tier = "genre_heading"; evidence.push({ kind: "genre_heading", value: ttl, matches: true }); }
    }
  }
  const attribution = { tier, evidence };
  const f = featuresOf(body, person, cfg);
  if (standing.platform && tier !== "strong") return out("refuse", "platform_unattributed", attribution, f);

  // 4. what the text is: a compilation of sayings, a biography, a text about them
  if (f.quoteShare >= cfg.quoteShare) return out("refuse", `quote_farm:share_${f.quoteShare.toFixed(2)}`, attribution, f);
  if (f.attrLines >= cfg.attrLines) return out("refuse", `quote_farm:attribution_lines_${f.attrLines}`, attribution, f);
  if (f.bio >= cfg.bioRate && f.tp > f.fp) return out("refuse", "biography", attribution, f);
  if (f.tp > 0 && f.tp >= 2 * f.fp && f.nm >= cfg.nmThird) return out("refuse", "third_person_about", attribution, f);

  // 5. attribution and voice
  if (tier === "none") return out("refuse", "no_attribution", attribution, f);
  if (f.fp >= cfg.fpOwn) return out("own", [`attribution:${tier}`, `first_person:${f.fp.toFixed(1)}/1000`], attribution, f);
  if (tier === "strong") return out("unsure", ["attributed_but_impersonal", `first_person:${f.fp.toFixed(1)}/1000`], attribution, f);
  return out("refuse", `no_first_person:${f.fp.toFixed(1)}/1000`, attribution, f);
}

// ─────────────── the bank entry (provenance) ───────────────

/** sha256 hex of a string through WebCrypto (browser and Node). Injected `hash` overrides. */
export async function sha256Hex(s) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const licenseOf = (host) => (/(^|\.)gutenberg\.org$/i.test(host) ? "public domain in the US (Project Gutenberg); verify per work" : /(^|\.)(wikisource\.org|archive\.org)$/i.test(host) ? "per-work; verify" : "unverified: short quote with its source only, never stored in bulk");
const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stemOf = (t) => (ground.stemOf ? ground.stemOf(t) : t);

/** The quotable sentences of a stored text, as the canon's voice-bank has them: { text, start, end, stems } with offsets into `text`. */
export function sentenceBank(text, fw = null, cfg = VOICE_FETCH) {
  const out = [];
  for (const s of sentencesWithOffsets(String(text ?? ""))) {
    const len = s.end - s.start;
    if (len < cfg.sentMin || len > cfg.sentMax) continue;
    if (((s.text.match(/\p{L}/gu) || []).length) / len < 0.7) continue;
    if (!/[.!?。！？]["')\]”’」』]*$/u.test(s.text)) continue;
    const stems = [...new Set(ground.tokenize(s.text).filter((t) => t.length >= 4 && !(fw && fw.has(t))).map(stemOf))];
    if (stems.length >= 2) out.push({ text: s.text, start: s.start, end: s.end, stems });
  }
  return out;
}

/** The most-used content words of the text: the fetched voice's `terms`. A STAND-IN for the canon's concern-field recipe (no seeded null, no two-seed intersection) and labelled as such. */
export function termsOf(text, fw = null, cfg = VOICE_FETCH) {
  const c = new Map();
  for (const w of words(text)) { const t = fold(w); if (t.length < 5 || (fw && fw.has(t))) continue; c.set(t, (c.get(t) || 0) + 1); }
  return [...c].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, cfg.termsMax).map(([t]) => t);
}

/** The entry for an accepted page: the text exactly as stored, its sha256, and the standing. Everything an audit needs to re-verify the fetch and detect a changed page. */
export async function buildEntry({ person, classified, fetchedAt, via = null, finalUrl = null, hash = sha256Hex, fw = null, cfg = VOICE_FETCH }) {
  const text = classified.body.slice(0, cfg.maxStore);
  const sha256 = await hash(text);
  const s = classified.standing;
  return {
    handle: `fetched:${slug(person)}:${sha256.slice(0, 8)}`,
    giver: person, work: classified.title || s.url, grade: "fetched",
    source: { path: s.url, url: s.url, finalUrl: finalUrl || s.url, host: s.host, hostKind: s.hostKind, fetchedAt, via, sha256, chars: text.length, license: licenseOf(s.host) },
    standing: { ...s, tier: "fetched", verdict: classified.verdict, attribution: classified.attribution, reasons: classified.reasons, features: classified.features },
    terms: termsOf(text, fw, cfg), termsRecipe: "tf-standin (not the canon concern-field recipe)",
    text, bank: sentenceBank(text, fw, cfg),
  };
}

/** Fetch ONE page for ONE person and decide. `read(url)` → { ok, html?, text?, title?, url?, via? }. Returns { verdict, reasons, entry? (own only), standing }. */
export async function fetchVoice({ person, url, read, now = () => new Date().toISOString(), hash = sha256Hex, fw = null, cfg = VOICE_FETCH, arm = "full" } = {}) {
  const hostless = arm === "features_only" || arm === "features_blind";
  const pre = hostless ? null : dropReason(url);
  if (pre && !PLATFORMS.some((re) => re.test(hostOf(url)))) return { verdict: "refuse", reasons: [`host:${pre.why}`], unread: true, standing: { host: hostOf(url), url } };
  if (!hostless && QUOTE_FARMS.some((re) => re.test(hostOf(url)))) return { verdict: "refuse", reasons: ["host:quote_farm"], unread: true, standing: { host: hostOf(url), url } };
  let page; try { page = await read(url); } catch (e) { if (e && (e.name === "AbortError")) throw e; return { verdict: "unreadable", reasons: ["read_threw"], standing: { host: hostOf(url), url } }; }
  if (!page || page.ok === false || (!page.html && !page.text)) return { verdict: "unreadable", reasons: [page?.why || "read_failed"], standing: { host: hostOf(url), url } };
  const fetchedAt = now();
  const c = classifyPage({ person, url: page.url || url, html: page.html || null, text: page.html ? null : page.text, title: page.title, cfg, arm });
  const res = { verdict: c.verdict, reasons: c.reasons, standing: { ...c.standing, fetchedAt, via: page.via || null }, attribution: c.attribution, features: c.features };
  if (c.verdict === "own") res.entry = await buildEntry({ person, classified: c, fetchedAt, via: page.via || null, finalUrl: page.url || url, hash, fw, cfg });
  return res;
}

// ─────────────── person → search → pages → entries ───────────────

/** Two queries for a person's own words (no model): their full text/essay/speech/letter; and the same on the open archives. Only the NAME enters a query. */
export function queriesForPerson(person, max = VOICE_FETCH.maxQueries) {
  const n = String(person || "").replace(/["]/g, "").trim();
  return [`"${n}" full text essay OR speech OR letter OR address`, `${n} in his own words site:gutenberg.org OR site:wikisource.org OR site:archive.org`].slice(0, max);
}
const RANK = { government: 5, education: 5, organisation: 3, agency: 2, other: 2 };
const archiveBonus = (host) => (/(^|\.)(gutenberg\.org|wikisource\.org|archive\.org|loc\.gov|avalon\.law\.yale\.edu)$/i.test(host) ? 10 : 0);

/** Rank search hits for reading: drop what is dropped by host; archives first; a host that is the person's own name next; then host kind. */
export function rankHits(person, hits) {
  const p = nameParts(person); const seen = new Set(); const rows = [];
  for (const h of hits || []) {
    const host = hostOf(h?.url); if (!host || seen.has(h.url)) continue; seen.add(h.url);
    const platform = PLATFORMS.some((re) => re.test(host));
    if (!platform && (dropReason(h.url) || QUOTE_FARMS.some((re) => re.test(host)))) continue;
    const lab = fold(host.replace(/\.[a-z.]+$/, "").split(".").pop()).replace(/[^a-z]/g, "");
    const own = p.surname && lab.includes(p.surname) ? 4 : 0;
    rows.push({ ...h, host, score: archiveBonus(host) + own + (RANK[kindOf(host).id] || 2) - (platform ? 1 : 0) });
  }
  return rows.sort((a, b) => b.score - a.score);
}

/** The whole path for a person: search, rank, read at most `maxPages`, classify; the accepted entries and the full trail (every page, why). */
export async function voicesFor({ person, search, read, now, hash, fw = null, limits = {}, cfg = VOICE_FETCH } = {}) {
  const lim = { ...VOICE_FETCH, ...limits }; const trail = []; const entries = []; let hits = [];
  for (const q of queriesForPerson(person, lim.maxQueries)) {
    let r; try { r = await search(q); } catch (e) { if (e && e.name === "AbortError") throw e; trail.push({ query: q, verdict: "search_failed" }); continue; }
    hits = hits.concat((r || []).slice(0, lim.maxResults));
  }
  const ranked = rankHits(person, hits);
  const dropped = new Set(ranked.map((r) => r.url));
  for (const h of hits) if (h?.url && !dropped.has(h.url)) trail.push({ url: h.url, host: hostOf(h.url), verdict: "refuse", reasons: ["host:dropped_unread"] });
  let read_n = 0;
  for (const h of ranked) {
    if (read_n >= lim.maxPages) break; read_n++;
    const r = await fetchVoice({ person, url: h.url, read, now, hash, fw, cfg });
    trail.push({ url: h.url, host: h.host, verdict: r.verdict, reasons: r.reasons });
    if (r.entry) entries.push(r.entry);
  }
  return { entries, trail };
}

// ─────────────── the per-session bank, shaped for fold-chat-voice.js ───────────────

export function createFetchedBank({ fw = null } = {}) {
  const entries = new Map();
  return {
    /** Admit an entry from fetchVoice (verdict own only). Idempotent on the handle (same person + same bytes). */
    admit(entry) { if (!entry || entry.standing?.verdict !== "own" || entry.grade !== "fetched") return false; entries.set(entry.handle, entry); return true; },
    size: () => entries.size,
    handles: () => [...entries.keys()],
    /** The archon records buildIndex(archons, fw) takes: { handle, giver, work, source, terms, grade } */
    archons: () => [...entries.values()].map((e) => ({ handle: e.handle, giver: e.giver, work: e.work, source: e.source, terms: e.terms, grade: "fetched" })),
    /** { [handle]: [{ text, start, end, stems }] }: asideOf({ bank }) / quoteFromBank */
    bank: () => Object.fromEntries([...entries].map(([h, e]) => [h, e.bank])),
    /** The page is re-read: does it still hold the bytes we stored? A changed page is detected, never silently re-quoted. */
    async verify(handle, newText, hash = sha256Hex) { const e = entries.get(handle); if (!e) return { ok: false, why: "unknown_handle" }; const s = await hash(String(newText ?? "").slice(0, VOICE_FETCH.maxStore)); return s === e.source.sha256 ? { ok: true } : { ok: false, why: "page_changed", was: e.source.sha256, now: s }; },
    /** The sentence at a span slices back verbatim from the stored text. */
    spanOk(handle, start, end, quote) { const e = entries.get(handle); return !!e && e.text.slice(start, end) === quote; },
    drop: (handle) => entries.delete(handle),
  };
}
