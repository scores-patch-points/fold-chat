// eval/ants/p1/mech.mjs — D+: the model-free "figure and date binder + evaluator" glue (my own, ~1 day of rung-shaped templates, NOT a product module).
// It reads figures and dates off the passages, applies fold-chat-compute.js (convertUnits, fmtNumber) and plain arithmetic, and templates a sentence made of
// the passages' own figures. Question shapes it knows (closed list, declared): convert | lifespan | year-diff | figure-diff | sum | compare | order | list-complement.
// A question whose shape is not in the list is a typed gap ("no-skill"). Nothing here calls a model, a network, or the gold fields of the battery.
import { convertUnits, fmtNumber } from "../../../fold-chat-compute.js";
const STOP = new Set("the a an and or but of in to with by for on at from as is are was were be been it its this that these those which who what when where why how than then so also there their they he she we you i her his him them do does did name tell between many much old first before after year years".split(" "));
const IRREG = { fell: "fall", fallen: "fall", born: "bear", died: "die", dying: "die", lived: "live", wrote: "write", built: "build", won: "win", began: "begin", landed: "land", landing: "land", assassinated: "assassinat", assassination: "assassinat", dedicated: "dedicat", dedication: "dedicat", completed: "complet", completion: "complet", finished: "finish", published: "publish" };
export const stem = (w) => { const l = String(w).toLowerCase(); return IRREG[l] || l.replace(/(?:ing|ed|es|s)$/, ""); };
export const toks = (s) => (String(s).toLowerCase().match(/[a-z0-9]{2,}/g) || []);
export const contentStems = (s) => toks(s).filter((w) => !STOP.has(w)).map(stem);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
export const sentencesOf = (t) => norm(t).split(/(?<=[.!?])\s+(?=[A-Z0-9"“(=])/).filter((s) => s.length > 15);
const titleOfPassage = (p) => String(p.ref || "").replace(/^.*— /, "").trim();

/** entity binding: the passages whose title the question names (all of the title's content stems, else its distinctive capitalised token) */
export function pagesFor(question, passages) {
  const qs = new Set(contentStems(question)), qlow = question.toLowerCase();
  const out = [];
  for (const p of passages) {
    const t = titleOfPassage(p); const ts = contentStems(t);
    if (!ts.length) continue;
    const hit = ts.filter((x) => qs.has(x)).length;
    let score = hit / ts.length;
    if (score < 1) { const dist = (t.match(/\b[A-Z][a-z]{3,}\b/g) || []).filter((w) => qlow.includes(w.toLowerCase()) && !STOP.has(w.toLowerCase())); if (dist.length && score >= 0.34) score = 0.9 + 0.01 * dist.length; else if (score < 1) continue; }
    out.push({ p, title: t, score, at: Math.max(0, qlow.indexOf((t.split(/\s+/).pop() || "").toLowerCase())) });
  }
  // one page per distinct surface: prefer the highest score, then the shorter title (the entity's own page over "Assassination of …")
  out.sort((a, b) => b.score - a.score || a.title.length - b.title.length);
  const seen = []; const keep = [];
  for (const o of out) { const key = contentStems(o.title).filter((x) => qs.has(x)).sort().join(","); if (seen.some((k) => k === key)) continue; seen.push(key); keep.push(o); }
  return keep.sort((a, b) => a.at - b.at);
}

// ── figures ──
const UNIT = "(?:km|m|metres?|meters?|kilomet(?:re|er)s?|mi|miles?|ft|feet|kg|lb|°F|°C|AU)";
const NUM = "\\d[\\d,]*(?:\\.\\d+)?";
const FIG = new RegExp(`(${NUM})(?:\\s*±\\s*${NUM})?\\s*(${UNIT}(?:⋅s−1)?)(?![\\w])`, "gi");
const num = (s) => Number(String(s).replace(/,/g, ""));
const UNITNAME = { "m⋅s−1": "m/s", "km⋅s−1": "km/s", m: "m", metre: "m", metres: "m", meter: "m", meters: "m", km: "km", kilometre: "km", kilometres: "km", kilometer: "km", kilometers: "km", mi: "mi", mile: "mi", miles: "mi", ft: "ft", feet: "ft", foot: "ft", "°f": "°F", "°c": "°C", au: "AU" };
const unitKey = (u) => UNITNAME[String(u).toLowerCase()] || String(u).toLowerCase();
export function figuresIn(s) { const out = []; let m; const re = new RegExp(FIG.source, "gi"); while ((m = re.exec(s))) out.push({ v: num(m[1]), unit: unitKey(m[2]), raw: m[0] }); return out; }
const DIMS = [
  [/\b(?:tall|height|high|highest|tallest)\b/i, "height"], [/\b(?:deep|depth|deepest)\b/i, "depth"], [/\b(?:long|length|longest)\b/i, "length"],
  [/\b(?:far|distance|away)\b/i, "distance"], [/\b(?:fast|speed)\b/i, "speed"], [/\b(?:boil\w*)\b/i, "boil"], [/\bfreez\w*/i, "freeze"],
];
const dimOf = (q) => { for (const [re, d] of DIMS) if (re.test(q)) return d; return null; };
const DIMCUE = { height: /\b(?:tall|height|high)\b/i, depth: /\b(?:deep|depth)\b/i, length: /\b(?:long|length|spanning|stretch\w*)\b/i, distance: /\b(?:distance|away|far)\b/i, speed: /\b(?:speed|fast)\b/i, boil: /\bboil/i, freeze: /\bfreez/i };
const TARGETUNIT = [[/\bkilomet(?:re|er)s?\b|\bkm\b/i, "km"], [/\bmet(?:re|er)s?\b/i, "m"], [/\bmiles?\b/i, "mi"], [/\bfeet\b|\bfoot\b|\bft\b/i, "ft"], [/\bfahrenheit\b/i, "°F"], [/\bcelsius\b/i, "°C"]];
const targetUnit = (q) => { for (const [re, u] of TARGETUNIT) if (re.test(q.replace(/^.*?\bin\b/i, (m) => m))) { const tail = q.slice(Math.max(0, q.search(/\bin\s+\w+\s*\??$/i))); if (re.test(tail)) return u; } for (const [re, u] of TARGETUNIT) if (re.test(q)) return u; return null; };

/** the best (value,unit) figure the page gives for a dimension: sentence overlapping the dimension cue + the question's other content stems, with a figure in a length-like unit */
export function measureOf(p, dim, extraStems = [], { prefer = null, entityTok = null } = {}) {
  const cue = DIMCUE[dim]; if (!cue) return null;
  const want = new Set(extraStems.filter((x) => !UNITSTEMS.has(x)));
  let best = null;
  sentencesOf(p.text).slice(0, 400).forEach((s, i) => {
    const cm = cue.exec(s); if (!cm) return;
    const figs = figuresIn(s).filter((f) => ["m", "km", "mi", "ft", "°F", "°C", "m/s", "km/s"].includes(f.unit));
    if (!figs.length) return;
    // the figure nearest the cue word (after it preferred)
    const after = dim === "boil" || dim === "freeze" || dim === "speed";
    const withPos = figs.map((f) => ({ ...f, d: Math.abs(s.indexOf(f.raw) - cm.index) + (s.indexOf(f.raw) < cm.index ? (after ? 80 : 15) : 0) })).sort((a, b) => a.d - b.d);
    const ov = new Set(contentStems(s).filter((x) => want.has(x))).size;
    const tok = entityTok && s.toLowerCase().includes(entityTok) ? 0.5 : 0;
    const sc = ov + tok - i * 0.1 + (prefer && withPos.some((f) => f.unit === prefer) ? 0.4 : 0) - withPos[0].d * 0.002;
    if (!best || sc > best.sc) best = { sc, s, figs: withPos, i };
  });
  return best;
}
const UNITSTEMS = new Set("m metr meter kilomet kilometr km mile mi feet foot ft fahrenheit celsius kilometre kilometer".split(" "));
const metersOf = (f) => (f.unit === "m" ? f.v : f.unit === "km" ? f.v * 1000 : f.unit === "mi" ? f.v * 1609.344 : f.unit === "ft" ? f.v * 0.3048 : null);

// ── dates ──
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const D1 = `(?:\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{3,4}|(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{3,4})`;
const dateOf = (s) => { const m = /(\d{1,2})\s+(\w+)\s+(\d{3,4})|(\w+)\s+(\d{1,2}),?\s+(\d{3,4})/.exec(s); if (!m) return null; const mo = (n) => MONTHS.split("|").indexOf(n); if (m[1]) return { y: +m[3], m: mo(m[2]), d: +m[1] }; return { y: +m[6], m: mo(m[4]), d: +m[5] }; };
export function lifeOf(p) {
  const lead = norm(p.text).slice(0, 700);
  const m = new RegExp(`()(${D1})\\s*(?:\\([^)]*\\)\\s*)?[–-]\\s*(${D1})`).exec(lead);
  if (!m) return null; const b = dateOf(m[2]), d = dateOf(m[3]); if (!b || !d) return null;
  let age = d.y - b.y; if (d.m < b.m || (d.m === b.m && d.d < b.d)) age--;
  return { born: b, died: d, age, span: m[0] };
}
const YEAR = /\b(1[0-9]{3}|20[0-9]{2})\b/g;
/** the year the page gives for an event: the sentence best matching the cue stems; the first year, or the last when the cue says completed/built/ended */
export function eventYear(p, cueStems, { last = false, titleStems = [] } = {}) {
  const ts = new Set(titleStems);
  const nonTitle = cueStems.filter((x) => !ts.has(x));
  const cs = new Set(nonTitle.length ? nonTitle : cueStems); const tt = new Set(cueStems.filter((x) => ts.has(x)));
  let best = null;
  sentencesOf(p.text).slice(0, 500).forEach((s, i) => {
    const ys = [...s.matchAll(YEAR)].map((m) => +m[1]); if (!ys.length) return;
    const st = [...new Set(contentStems(s))];
    const ov = st.filter((x) => cs.has(x)).length; if (!ov) return;
    const sc = ov * 3 + st.filter((x) => tt.has(x)).length - i * 0.3;
    if (!best || sc > best.sc) best = { sc, s, ys };
  });
  return best ? { year: last ? Math.max(...best.ys) : best.ys[0], s: best.s } : null;
}
const popOf = (p) => {
  for (const s of sentencesOf(p.text).slice(0, 80)) { if (!/\b(?:population|residents|inhabitants|people)\b/i.test(s)) continue; const m = /(\d[\d,]*(?:\.\d+)?)\s*(million)?\s*(?:people|residents|inhabitants)|population of (?:about |roughly |approximately )?(\d[\d,]*)|roughly (\d[\d,]*) residents/i.exec(s) || /(\d[\d,]{3,})/.exec(s); if (m) { const g = m[3] || m[4] || m[1]; if (g) { let v = num(g); if (m[2]) v *= 1e6; return { v, s }; } } }
  return null;
};

// ── the skills ──
const gap = (why) => ({ gap: true, why, text: "", evidence: [] });
const ok = (skill, text, evidence) => ({ gap: false, skill, text, evidence });
const nm = (title) => title.replace(/^(?:Fall of|Assassination of)\s+/i, "");
const fmt = fmtNumber;

export function answerDplus(question, passages) {
  const q = norm(question);
  const pgs = pagesFor(q, passages);
  const unit = targetUnit(q);
  const tstems = (P) => contentStems(P.title);
  const lastTok = (P) => (P.title.split(/\s+/).pop() || "").toLowerCase();
  // ── list complement: "Which of these is not ...: a, b, c, d?"  (no entity needs to be named: every passage is searched)
  { const m = /^which of (?:these|the following)[^:]*\b(?:not|n't)\b[^:]*:\s*(.+?)\??$/i.exec(q);
    if (m) {
      const opts = m[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map((x) => x.trim()).filter(Boolean);
      const qs = new Set(contentStems(q.replace(/:.*$/, "")));
      const pool = pgs.length ? pgs.map((x) => x.p) : passages;
      const re = (o) => new RegExp("\\b" + o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      let best = null;
      for (const p of pool) for (const sn of sentencesOf(p.text)) { const n = opts.filter((o) => re(o).test(sn)); if (n.length >= 2 && (!best || n.length > best.n.length)) best = { n, s: sn }; }
      if (best && best.n.length < opts.length) { const missing = opts.filter((o) => !best.n.includes(o)); if (missing.length === 1) return ok("list-complement", `${missing[0]} is the odd one out; the page lists ${best.n.join(", ")}.`, [best.s]); }
      const sup = opts.map((o) => ({ o, ok: pool.some((p) => sentencesOf(p.text).some((sn) => re(o).test(sn) && contentStems(sn).filter((x) => qs.has(x)).length >= 2)) }));
      const missing = sup.filter((x) => !x.ok).map((x) => x.o);
      if (missing.length === 1) return ok("list-complement", `${missing[0]} is the odd one out.`, []);
      return gap("list-ambiguous");
    } }
  // ── lifespan
  if (/how many years did (.+) live|how old was (.+) when (?:he|she|it) died/i.test(q)) {
    if (!pgs.length) return gap("no-entity-page");
    const L = lifeOf(pgs[0].p); if (!L) return gap("no-life-dates");
    return ok("lifespan", `${nm(pgs[0].title)} lived ${L.age} years (${L.span.replace(/^\(/, "").trim()}).`, [L.span]);
  }
  // ── convert / figure lookup
  if (/^(?:how|what|at what)\b/i.test(q) && unit && dimOf(q) && pgs.length >= 1 && !/\b(?:taller|longer|more|older|combined|which|between|how many (?:years|metres|meters))\b/i.test(q)) {
    if (/per second/i.test(q)) {
      const P = pgs[0]; const hit = P && measureOf(P.p, "speed", [], { entityTok: lastTok(P) }); if (!hit) return gap("no-figure");
      const f = hit.figs.find((x) => x.unit === "m/s"); if (!f) return gap("no-figure");
      const v = convertUnits(f.v, "m/s", "km/s"); if (v == null) return gap("no-conversion:km/s unit not in the table");
      return ok("convert", `${f.raw} = ${fmt(v)} km/s.`, [hit.s]);
    }
    const dim = dimOf(q); const P = pgs[0];
    const extra = contentStems(q).filter((x) => !tstems(P).includes(x));
    const hit = measureOf(P.p, dim, extra, { prefer: unit, entityTok: lastTok(P) });
    if (!hit) return gap("no-figure");
    const direct = hit.figs.find((f) => f.unit === unit);
    if (direct && hit.figs[0].unit === unit || direct && hit.figs.length === 1 || direct && hit.figs.indexOf(direct) <= 1) return ok("figure", `${nm(P.title)}: ${direct.raw} (stated).`, [hit.s]);
    const metric = (u) => u === "m" || u === "km"; const tm = metric(unit);
    const cand = [...hit.figs].sort((a, b) => (metric(a.unit) === tm ? 0 : 1) - (metric(b.unit) === tm ? 0 : 1));
    for (const f of cand) { const v = convertUnits(f.v, f.unit, unit); if (v != null) return ok("convert", `${f.raw} = ${fmt(v)} ${unit} (converted from the stated figure).`, [hit.s]); }
    return gap("no-conversion");
  }
  // ── year difference / figure difference / sum
  { let m;
    if ((m = /how many years (?:separate|between) (?:the )?two (.+?)\??$/i.exec(q))) {
      const P = pgs[0]; if (!P) return gap("no-entity-page");
      const ys = [...new Set([...P.p.text.matchAll(/\b(1[89]\d{2}|20\d{2}) Nobel Prize/g)].map((x) => +x[1]))];
      if (ys.length >= 2) return ok("year-diff", `${Math.abs(ys[1] - ys[0])} years separate the ${ys[0]} and ${ys[1]} prizes.`, ys.map(String));
      return gap("no-two-years");
    }
    if ((m = /how many years after the first part of (.+?) was the second part published/i.exec(q))) {
      const P = pgs[0]; const ys = P && [...P.p.text.matchAll(/published in two parts in (\d{4}) and (\d{4})/g)][0];
      if (ys) return ok("year-diff", `${+ys[2] - +ys[1]} years (${ys[1]} and ${ys[2]}).`, [ys[0]]);
      return gap("no-years");
    }
    let A = null, B = null;
    if ((m = /how many years (?:passed )?between (.+?) and (.+?)\??$/i.exec(q))) { A = m[1]; B = m[2]; }
    else if ((m = /how many years (?:before|after) (the .+? (?:was|were) \w+|.+?) (?:was|were|did) (.+?)\??$/i.exec(q))) { A = m[1]; B = m[2]; }
    if (A && B) {
      const pa = pgs.find((x) => contentStems(A).some((t) => tstems(x).includes(t))) || pgs[0];
      const pb = pgs.find((x) => x !== pa && contentStems(B).some((t) => tstems(x).includes(t))) || pgs.find((x) => x !== pa);
      if (pa && pb) {
        const ea = eventYear(pa.p, contentStems(A), { last: /finish|complet|built/i.test(A), titleStems: tstems(pa) }), eb = eventYear(pb.p, contentStems(B), { last: /finish|complet|built/i.test(B), titleStems: tstems(pb) });
        if (ea && eb) return ok("year-diff", `${Math.abs(ea.year - eb.year)} years (${ea.year} and ${eb.year}).`, [ea.s, eb.s]);
      }
      return gap("no-years");
    }
    if ((m = /how many years after the first part of (.+?) was the second part published/i.exec(q))) {
      const P = pgs[0]; const ys = P && [...P.p.text.matchAll(/published in two parts in (\d{4}) and (\d{4})/g)][0];
      if (ys) return ok("year-diff", `${+ys[2] - +ys[1]} years (${ys[1]} and ${ys[2]}).`, [ys[0]]);
      return gap("no-years");
    }
    if ((m = /how many (metres|meters|kilometres|kilometers|feet|miles) (?:taller|higher|longer|deeper|farther) is (.+?) than (.+?)\??$/i.exec(q))) {
      if (pgs.length < 2) return gap("need-two-pages");
      const dim = dimOf(q); const tu = unitKey(m[1]);
      const val = (P) => { const hit = measureOf(P.p, dim, contentStems(q).filter((x) => !tstems(P).includes(x)), { entityTok: lastTok(P) }); if (!hit) return null; const f = hit.figs.find((x) => x.unit === "m") || hit.figs[0]; return { v: metersOf(f), f, s: hit.s }; };
      const a = val(pgs[0]), b = val(pgs[1]); if (!a || !b || a.v == null || b.v == null) return gap("no-figures");
      const conv = convertUnits(Math.abs(a.v - b.v), "m", tu);
      return ok("figure-diff", `${fmt(conv)} ${tu} (${a.f.raw} versus ${b.f.raw}).`, [a.s, b.s]);
    }
    if ((m = /combined population of (.+?) and (.+?)\??$/i.exec(q))) {
      if (pgs.length < 2) return gap("need-two-pages");
      const a = popOf(pgs[0].p), b = popOf(pgs[1].p); if (!a || !b) return gap("no-population");
      return ok("sum", `${fmt(a.v + b.v)} (${fmt(a.v)} + ${fmt(b.v)}).`, [a.s, b.s]);
    }
  }
  // ── compare (figures) / order (events)
  { const two = pgs.length >= 2 ? [pgs[0], pgs[1]] : null;
    const kindOf = () => /\b(?:taller|higher)\b/i.test(q) ? "height" : /\blonger\b/i.test(q) && !/lived longer/i.test(q) ? "length" : /\bdeeper\b/i.test(q) ? "depth" : /more people|larger population|more inhabitants/i.test(q) ? "pop" : /lived longer/i.test(q) ? "life" : /who was born first/i.test(q) ? "born" : /who died first/i.test(q) ? "died" : null;
    const k = /^(?:which|who)\b/i.test(q) ? kindOf() : null;
    if (k && two) {
      const val = (P) => {
        if (k === "pop") { const r = popOf(P.p); return r && { v: r.v, s: r.s, shown: fmt(r.v) }; }
        if (k === "life") { const L = lifeOf(P.p); return L && { v: L.age, s: L.span, shown: `${L.age} years` }; }
        if (k === "born" || k === "died") { const L = lifeOf(P.p); if (!L) return null; const d = k === "born" ? L.born : L.died; return { v: d.y + d.m / 12 + d.d / 400, s: L.span, shown: String(d.y) }; }
        const hit = measureOf(P.p, k, contentStems(q).filter((x) => !tstems(P).includes(x)), { entityTok: lastTok(P) }); if (!hit) return null; const f = hit.figs.find((x) => x.unit === "m" || x.unit === "km") || hit.figs[0]; const mv = metersOf(f); return mv == null ? null : { v: mv, s: hit.s, shown: f.raw };
      };
      const a = val(two[0]), b = val(two[1]);
      if (!a || !b) return gap("no-figures-for-compare");
      const smaller = k === "born" || k === "died";
      const winA = smaller ? a.v < b.v : a.v > b.v;
      const W = winA ? two[0] : two[1], Lz = winA ? two[1] : two[0], wv = winA ? a : b, lv = winA ? b : a;
      const verb = { height: "is taller than", length: "is longer than", depth: "is deeper than", pop: "has more people than", life: "lived longer than", born: "was born before", died: "died before" }[k];
      return ok("compare", `${nm(W.title)} ${verb} ${nm(Lz.title)} (${wv.shown} versus ${lv.shown}).`, [wv.s, lv.s]);
    }
    if (/^(?:which came first|which is older|which was earlier)|^which .*\bfirst[,:]/i.test(q) || /^who (?:was born|died) first/i.test(q)) {
      const born = /born/i.test(q), died = /died/i.test(q);
      if (born || died) { if (!two) return gap("need-two-pages"); }
      const parts = /(?:first|older|earlier)[:,]?\s+(?:the )?(.+?)\s+or\s+(?:the |her |his )?(.+?)\??$/i.exec(q);
      const older = /older/i.test(q);
      const yearOf = (P, phrase) => {
        if (born || died) { const L = lifeOf(P.p); return L ? { year: (born ? L.born : L.died).y, s: L.span } : null; }
        const cs = older ? ["built", "construct", "complet", "dedicat", "open", "inaugurat", "finish", "erect"].map(stem) : contentStems(phrase);
        const r = eventYear(P.p, cs.concat(older ? [] : []), { last: older || /complet|finish|built/i.test(phrase || ""), titleStems: older ? [] : tstems(P) });
        return r && { year: r.year, s: r.s };
      };
      if (born || died) { const a = yearOf(two[0]), b = yearOf(two[1]); if (a && b) return ok("order", `${nm((a.year <= b.year ? two[0] : two[1]).title)} came first (${a.year} versus ${b.year}).`, [a.s, b.s]); return gap("no-life-dates"); }
      if (parts) {
        const [A, B] = [parts[1], parts[2]];
        const find = (phrase, not) => pgs.find((x) => x !== not && contentStems(phrase).some((t) => tstems(x).includes(t)));
        let pa = find(A, null), pb = find(B, pa);
        // one page names both events (Curie's two prizes): both phrases read off the SAME page
        if ((!pa || !pb) && pgs.length >= 1) { pa = pa || pgs[0]; pb = pb || pgs[0]; }
        if (pa && pb) {
          const a = yearOf(pa, A), b = yearOf(pb, B);
          if (a && b) { const first = a.year <= b.year ? A : B; return ok("order", `${first.replace(/^(?:the|her|his) /i, "")} came first (${a.year} versus ${b.year}).`, [a.s, b.s]); }
        }
      }
      return gap("order-unparsed");
    }
  }
  return gap("no-skill");
}
