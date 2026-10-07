// eval/ants/c3/collect-janus.mjs — K3: the janus text door (khora proxy :11436 /v1/reason) given `sentence + " " + claim` for every pair; raw text stored. K3 flags a contradiction iff the report names one (regex below, fixed in advance).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const battery = JSON.parse(fs.readFileSync(path.join(here, "battery.json"), "utf8"));
const base = process.argv[2] || "http://127.0.0.1:11436";
const FLAG = /contradict|conflict|incoheren|inconsisten|refut|violat|FAIL|✗/i;
const rows = [];
for (const p of battery.pairs) {
  const r = await fetch(base + "/v1/reason", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: p.sentence + " " + p.claim }) });
  const text = await r.text();
  rows.push({ id: p.id, label: p.label, status: r.status, exit: r.headers.get("x-er7-exit"), flagged: FLAG.test(text), text: text.slice(0, 600) });
}
fs.writeFileSync(path.join(here, "janus-raw.json"), JSON.stringify(rows, null, 1));
console.log("flagged:", rows.filter((r) => r.flagged).map((r) => r.id + r.label).join(" ") || "none", "| exit codes:", [...new Set(rows.map((r) => r.exit))].join(","));
console.log(rows[3].text.split("\n").slice(0, 4).join("\n"));
