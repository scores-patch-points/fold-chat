// fold-chat-ethos.js — ONE ethos grounding, every model-voiced path. Pure: no DOM, no IO, no model, no clock. The model, the voice index and the voice bank are INJECTED.
//
// Why (user, 2026-10-06): "the agentic thing doesn't have this type of pathos added to it ... they all have the same grounding in ethos" and "this should be wired
// into what we call chat, not just querying the pipeline for reasoning". docs/ETHOS-PATHOS-PATHS.md measured it: the chat reads pathos on conversational kinds only and
// (0/24 real prompts) never has enough answers to speak it; the code lane's prompts are the task and the measured findings, nothing else; counsel, the voice aside and
// the primary-source finder are wired nowhere. Each path computed its own piece, or none. This module is the ONE place that asks the shared organs, so every path can call
// the same function and get the same grounding, and a lane that must not have one gets a typed empty.
//
//   ethosFor(input) → { lane, cues, aside, parts, gaps, memo, basis }
//     cues    [{ from, text }]   facts a MODEL may be handed (information, never a directive; Gary reads them again at the door). Empty on a lane the model may not voice.
//     aside   { text, audit }    ONE app-authored sentence around a verbatim quote of an ingested voice, for the APP to speak after the Pivot — never put in a prompt.
//     parts   { atmosphere, lens, paradigm, pathos, voice }   each with its own basis; the four pathos inputs are listed with what is READ and what is a typed GAP.
//     gaps    [{ part, why }]   what was not read, said not guessed (the curve; the Paradigm; an unverified maker; too few answers…).
//     memo    the pathos ledger to carry to the next call (same shape fold-chat-pathos.js uses).
//
// WHAT IT MUST NOT DO (eval/ants/C7-PREREG.md N1–N10; each gate has a test AND a mutation check): never impersonate (a holder is named only in the fixed aside frame, their
// words in quotation marks); never invent a quote (the quote is re-found in the injected canon/bank here, not trusted from the voice module); never add a score (no rating
// vocabulary in any line a model or a person reads — numbers live in `aside.audit`); silence is the default; facts not directives; pathos only for a DECLARED experiencer read
// from the record; pure; a lane the model may not voice gets nothing; the code model never gets feelings; gaps are said.
import { carryOf } from "./fold-chat-carry.js";
import { readFelt, PATHOS } from "./fold-chat-pathos.js";
import { conversationTerms, asideOf, frameOf, VOICE } from "./fold-chat-voice.js";
import { pathosOf, reGroundCondition, reGround, landReGround } from "./vendor/khora/native/organs/pathos.js";
import { pathosTurn } from "./vendor/khora/native/the-fold/pathos-turn.js";
import { bannedHits } from "./vendor/khora/native/the-fold/earned-cast.js";

// DECLARED, not measured (Constitution II.11); giver: the author's draft 2026-10-06 (C7), for the user to correct.
export const ETHOS = Object.freeze({
  giver: "C7 ant draft, 2026-10-06; declared, not measured (II.11)",
  minRounds: 2,   // the code lane: a run needs at least this many rounds before its pathos is read (the chat needs PATHOS.minAnswers = 3 answers)
  // lane → which parts it may carry. `cueAtmosphere`: the lane has no running summary of its own, so the Atmosphere/Lens ride as a fact; the chat's already rides in `summary.flow`.
  lanes: Object.freeze({
    chat:    Object.freeze({ atmosphere: true, lens: true,  pathos: true,  aside: true,  cueAtmosphere: false, cuePathos: true,  why: "the fold's own conversational voice (research / chat / advice / a thread follow-up)" }),
    writing: Object.freeze({ atmosphere: true, lens: true,  pathos: false, aside: false, cueAtmosphere: true,  cuePathos: false, why: "a writing request: continuity with the thread, not a reading of the person; voice would be a quote the writer never asked for" }),
    counsel: Object.freeze({ atmosphere: true, lens: true,  pathos: true,  aside: false, cueAtmosphere: true,  cuePathos: true,  why: "the draft IS a thinker's voice; an aside on top of it would be the same voice twice" }),
    agent:   Object.freeze({ atmosphere: true, lens: true,  pathos: true,  aside: true,  cueAtmosphere: false, cuePathos: false, why: "N9: the code model never gets feelings; the condition steers the loop and the aside is spoken by the app at a natural break" }),
    none:    Object.freeze({ atmosphere: false, lens: false, pathos: false, aside: false, cueAtmosphere: false, cuePathos: false, why: "no model voice (slot turn, Sources-only strand, self line, gap line, compute, transform, code, pointer, restate, continue)" }),
  }),
});

// words a model-facing line may not carry: apparatus vocabulary beyond the vendored ban (earned-cast bannedHits) — the names of the organs themselves
const APPARATUS = /\b(?:pathos|ethos|atmosphere|paradigm|archon|lens)\b/i;
// N3: any rating vocabulary or ratio/percent form
const SCORE = /\b(?:scores?|scored|rating|rated|confidence|confident|how good|p\s*[=<>]|likelihood)\b|\d\s*%|\d+\s*\/\s*\d+|out of \d+/i;
// N5: an instruction or a prohibition
const DIRECTIVE = /\b(?:do not|don't|dont|never|must|should|always|you (?:need|have) to|make sure|be sure|ensure|avoid|remember to)\b|^\s*(?:please\s+)?(?:use|write|answer|reply|respond|say|speak|keep|stay|try|ask|tell|give|take|be)\b/i;
// N1: speech as a holder
const AS_HOLDER = /\b(?:as|speaking as|in the voice of|i am|i'm)\s+[A-Z][\p{L}'’-]+/u;

/** One vetting for every model-facing line: facts, not directives, no apparatus, no score, not first-person speech as anyone. → { ok, why } */
export function vetFact(text, { names = [] } = {}) {
  const t = String(text ?? "").trim();
  if (!t) return { ok: false, why: "empty" };
  if (bannedHits(t).length) return { ok: false, why: "apparatus:" + bannedHits(t).join(",") };
  if (APPARATUS.test(t)) return { ok: false, why: "apparatus_name" };
  if (SCORE.test(t)) return { ok: false, why: "score" };
  if (DIRECTIVE.test(t)) return { ok: false, why: "directive" };
  if (AS_HOLDER.test(t)) return { ok: false, why: "speaks_as" };
  const low = t.toLowerCase();
  for (const n of names) if (n && low.includes(String(n).toLowerCase())) return { ok: false, why: "names_a_holder:" + n };
  return { ok: true, why: null };
}

/** The lane a turn belongs to, from the chat's own dispatch facts (never from the model). `modelBarred`: fold-chat.js `modelBarred` (no source, a Sources-only strand, a kind the model may not answer alone). */
export function laneOf({ kind = null, threadTurn = false, modelBarred = false, slot = false, strand = false, agent = false } = {}) {
  if (modelBarred || slot || strand) return "none";
  if (agent) return "agent";
  if (kind === "research" || kind === "chat" || kind === "advice" || threadTurn) return "chat";
  if (kind === "generate" || kind === "compose") return "writing";
  return "none";   // smalltalk, compute, transform, code, self: the model may not voice them with ethos
}

// ───────────────────────────── the code lane's record, as the same pathos reads it ─────────────────────────────

const sigOf = (f) => String(f).toLowerCase().replace(/\(line \d+\)|\d+/g, "#").slice(0, 70);   // the agent loop's own signature (fold-chat-agent.js `sig`)
const sentence = (s) => { const t = String(s ?? "").trim().replace(/\s+/g, " "); return /[.!?]$/.test(t) ? t : t + "."; };

/**
 * The rounds of a code run as what the pathos organ reads: the observed outcome of each round as sentences, the maker that wrote it (from the round's OWN record:
 * `maker` = the model/lane the door reported — never a label), and the strain the record earned. A repair that undid an earlier repair (a finding that was gone in a round
 * and is back) is a directed cycle on the record: `cycles` counts them, so strain reads "strict" — measured, never inferred from prose.
 * rounds: [{ n, findings:[string], maker?: string }]  →  { text, who, rounds, cycles, repeats, gap }
 */
export function runRecord(rounds) {
  const rs = (Array.isArray(rounds) ? rounds : []).filter((r) => r && Array.isArray(r.findings));
  if (rs.length < ETHOS.minRounds) return { text: "", who: null, rounds: rs.length, cycles: 0, repeats: 0, gap: "too_few_rounds" };
  const makers = [...new Set(rs.map((r) => r.maker).filter(Boolean).map(String))];
  if (!makers.length) return { text: "", who: null, rounds: rs.length, cycles: 0, repeats: 0, gap: "unverified_maker" };
  const sets = rs.map((r) => new Set(r.findings.map(sigOf)));
  let cycles = 0, repeats = 0;
  const all = new Set(sets.flatMap((s) => [...s]));
  for (const sig of all) {
    const at = sets.map((s) => s.has(sig));
    const first = at.indexOf(true), gone = at.indexOf(false, first + 1);
    if (first >= 0 && gone > first && at.indexOf(true, gone + 1) > gone) cycles++;   // there, gone, back
    if (at.filter(Boolean).length >= 2) repeats++;
  }
  const text = rs.map((r) => r.findings.length ? `Round ${r.n}: ${r.findings.map((f) => sentence(f)).join(" ")}` : `Round ${r.n}: nothing failed.`).join("\n\n");
  return { text, who: `maker:${makers.join("+")}`, rounds: rs.length, cycles, repeats, gap: null };
}

function readRun(record, { convo, memo }) {
  const prior = { log: Array.isArray(memo?.log) ? memo.log : [], lastKind: memo?.lastKind ?? null, held: memo?.held ?? true };
  if (record.gap) return { felt: null, cue: null, condition: null, act: null, memo: prior, gap: record.gap, experiencer: null, read: null };
  const experiencer = { who: record.who, read: `run:${convo}` };
  try {
    const out = pathosTurn({ organs: { pathosOf, reGroundCondition, reGround, landReGround }, text: record.text, experiencer, state: { cycles: record.cycles }, ledger: prior.log, lastKind: prior.lastKind, heldSinceLast: prior.held, turn: record.rounds });
    return { felt: { flatline: !!out.read.rhythm.flatline, strain: out.read.strain }, cue: out.cue, condition: out.condition.kind, act: out.act, read: out.read, experiencer, run: { rounds: record.rounds, cycles: record.cycles, repeats: record.repeats }, gap: null, memo: { log: [...out.ledger], lastKind: out.lastKind, held: out.heldSinceLast } };
  } catch (e) { return { felt: null, cue: null, condition: null, act: null, memo: prior, gap: "pathos_refused:" + String(e?.message || e).slice(0, 80), experiencer, read: null }; }
}

// ───────────────────────────── the four pathos inputs, each with what was read and what is a gap ─────────────────────────────

function inputsOf(p) {
  if (!p || p.gap || !p.felt) return null;
  const r = p.read;
  return {
    experiencer: { status: "read", who: p.experiencer?.who ?? null, read: p.experiencer?.read ?? null },
    rhythm: { status: "read", flatline: !!p.felt.flatline },
    strain: { status: p.felt.strain === "report" ? "read:report (no contradiction record on this lane)" : "read:" + p.felt.strain },
    curve: { status: r?.curve?.measured ? "measured" : "gap: unmeasured — no reader fold is run over this lane, so collapse cannot fire" },
  };
}

// ───────────────────────────── the aside: re-verified here, never trusted ─────────────────────────────

/** N2: the quote must be a verbatim slice of the injected canon text or an entry of the injected bank, at the stated span. */
export function quoteIsVerbatim(aside, { texts = null, bank = null } = {}) {
  const q = aside?.quote;
  if (!q || typeof q.text !== "string" || !q.text) return false;
  const t = texts?.[aside.handle];
  if (typeof t === "string" && t.length) return Number.isInteger(q.start) && Number.isInteger(q.end) && t.slice(q.start, q.end) === q.text;
  const rows = bank?.[aside.handle];
  return Array.isArray(rows) && rows.some((e) => e && e.text === q.text && e.start === q.start && e.end === q.end);
}

function asideFor({ lane, kind, exchanges, condition, voice, naturalBreak }) {
  const L = ETHOS.lanes[lane];
  if (!L.aside) return { none: "lane:" + lane };
  if (!voice?.index) return { none: "no_voice_index" };
  if (lane === "agent" && !naturalBreak) return { none: "not_a_natural_break" };
  const conv = conversationTerms(exchanges, voice.index.fw || voice.fw);
  const decide = typeof voice.asideOf === "function" ? voice.asideOf : asideOf;   // injectable so a test can hand it a hostile decision: the checks below never trust it
  const res = decide({ index: voice.index, conv, texts: voice.texts || null, bank: voice.bank || null, seed: voice.seed, draws: voice.draws,
    state: { kind, exchangeIndex: voice.exchangeIndex ?? exchanges.length + 1, sinceLast: voice.sinceLast ?? Infinity, condition, gate: voice.gate !== false, used: voice.used || [] } });
  if (!res.aside) return { none: res.none };
  const a = res.aside;
  // N2 — the quote is found again in the injected canon; a quote that is not there is dropped, never repaired
  if (!quoteIsVerbatim(a, voice)) return { none: "quote_not_verbatim" };
  // N1/N3 — the spoken sentence is exactly the fixed frame around the quote, and the frame (the part that is ours) carries no score
  if (a.text !== frameOf(a)) return { none: "frame_altered" };
  const frame = a.text.split(a.quote.text).join("");
  if (SCORE.test(frame) || AS_HOLDER.test(frame)) return { none: "frame_unsafe" };
  return { aside: { text: a.text, audit: { handle: a.handle, holder: a.holder, work: a.work, source: a.source, quote: a.quote, shared: a.shared, score: a.score, p: a.p, grade: a.grade, condition } } };
}

// ───────────────────────────── the one entry point ─────────────────────────────

/**
 * ethosFor — the shared grounding block. Chat-shaped lanes pass `session` (the chat's own record: messages, referents, summary), `messagesBefore` (the messages BEFORE this ask) and `question`.
 * The code lane passes `rounds` ([{ n, findings, maker }]), `task` and `names` (the referent surfaces khora read from the ask). `kind` is the chat's turn kind.
 * `voice`: { index, bank?, texts?, exchangeIndex, sinceLast, used, gate, seed, draws } — all injected; nothing is loaded here.
 */
export function ethosFor({ lane = "none", kind = null, session = null, messagesBefore = null, question = "", rounds = null, task = "", names = [], convo = "chat", memo = null, voice = null, naturalBreak = false } = {}) {
  const L = ETHOS.lanes[lane] || ETHOS.lanes.none;
  const laneName = ETHOS.lanes[lane] ? lane : "none";
  const gaps = [];
  const empty = (why) => ({ lane: laneName, cues: [], aside: null, parts: { atmosphere: null, lens: null, paradigm: { gap: "no_ledger_notes" }, pathos: null, voice: { none: why } }, gaps: [{ part: "all", why }], memo, basis: "" });
  if (laneName === "none") return empty("lane:none");

  // ── Atmosphere + Lens (the chat's own carry, khora resolutions.js) ──
  let atmosphere = null, lens = false;
  let sess = session, ask = question, exchanges = [];
  if (laneName === "agent") {
    const rs = (Array.isArray(rounds) ? rounds : []).filter((r) => r && Array.isArray(r.findings));
    const msgs = rs.flatMap((r) => [{ role: "user", content: r.n === 1 ? String(task) : "Fix it." }, { role: "assistant", content: r.findings.length ? r.findings.map(sentence).join(" ") : "Nothing failed." }]);
    sess = { messages: msgs, referents: { entities: [...new Set(names.map(String))].map((surface, i) => ({ surface, forms: [], weight: 1, lastTurn: 0, roles: [], i })) }, summary: { records: [] } };
    ask = String(task);
    exchanges = rs.map((r, i) => ({ ask: i === 0 ? String(task) : "", said: r.findings.map(sentence).join(" ") }));
  } else if (sess) {
    const ms = sess.messages || [];
    exchanges = [];
    let a = null;
    for (const m of ms) { if (m?.role === "user") a = String(m.content || ""); else if (m?.role === "assistant" && a != null) { exchanges.push({ ask: a, said: m.authored === "sources" || m.mode === "agent" ? "" : String(m.content || "") }); a = null; } }
    if (question) exchanges.push({ ask: question, said: "" });
  }
  if (sess && L.atmosphere) {
    try {
      const c = carryOf(sess, { question: ask || null, level: L.lens ? 2 : 1 });
      // carryOf's basis joins the Atmosphere's string with the Lens's OBJECT (fold-chat-carry.js:74 `[atmosphere.basis, lens?.basis].join`), which prints "[object Object]"; struck here, reported in docs/ETHOS-PATHOS-PATHS.md
      if (c.text) { atmosphere = { text: c.text, basis: String(c.basis || "").replace(/\s*·?\s*\[object Object\]/g, "").trim(), active: c.active }; lens = L.lens; }
      else gaps.push({ part: "atmosphere", why: c.basis || "nothing resolves to a referent yet" });
    } catch (e) { gaps.push({ part: "atmosphere", why: "carry_failed:" + String(e?.message || e).slice(0, 60) }); }
  }
  gaps.push({ part: "paradigm", why: "no ledger notes on this pipeline (needs resolved referents and acts at sentence grain)" });

  // ── Pathos: the four inputs, the same organs, the lane's own record ──
  let pathos = null;
  if (L.pathos) {
    if (laneName === "agent") pathos = readRun(runRecord(rounds), { convo, memo });
    else pathos = readFelt(messagesBefore ?? sess?.messages ?? [], { convo, memo });
    if (pathos.gap) gaps.push({ part: "pathos", why: pathos.gap });
    else gaps.push({ part: "pathos.curve", why: "unmeasured: no reader fold is run over this lane — collapse cannot fire; stale and contested are the live registers" });
  }

  // ── cues: facts a model may be handed, each vetted ──
  const names2 = (voice?.index?.archons || []).flatMap((a) => [a.giver, a.handle].filter(Boolean));
  const cues = [], dropped = [];
  const offer = (from, text) => { const v = vetFact(text, { names: names2 }); if (v.ok) cues.push({ from, text: String(text).trim() }); else dropped.push({ from, why: v.why }); };
  if (L.cueAtmosphere && atmosphere) offer("atmosphere", atmosphere.text.split("\n").filter((l) => l.trim() && !/:$/.test(l.trim())).join(" ").replace(/\s+/g, " ").trim());
  if (L.cuePathos && pathos && !pathos.gap && pathos.cue) offer("pathos", pathos.cue);
  for (const d of dropped) gaps.push({ part: "cue:" + d.from, why: "withheld:" + d.why });

  // ── the aside: the app's, verbatim, rare ──
  const condition = pathos && !pathos.gap ? pathos.condition : null;
  const voiceRes = asideFor({ lane: laneName, kind, exchanges, condition, voice, naturalBreak });
  if (voiceRes.none) gaps.push({ part: "voice", why: voiceRes.none });

  return {
    lane: laneName,
    cues,
    aside: voiceRes.aside || null,
    parts: {
      atmosphere: atmosphere ? { text: atmosphere.text, basis: atmosphere.basis, active: atmosphere.active } : null,
      lens: lens ? { in: "atmosphere.text" } : null,
      paradigm: { gap: "no_ledger_notes" },
      pathos: pathos ? { condition: pathos.condition ?? null, felt: pathos.felt ?? null, cue: pathos.cue ?? null, inputs: inputsOf(pathos), gap: pathos.gap ?? null, excluded: pathos.excluded ?? null, ...(pathos.run ? { run: pathos.run } : {}) } : null,
      voice: voiceRes.aside ? { offered: true } : { none: voiceRes.none },
    },
    gaps,
    memo: pathos && !pathos.gap ? pathos.memo : memo,
    basis: atmosphere?.basis || "",
  };
}

export { PATHOS, VOICE };
