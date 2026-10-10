// dbg.mjs <askid> [gold-substring] — authoring/debug aid: where does the gold sentence rank, and why
import { DEV } from "./asks-dev.mjs"; import { passagesOf } from "./asks-lib.mjs"; import * as M from "../../../fold-chat-answerspan.js";
const [id, sub] = process.argv.slice(2); const a = DEV.find((x) => x.id === id) || (await import("./asks-held.mjs").then((m) => m.HELD.find((x) => x.id === id)));
const ps = passagesOf(a); const r = M.answerSpan(a.q, ps, { minConfidence: 0, debug: true });
console.log(JSON.stringify(r.ask)); for (const c of (r.debug || []).slice(0, 8)) console.log(c.score.toFixed(3), c.pi, JSON.stringify(c.text.slice(0, 110)), c.why.join("|"));
if (sub) { for (const c of r.debug || []) if (c.sent.includes(sub)) console.log("GOLD@", c.score.toFixed(3), c.why.join("|")); }
