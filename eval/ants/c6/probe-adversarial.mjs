// probe-adversarial.mjs — SUPPLEMENTARY (post-hoc, not pre-registered): the title cue and the other-author rule are the cheapest things for a content farm to dodge. Re-run the TRAP pages with
// the <title> rewritten to the bare person name and every <h1> removed, in the arms with the host tables OFF (features_blind) and with them ON (full). What still gets in?
import fs from "node:fs";
import { read } from "./reader.mjs";
import { classifyPage } from "../../../fold-chat-fetchedvoice.js";
const traps = [...JSON.parse(fs.readFileSync(new URL("./battery.json", import.meta.url))).items, ...JSON.parse(fs.readFileSync(new URL("./battery-holdout.json", import.meta.url))).items].filter((i) => i.label === "not_own");
const rows = [];
for (const it of traps) {
  const r = await read(it.url); if (!r.ok || !r.html) { rows.push([it.id, "n/a (no html)"]); continue; }
  const html = r.html.replace(/<title[^>]*>[^]*?<\/title>/i, `<title>${it.person}</title>`).replace(/<h1[^>]*>[^]*?<\/h1>/gi, "").replace(/<meta[^>]*name=["']author["'][^>]*>/gi, "");
  const blind = classifyPage({ person: it.person, url: it.url, html, arm: "features_blind" });
  const full = classifyPage({ person: it.person, url: it.url, html });
  rows.push([it.id, it.kind.slice(0, 40), "blind:" + blind.verdict + " " + (blind.reasons[0] || ""), "full:" + full.verdict + " " + (full.reasons[0] || "")]);
}
for (const r of rows) console.log(r.join(" | "));
const leak = rows.filter((r) => /blind:own/.test(r[2])).length, leakFull = rows.filter((r) => /full:own/.test(r[3])).length;
console.log(`\nadversarial (title neutralised, author meta removed): features_blind admits ${leak}/${rows.length}; full admits ${leakFull}/${rows.length}`);
