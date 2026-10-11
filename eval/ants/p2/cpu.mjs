// cpu.mjs <dev|held> — CPU milliseconds (process.cpuUsage, not wall time: the machine was under a load average of ~250) of one answerSpan call per ask, 3 passages each.
import { passagesOf } from "./asks-lib.mjs"; import { answerSpan } from "../../../fold-chat-answerspan.js"; import { median, quantile } from "./score-lib.mjs";
const set = process.argv[2] || "held"; const asks = set === "dev" ? (await import("./asks-dev.mjs")).DEV : set === "h2" ? (await import("./asks-h2.mjs")).H2 : set === "h3" ? (await import("./asks-h3.mjs")).H3 : (await import("./asks-held.mjs")).HELD;
const ms = [];
for (const a of asks) { const ps = passagesOf(a); const t0 = process.cpuUsage(); answerSpan(a.q, ps); const d = process.cpuUsage(t0); ms.push((d.user + d.system) / 1000); }
console.log(JSON.stringify({ set, n: ms.length, cpuMsMedian: +median(ms).toFixed(1), p90: +quantile(ms, 0.9).toFixed(1), max: +Math.max(...ms).toFixed(1) }));
