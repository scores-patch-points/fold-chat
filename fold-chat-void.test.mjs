// fold-chat-void.test.mjs — the turn's append-only event record, the question tree projected from it, and the first-person trace.
// Hand-written rows (the contract's examples). FALSIFIERS are marked.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createTurnVoid, replayVoid, projectVoid, traceOf, assertInvariant, hasEvidence, noteFalsification, TRACE_TEMPLATES, PROBE_WORDS, askPhrase } from "./fold-chat-void.js";
import { runFalsify } from "./fold-chat-falsify.js";

const NOW = { year: 2026 };
const FRAME = { ok: true, lang: "en", said: "Who is the king of the UK?", slot: "person",
  referents: [{ surface: "UK", title: "United Kingdom", aliases: ["UK", "United Kingdom"] }], predicate: [{ surface: "king", stem: "king" }], gap: null };
const src = (ref, title, url) => ({ ref, title, url, host: "en.wikipedia.org", lang: "en" });
const CHARLES = { tier: "T1", sentence: "Charles III is the king of the United Kingdom and the other Commonwealth realms, having acceded to the throne on 8 September 2022.",
  source: src("S1", "Monarchy of the United Kingdom", "https://en.wikipedia.org/wiki/Monarchy_of_the_United_Kingdom"), span: [0, 130], polarity: "+", tense: "present", filler: { text: "Charles III", span: [0, 11] }, emphasis: [[0, 11]] };
const ELIZABETH = { tier: "T1", sentence: "Elizabeth II is the queen of the United Kingdom, reigning since 1952.", source: src("S2", "Old page", "https://en.wikipedia.org/wiki/Old_page"), span: [0, 60], polarity: "+", tense: "present", filler: { text: "Elizabeth II", span: [0, 12] }, emphasis: [] };
const T2A = { tier: "T2", sentence: "The monarchy has a long history.", source: src("S3", "History", "https://en.wikipedia.org/wiki/History"), span: [0, 30], polarity: "+", tense: "present", filler: null, emphasis: [] };
const T2B = { ...T2A, sentence: "Palaces house the royal household.", source: src("S4", "Palaces", "https://en.wikipedia.org/wiki/Palaces") };
const CHARLES_LEAD = { title: "Charles III", url: "https://en.wikipedia.org/wiki/Charles_III", extract: "Charles III (Charles Philip Arthur George; born 14 November 1948) is King of the United Kingdom and the other Commonwealth realms." };
const ELIZABETH_LEAD = { title: "Elizabeth II", url: "https://en.wikipedia.org/wiki/Elizabeth_II", extract: "Elizabeth II (1926 to 8 September 2022) was Queen of the United Kingdom and the other Commonwealth realms from 6 February 1952 until her death." };

const BANNED = /\b(void|EOT|archon|witness|probe|T1)\b/iu;
const textOf = (lines) => lines.flatMap((l) => [l.say, l.detail, l.result]).filter(Boolean).join("\n");

async function a1Turn() {
  const t = createTurnVoid(FRAME);
  t.note("candidate", { row: CHARLES });
  const run = await runFalsify({ candidate: { filler: CHARLES.filler, row: CHARLES }, frame: FRAME, rows: [CHARLES, T2A, T2B], now: NOW, fetchLead: async () => CHARLES_LEAD });
  noteFalsification(t, run, "Charles III");
  return { t, run };
}

test("the ask opens as v0 with exactly the five children the contract names, all open (no evidence yet), and no status is 'satisfied' without an event", () => {
  const t = createTurnVoid(FRAME);
  const v = t.void;
  assert.equal(v.id, "v0");
  assert.equal(v.kind, "ask");
  assert.equal(v.text, "who holds the role “king” of “United Kingdom”");
  assert.deepEqual(v.children.map((c) => c.kind), ["referents", "filler", "currency", "rival", "falsify"]);
  assert.equal(v.status, "open");
  // the frame's own referents carry a title, so that child alone is satisfied — by the 'referents' event createTurnVoid appended
  assert.deepEqual(v.children.map((c) => c.status), ["satisfied", "open", "open", "open", "open"]);
  assert.deepEqual(t.events.map((e) => e.kind), ["ask", "referents"]);
  assert.equal(assertInvariant(v), true);
});

test("FALSIFIER: the tree changes ONLY by appended events — replaying the events into a fresh turn gives a deep-equal tree at every step", async () => {
  const { t } = await a1Turn();
  const evs = t.events;
  for (let i = 2; i <= evs.length; i++) {
    const partial = projectVoid(evs.slice(0, i));
    const fresh = replayVoid(FRAME, evs.slice(0, i));
    assert.deepEqual(fresh.void, partial, `step ${i}`);
    assert.deepEqual(fresh.events, evs.slice(0, i));
  }
  assert.deepEqual(replayVoid(FRAME, evs).void, t.void);
  assert.deepEqual(traceOf(replayVoid(FRAME, evs)), traceOf(t));
});

test("the record is append-only: the events list is a snapshot, entries are frozen, notes only add, and a closed turn refuses more", () => {
  const t = createTurnVoid(FRAME);
  const a = t.events;
  a.push({ n: 99, kind: "verdict", data: { standing: "survived", survived: ["x"] } });
  assert.equal(t.events.length, 2, "pushing to the snapshot changes nothing");
  assert.throws(() => { t.events[0].kind = "verdict"; }, TypeError);
  assert.throws(() => { t.events[0].data.said = "x"; }, TypeError);
  const before = t.events.length;
  t.note("candidate", { row: CHARLES });
  assert.equal(t.events.length, before + 1);
  assert.deepEqual(t.events.map((e) => e.n), [0, 1, 2], "events are numbered in the order appended");
  assert.throws(() => t.note("nonsense", {}), TypeError);
  assert.throws(() => t.note("ask", {}), TypeError, "the ask is opened once, by createTurnVoid");
  t.close();
  assert.throws(() => t.note("candidate", { row: CHARLES }), /closed/);
  assert.equal(t.events.at(-1).kind, "closed");
});

test("FALSIFIER: a status other than 'open' needs an event carrying evidence — evidence-less events leave the tree 'open' (invariant holds over a fuzz of event sequences)", () => {
  const t = createTurnVoid({ ...FRAME, referents: [] });
  assert.equal(t.void.children[0].status, "open", "no referents resolved by title: open, not satisfied");
  t.note("candidate", { row: { sentence: "" } });
  t.note("candidate", {});
  t.note("probes", { probes: [{ id: "life-dates", kind: "life-dates", network: true, why: "w", query: "X" }] });
  t.note("probe-result", { probe: { id: "life-dates", kind: "life-dates" }, outcome: "none" });                // no lead, no scope
  t.note("probe-result", { probe: { id: "life-dates", kind: "life-dates" }, outcome: "found" });                // no passage
  t.note("probe-result", { probe: { id: "life-dates", kind: "life-dates" }, outcome: "unmeasured" });          // no reason
  t.note("verdict", { standing: "survived", survived: [], unmeasured: [], refuters: [] });                      // nothing said it survived
  t.note("no-witness", { kind: "unwitnessed", tried: [] });
  const v = t.void;
  const statuses = [];
  (function walk(n) { statuses.push(n.status); n.children.forEach(walk); })(v);
  assert.ok(statuses.every((s) => s === "open"), statuses.join(","));
  assert.equal(assertInvariant(v), true);
  // fuzz: deterministic mix of events with and without evidence; the invariant must hold after every note
  let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const probe = (k) => ({ id: k, kind: k, network: k === "life-dates", why: "w", query: k === "life-dates" ? "X" : null });
  const makers = [
    () => ["candidate", rnd(2) ? { row: CHARLES } : {}],
    () => ["probes", { probes: ["life-dates", "rival-holder", "negation", "later-date"].filter(() => rnd(2)).map(probe) }],
    () => { const k = ["life-dates", "rival-holder", "negation", "later-date"][rnd(4)]; const o = ["none", "found", "unmeasured"][rnd(3)];
      const d = { probe: probe(k), outcome: o }; if (rnd(2)) { d.lead = { title: "t" }; d.scope = "the rest of that page"; d.passage = { text: "p" }; d.reason = "r"; } return ["probe-result", d]; },
    () => ["verdict", { standing: ["survived", "contested", "refuted", "unmeasured"][rnd(4)], survived: rnd(2) ? ["s"] : [], unmeasured: [], refuters: [] }],
    () => ["no-witness", { kind: rnd(2) ? "unwitnessed" : "unreached", tried: rnd(2) ? ["q"] : [], reason: rnd(2) ? "r" : undefined }],
    () => ["past-only", rnd(2) ? { row: CHARLES } : {}],
  ];
  for (let round = 0; round < 40; round++) {
    const f = createTurnVoid(rnd(2) ? FRAME : { ...FRAME, referents: [], gap: { kind: "referents_unresolved" } });
    for (let i = 0; i < 12; i++) { const [k, d] = makers[rnd(makers.length)](); f.note(k, d); assert.equal(assertInvariant(f.void), true); }
  }
});

test("assertInvariant throws on a tree whose status has no evidence behind it (the check itself can fail)", () => {
  const bad = { id: "v0", kind: "ask", status: "satisfied", events: [{ n: 0, kind: "ask", data: {} }], children: [] };
  assert.throws(() => assertInvariant(bad), /no evidence/);
});

test("a full king-of-the-UK turn: the tree after a surviving answer, with a child per probe and the contract's statuses", async () => {
  const { t, run } = await a1Turn();
  const v = t.void;
  assert.equal(run.standing, "survived");
  assert.equal(v.status, "satisfied");
  const byKind = Object.fromEntries(v.children.map((c) => [c.kind, c]));
  assert.equal(byKind.referents.status, "satisfied");
  assert.equal(byKind.filler.status, "satisfied");
  assert.equal(byKind.currency.status, "satisfied", "the life-dates probe found no death");
  assert.equal(byKind.rival.status, "satisfied");
  assert.equal(byKind.falsify.status, "satisfied");
  assert.deepEqual(byKind.falsify.children.map((c) => c.id), ["v0.5.1", "v0.5.2", "v0.5.3", "v0.5.4"]);
  assert.deepEqual(byKind.falsify.children.map((c) => c.status), ["satisfied", "satisfied", "satisfied", "satisfied"]);
  assert.ok(byKind.falsify.children.every((c) => ["satisfied", "refused", "unmeasured", "open"].includes(c.status)));
  assert.equal(assertInvariant(v), true);
  assert.ok(byKind.filler.text.includes("Charles III"));
  assert.ok(v.events.length === t.events.length, "the root carries the whole record");
});

test("the trace of that turn reads like the contract's example, line for line", async () => {
  const { t } = await a1Turn();
  const lines = traceOf(t.void);
  assert.deepEqual(lines.map((l) => l.n), lines.map((_, i) => i + 1));
  assert.equal(lines[0].say, "It looks like a question of fact: who holds the role “king” of “United Kingdom”.");
  assert.equal(lines[1].say, "I can't answer that from memory, so I'm reading sources.");
  assert.equal(lines[2].say, `I read Monarchy of the United Kingdom (en.wikipedia.org). One sentence states it: “${CHARLES.sentence}”`);
  assert.equal(lines[3].say, "That says Charles III. What would make me doubt it? A later holder, another holder, a death, or a source saying otherwise.");
  assert.equal(lines[4].say, "I searched “Charles III” and read the page “Charles III”: it gives 1948 and no death date.");
  assert.equal(lines[4].result, "found nothing");
  assert.equal(lines[4].probe.kind, "life-dates");
  assert.equal(lines[5].say, "I looked for a later holder, another holder, and a source saying otherwise in the other 2 sources and found none.");
  assert.equal(lines.at(-1).say, "So I'm answering Charles III, and saying what I checked.");
  assert.equal(lines.length, 7);
  // the C9 falsifier, in the trace: a line records a search whose query names the claim
  assert.ok(lines.some((l) => /I searched “Charles III”/.test(l.say)));
});

test("FALSIFIER: every TraceLine has who:'app', and none of the apparatus words (void, EOT, archon, witness, probe, T1) appears in any shown text", async () => {
  const flows = [];
  flows.push((await a1Turn()).t);
  // a refutation
  const r = createTurnVoid(FRAME); r.note("candidate", { row: ELIZABETH });
  noteFalsification(r, await runFalsify({ candidate: { filler: ELIZABETH.filler, row: ELIZABETH }, frame: FRAME, rows: [ELIZABETH, CHARLES], now: NOW, fetchLead: async () => ELIZABETH_LEAD }), "Elizabeth II");
  flows.push(r);
  // an unmeasured turn
  const u = createTurnVoid(FRAME); u.note("candidate", { row: CHARLES });
  noteFalsification(u, await runFalsify({ candidate: { filler: CHARLES.filler, row: CHARLES }, frame: FRAME, rows: [CHARLES], now: NOW, fetchLead: async () => null }), "Charles III");
  flows.push(u);
  // gaps
  const g1 = createTurnVoid(FRAME); g1.note("no-witness", { kind: "unwitnessed", tried: ["q1", "q2"], closest: { sentence: "A close sentence.", source: src("S9", "Close", "u") } });
  const g2 = createTurnVoid(FRAME); g2.note("past-only", { row: { ...CHARLES, sentence: "Louis XVI was the last king of France." } });
  const g3 = createTurnVoid({ ...FRAME, ok: false, slot: null, gap: { kind: "no_grammar_for_language" }, referents: [] });
  const g4 = createTurnVoid(FRAME); g4.note("no-witness", { kind: "unreached", tried: [], reason: "no source could be read" });
  flows.push(g1, g2, g3, g4);
  for (const f of flows) {
    const lines = traceOf(f.void);
    assert.ok(lines.length >= 1);
    for (const l of lines) {
      assert.equal(l.who, "app");
      assert.ok(typeof l.say === "string" && l.say.length > 0);
      for (const piece of [l.say, l.detail, l.result]) if (piece) assert.ok(!BANNED.test(piece), `banned word in: ${piece}`);
    }
  }
});

test("FALSIFIER: a refutation reads as one — 'X's page says X died in 2022, so X can't be the current holder' — with the refuting passage in detail", async () => {
  const t = createTurnVoid({ ...FRAME, said: "Who is the monarch of the UK?" });
  t.note("candidate", { row: ELIZABETH });
  const run = await runFalsify({ candidate: { filler: ELIZABETH.filler, row: ELIZABETH }, frame: { ...FRAME, said: "Who is the monarch of the UK?" }, rows: [ELIZABETH, CHARLES], now: NOW, fetchLead: async () => ELIZABETH_LEAD });
  assert.equal(run.standing, "refuted");
  noteFalsification(t, run, "Elizabeth II");
  const lines = traceOf(t.void);
  const died = lines.find((l) => /died in 2022/.test(l.say));
  assert.ok(died, lines.map((l) => l.say).join("\n"));
  assert.match(died.say, /can't be the current holder\.$/);
  assert.match(died.result, /^found a death in 2022/);
  assert.match(died.detail, /Elizabeth II \(1926 to 8 September 2022\)/);
  assert.ok(lines.some((l) => /I searched “Elizabeth II”/.test(l.say)), "the search that found it names the claim");
  assert.match(lines.at(-1).say, /^So I'm not answering Elizabeth II/);
  const v = t.void;
  assert.equal(v.status, "refused");
  assert.equal(v.children.find((c) => c.kind === "currency").status, "refused");
  assert.equal(v.children.find((c) => c.kind === "filler").status, "refused");
  assert.equal(assertInvariant(v), true);
});

test("FALSIFIER: the trace for an UNMEASURED probe says it could not be checked, and the tree says 'unmeasured' — never satisfied", async () => {
  const t = createTurnVoid(FRAME);
  t.note("candidate", { row: CHARLES });
  const run = await runFalsify({ candidate: { filler: CHARLES.filler, row: CHARLES }, frame: FRAME, rows: [CHARLES], now: NOW, fetchLead: async () => null });
  assert.equal(run.standing, "unmeasured");
  noteFalsification(t, run, "Charles III");
  const lines = traceOf(t.void);
  const unm = lines.filter((l) => /could not be checked/.test(l.say));
  assert.ok(unm.length >= 1, lines.map((l) => l.say).join("\n"));
  assert.match(unm[0].say, /whether Charles III is still living/);
  assert.match(unm[0].say, /could not read a page for “Charles III”/);
  const v = t.void;
  assert.equal(v.children.find((c) => c.kind === "currency").status, "unmeasured");
  assert.ok(v.children.find((c) => c.kind === "falsify").children.every((c) => c.status === "unmeasured"));
  assert.equal(v.status, "unmeasured");
  assert.ok(!JSON.stringify(v).includes('"status":"satisfied"') || v.children[0].status === "satisfied", "only the referents child (resolved by title) may be satisfied");
  assert.match(lines.at(-1).say, /^So I'm giving Charles III only because the source says so/);
  assert.equal(assertInvariant(v), true);
});

test("a contested turn keeps both rows visible in the trace and says it is not picking", async () => {
  const t = createTurnVoid(FRAME); t.note("candidate", { row: ELIZABETH });
  const run = await runFalsify({ candidate: { filler: ELIZABETH.filler, row: ELIZABETH }, frame: FRAME, rows: [ELIZABETH, CHARLES], now: NOW, fetchLead: async () => null, current: true });
  assert.equal(run.standing, "contested");
  noteFalsification(t, run, "Elizabeth II");
  const lines = traceOf(t.void);
  assert.ok(lines.some((l) => l.say.includes(CHARLES.sentence)), "the rival's own sentence is quoted verbatim");
  assert.match(lines.at(-1).say, /^So I'm not picking one: the sources disagree, and I'm showing both\./);
  assert.equal(t.void.status, "contested");
  assert.equal(t.void.children.find((c) => c.kind === "rival").status, "contested");
  assert.equal(t.void.children.find((c) => c.kind === "filler").status, "contested");
});

test("a survived turn with a check that could not be run says so in its last lines", async () => {
  const t = createTurnVoid(FRAME); t.note("candidate", { row: CHARLES });
  noteFalsification(t, await runFalsify({ candidate: { filler: CHARLES.filler, row: CHARLES }, frame: FRAME, rows: [CHARLES], now: NOW, fetchLead: async () => CHARLES_LEAD }), "Charles III");
  const lines = traceOf(t.void);
  assert.match(lines.at(-2).say, /^So I'm answering Charles III, and saying what I checked\.$/);
  assert.match(lines.at(-1).say, /^I could not check: whether another source names a different holder/);
});

test("gap events: unwitnessed / unreached / past-tense-only / language — plain words, the closest sentence verbatim, root status derived", () => {
  const g1 = createTurnVoid(FRAME);
  g1.note("no-witness", { kind: "unwitnessed", tried: ["a", "b"], closest: { sentence: "The president of France is the head of state of France.", source: src("S1", "President of France", "u") } });
  const l1 = traceOf(g1.void);
  assert.equal(l1[2].say, "I read 2 sources, and none has a sentence that states it, so I'm not answering.");
  assert.equal(l1[3].say, "The closest sentence I found is “The president of France is the head of state of France.”");
  assert.equal(g1.void.status, "refused");
  assert.equal(g1.void.children.find((c) => c.kind === "filler").status, "refused");

  const g2 = createTurnVoid(FRAME);
  g2.note("past-only", { row: { ...CHARLES, sentence: "Louis XVI was the last king of France before the fall of the monarchy." } });
  const l2 = traceOf(g2.void);
  assert.match(l2.at(-1).say, /^The only sentence I found is in the past tense: “Louis XVI was the last king of France before the fall of the monarchy\.”/);
  assert.equal(g2.void.status, "refused");
  assert.equal(g2.void.children.find((c) => c.kind === "currency").status, "refused");

  const g3 = createTurnVoid({ ...FRAME, ok: false, slot: null, gap: { kind: "no_grammar_for_language" }, referents: [] });
  assert.equal(traceOf(g3.void)[0].say, "I can't tell what single fact is being asked.");
  assert.equal(traceOf(g3.void)[1].say, "I can't read the grammar of this language yet, so I'm not guessing.");
  assert.equal(g3.void.status, "refused");

  const g4 = createTurnVoid(FRAME);
  g4.note("no-witness", { kind: "unreached", tried: [], reason: "no source could be read" });
  assert.equal(g4.void.status, "unmeasured");
  assert.equal(traceOf(g4.void).at(-1).say, "I could not read any source, so I'm not answering.");
});

test("traceOf is derived from events alone: no event, no line; the same events give the same lines; it takes the tree root or the turn", async () => {
  const { t } = await a1Turn();
  const a = traceOf(t), b = traceOf(t.void);
  assert.deepEqual(a, b);
  assert.deepEqual(traceOf(replayVoid(FRAME, t.events)), a);
  const bare = traceOf(createTurnVoid(FRAME));
  assert.deepEqual(bare.map((l) => l.say), ["It looks like a question of fact: who holds the role “king” of “United Kingdom”.", "I can't answer that from memory, so I'm reading sources."]);
  assert.deepEqual(traceOf(null), []);
  // an event without evidence says nothing
  const t2 = createTurnVoid(FRAME); t2.note("candidate", {}); t2.note("verdict", { standing: "survived" });
  assert.equal(traceOf(t2).length, 2);
});

test("the template table is exported and replaceable: a translated table changes every line and nothing else", async () => {
  assert.ok(Object.isFrozen(TRACE_TEMPLATES));
  for (const k of ["ask", "candidate", "probes", "probe-result", "verdict", "no-witness", "past-only", "frame-gap"]) assert.equal(typeof TRACE_TEMPLATES[k], "function", k);
  const { t } = await a1Turn();
  const shout = { ...TRACE_TEMPLATES, ask: () => [{ say: "(translated ask)" }] };
  const lines = traceOf(t, { templates: shout });
  assert.equal(lines[0].say, "(translated ask)");
  assert.equal(lines.length, traceOf(t).length - 1, "the ask line count differs only because the replacement has one line");
  assert.ok(PROBE_WORDS["life-dates"].doubt.length === 2);
});

test("hasEvidence: what counts, and what does not", () => {
  assert.equal(hasEvidence({ kind: "candidate", data: { row: CHARLES } }), true);
  assert.equal(hasEvidence({ kind: "candidate", data: { row: { sentence: "" } } }), false);
  assert.equal(hasEvidence({ kind: "probe-result", data: { probe: { id: "x" }, outcome: "none", lead: { title: "t" } } }), true);
  assert.equal(hasEvidence({ kind: "probe-result", data: { probe: { id: "x" }, outcome: "none" } }), false);
  assert.equal(hasEvidence({ kind: "probe-result", data: { probe: { id: "x" }, outcome: "found", passage: { text: "p" } } }), true);
  assert.equal(hasEvidence({ kind: "probe-result", data: { probe: { id: "x" }, outcome: "unmeasured", reason: "r" } }), true);
  assert.equal(hasEvidence({ kind: "probe-result", data: { probe: { id: "x" }, outcome: "unmeasured" } }), false);
  assert.equal(hasEvidence({ kind: "read", data: {} }), false);
  assert.equal(hasEvidence(null), false);
});

test("a read source that stated nothing gets a line; the ask text for the other slots is plain", () => {
  const t = createTurnVoid(FRAME);
  t.note("read", { source: { title: "Eiffel Tower", host: "en.wikipedia.org" }, found: false });
  assert.equal(traceOf(t).at(-1).say, "I read Eiffel Tower (en.wikipedia.org), but no sentence in it states the answer.");
  const d = (slot) => askPhrase({ slot, role: "capital", referents: [{ surface: "x", title: "Australia" }] });
  assert.equal(d("thing"), "what is the “capital” of “Australia”");
  assert.equal(d("quantity"), "how many: “capital” of “Australia”");
});

test("NO CASE LOGIC and no model: the module has no capital-letter class or upper-casing call, and imports nothing", () => {
  const code = fs.readFileSync(new URL("./fold-chat-void.js", import.meta.url), "utf8");
  for (const bad of ["[A-" + "Z]", "\\p{L" + "u}", "\\p{L" + "t}", "toUpper" + "Case", "isUpper" + "Case", "fetch" + "(", "XMLHttp"]) assert.ok(!code.includes(bad), `found ${bad}`);
  assert.ok(!/^\s*import\b/m.test(code), "no imports at all");
});
