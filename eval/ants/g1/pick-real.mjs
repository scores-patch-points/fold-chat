// G1 closed-list picker with a REAL local model (gemma2:2b or qwen2.5:14b via Ollama, no thinking models). Only UNDECIDED descriptions go to the model.
import { describeOutput, pickType, TYPES } from "../../../fold-chat-outputtype.js";
const model = process.argv[2] || "gemma2:2b";
const pick = async (prompt) => {
  const r = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0, num_predict: 12 } }) });
  const j = await r.json(); return String(j.response || "").trim();
};
const cases = [
  ["write me something funny about my boss", "story|poem|other|email|slogan"],
  ["write something about dolphins", "essay|other"],
  ["write me something to read to my kids at bedtime", "story"],
  ["write something for my sister's wedding", "speech|poem|letter|other"],
  ["write me something to post on instagram", "slogan|other"],
  ["write me something that rhymes about summer", "poem"],
  ["write something in python that sorts a list", "code"],
  ["write me something to send to my landlord", "email|letter"],
  ["write something that translates this into French", "translation"],
  ["write me anything", "other"],
  ["write something nice", "other|poem|letter"],
  ["do me something about taxes", "essay|other"],
];
let n = 0, undecided = 0, picked = 0, droppedOffList = 0, droppedDisagree = 0, errs = [];
for (const [q, ok] of cases) {
  n++;
  const d = describeOutput(q);
  if (!d.undecided) { console.log("NOT-UNDECIDED", q, "->", d.type, d.typed); continue; }
  undecided++;
  const raw = []; const spy = async (p, o) => { const a = await pick(p); raw.push(a); return a; };
  const e = await pickType(d, q, spy);
  const got = e.typed === "model-pick" ? e.type : null;
  if (got) { picked++; if (!ok.split("|").includes(got)) errs.push([q, got, ok]); }
  else if (raw.some((r) => !TYPES.includes(r.toLowerCase().replace(/[^a-z]/g, "")))) droppedOffList++; else droppedDisagree++;
  console.log(`${q.padEnd(54)} raw=${JSON.stringify(raw)} -> ${got || "kept " + d.type}`);
}
console.log(JSON.stringify({ model, cases: n, undecided, picked, droppedOffList, droppedDisagreeOrEvidence: droppedDisagree, pickedButOutsideAcceptable: errs }));
