// exploration: what does searchWeb put on the wire in node (record mode)?
import * as web from "../../../fold-chat-web.js";
const log = [];
const f = async (u, o) => { const t = Date.now(); try { const r = await fetch(u, o); log.push({ u: String(u).slice(0, 170), s: r.status, ms: Date.now() - t }); return r; } catch (e) { log.push({ u: String(u).slice(0, 170), err: String(e.message).slice(0, 60) }); throw e; } };
const memo = web.makeMemo();
const w = await web.searchWeb(process.argv[2] || "Who invented the telephone?", { effort: "balanced", memo, fetchImpl: f });
console.log("passages", w.passages.map((p) => [p.ref.slice(0, 60), p.text.length]));
console.log("trace", JSON.stringify(w.trace).slice(0, 600));
console.log(log.map((x) => JSON.stringify(x)).join("\n"));
