// G1 real data: the 73 cases of eval/cases.json (written 2026-10-05 by others, with an `expect.search` of their own) run through describeOutput and classifyTurn.
// Independent of my corpora. Agreement means: expect.search===false <=> the turn is read as output that needs no sources; expect.search===true <=> no output type, or output that needs sources.
import fs from "node:fs";
import { describeOutput } from "../../../fold-chat-outputtype.js";
import { classifyTurn, skipsSearch } from "../../../fold-chat-discourse.js";
const j = JSON.parse(fs.readFileSync(new URL("../../cases.json", import.meta.url), "utf8"));
let n = 0, agree = 0, wantsTrue = 0; const bad = []; let kindAgree = 0;
for (const c of j.cases) {
  let prior = [];
  c.turns.forEach((t, i) => {
    const d = describeOutput(t, { prior });
    const last = i === c.turns.length - 1;
    if (last || true) {
      n++;
      const shouldSearch = c.expect.search;
      const readSearches = !d.wants || d.needsSources;      // none, or output grounded in sources
      const ok = shouldSearch ? readSearches : !readSearches;
      if (d.wants) wantsTrue++;
      if (ok) agree++; else bad.push({ id: c.id, turn: i, t, d: { type: d.type, needsSources: d.needsSources, topic: d.topic } });
    }
    prior = [...prior, { role: "user", content: t }, { role: "assistant", content: "Answer given." }];
  });
}
console.log(`turns ${n}, describeOutput agrees with expect.search on ${agree}; turns read as output: ${wantsTrue}`);
for (const b of bad) console.log("  DISAGREE", b.id, JSON.stringify(b.t).slice(0, 90), JSON.stringify(b.d));
// the old classifier on the same turns (only first turn of each case, no thread): does skipsSearch agree with expect.search?
let on = 0, oa = 0; const ob = [];
for (const c of j.cases) { const t = c.turns[0]; on++; const k = classifyTurn(t); const searches = !skipsSearch(k) && k !== "smalltalk"; const ok = c.expect.search ? searches : !searches; if (ok) oa++; else ob.push([c.id, k, t.slice(0, 70)]); }
console.log(`OLD classifyTurn+skipsSearch agrees with expect.search on ${oa}/${on} first turns`);
for (const b of ob) console.log("  OLD-DISAGREE", b.join(" | "));
