// sweep.mjs — in-sample sensitivity of ONE declared constant (predWeight) over all four ask sets, answerSpan only (no strand): containment, confident-wrong, gap on unanswerable.
// NOT a held-out result: every set is in-sample for whatever this picks.
import { passagesOf } from "./asks-lib.mjs"; import { answerSpan } from "../../../fold-chat-answerspan.js"; import { containsKey } from "./score-lib.mjs";
const sets = { dev: (await import("./asks-dev.mjs")).DEV, held: (await import("./asks-held.mjs")).HELD, h2: (await import("./asks-h2.mjs")).H2, h3: (await import("./asks-h3.mjs")).H3 };
const ws = process.argv.slice(2).map(Number); const cache = {};
for (const [name, asks] of Object.entries(sets)) cache[name] = asks.map((a) => ({ a, ps: passagesOf(a) }));
for (const w of ws) {
  let line = `predWeight=${w}`;
  const tot = { ans: 0, hit: 0, wrong: 0, un: 0, unGap: 0 };
  for (const [name, items] of Object.entries(cache)) {
    let ans = 0, hit = 0, wrong = 0, un = 0, unGap = 0;
    for (const { a, ps } of items) {
      const r = answerSpan(a.q, ps, { predWeight: w }); const sh = r.spans[0] ? r.spans[0].shown : null;
      if (a.gapExpected) continue;
      if (a.answerable === false) { un++; if (!sh) unGap++; } else { ans++; if (sh && containsKey(sh, a)) hit++; else if (sh) wrong++; }
    }
    line += `\n  ${name.padEnd(5)} contains ${hit}/${ans}=${(100 * hit / ans).toFixed(0)}%  wrong ${wrong}=${(100 * wrong / ans).toFixed(0)}%  gap-on-unanswerable ${unGap}/${un}`;
    tot.ans += ans; tot.hit += hit; tot.wrong += wrong; tot.un += un; tot.unGap += unGap;
  }
  console.log(line + `\n  ALL   contains ${tot.hit}/${tot.ans}=${(100 * tot.hit / tot.ans).toFixed(0)}%  wrong ${tot.wrong}=${(100 * tot.wrong / tot.ans).toFixed(0)}%  gap-on-unanswerable ${tot.unGap}/${tot.un}=${(100 * tot.unGap / tot.un).toFixed(0)}%`);
}
