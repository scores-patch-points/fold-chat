// eval/ants/e2/patch-web-grace.mjs — builds patched/fold-chat-web-grace.js = patched/fold-chat-web.js (L6 hedge) + L3b "enough pages read: do not wait for the stragglers".
// searchWeb waits for ALL its read workers (`await Promise.all(workers)`), so one slow page (an 8 s timeout, a CORS-closed host) holds the turn even after `want` pages have been read.
// New rule: once `want` reads have succeeded, wait at most READ_GRACE_MS more for reads still in flight (they may be ranked above the last kept page), then go on with what is in hand.
// Same pages whenever the top-ranked reads finish inside the grace; a slower top-ranked page is replaced by the next ranked one that already succeeded (named in the trace as unread, as a failed read is today).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let s = fs.readFileSync(path.join(HERE, "patched/fold-chat-web.js"), "utf8");
const rep = (from, to, label) => { if (!s.includes(from)) { console.error("ANCHOR MISSING:", label); process.exit(1); } s = s.replace(from, to); };
rep(`  await Promise.all(Array.from({ length: Math.min(CONC, chosen.length) }, worker));
  reads.sort((x, y) => x.i - y.i);`,
`  { const all = Promise.all(Array.from({ length: Math.min(CONC, chosen.length) }, worker));
    const graceMs = (() => { try { return localStorage.getItem("fold-chat:e2grace") === "off" ? Infinity : READ_GRACE_MS; } catch { return READ_GRACE_MS; } })();
    let release = null; const enough = new Promise((res) => { release = res; });
    const poll = setInterval(() => { if (okReads >= want) { clearInterval(poll); setTimeout(release, graceMs === Infinity ? 0 : graceMs); } }, 50);
    if (graceMs === Infinity) { clearInterval(poll); await all; } else { await Promise.race([all, enough]); clearInterval(poll); } }   // E2 L3b
  reads.sort((x, y) => x.i - y.i);`, "reads wait");
rep("export const DIRECT_HEDGE_MS = 1200;", "export const READ_GRACE_MS = 1500;   // E2 L3b: once enough pages are read, how long reads still in flight may keep the turn waiting\nexport const DIRECT_HEDGE_MS = 1200;", "const");
fs.writeFileSync(path.join(HERE, "patched/fold-chat-web-grace.js"), s);
console.log("patched/fold-chat-web-grace.js written");
