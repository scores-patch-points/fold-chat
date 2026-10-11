// fold-experiment.mjs — the "best of all worlds" experiment. Complicated
// generation tasks, two modes, one yardstick:
//
//   GROUNDED — every proposition is in the source (bound edge, or verbatim
//              source sentence witnessed at its byte — the byte-trace)
//   VOICE    — explicit [voice:<altitude>] thought cited to a source span
//   FAIL     — neither (never ships as SEALED)
//   NOVEL    — prose the machine/model made by recombining the material, not
//              copied whole: model-interpretation sentences + travels.
//
// Modes:
//   chat     — ONE model call drafts the whole essay from the box.
//   agentic  — the loop: grounded box facts + a MIND-WANDER (the walk over real
//              source sentences, ruminated/drifted, each cited to its byte) +
//              the model's cited [voice:<altitude>] thoughts; verified per unit.
//
//   node fold-experiment.mjs [--tasks N] [--model M] [--source PATH]
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { readEnglish } from "../khora/native/eval/the-fold/scene/reader-en.mjs";
import { replaceCitesUtf8, snipSentenceUtf8 } from "../penelope/organs/verified-byte-snips.mjs";
import { idfOver, makeMuller } from "./experiments/mind-wandering/compose.mjs";
import { isStop } from "./experiments/mind-wandering/wander.mjs";
import { essayBoxFromRead, boundEdgesFromRead, cleanEdges, verifyDraftClaims, classifyEssay, sealEssayDraft, sentenceWitnesses, contentWords } from "./essay-seam.mjs";

const SOURCE_ID = "fold:essay-source";
const SOURCE = (() => { const i = process.argv.indexOf("--source"); return i >= 0 ? process.argv[i + 1] : "/Users/mlacy/Documents/3.0/pg2600.txt"; })();
const MODEL = (() => { const i = process.argv.indexOf("--model"); return i >= 0 ? process.argv[i + 1] : "qwen2.5-coder:1.5b"; })();
const URL = "http://127.0.0.1:11435";
const TASKS_N = Number((() => { const i = process.argv.indexOf("--tasks"); return i >= 0 ? process.argv[i + 1] : "4"; })());
const VOICE_NONE = (() => { const i = process.argv.indexOf("--voice"); return i >= 0 && process.argv[i + 1] === "none"; })();

export const TASKS = [
  { topic: "a warning given between two guests in a drawing-room", register: "attentive" },
  { topic: "rank and the order of entry when a prince arrives", register: "attentive" },
  { topic: "an evening invitation and the people it brings into view", register: "tender" },
  { topic: "what a persistent cough reveals about a hostess", register: "dread" },
  { topic: "the theatre of manners and who must speak first", register: "plain" },
  { topic: "fear and favour carried in one household", register: "dread" },
];

async function ollama(prompt, { temperature = 0.6, num_predict = 90 } = {}) {
  const r = await fetch(`${URL}/api/generate`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature, num_predict } }) });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  return (await r.json()).response ?? "";
}

// The wander's sentence bank from the SAME excerpt the reader saw, with CHAR
// offsets preserved (so texts match the reader's own sentences byte for byte).
function wanderBank(excerpt) {
  const bank = [];
  let cursor = 0;
  for (const p of excerpt.split(/(?<=[.!?])\s+/)) {
    const t = p.trim();
    const idx = excerpt.indexOf(t, cursor); if (idx >= 0) cursor = idx + t.length;
    const wc = t.split(/\s+/).length;
    if (wc < 7 || wc > 55) continue;
    if (!/^["“']?[A-Z]/.test(t)) continue;
    const cw = new Set((t.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length > 2 && !isStop(w)));
    if (cw.size < 3) continue;
    bank.push({ i: bank.length, text: t, cw, cwArr: [...cw], charAt: idx >= 0 ? idx : -1 });
  }
  return bank;
}

export async function setup() {
  const full = fs.readFileSync(SOURCE, "utf8");
  const iC1 = full.indexOf("CHAPTER I");
  const offset = iC1 < 0 ? 0 : iC1;
  const excerpt = full.slice(offset, offset + 80000);
  const read = await readEnglish({ text: excerpt });
  const box = essayBoxFromRead({ sourceText: full, excerptStart: offset, excerpt, sourceFile: SOURCE, sourceId: SOURCE_ID, read, induceKinds: () => [] });
  const edges = cleanEdges(boundEdgesFromRead({ sourceText: full, excerptStart: offset, excerpt, read }));
  const witnesses = sentenceWitnesses({ sourceText: full, excerptStart: offset, excerpt, read });
  const sourceAt = new Set([...witnesses.keys()]);
  const facts = edges.filter((e) => e.o);
  const byteAt = (charAt) => Buffer.byteLength(full.slice(0, offset + charAt), "utf8");
  // the wander walks only sentences the READ actually witnessed (byte-trace),
  // so every travelled line is grounded at its own byte by construction.
  const bank = wanderBank(excerpt).filter((b) => b.charAt >= 0 && witnesses.has(byteAt(b.charAt)));
  const idf = idfOver(bank);
  const classify = async (text) => {
    const prose = text.replace(/⟦[^⟧]*⟧/g, (m) => " ".repeat(m.length));
    const dr = await readEnglish({ text: prose });
    const claims = verifyDraftClaims({ read: dr, edges, text: prose });
    return { read: dr, claims, lanes: classifyEssay({ draft: text, read: dr, claims, sourceAt, witnesses }) };
  };
  const seal = (essay, claims, lanes) => sealEssayDraft({ draft: essay, sourceFile: SOURCE, sourceId: SOURCE_ID, replaceCites: replaceCitesUtf8, snipSentence: snipSentenceUtf8, claims, lanes });
  return { full, offset, excerpt, box, edges, witnesses, sourceAt, facts, bank, idf, byteAt, classify, seal };
}

async function wander(s, topic, register, steps = 12, seed = 1) {
  const m = makeMuller({ sentences: s.bank, idf: s.idf, thinkText: topic, topic, register, seed, take: steps });
  const rows = [];
  for (let i = 0; i < steps; i++) { const r = m.step(); if (r.sentence && !rows.includes(r.sentence)) rows.push(r.sentence); }
  const lines = rows.map((t) => {
    const without = String(t).replace(/["”'’…]*[.!?]+["”'’]*$/g, "").trim();
    return `${without} ⟦${SOURCE_ID}@${s.byteAt(s.bank.find((b) => b.text === t).charAt)}⟧.`;
  });
  return { lines, drifts: m.record().janus, novel: rows.length };
}

const ALTITUDES = ["atmosphere", "lens", "kind", "paradigm", "field", "network"];
async function voiceThoughts(s, facts, { voiceModel = true } = {}) {
  const lines = [];
  for (let i = 0; i < Math.min(ALTITUDES.length, facts.length); i++) {
    const e = facts[i];
    let out;
    if (!voiceModel) {
      const wit = String(s.witnesses.get(e.at) ?? "").replace(/\s+/g, " ");
      const ws = [...contentWords(wit)].filter((x) => x.length >= 4);
      const w1 = ws[0] ?? e.s, w2 = ws[1] ?? (e.o ?? e.s);
      out = i % 2 ? `${w1} and ${w2} carry the register of the scene` : `the ${w1} of this passage sets the tone`;
    } else {
      const snip = snipSentenceUtf8(SOURCE, e.at);
      const quote = (snip.ok ? snip.quote : `${e.s} ${e.v} ${e.o}`).replace(/\s+/g, " ").slice(0, 220);
      out = ((await ollama(`A line from War and Peace: "${quote}". In ONE short plain sentence, at the ${ALTITUDES[i]} level, say what it shows. Do not quote it back.`)).trim().split(/(?<=[.!?])\s+/)[0]) ?? "";
    }
    if (!out) continue;
    lines.push(`[voice:${ALTITUDES[i]}] ${out.replace(/[.\s]+$/, "")} ⟦${SOURCE_ID}@${e.at}⟧.`);
  }
  return lines;
}

export async function runAgentic(s, task, { voiceModel = true } = {}) {
  // grounded body by construction
  let essay = "";
  const cap = (x) => x[0].toUpperCase() + x.slice(1);
  for (const e of s.facts.slice(0, 10)) {
    const line = `${cap(e.s)} ${e.v}${e.o ? " " + e.o : ""} ⟦${SOURCE_ID}@${e.at}⟧.`;
    const trial = essay ? `${essay}\n${line}` : line;
    const { lanes } = await s.classify(trial);
    if (lanes.sentences.at(-1)?.lane === "grounded") essay = trial;
  }
  // mind-wander: novel grounded sentences, each witnessed at its byte
  const w = await wander(s, task.topic, task.register);
  essay = [essay, ...w.lines].filter(Boolean).join("\n");
  // the model's cited voice
  const voice = await voiceThoughts(s, s.facts, { voiceModel });
  essay = [essay, ...voice].filter(Boolean).join("\n");
  const { claims, lanes } = await s.classify(essay);
  const sealed = s.seal(essay, claims, lanes);
  return { essay, sealed, lanes, wander: w };
}

export async function runChat(s, task) {
  const cap = (x) => x[0].toUpperCase() + x.slice(1);
  const facts = s.facts.slice(0, 8).map((e) => `${cap(e.s)} ${e.v}${e.o ? " " + e.o : ""} ⟦${SOURCE_ID}@${e.at}⟧`).join("\n");
  const w = await wander(s, task.topic, task.register, 8);
  const reading = w.lines.join("\n");
  const snip = (at) => (snipSentenceUtf8(SOURCE, at).ok ? "yes" : "no");
  const factBytes = s.facts.slice(0, 8).map((e) => e.at);
  const spec = `Write a short essay on: ${task.topic}.\n\nFacts the reading holds (subject · act · object @byte):\n${facts}\n\nReading material (source sentences, each with its byte):\n${reading}\n\nRules: a factual sentence must restate a fact using those exact words and keep its ⟦${SOURCE_ID}@BYTE⟧ marker; an interpretation must start with [voice:ALTITUDE] (kind, field, link, network, atmosphere, lens, paradigm) and also keep a ⟦${SOURCE_ID}@BYTE⟧ marker. Cite at least three different bytes. One sentence per line.`;
  const essay = (await ollama(spec, { num_predict: 500, temperature: 0.5 })).trim();
  const { claims, lanes } = await s.classify(essay);
  const sealed = s.seal(essay, claims, lanes);
  return { essay, sealed, lanes, wander: w };
}

function metrics(run) {
  const L = run.lanes.counts;
  const verbatim = run.lanes.sentences.filter((x) => x.lane === "grounded" && x.because === "verbatim witnessed at its byte").length;
  const novel = L.voice + verbatim;
  const uniqueCites = new Set(run.lanes.sentences.flatMap((x) => (x.cites > 0 ? [x.at] : []))).size;
  return { ...L, sealed: run.sealed.verdict === "SEALED", novel, uniqueCites, length: run.essay.length, verbatim };
}

async function main() {
  const s = await setup();
  console.log(`read: ${s.edges.length} clean edges · ${s.bank.length} wander sentences · ${s.facts.length} facts`);
  const rows = [];
  for (const task of TASKS.slice(0, TASKS_N)) {
    console.log(`\n▸ TASK: "${task.topic}" (${task.register})`);
    for (const mode of ["chat", "agentic"]) {
      const t0 = Date.now();
      const run = mode === "agentic" ? await runAgentic(s, task, { voiceModel: !VOICE_NONE }) : await runChat(s, task);
      const m = metrics(run);
      rows.push({ task: task.topic.slice(0, 34), mode, ...m, ms: Date.now() - t0 });
      console.log(`  ${mode.padEnd(8)} grounded ${m.grounded} · voice ${m.voice} · fail ${m.fail} · novel ${m.novel} · ${run.sealed.verdict} (${run.sealed.sealScope}) · refused ${run.sealed.refused.length} · reason: ${run.sealed.reason?.slice(0, 60)} · cites ${m.uniqueCites} · ${m.length}ch`);
      if (!m.sealed) for (const f of run.lanes.sentences.filter((x) => x.lane === "fail").slice(0, 3)) console.log(`      FAIL [${f.because}] ${f.text.slice(0, 70)}`);
      else console.log(`      → ${run.sealed.text.split(/\n/).filter(Boolean).slice(0, 3).map((x) => x.slice(0, 70)).join(" | ")}`);
    }
  }
  console.log("\n=== VERDICT: chat vs agentic ===\n" + "task".padEnd(36) + "mode".padEnd(9) + "g".padEnd(4) + "v".padEnd(4) + "fail".padEnd(5) + "novel".padEnd(6) + "sealed");
  for (const r of rows) console.log(`${r.task.padEnd(36)}${r.mode.padEnd(9)}${String(r.grounded).padEnd(4)}${String(r.voice).padEnd(4)}${String(r.fail).padEnd(5)}${String(r.novel).padEnd(6)}${r.sealed ? "✓" : "✗"}`);
  const sum = (mode, k) => rows.filter((r) => r.mode === mode).reduce((a, r) => a + r[k], 0);
  const sealedBy = { chat: rows.filter((r) => r.mode === "chat" && r.sealed).length, agentic: rows.filter((r) => r.mode === "agentic" && r.sealed).length };
  console.log(`\ntotals  chat : grounded ${sum("chat", "grounded")} · voice ${sum("chat", "voice")} · fail ${sum("chat", "fail")} · novel ${sum("chat", "novel")} · sealed ${sealedBy.chat}/${TASKS_N}`);
  console.log(`        agentic: grounded ${sum("agentic", "grounded")} · voice ${sum("agentic", "voice")} · fail ${sum("agentic", "fail")} · novel ${sum("agentic", "novel")} · sealed ${sealedBy.agentic}/${TASKS_N}`);
  if (rows.some((r) => r.mode === "agentic" && !r.sealed)) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("experiment error:", e); process.exit(2); });
}