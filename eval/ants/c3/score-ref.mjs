// eval/ants/c3/score-ref.mjs — REFERENCE signals (not khora): R1 nomic-embed-text cosine, R2 gemma2:2b three-way judge. Local Ollama, temperature 0, one call per pair; raw replies stored in results-ref.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { report, auc } from "./lib.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const SET = process.env.C3_SET ? "-" + process.env.C3_SET : "";   // C3_SET=cf → the counterfactual control (battery-cf.json, results-*-cf.json)
const battery = JSON.parse(fs.readFileSync(path.join(here, `battery${SET}.json`), "utf8"));
const OLLAMA = "http://127.0.0.1:11434";
const embed = async (t) => (await (await fetch(OLLAMA + "/api/embeddings", { method: "POST", body: JSON.stringify({ model: "nomic-embed-text", prompt: t }) })).json()).embedding;
const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y); };
async function judge(claim, sentence) {
  const messages = [
    { role: "system", content: "You compare a SENTENCE from a source to a CLAIM. Answer with exactly one word: ENTAILS if the sentence says what the claim says, CONTRADICTS if the sentence says something incompatible with the claim, NEITHER otherwise (different topic, different fact, or merely mentions it)." },
    { role: "user", content: `SENTENCE: ${sentence}\nCLAIM: ${claim}\nAnswer:` },
  ];
  const r = await (await fetch(OLLAMA + "/api/chat", { method: "POST", body: JSON.stringify({ model: "gemma2:2b", messages, stream: false, options: { temperature: 0, num_predict: 8 } }) })).json();
  return String(r.message?.content ?? "").trim();
}
const rows = [];
for (const p of battery.pairs) {
  const [a, b] = [await embed(p.claim), await embed(p.sentence)];
  const reply = await judge(p.claim, p.sentence);
  const verdict = /ENTAIL/i.test(reply) ? "ENTAILS" : /CONTRADICT/i.test(reply) ? "CONTRADICTS" : /NEITHER/i.test(reply) ? "NEITHER" : "UNPARSED";
  rows.push({ id: p.id, label: p.label, loose: !!p.loose, type: p.type, cos: cos(a, b), reply, verdict, R2: verdict === "ENTAILS" ? "ACCEPT" : "REJECT" });
}
fs.writeFileSync(path.join(here, `results-ref${SET}.json`), JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
const f = (x) => (x == null ? "n/a" : x.toFixed(3));
console.log(`R1 cosine AUC  E vs rest ${f(auc(rows, "cos", ["E"], ["T", "C", "U"]))}  E vs C ${f(auc(rows, "cos", ["E"], ["C"]))}  E vs T ${f(auc(rows, "cos", ["E"], ["T"]))}  E vs U ${f(auc(rows, "cos", ["E"], ["U"]))}`);
for (const l of ["E", "T", "C", "U"]) { const x = rows.filter((r) => r.label === l).map((r) => r.cos); console.log(`  cos ${l}: min ${f(Math.min(...x))} mean ${f(x.reduce((a, b) => a + b, 0) / x.length)} max ${f(Math.max(...x))}`); }
const cmax = Math.max(...rows.filter((r) => r.label === "C").map((r) => r.cos)), emin = Math.min(...rows.filter((r) => r.label === "E").map((r) => r.cos));
console.log(`  some C outscores some E: ${cmax > emin} (max C ${f(cmax)}, min E ${f(emin)})`);
console.log(report("R2 gemma2:2b judge", rows, "R2"));
const vm = {}; for (const r of rows) { vm[r.label] ??= {}; vm[r.label][r.verdict] = (vm[r.label][r.verdict] || 0) + 1; }
console.log("3-way verdicts by label:", JSON.stringify(vm));
console.log(rows.map((r) => `${r.id}${r.label}${r.loose ? "*" : ""}:${r.verdict[0]}`).join(" "));
