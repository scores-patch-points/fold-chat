// eval/ants/c2/c2-eval.mjs — the REAL run of fold-chat-voices.js (C2-PREREG.md): B1's 12 contested questions + 6 controls, the REAL classify() over the REAL voice/thinkers-profile.json,
// the REAL canon files read from disk (sha256-checked), strict arm (shipped) and loose arm (comparison). No model, no network. An oracle independent of the module re-reads every canon and re-finds every quote.
//   node eval/ants/c2/c2-eval.mjs            writes eval/ants/c2/C2-results-<stamp>.json and C2-listing-<stamp>.txt (the text I hand-judge; labels go to C2-judgements.json AFTER, from that listing)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { decodeProfile, classify } from "../../../fold-chat-thinkers.js";
import { voicesFor, verifyVoices, thinkerTable, renderText } from "../../../fold-chat-voices.js";
import { functionWordsOf } from "../../../fold-chat-snippets.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../.."), WORLD = path.resolve(ROOT, "..");
const profile = JSON.parse(fs.readFileSync(path.join(ROOT, "voice/thinkers-profile.json"), "utf8"));
const model = decodeProfile(profile), thinkers = thinkerTable(profile), FW = functionWordsOf("en");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const canonFile = (p) => [path.join(WORLD, p), path.join(WORLD, p.replace(/^live_priors\//, "ethos/"))].find((x) => fs.existsSync(x));

const QUESTIONS = ["Is there a God?", "What is justice?", "How should I treat my enemies?", "Is suffering necessary?", "Can a person change?", "What is a good ruler?", "Is it wrong to lie?", "What happens after death?", "What is the self?", "Why obey the law?", "Is war ever just?", "What is virtue?"];
const CONTROLS = ["What is the capital of France?", "How do I reset my router password?", "Who won the 1998 World Cup?", "What is the boiling point of water?", "How many ounces are in a pound?", "asdf qwerty zxcv"];

// the host's canon reader (cached; its cost is reported separately)
const cache = new Map(); let readMs = 0, readBytes = 0;
const canonOf = (handle, th) => {
  if (cache.has(handle)) return cache.get(handle);
  const t0 = performance.now(), f = canonFile(th.source.path);
  let rec = null;
  if (f) { const buf = fs.readFileSync(f); readBytes += buf.length; rec = { text: buf.toString("utf8"), sha256: sha(buf) }; }
  readMs += performance.now() - t0; cache.set(handle, rec); return rec;
};
// the ORACLE, independent of the module: a fresh read, a fresh hash, indexOf, offsets
const oracle = (v) => {
  const th = thinkers[v.handle], f = canonFile(th.source.path);
  const buf = fs.readFileSync(f), text = buf.toString("utf8");
  const shaOk = sha(buf) === th.source.sha256, found = text.indexOf(v.quote);
  const offsetsOk = text.slice(v.source.start, v.source.end) === v.quote;
  return { shaOk, substring: found >= 0, offsetsOk, atExact: found === v.source.start };
};
const ctx = (v) => { const t = canonOf(v.handle, thinkers[v.handle]).text; const a = Math.max(0, v.source.start - 170), b = Math.min(t.length, v.source.end + 170); return t.slice(a, v.source.start).replace(/\s+/g, " ") + " ⟦" + v.quote.replace(/\s+/g, " ") + "⟧ " + t.slice(v.source.end, b).replace(/\s+/g, " "); };

const out = { at: new Date().toISOString(), arms: {}, versions: Object.fromEntries(["fold-chat-provenance.js", "fold-chat-voices.js", "fold-chat-thinkers.js", "fold-chat-counsel.js", "voice/thinkers-profile.json"].map((f) => [f, sha(fs.readFileSync(path.join(ROOT, f)))])) };
const lines = [];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
for (const [armName, limits] of [["strict", {}], ["loose", { strict: false }]]) {
  const arm = { questions: [] }; out.arms[armName] = arm;
  lines.push(`\n######## ARM ${armName.toUpperCase()} ########`);
  for (const [group, qs] of [["Q", QUESTIONS], ["C", CONTROLS]]) {
    qs.forEach((q, qi) => {
      const cls = classify(q, { model });
      const cands = cls.candidates || [];
      const t0 = performance.now();
      const r = voicesFor({ question: q, candidates: cands, thinkers, canonOf, fw: FW, limits });
      const first = performance.now() - t0;
      const warm = []; for (let i = 0; i < 9; i++) { const a = performance.now(); voicesFor({ question: q, candidates: cands, thinkers, canonOf, fw: FW, limits }); warm.push(performance.now() - a); }
      const ver = verifyVoices({ result: r, thinkers, canonOf, limits });
      const orc = r.voices.map(oracle);
      arm.questions.push({ group, i: qi + 1, q, undetermined: cls.undetermined, why: cls.why, known: cls.known, candidates: cands.map((c) => c.handle), voices: r.voices, line: r.line, considered: r.considered, verifyOk: ver.ok, verifyBad: ver.bad, oracle: orc, calls: r.calls, firstMs: +first.toFixed(2), warmMedianMs: +median(warm).toFixed(3), warmMaxMs: +Math.max(...warm).toFixed(3) });
      lines.push(`\n[${armName[0].toUpperCase()}:${group}${qi + 1}] ${q}   (B1: ${cls.undetermined ? "undetermined" : "accepted"}; candidates ${cands.map((c) => c.handle).join(", ") || "-"})   ${r.voices.length} voice(s)   first ${first.toFixed(1)} ms, warm median ${median(warm).toFixed(2)} ms`);
      if (r.line) lines.push("  LINE: " + r.line);
      for (const v of r.voices) lines.push(`  <${armName[0].toUpperCase()}:${group}${qi + 1}:${v.handle}>\n    ${v.frame}\n    QUOTE: “${v.quote.replace(/\s+/g, " ")}”\n    SOURCE: ${v.source.work} | section: ${v.source.section ?? "-"} | ${v.source.path} chars ${v.source.start}-${v.source.end}\n    CONTEXT: …${ctx(v)}…`);
      for (const c of r.considered.filter((x) => !x.ok)) lines.push(`  (no voice from ${c.handle}: ${c.why})`);
    });
  }
}
out.host = { canonReadMs: +readMs.toFixed(1), canonBytes: readBytes, canonsRead: cache.size };
const stamp = out.at.replace(/[:.]/g, "-").slice(0, 19);
fs.writeFileSync(path.join(HERE, `C2-results-${stamp}.json`), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(HERE, `C2-listing-${stamp}.txt`), lines.join("\n") + "\n");
console.log(lines.join("\n"));
// summary (the claims)
for (const [name, arm] of Object.entries(out.arms)) {
  const Qs = arm.questions.filter((x) => x.group === "Q"), Cs = arm.questions.filter((x) => x.group === "C");
  const all = arm.questions.flatMap((x) => x.voices.map((v, k) => ({ v, o: x.oracle[k] })));
  console.log(`\n== ${name}: questions with >=2 voices ${Qs.filter((x) => x.voices.length >= 2).length}/12; >=1 voice ${Qs.filter((x) => x.voices.length >= 1).length}/12; total quotes (12 Q) ${Qs.reduce((a, x) => a + x.voices.length, 0)}; controls with any voice ${Cs.filter((x) => x.voices.length).length}/6 (${Cs.reduce((a, x) => a + x.voices.length, 0)} quotes)`);
  console.log(`   oracle: ${all.filter((x) => x.o.shaOk && x.o.substring && x.o.offsetsOk && x.o.atExact).length}/${all.length} quotes pass (sha + substring + offsets); verifyVoices ok ${arm.questions.filter((x) => x.verifyOk).length}/${arm.questions.length}; model calls ${arm.questions.reduce((a, x) => a + x.calls, 0)}`);
  console.log(`   cost: first-call median ${median(arm.questions.map((x) => x.firstMs))} ms, max ${Math.max(...arm.questions.map((x) => x.firstMs))} ms; warm median-of-medians ${median(arm.questions.map((x) => x.warmMedianMs))} ms, max ${Math.max(...arm.questions.map((x) => x.warmMaxMs))} ms`);
}
console.log(`\nhost: read ${out.host.canonsRead} canons, ${(out.host.canonBytes / 1e6).toFixed(1)} MB, ${out.host.canonReadMs} ms (NOT in the per-question figures)`);
