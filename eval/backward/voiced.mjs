// eval/backward/voiced.mjs — arm (j) of docs/BACKWARDS-GROUNDING-PREREG.md: the VOICED variant. gemma2:2b only (local Ollama, :11435 then :11434), temperature 0,
// no sealed model, no key. The model is shown ONLY the holons the assembler selected (top K verbatim) and asked for ONE sentence; the forward gate
// (fold-chat-ground.js attribute) and the assembler's own `certify` check it; a rejected voicing is replaced by the verbatim holons.
//   node eval/backward/voiced.mjs [--k 2] [--out voiced-run.json]
import fs from "node:fs";
import path from "node:path";
import { here, root, CASES, turnPages, goldPass } from "./lib.mjs";
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : argv[i + 1]; };
const K = Number(arg("k", 2));
const asm = await import(path.join(root, "fold-chat-assemble.js"));
const ground = await import(path.join(root, "fold-chat-ground.js"));
async function chat(prompt) {
  for (const port of [11435, 11434]) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "gemma2:2b", stream: false, options: { temperature: 0, num_predict: 90 }, messages: [{ role: "user", content: prompt }] }), signal: AbortSignal.timeout(90000) });
      if (!r.ok) continue;
      const j = await r.json();
      return String(j.message?.content || "").trim();
    } catch { /* try the next port */ }
  }
  return null;
}
const rows = [];
for (const c of CASES.filter((x) => ["a_single", "b_numeric", "c_multihop"].includes(x.stratum))) {
  const tp = turnPages("default", c.id, 0); if (!tp?.pages.length) continue;
  const pages = tp.pages.map((p) => ({ url: p.url, text: p.text }));
  const res = asm.assemble({ question: c.turns[0], pages });
  const ver = res.sentences.filter((s) => s.how === "verbatim").slice(0, K);
  if (!ver.length) { rows.push({ id: c.id, answered: false, gap: res.gaps[0]?.kind }); continue; }
  const passages = ver.map((s, i) => `[${i + 1}] ${s.text}`).join("\n");
  const prompt = `Answer the question in ONE short sentence, using ONLY the passages below. If they do not answer it, reply exactly: NO ANSWER.\n\nPassages:\n${passages}\n\nQuestion: ${c.turns[0]}`;
  const t0 = Date.now();
  const out = await chat(prompt);
  const ms = Date.now() - t0;
  if (out == null) { rows.push({ id: c.id, answered: true, model: "unreachable" }); continue; }
  const sentence = out.replace(/\s+/g, " ");
  const noAns = /^NO ANSWER/i.test(sentence);
  const material = pages.map((p, i) => ({ ref: asm.refsOf(pages)[i], source: p.url, text: p.text }));
  const g = noAns ? null : ground.attribute(sentence, material)[0];
  const cz = noAns ? null : asm.certify(sentence, pages);
  const fallbackText = ver.map((s) => s.text).join("\n");
  rows.push({ id: c.id, answered: true, voiced: sentence, noAnswer: noAns, gateAccepted: !!(g && g.ref), gateWhy: g && !g.ref ? g.why : null, certified: !!(cz && cz.accepted), certWhy: cz && !cz.accepted ? cz.why : null,
    goldVoiced: noAns ? null : goldPass(c, 0, sentence), goldFinal: goldPass(c, 0, (g && g.ref) || (cz && cz.accepted) ? sentence : fallbackText), ms });
  console.log(c.id.padEnd(24), noAns ? "NO ANSWER" : `gate=${!!(g && g.ref)} cert=${!!(cz && cz.accepted)} goldVoiced=${rows.at(-1).goldVoiced}`, sentence.slice(0, 110));
}
const sub = rows.filter((r) => r.voiced !== undefined && !r.noAnswer);
const sum = (xs, f) => xs.filter(f).length;
const summary = { k: K, model: "gemma2:2b", casesWithHolons: rows.filter((r) => r.answered).length, voiced: sub.length, noAnswer: sum(rows, (r) => r.noAnswer), gateAccepted: sum(sub, (r) => r.gateAccepted), certified: sum(sub, (r) => r.certified), goldVoiced: sum(sub, (r) => r.goldVoiced === true), goldVoicedAndGateAccepted: sum(sub, (r) => r.goldVoiced === true && r.gateAccepted), goldFinalWithFallback: sum(rows.filter((r) => r.answered), (r) => r.goldFinal === true), medianMs: (() => { const m = sub.map((r) => r.ms).sort((a, b) => a - b); return m.length ? m[Math.floor((m.length - 1) / 2)] : null; })() };
fs.writeFileSync(path.join(here, arg("out", "voiced-run.json")), JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
