// docs/playback/interpretation/extract.mjs — turns REAL recorded turns into the inline data the three interpretation mocks embed.
// No model, no network. Reads eval/ants/falsify-checks/f3/real-{a,b}.json and docs/playback/fixtures/turns.json (real records), runs the
// app's own pure cross-reference (falsifyAnswer / crossCheckOf) over what each record saved, and trims. Every sentence in the output is a
// verbatim substring of a recorded page; nothing is written by a model.
//   node docs/playback/interpretation/extract.mjs   -> data.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const pres = await import(path.join(ROOT, "fold-chat-present.js"));
const fa = await import(path.join(ROOT, "fold-chat-falsify-answer.js"));

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const pool = [];
for (const t of read("docs/playback/fixtures/turns.json")) pool.push({ id: "fx:" + t.ask, ask: t.ask, spoken: t.content, g: t.grounding, src: "fixtures/turns.json" });
for (const f of ["real-a", "real-b"]) read(`eval/ants/falsify-checks/f3/${f}.json`).forEach((c, i) => { if (c.rec?.grounding?.tape?.length && (c.rec.grounding.facing?.response || []).length) pool.push({ id: f + ":" + i, ask: c.ask, spoken: c.spoken, g: c.rec.grounding, src: `f3/${f}.json[${i}]` }); });

const dom = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const fold = (s) => String(s || "").toLowerCase();
const tw = (s) => (String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);

// ── figures: a year, a magnitude ("14.27 million"), or a quantity with a unit — on one axis per claim ──
const num = (x) => Number(String(x).replace(/,/g, ""));
const YEAR = /\b(1[0-9]\d\d|20\d\d)\b/g;
const MAG = /(\d+(?:\.\d+)?)\s*(million|billion)\b/gi;
const QTY = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(m|metres?|meters?|ft|feet|km|kilomet(?:re|er)s?|mi|miles?|kg|lbs?|pounds?|%|°C|°F)\b/gi;
const TOM = (u) => (/^(m|metres?|meters?)$/i.test(u) ? ["m", 1] : /^(ft|feet)$/i.test(u) ? ["m", 0.3048] : /^(km|kilomet)/i.test(u) ? ["km", 1] : /^(mi|miles?)$/i.test(u) ? ["km", 1.609344] : /^kg$/i.test(u) ? ["kg", 1] : /^(lbs?|pounds?)$/i.test(u) ? ["kg", 0.45359237] : [u, 1]);
function axisOf(claim) {
  const q = [...claim.matchAll(QTY)][0];
  if (q) { const [u] = TOM(q[2]); return { kind: "qty", unit: u, value: num(q[1]) * TOM(q[2])[1], raw: q[0] }; }
  const m = [...claim.matchAll(MAG)][0];
  if (m) return { kind: "mag", unit: m[2].toLowerCase(), value: num(m[1]), raw: m[0] };
  const y = [...claim.matchAll(YEAR)][0];
  if (y) return { kind: "year", unit: "", value: num(y[1]), raw: y[0] };
  return null;
}
/** every figure of the claim's kind in a sentence, as { value, raw, at } (feet converted to metres so the axis is one scale) */
function figsIn(sentence, ax) {
  const out = [];
  if (!ax) return out;
  if (ax.kind === "qty") for (const m of sentence.matchAll(QTY)) { const [u, k] = TOM(m[2]); if (u === ax.unit) out.push({ value: num(m[1]) * k, raw: m[0], at: m.index, converted: k !== 1 }); }
  if (ax.kind === "mag") for (const m of sentence.matchAll(MAG)) if (m[2].toLowerCase() === ax.unit) out.push({ value: num(m[1]), raw: m[0], at: m.index });
  if (ax.kind === "year") for (const m of sentence.matchAll(YEAR)) out.push({ value: num(m[1]), raw: m[0], at: m.index });
  return out;
}
const nearest = (list, v) => { const pick = (l) => l.slice().sort((a, b) => Math.abs(a.value - v) - Math.abs(b.value - v))[0] || null; return pick(list.filter((x) => !x.converted)) || pick(list); };

/** the span of the shared run inside the sentence as written (the run is stored as tokens; the sentence keeps its punctuation) */
function runSpan(sentence, run) {
  const ws = tw(run); if (!ws.length) return null;
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(ws.map(esc).join("[^\\p{L}\\p{N}]+"), "iu").exec(sentence);
  return m ? [m.index, m.index + m[0].length] : null;
}
const clipAround = (s, a, b, before = 70, after = 90) => {
  const l = Math.max(0, a - before), r = Math.min(s.length, b + after);
  const sl = l > 0 ? s.slice(l, a).replace(/^\S*\s/, "") : s.slice(0, a);
  const sr = r < s.length ? s.slice(b, r).replace(/\s\S*$/, "") : s.slice(b);
  return { left: (l > 0 ? "…" : "") + sl, mid: s.slice(a, b), right: sr + (r < s.length ? "…" : ""), full: s };
};
const sentenceClip = (s, n = 420) => (s.length <= n ? s : s.slice(0, n).replace(/\s\S*$/, "") + "…");

const STOP_Q = new Set(tw("what is the a an of in on to who how when where why which does do did was were are be been it its this that and or for by with from at as"));

function turnOf(p) {
  const g = p.g;
  const fz = pres.crossCheckOf(g);
  if (!fz) return null;
  const passages = fa.passagesOfRecord(g);
  const qWords = new Set(tw(p.ask));
  const sources = fz.sources.map((s) => ({ key: s.key, domain: s.domain || s.key, url: s.url || "", title: String(s.ref || s.key).replace(/^[^—]*—\s*/, "") }));
  const claims = fz.claims.map((c) => {
    const ax = axisOf(c.s);
    const ws = c.witnesses.map((w) => {
      const sent = w.sentence || "";
      const span = w.runN >= 2 ? runSpan(sent, w.run) : null;
      const f = ax ? nearest(figsIn(sent, ax), ax.value) : null;
      return { src: w.src, verdict: w.verdict, why: w.why, run: w.run, runN: w.runN, chain: w.sameChainAs || null, sentence: sentenceClip(sent, 520), kw: span ? clipAround(sent, span[0], span[1]) : null, fig: f ? { value: f.value, raw: f.raw, converted: !!f.converted } : null };
    });
    // the null: the same claim with its figure/name swapped for the rival the cross-reference chose, run through the same test
    let nullW = null;
    if (c.swap.armed) {
      const swapped = c.s.replace(c.swap.from, c.swap.to);
      try { const r = fa.falsifyAnswer([swapped], passages).claims[0]; nullW = { sentence: swapped, per: r.witnesses.map((w) => ({ src: w.src, verdict: w.verdict })) }; } catch { nullW = null; }
    }
    const stake = tw(c.s).filter((w) => !qWords.has(w));
    return { i: c.i, s: c.s, verdict: c.verdict, figures: c.figures, names: c.names, chains: c.chains, contradictions: c.contradictions, swap: c.swap, nullW, ax: ax ? { kind: ax.kind, unit: ax.unit, value: ax.value, raw: ax.raw } : null, stakeWords: stake, witnesses: ws };
  });
  const L = g.loop || null;
  const loop = L ? {
    passes: (L.passes || []).map((ps) => ({ lap: ps.lap, before: ps.before, failing: ps.failing.map((f) => ({ i: f.i, s: f.s, verdict: f.verdict, why: f.why, query: f.query, afterIns: f.afterIns })), added: ps.added, restated: ps.restated, reImpressed: (ps.reImpressed || []).map((r) => ({ domain: dom(r.url), url: r.url, kept: r.kept, chars: r.chars, segments: r.segments, recalled: r.recalled })) })),
    after: L.after, cleared: L.cleared, firstTry: !!L.firstTry, processLine: L.processLine,
  } : null;
  const tape = g.tape || [];
  const found = tape.filter((e) => e.kind === "st" && e.st?.phase === "found").map((e) => ({ scope: e.st.scope, q: e.st.q, n: e.st.n }));
  const demoted = tape.filter((e) => e.kind === "st" && e.st?.phase === "demoted").reduce((n, e) => n + (e.st.n || 0), 0);
  const opened = new Set(tape.filter((e) => e.kind === "quick").map((e) => dom(e.p?.url))).size;
  const answerSents = (g.facing?.response || []).map((r) => ({ text: r.text, grounded: !!r.grounded, tag: r.tag }));
  return { id: p.id, ask: p.ask, srcFile: p.src, answer: answerSents, sources, claims, loop, lang: g.language || null, kind: g.kind || null, answerMode: g.answerMode || null, found, demoted, opened, tapeKinds: [...new Set(tape.map((e) => e.kind + (e.k != null ? "/" + e.k : "")))], facingSources: (g.facing?.sources || []).length };
}

// ── the thread: every recorded turn, claim by claim (the stand-in for "what recurs across the thread") ──
const all = pool.map(turnOf).filter(Boolean);
const THREAD_TESTS = ["words", "figure", "against", "second", "wrong"];
const claimRows = [];
const givers = new Map();
for (const t of all) {
  t.claims.forEach((c) => {
    const states = c.witnesses.filter((w) => w.verdict === "states");
    const tests = {
      words: states.some((w) => w.runN >= 4) ? "held" : states.length ? "differs" : c.witnesses.some((w) => w.verdict === "near") ? "differs" : "differs",
      figure: !c.figures.length ? "na" : c.figures.every((f) => states.some((w) => w.sentence.replace(/,/g, "").includes(String(f).replace(/,/g, "")))) ? "held" : "differs",
      against: c.contradictions ? "differs" : "held",
      second: c.chains >= 2 ? "held" : c.chains === 1 ? "na" : "differs",
      wrong: !c.swap.armed ? "na" : c.swap.discriminates ? "held" : "differs",
    };
    claimRows.push({ turn: t.id, ask: t.ask, i: c.i, s: c.s, verdict: c.verdict, tests, n: c.witnesses.length });
    for (const w of c.witnesses) {
      const g = givers.get(w.src) || { site: w.src, states: 0, differs: 0, near: 0, silent: 0, claims: [] };
      if (w.verdict === "states") g.states++; else if (w.verdict === "contradicts") g.differs++; else if (w.verdict === "near") g.near++; else g.silent++;
      g.claims.push({ turn: t.id, ask: t.ask, i: c.i, v: w.verdict });
      givers.set(w.src, g);
    }
  });
}
const lapRows = all.filter((t) => t.loop).map((t) => ({ id: t.id, ask: t.ask, laps: t.loop.passes.length, firstTry: t.loop.firstTry, before: t.loop.passes[0]?.before || null, after: t.loop.after, cleared: t.loop.cleared }));
const thread = { turns: all.length, claims: claimRows.length, claimRows, tests: THREAD_TESTS, givers: [...givers.values()].sort((a, b) => b.states + b.differs + b.near + b.silent - (a.states + a.differs + a.near + a.silent)), lapRows };

const PICK = ["real-a:1", "real-b:0", "real-b:3", "real-b:9", "real-a:2", "fx:who invented the telephone?"];
const turns = PICK.map((id) => all.find((t) => t.id === id)).filter(Boolean);
const label = { "real-a:1": "Mount Everest", "real-b:0": "Eiffel Tower", "real-b:3": "Tokyo", "real-b:9": "Penicillin", "real-a:2": "Pride and Prejudice", "fx:who invented the telephone?": "Telephone" };
turns.forEach((t) => { t.label = label[t.id]; });
// thread rows keep only what the pattern faces draw
thread.claimRows = claimRows.map((r) => ({ ...r, s: r.s.slice(0, 140) }));
thread.givers = thread.givers.map((g) => ({ ...g, claims: g.claims.slice(0, 40) }));

fs.writeFileSync(path.join(HERE, "data.json"), JSON.stringify({ turns, thread }, null, 0));
console.log("turns", turns.map((t) => t.label + ":" + t.claims.length + "c/" + t.sources.length + "s").join("  "), "| thread", thread.turns, "turns", thread.claims, "claims", "| data.json", fs.statSync(path.join(HERE, "data.json")).size, "bytes");
const tally = (k) => { const o = {}; claimRows.forEach((r) => { o[r.tests[k]] = (o[r.tests[k]] || 0) + 1; }); return o; };
for (const k of THREAD_TESTS) console.log("test", k, JSON.stringify(tally(k)));
console.log("laps", JSON.stringify(lapRows.filter((r) => r.laps).map((r) => [r.ask.slice(0, 22), r.laps, r.cleared])));
console.log("tape kinds in picked turns:", [...new Set(turns.flatMap((t) => t.tapeKinds))].join(" "));
