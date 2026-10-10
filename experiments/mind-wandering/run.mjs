// run.mjs — the headless arm: run the wander, print the disclosed log, write
// the transcript and the numbers. No browser, no model unless asked.
//
//   node experiments/mind-wandering/run.mjs --topic castle --steps 240 --seed 1
//   node experiments/mind-wandering/run.mjs --topic "time travel" --model tiny
//
// Numbers land in out/<slug>.jsonl (one step per line) and out/<slug>.summary.json.

import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPrior, wander, detokenize, DEFAULT_CORPUS, DEFAULT_ORDER } from "./wander.mjs";
import { runThroughJanus, logicalTranscript } from "./janus.mjs";
import { weavePathos } from "./penelope.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, d = null) => { const i = process.argv.indexOf("--" + name); return i >= 0 ? (process.argv[i + 1] ?? true) : d; };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "topic";

const topic = String(arg("topic", "castle"));
const steps = Number(arg("steps", 240));
const seed = Number(arg("seed", 1));
const order = Number(arg("order", DEFAULT_ORDER));
const corpus = arg("corpus", DEFAULT_CORPUS);
const useModel = String(arg("model", "none")) === "tiny";
const temperature = Number(arg("temperature", 0.9));
const quiet = process.argv.includes("--quiet");

const OLLAMA = arg("ollama", "http://127.0.0.1:11435");
async function tinySeed(t) {
  try {
    const r = await fetch(`${OLLAMA}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: arg("tiny-model", "gemma2:2b"), prompt: `In one short sentence, state what "${t}" is about, in plain words.`, stream: false, options: { num_predict: 60 } }), signal: AbortSignal.timeout(20000) });
    if (r.ok) { const j = await r.json(); if (j?.response) return j.response; }
  } catch {}
  return null;
}

const t0 = Date.now();
const loaded = loadPrior({ corpusPaths: [corpus], order });
if (!loaded.ok) { console.error(loaded.reason); process.exit(1); }
if (!quiet) console.error(`prior: ${loaded.prior.events.toLocaleString()} events · ${loaded.vocab.size.toLocaleString()} forms · ${Date.now() - t0}ms`);

const run = await wander({ loaded, topic, steps, seed, order, temperature, model: useModel ? tinySeed : null });

if (!quiet) {
  for (const e of run.events) {
    if (e.n % 8 === 0 || e.move === "reopen" || e.move === "anchor" || e.overlap < 0.05) {
      console.log(`${String(e.n).padStart(4)}  ${e.move.padEnd(9)} g${e.grain ?? "-"} ov=${e.overlap.toFixed(2)} drift=${e.driftRun}  ${e.context}`);
    }
  }
}

const outDir = join(HERE, "out");
fs.mkdirSync(outDir, { recursive: true });
const base = join(outDir, `${slug(topic)}--s${seed}`);
fs.writeFileSync(base + ".jsonl", run.events.map((e) => JSON.stringify(e)).join("\n") + "\n");
fs.writeFileSync(base + ".summary.json", JSON.stringify({ topic, seed, steps, order, corpus, summary: run.summary, modelCalls: run.modelCalls, oov: run.oov }, null, 2));
fs.writeFileSync(base + ".txt", run.transcript + "\n");

// ── run it through Janus ────────────────────────────────────────────────────
const janus = runThroughJanus(run.events);
const logical = logicalTranscript(janus, detokenize);
fs.writeFileSync(base + ".janus.json", JSON.stringify({ topic, seed, basis: janus.basis, relation: janus.relation, edges: janus.edges, kept: janus.kept, verdict: janus.verdict, probe: janus.probe, refuted: janus.refuted, transcript: logical }, null, 2));

console.log(`\n── ${topic} (seed ${seed}, ${steps} steps, model ${useModel ? "tiny" : "none"}) ──`);
console.log(run.summary);
console.log(`model calls: ${run.modelCalls}${run.oov ? " (topic stayed out of vocabulary)" : ""}`);
console.log(`\n── Janus ──`);
console.log(janus.basis);
for (const r of janus.refuted.slice(0, 6)) console.log(`  ✗ ${r.edge.id} ${r.edge.from}→${r.edge.to} (${r.edge.move}) [${r.kind}]: ${String(r.cycle).slice(0, 110)}`);
if (janus.refuted.length > 6) console.log(`  … ${janus.refuted.length - 6} more refuted`);
console.log(`\nraw:     ${run.transcript.slice(0, 420)}${run.transcript.length > 420 ? " …" : ""}`);
console.log(`logical: ${logical.slice(0, 420)}${logical.length > 420 ? " …" : ""}`);

// ── wire in Penelope for the creativity, the pathos (no model) ──────────────
if (process.argv.includes("--pathos")) {
  const register = String(arg("register", "elegiac"));
  console.log(`\n── Penelope (pathos · ${register}, no model) ──`);
  const p = weavePathos({ topic, logicalTranscript: logical, register });
  if (p.drew) {
    fs.writeFileSync(base + ".pathos.txt", p.passage + "\n");
    console.log(p.passage);
    console.log(`\n${p.basis}`);
    fs.writeFileSync(base + ".pathos.json", JSON.stringify(p, null, 2));
  } else {
    console.log(`no draw — ${p.gap}`);
  }
}

console.log(`\nwritten: ${base}.{jsonl,summary.json,txt,janus.json}${process.argv.includes("--pathos") ? ",pathos.txt,pathos.json" : ""}`);
