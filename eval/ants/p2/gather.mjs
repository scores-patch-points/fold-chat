// gather.mjs — authoring aid: for [page, regex] pairs print the matching context so held gold can be copied verbatim
import { loadPool } from "./pool.mjs";
import { passageOf } from "./asks-lib.mjs";
const pairs = JSON.parse(process.argv[2]);
const pool = loadPool();
for (const [pg, re, w = 260] of pairs) {
  let text;
  if (pg.startsWith("html:")) text = passageOf(pg).text + " " + (passageOf(pg).declared || []).flatMap((b) => b.items).join(" ¶ ");
  else { const p = pool.find((x) => x.id === pg) || pool.find((x) => x.title === pg); if (!p) { console.log("[" + pg + "] NO PAGE"); continue; } text = p.text.slice(0, 24000); }
  const m = new RegExp(re, "i").exec(text);
  console.log("[" + pg + " /" + re + "/] " + (m ? text.slice(Math.max(0, m.index - 60), m.index + w).replace(/\s+/g, " ") : "NONE"));
}
