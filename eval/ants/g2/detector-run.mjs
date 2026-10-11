// G2 I2: isMetaAboutType on the real fetched pages. Genre pages (the encyclopedia article ON the output type) are scored twice:
// with a different topic (expect meta) and with their own subject as the topic (expect NOT meta).
import fs from "node:fs";
import { isMetaAboutType } from "../../../fold-chat-genvoid.js";
const pages = JSON.parse(fs.readFileSync("eval/ants/g2/pages.json", "utf8"));
const split = process.argv[2] || "dev";
const GENRE = new Set(["ctl-wp-essay", "ctl-wp-haiku", "ctl-wp-coverletter"]);
const rows = [];
for (const p of pages.filter((x) => split === "all" || x.split === split)) {
  const pg = { title: p.title, url: p.url, text: p.text };
  const cases = GENRE.has(p.id) ? [["topic=telephone (a different topic)", { type: p.type, topic: "telephone" }, true], ["topic=its own subject", { type: p.type, topic: p.type }, false]]
    : [["", { type: p.type, topic: p.topic }, p.role === "tutorial"]];
  for (const [label, ot, expect] of cases) {
    const r = isMetaAboutType(pg, ot);
    rows.push({ id: p.id, role: GENRE.has(p.id) ? "genre" : p.role, label, expect, got: r.meta, kind: r.kind, score: r.score });
    console.log((r.meta === expect ? "ok  " : "FAIL"), (GENRE.has(p.id) ? "genre" : p.role).padEnd(9), p.id.padEnd(28), label.padEnd(36), "meta=" + r.meta, String(r.kind).padEnd(9), "s=" + r.score, "|", r.why.join("; ").slice(0, 90));
  }
}
const tut = rows.filter((r) => r.role === "tutorial"), ctl = rows.filter((r) => r.role === "control"), gen = rows.filter((r) => r.role === "genre");
console.log(`\nSPLIT ${split}: tutorials flagged ${tut.filter((r) => r.got).length}/${tut.length}; topical controls falsely flagged ${ctl.filter((r) => r.got).length}/${ctl.length}; genre cases right ${gen.filter((r) => r.got === r.expect).length}/${gen.length}`);
