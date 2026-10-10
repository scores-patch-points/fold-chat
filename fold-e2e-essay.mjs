// fold-e2e-essay.mjs — HEADLESS end-to-end. khora reads → box → a MOUTH composes
// → the seam classifies (grounded | [voice:<altitude>] cited to a source span)
// → seal. Success = EVERY proposition is either grounded in the source OR an
// explicit terrain-altitude voice cited to a witnessed source span — the system
// cites its thoughts to the source that prompted them, never to its own output.
//
// Two mouths (--mouth):
//   ollama   a real local model supplies the VOICE (default qwen2.5-coder:1.5b)
//   compose  a deterministic box-mouth (a stand-in that exercises the whole seam
//            with no GPU)
// In BOTH, the machine composes the grounded body (only propositions that bind)
// and cites each voice thought to the source span that prompted it.
//
//   node fold-e2e-essay.mjs [--mouth ollama|compose] [--model M] [--url U] [--rounds N] [--source PATH]
import fs from "node:fs";
import { readEnglish } from "../khora/native/eval/the-fold/scene/reader-en.mjs";
import { replaceCitesUtf8, snipSentenceUtf8 } from "../penelope/organs/verified-byte-snips.mjs";
import { essayBoxFromRead, boundEdgesFromRead, cleanEdges, verifyDraftClaims, classifyEssay, rewriteParts, sealEssayDraft } from "./essay-seam.mjs";

const SOURCE_ID = "fold:essay-source";
const ALTITUDES = ["atmosphere", "lens", "kind", "paradigm", "field", "network"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const factLine = (e, sourceId = SOURCE_ID) => `${cap(e.s)} ${e.v}${e.o ? " " + e.o : ""} ⟦${sourceId}@${e.at}⟧.`;

export const DEFAULT_SOURCE = "/Users/mlacy/Documents/3.0/pg2600.txt";

async function ollama({ url, model, prompt, temperature = 0.6, num_predict = 60 }) {
  const r = await fetch(`${url}/api/generate`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false, options: { temperature, num_predict } }) });
  if (!r.ok) throw new Error(`ollama ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return (await r.json()).response ?? "";
}

/** Run the whole pipeline headless. Returns { ok, sealed, lanes, essay, edgeless }. */
export async function runEssay({
  mouth = "compose", model = "qwen2.5-coder:1.5b", url = "http://127.0.0.1:11435",
  source = DEFAULT_SOURCE, rounds = 4, log = () => {},
} = {}) {
  if (!fs.existsSync(source)) return { ok: false, reason: `source not found: ${source}` };
  const full = fs.readFileSync(source, "utf8");
  const iC1 = full.indexOf("CHAPTER I");
  const offset = iC1 < 0 ? 0 : iC1;
  const excerpt = full.slice(offset, offset + 80000);
  const read = await readEnglish({ text: excerpt });
  const box = essayBoxFromRead({ sourceText: full, excerptStart: offset, excerpt, sourceFile: source, sourceId: SOURCE_ID, read, induceKinds: () => [] });
  const edges = cleanEdges(boundEdgesFromRead({ sourceText: full, excerptStart: offset, excerpt, read }));
  const sourceAt = new Set(edges.map((e) => e.at));
  const facts = edges.filter((e) => e.o).slice(0, 12);

  const classify = async (text) => {
    const prose = text.replace(/⟦[^⟧]*⟧/g, (m) => " ".repeat(m.length));
    const dr = await readEnglish({ text: prose });
    const claims = verifyDraftClaims({ read: dr, edges, text: prose });
    return { read: dr, claims, lanes: classifyEssay({ draft: text, read: dr, claims, sourceAt }) };
  };

  // THE GROUNDED BODY — only propositions that bind survive re-reading.
  let essay = "";
  for (const e of facts) {
    const cand = factLine(e);
    const trial = essay ? `${essay}\n${cand}` : cand;
    const { lanes } = await classify(trial);
    const last = lanes.sentences[lanes.sentences.length - 1];
    if (last && last.lane === "grounded") essay = trial;
  }

  // THE VOICE — the model's reading, each thought PROMPTED by a source span and
  // CITED BY THE SYSTEM to that span (never to the model's own output).
  for (let i = 0; i < Math.min(ALTITUDES.length, facts.length); i++) {
    const e = facts[i];
    let thought;
    if (mouth === "compose") {
      thought = i % 2 ? "read from the household, this act takes on the colour of obligation"
        : "the company of the drawing-room gives this act its tone";
    } else {
      const snip = snipSentenceUtf8(source, e.at);
      const quote = (snip.ok ? snip.quote : `${e.s} ${e.v} ${e.o}`).replace(/\s+/g, " ").slice(0, 240);
      const ask = `A line from War and Peace: "${quote}". In ONE short plain sentence, at the ${ALTITUDES[i]} level, say what it shows. Do not quote it back. Just the one sentence.`;
      thought = ((await ollama({ url, model, prompt: ask })).trim().split(/(?<=[.!?])\s+/)[0]) ?? "";
    }
    if (!thought) continue;
    essay += `${essay ? "\n" : ""}[voice:${ALTITUDES[i]}] ${thought.replace(/[.\s]+$/, "")} ⟦${SOURCE_ID}@${e.at}⟧.`;
  }

  // REPAIR (P186 carve-out): hand the machine the bound material for the first
  // failing sentence; the machine composes a grounded replacement (the model's
  // words are never rewritten by a model-on-model pass here).
  for (let round = 0; round < rounds; round++) {
    const { read: dr, claims, lanes } = await classify(essay);
    const L = lanes.counts;
    log(`round ${round}: grounded ${L.grounded} · voice ${L.voice} · fail ${L.fail} ${JSON.stringify(L.altitudes)}`);
    if (L.contradicted || (L.total > 0 && L.fail === 0)) {
      const sealed = sealEssayDraft({ draft: essay, sourceFile: source, sourceId: SOURCE_ID, replaceCites: replaceCitesUtf8, snipSentence: snipSentenceUtf8, claims, lanes });
      return { ok: sealed.verdict === "SEALED", sealed, lanes, essay };
    }
    const bad = lanes.sentences.find((s) => s.lane === "fail");
    const parts = rewriteParts({ read: dr, claims, edges, sourceId: SOURCE_ID }).find((r) => r.at === bad?.at);
    if (!bad || !parts?.parts?.length) break;
    const e = parts.parts[0];
    essay = essay.slice(0, bad.at) + factLine(e) + essay.slice(bad.at + bad.len);
  }
  const { lanes } = await classify(essay);
  return { ok: false, lanes, essay };
}

async function main() {
  const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
  const r = await runEssay({
    mouth: arg("--mouth", "compose"), model: arg("--model", "qwen2.5-coder:1.5b"),
    url: arg("--url", "http://127.0.0.1:11435"), source: arg("--source", DEFAULT_SOURCE), rounds: Number(arg("--rounds", "4")),
    log: (m) => console.log(m),
  });
  if (r.reason) { console.error(r.reason); process.exit(2); }
  console.log(`\n--- essay (${r.essay.length} chars) ---\n${r.essay}\n`);
  const L = r.lanes.counts;
  if (r.ok) {
    console.log(`=== ${r.sealed.verdict} · ${r.sealed.sealScope} · snips ${r.sealed.snips.filter((s) => s.verified).length} ===`);
    console.log(`PASS: ${L.grounded} grounded + ${L.voice} cited terrain-voice ${JSON.stringify(L.altitudes)} · every voice cited to a witnessed source span`);
    process.exit(0);
  }
  console.log(`=== NOT SEALED: grounded ${L.grounded} · voice ${L.voice} · fail ${L.fail} ===`);
  for (const s of r.lanes.sentences.filter((x) => x.lane === "fail").slice(0, 8)) console.log(`  FAIL [${s.because}] ${s.text.slice(0, 90)}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error("e2e error:", e?.message ?? e); process.exit(2); });
