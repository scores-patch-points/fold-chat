// prints, per topic and per ask, the sentences of the recorded passages (what the app really keeps) that carry a figure — for choosing the verbatim needles by hand
import fs from "node:fs";
import { sentencesWithOffsets } from "../../../fold-chat-impression.js";
const P = JSON.parse(fs.readFileSync(new URL("./corpus/passages.json", import.meta.url), "utf8"));
const only = process.argv[2];
for (const [q, v] of Object.entries(P)) {
  if (only && v.id !== only) continue;
  console.log(`\n## ${v.lang}/${v.id} | ${q}`);
  for (const p of v.passages) { const title = p.ref.replace(/^.*— /, ""); const ss = sentencesWithOffsets(p.text).filter((s) => /\d/.test(s.text) && s.text.length > 40 && s.text.length < 260); console.log(`  - ${title} (${p.chars})`); ss.slice(0, 4).forEach((s) => console.log(`      · ${s.text}`)); }
}
