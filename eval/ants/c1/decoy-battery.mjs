// C1 I1 — the decoy battery. 14 true pages + 56 decoys x three gate arms. Counts decoys accepted (FALSE ACCEPTS) and trues accepted.
//   node eval/ants/c1/decoy-battery.mjs [--frame]      --frame also reads each question's asker frame (network: Wikipedia title service; cached) so rung 2 runs as in the live lane
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import * as BASE from "./origin-base.mjs"; import * as FIX from "./origin-fixed.mjs"; import * as ALL from "../a1/origin-min2.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = JSON.parse(fs.readFileSync(path.join(HERE, "decoys.json"), "utf8")), C = JSON.parse(fs.readFileSync(path.join(HERE, "../primary-corpus.json"), "utf8"));
const FRAME = process.argv.includes("--frame");
const arms = { "min3 (the real module)": BASE, "min2-all (A1 copy)": ALL, "minSlot (Fix 1)": FIX };
const kinds = ["true", "wf", "oe", "mn", "ng"];
const FCACHE = path.join(HERE, "frame-cache.json"); let fc = {}; try { fc = JSON.parse(fs.readFileSync(FCACHE, "utf8")); } catch {}
const rows = [];
for (const it of D.items) {
  const q = C.claims.find((c) => c.id === it.id).question;
  let reading = null;
  if (FRAME) { reading = await BASE.readFrame(q, { fetchImpl: fetch }); }
  for (const k of kinds) for (const [arm, M] of Object.entries(arms)) {
    const r = M.supportOf(it.claim, { url: "https://example.org/" + it.id, title: "", text: it[k] }, { forWhom: q, reading });
    rows.push({ id: it.id, kind: k, arm, verdict: r.verdict, why: r.why || null, sentence: r.sentence || null, framed: !!reading });
  }
}
const out = {};
for (const arm of Object.keys(arms)) {
  const mine = rows.filter((r) => r.arm === arm);
  out[arm] = { trueAccepted: mine.filter((r) => r.kind === "true" && r.verdict === "same").length, trueTotal: D.items.length, falseAccepts: mine.filter((r) => r.kind !== "true" && r.verdict === "same").map((r) => r.id + "/" + r.kind), decoyTotal: D.items.length * 4,
    trueMissed: mine.filter((r) => r.kind === "true" && r.verdict !== "same").map((r) => r.id + ":" + r.verdict + (r.why ? "/" + r.why : "")) };
}
const stamp = (process.env.C1_TAG ? process.env.C1_TAG + "-" : "") + (FRAME ? "frame" : "rung1");
fs.writeFileSync(path.join(HERE, `decoy-battery-${stamp}.json`), JSON.stringify({ at: new Date().toISOString(), framed: FRAME, framesRead: FRAME ? rows.filter((r) => r.arm.startsWith("min3")).filter((r) => r.framed).length / 5 : 0, summary: out, rows }, null, 1));
for (const [arm, o] of Object.entries(out)) console.log(arm.padEnd(26), `true ${o.trueAccepted}/${o.trueTotal}  false accepts ${o.falseAccepts.length}/${o.decoyTotal} ${o.falseAccepts.join(" ")}`, "\n   true missed:", o.trueMissed.join(" "));
