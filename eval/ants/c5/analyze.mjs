// eval/ants/c5/analyze.mjs — tables from results-<tag>.json (no new measurement; reads the raw file). node eval/ants/c5/analyze.mjs run1
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const tag = process.argv[2] || "run1";
const r = JSON.parse(fs.readFileSync(path.join(HERE, `results-${tag}.json`), "utf8"));
const TOPIC = { eiffel: ["eiffel", "tower", "gustave"], photo: ["photosynthesis", "oxygen", "chloroplast"], curie: ["curie", "nobel", "warsaw"], wall: ["great wall", "ming"] };
const topicOfTurn = (n) => (n <= 3 ? "eiffel" : n <= 5 ? "photo" : n <= 8 ? "curie" : "wall");
const stale = (n, text) => Object.entries(TOPIC).filter(([k]) => k !== topicOfTurn(n)).flatMap(([, ws]) => ws.filter((w) => text.toLowerCase().includes(w)));
const out = [];
out.push("| T | ask | kind | cur chars | sal chars | cur tok | sal tok | cut | paired cut | cur hist msgs | sal hist msgs | cur sources (kept/of) | sal sources (kept/of) | summary cur/sal | stale words cur / sal |");
out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
let sc = 0, ss = 0, pc = 0, ps = 0, n = 0;
for (let i = 0; i < r.arms.current.length; i++) {
  const c = r.arms.current[i], s = r.arms.salient[i], p = r.paired[i];
  if (!c.info.sizes) { out.push(`| ${c.n} | ${c.ask} | ${c.kind} | - | - | - | - | - | - | - | - | - | - | - | - |`); continue; }
  const cs = c.info.sizes, ss_ = s.info.sizes;
  const pages = (x) => (x.info.sal.pages || []).map((q) => `${q.kept}/${q.of}`).join(",") || "-";
  const outside = (x) => { const sys = x.messages[0].content; const k = sys.indexOf("The sources below were read"); const kt = sys.indexOf("The person is following up"); const cut = k >= 0 ? k : kt >= 0 ? kt : sys.length; return sys.slice(0, cut) + "\n" + x.messages.slice(1).map((m) => m.content).join("\n"); };
  sc += cs.chars; ss += ss_.chars; pc += p.current.chars; ps += p.salient.chars; n++;
  out.push(`| ${c.n} | ${c.ask} | ${c.kind} | ${cs.chars} | ${ss_.chars} | ${cs.tokens4} | ${ss_.tokens4} | ${(100 * (1 - ss_.chars / cs.chars)).toFixed(0)}% | ${(100 * (1 - p.salient.chars / p.current.chars)).toFixed(0)}% | ${cs.historyMsgs} | ${ss_.historyMsgs} | ${pages(c)} | ${pages(s)} | ${cs.pastDiscourse}/${ss_.pastDiscourse} | ${[...new Set(stale(c.n, outside(c)))].join(",") || "-"} / ${[...new Set(stale(s.n, outside(s)))].join(",") || "-"} |`);
}
console.log(out.join("\n"));
console.log(`\nmodel-called turns: ${n}; mean chars current ${(sc / n).toFixed(0)} salient ${(ss / n).toFixed(0)} -> own-transcript cut ${(100 * (1 - ss / sc)).toFixed(1)}%; paired (same history) mean ${(pc / n).toFixed(0)} vs ${(ps / n).toFixed(0)} -> cut ${(100 * (1 - ps / pc)).toFixed(1)}%; tokens (chars/4) cur ${(sc / n / 4).toFixed(0)} sal ${(ss / n / 4).toFixed(0)}`);
console.log("\nOllama prompt_eval_count (real tokens):");
for (let i = 0; i < r.arms.current.length; i++) { const c = r.arms.current[i], s = r.arms.salient[i]; if (c.model) console.log(`T${c.n} cur ${c.model.promptEval} sal ${s.model?.promptEval}`); }
console.log("\nverdicts (cur/sal):"); for (let i = 0; i < r.arms.current.length; i++) console.log(`T${r.arms.current[i].n}`, r.arms.current[i].verdict.pass, r.arms.salient[i].verdict.pass, JSON.stringify(r.arms.salient[i].verdict.checks));

if (r.arms.fixed) {
  console.log("\n--- FIXED arm (wire.diff applied) vs SALIENT (as shipped) ---");
  console.log("| T | ask | sal chars | fixed chars | sal hist msgs | fixed hist msgs | stale words sal / fixed | verdict sal / fixed | answer differs |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  const outside = (x) => { const sys = x.messages[0].content; const k = sys.indexOf("The sources below were read"); const kt = sys.indexOf("The person is following up"); const cut = k >= 0 ? k : kt >= 0 ? kt : sys.length; return sys.slice(0, cut) + "\n" + x.messages.slice(1).map((m) => m.content).join("\n"); };
  let a = 0, b = 0, m = 0;
  for (let i = 0; i < r.arms.salient.length; i++) {
    const s = r.arms.salient[i], f = r.arms.fixed[i];
    if (!s.info.sizes) continue;
    a += s.info.sizes.chars; b += f.info.sizes.chars; m++;
    console.log(`| ${s.n} | ${s.ask} | ${s.info.sizes.chars} | ${f.info.sizes.chars} | ${s.info.sizes.historyMsgs} | ${f.info.sizes.historyMsgs} | ${[...new Set(stale(s.n, outside(s)))].join(",") || "-"} / ${[...new Set(stale(f.n, outside(f)))].join(",") || "-"} | ${s.verdict.pass}/${f.verdict.pass} | ${s.answer === f.answer ? "same" : "DIFFERENT"} |`);
  }
  console.log(`mean chars salient ${(a / m).toFixed(0)} fixed ${(b / m).toFixed(0)}; vs current ${(sc / n).toFixed(0)} -> fixed cut ${(100 * (1 - b / m / (sc / n))).toFixed(1)}%`);
}
