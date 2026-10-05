// fold-chat-deid.js — take the identifying details out of a request before it leaves, put them back in the reply.
//
// This is PSEUDONYMIZATION, and the audit grades it as exactly that ("masked", never "sealed"):
// names, folder paths, file names, emails, phone numbers, keys, usernames and private hostnames are replaced
// with stable placeholders (PERSON-like words, never the originals), the real values stay in a map held in
// this closure, and the reply is mapped back locally. The structure of the request and of the code is
// untouched, so the outside service can still read what the code DOES. It cannot read who it is about or where
// it lives — unless that detail is one this module has no way to recognise (see "what it does not catch").
//
// What it masks:
//   • every term in the taint registry (everything the Fold read or learned locally: folder paths, filenames,
//     names and identifiers from the person's files — fold-chat-seal.js createTaint)
//   • credentials (keys, tokens, bearer strings, password assignments — the VALUE only, the name stays)
//   • the username inside a home path (/Users/<x>/…, C:\Users\<x>\…), and that username anywhere else in the text
//   • email addresses, phone numbers, SSN-shaped ids, private IPv4 addresses, .local/.internal/.corp/.lan hosts
//   • `extra` terms: named things the caller found in THIS request — the khora/holograph's read of the ask names
//     them (its referents), and namesIn() is the floor when that read comes back empty. Matched as whole words
//     (a name is not a substring of "maintain"), unlike registry terms, which match as substrings to fail safe.
//   • a title and the name after it ("Dr. Kim", "Mrs Okafor")
// What it does not catch: a personal detail that is neither registered, nor read as a referent, nor shaped like
// any of the above — a lone lowercase name, a public URL that is itself identifying.
//
// Pure: no DOM, no network. The map is the key; it is never exported, logged or recorded.

import { SECRET_PATTERNS, EMAIL } from "./fold-chat-seal.js";

const PREFIXES = ["USER", "PATH", "FILE", "TERM", "EMAIL", "PHONE", "SECRET", "HOST", "ID"];
const PLACEHOLDER = new RegExp("(?:" + PREFIXES.join("|") + ")_\\d+", "g");
const ONLY_PLACEHOLDER = new RegExp("^(?:" + PREFIXES.join("|") + ")_\\d+_?$");
const GENERIC_USERNAMES = new Set(["user", "users", "admin", "root", "runner", "ubuntu", "shared", "guest", "node", "home", "app", "ec2-user"]);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const global = (re) => new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
const prefixOfKind = (kind) => (/path|folder/i.test(kind) ? "PATH" : /file/i.test(kind) ? "FILE" : /user/i.test(kind) ? "USER" : "TERM");

// Shapes found by pattern, in order. `group` masks only that capture (a password's value, not its name).
const SECRET_WHOLE = SECRET_PATTERNS.filter(([k]) => k !== "password assignment").map(([, re]) => ({ prefix: "SECRET", re: global(re) }));
const PATTERNS = [
  ...SECRET_WHOLE,
  { prefix: "SECRET", re: /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?([^\s"']{8,})/gi, group: 1 },
  { prefix: "EMAIL", re: global(EMAIL) },
  { prefix: "USER", re: /(?:\/Users|\/home)\/([A-Za-z0-9._-]+)(?=\/)/g, group: 1 },
  { prefix: "USER", re: /[A-Za-z]:\\Users\\([^\\\s]+)(?=\\)/g, group: 1 },
  { prefix: "TERM", re: /\b(?:Dr|Mr|Mrs|Ms|Miss|Prof|Rev|Sen|Rep|Judge)\.?\s+([\p{Lu}][\p{L}'’-]{2,})/gu, group: 1 },
  { prefix: "ID", re: /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g },
  { prefix: "PHONE", re: /(?<![\d.])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\d])/g },
  { prefix: "HOST", re: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g },
  { prefix: "HOST", re: /\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:local|internal|corp|lan|intranet)\b/gi },
];

/** Capitalised multi-word names in a text ("Eleanor Voss") — the floor for when the holograph's read finds nothing, as it does for one-line asks. */
export function namesIn(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(/(?<![\p{L}\p{N}])\p{Lu}[\p{Ll}'’-]{2,}(?:[ \t]+\p{Lu}[\p{Ll}'’-]{2,})+(?![\p{L}\p{N}])/gu)) out.add(m[0]);
  return [...out];
}

const bounded = (t) => `(?<![\\p{L}\\p{N}_])${esc(t)}(?![\\p{L}\\p{N}_])`;

/** A fresh masker. One per outbound request: its numbering and map die with it. `taint` is a createTaint() registry. */
export function createDeid({ taint = null, extra = [] } = {}) {
  const extras = [...new Map((extra || []).map((e) => (typeof e === "string" ? { term: e, kind: "name" } : e)).filter((e) => e?.term && String(e.term).trim().length >= 3).map((e) => [String(e.term).trim(), { term: String(e.term).trim(), kind: e.kind || "name", whole: e.whole !== false }])).values()];
  const extraRe = (e) => new RegExp(e.whole ? bounded(e.term) : esc(e.term), "iu");   // a piece of an identifier has no word edges to hold to
  const forward = new Map();   // "PREFIX\u0000surface" → placeholder
  const back = new Map();      // placeholder → original surface form (exactly as it appeared)
  const guarded = new Set();   // placeholders written right before a digit: unmask must eat the "_" we added
  const counters = new Map();
  const reserved = new Set();  // placeholder-shaped tokens the text already contains — never issued, so nothing is confused

  const issue = (prefix, surface, followedBy) => {
    const k = prefix + "\u0000" + surface;
    let ph = forward.get(k);
    if (!ph) {
      let n = counters.get(prefix) || 0;
      do { n++; ph = `${prefix}_${n}`; } while (reserved.has(ph));
      counters.set(prefix, n); forward.set(k, ph); back.set(ph, surface);
    }
    // "term" + "2" must not become TERM_12: a digit after the placeholder gets a separator the unmask knows to eat.
    if (/\d/.test(followedBy || "")) { guarded.add(ph); return ph + "_"; }
    return ph;
  };

  // The terms to replace in one text: what the registry finds in it, plus the usernames that home paths reveal.
  const termsIn = (text) => {
    const found = new Map();   // surface → { prefix, whole }; longest replaced first
    if (taint) for (const h of taint.scan(text)) found.set(h.term, { prefix: prefixOfKind(h.kind || ""), whole: false });
    for (const e of extras) if (extraRe(e).test(text) && !found.has(e.term)) found.set(e.term, { prefix: prefixOfKind(e.kind), whole: e.whole });
    for (const m of text.matchAll(/(?:\/Users|\/home)\/([A-Za-z0-9._-]{3,})(?=\/)|[A-Za-z]:\\Users\\([^\\\s]{3,})(?=\\)/g)) {
      const u = m[1] || m[2];
      if (!GENERIC_USERNAMES.has(u.toLowerCase()) && !found.has(u)) found.set(u, { prefix: "USER", whole: false });
    }
    return found;
  };

  const maskTerms = (text, terms) => {
    if (!terms.size) return text;
    const ordered = [...terms.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp(ordered.map((t) => (terms.get(t).whole ? bounded(t) : esc(t))).join("|"), "giu");
    const prefixOf = new Map([...terms].map(([t, v]) => [t.toLowerCase(), v.prefix]));
    return text.replace(re, (m, off, all) => issue(prefixOf.get(m.toLowerCase()) || "TERM", m, all[off + m.length]));
  };

  const maskPatterns = (text) => {
    let out = text;
    for (const { prefix, re, group } of PATTERNS) {
      out = out.replace(re, (...a) => {
        const all = a[a.length - 1], off = a[a.length - 2], whole = a[0];
        const val = group == null ? whole : a[group];
        if (val == null || ONLY_PLACEHOLDER.test(val)) return whole;   // already masked: a password whose value is a placeholder stays one
        const at = whole.lastIndexOf(val);
        return whole.slice(0, at) + issue(prefix, val, all[off + whole.length]) + whole.slice(at + val.length);
      });
    }
    return out;
  };

  const api = {
    /** Mask several texts that will travel together, so numbering is shared and nothing already shaped like a placeholder is mistaken for one. */
    maskAll(texts) {
      const list = texts.map((t) => String(t ?? ""));
      for (const t of list) for (const m of t.matchAll(PLACEHOLDER)) reserved.add(m[0]);
      return list.map((t) => maskPatterns(maskTerms(t, termsIn(t))));
    },
    mask(text) { return api.maskAll([text])[0]; },
    /** Put the originals back into a reply. A placeholder this request never issued is left exactly as written. */
    unmask(text) {
      return String(text ?? "").replace(new RegExp("(" + PREFIXES.join("|") + ")_(\\d+)(_(?=\\d))?", "g"), (whole, p, digits, sep) => {
        for (let k = digits.length; k >= 1; k--) {   // the longest number we actually issued ("TERM_12" before "TERM_1" + "2")
          const ph = `${p}_${digits.slice(0, k)}`;
          if (!back.has(ph)) continue;
          const rest = digits.slice(k);
          if (guarded.has(ph) && !rest && sep) return back.get(ph);              // our own "_" separator, eaten
          return back.get(ph) + rest + (sep || "");
        }
        return whole;
      });
    },
    /** What is STILL in a masked text that must not be: the kinds only, never the values. Empty = clean. */
    residual(masked) {
      const t = String(masked ?? "");
      const hits = [];
      if (taint) for (const h of taint.scan(t)) hits.push({ type: "particular", kind: h.kind });
      for (const e of extras) if (extraRe(e).test(t)) hits.push({ type: "particular", kind: e.kind });
      const stripped = t.replace(PLACEHOLDER, "§");
      for (const { prefix, re } of PATTERNS) { re.lastIndex = 0; if (re.test(stripped)) hits.push({ type: "pattern", kind: prefix.toLowerCase() }); re.lastIndex = 0; }
      return hits;
    },
    /** What was masked, by kind and count — no values. */
    stats() {
      const kinds = {};
      for (const [ph] of back) { const p = ph.slice(0, ph.indexOf("_")); kinds[p] = (kinds[p] || 0) + 1; }
      return { count: back.size, kinds };
    },
  };
  return api;
}
