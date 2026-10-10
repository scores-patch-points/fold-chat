// fidelity.mjs — the sim against the real page on the SAME asks (R2 = sibling words; R5 = prompt composition). Paths and recall turns should agree where the stand-in's claims exist.
import fs from "node:fs";
import { makeReplayFetch } from "./lib/replay.mjs";
import { newSession, runTurn, makeCtx } from "./sim.mjs";
const f = makeReplayFetch({ mode: "replay" });
const real = (n) => JSON.parse(fs.readFileSync(new URL(`./out/real-${n}.json`, import.meta.url), "utf8")).turns;
const rows = [];
for (const name of ["R2", "R5"]) {
  const rt = real(name); const s = newSession("fid"), ctx = makeCtx({ fetchImpl: f });
  for (const t of rt) {
    const r = await runTurn(s, t.ask, ctx);
    const realPath = t.notices.some((n) => /^\[alone\] On turn \d+ I said/.test(n)) ? "recall" : (t.searches > 0 ? "web" : "other");
    rows.push({ script: name, turn: t.turn, ask: t.ask.slice(0, 50), realPath, simPath: r.path, realSearches: t.searches, simSearches: r.web, realRecallTurn: (t.notices.join(" ").match(/On turn (\d+)/) || [])[1] || null, simRecallTurn: r.recallTurn, realFirstCallChars: t.modelChars[0] ?? null, simLiveChars: r.arms.live.chars, simGate: r.gateOn });
  }
}
fs.writeFileSync(new URL("./out/fidelity.json", import.meta.url), JSON.stringify(rows, null, 1));
for (const r of rows) console.log(`${r.script}.${r.turn} ${r.ask.padEnd(50)} path real/sim ${r.realPath}/${r.simPath}  searches ${r.realSearches}/${r.simSearches}  recallTurn ${r.realRecallTurn}/${r.simRecallTurn}  chars ${r.realFirstCallChars}/${r.simLiveChars} gate ${r.simGate}`);
