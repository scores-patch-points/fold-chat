// sent.mjs <page> <regex> — authoring aid: print the whole sentence(s) containing the match (verbatim, for copying gold)
import { loadPool } from "./pool.mjs"; import { passageOf } from "./asks-lib.mjs"; import { sentencesWithOffsets } from "../../../fold-chat-impression.js";
const [pg, re, n = "2"] = process.argv.slice(2); const pool = loadPool();
const text = pg.startsWith("html:") ? passageOf(pg).text : (pool.find((x) => x.id === pg) || pool.find((x) => x.title === pg))?.text.slice(0, 24000);
if (!text) { console.log("NO PAGE"); process.exit(); }
let c = 0; for (const s of sentencesWithOffsets(text)) if (new RegExp(re, "i").test(s.text)) { console.log(`[${pg}] @${s.start}: ${s.text}`); if (++c >= +n) break; }
if (!c) console.log(`[${pg}] NONE for /${re}/`);
