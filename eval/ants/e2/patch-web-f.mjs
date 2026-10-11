// eval/ants/e2/patch-web-f.mjs — the TINY web changes, built from the tracked fold-chat-web.js (never edits it):
//   (4) DIRECT_BUDGET_MS: the browser's own read of a page gets 1.5 s (was the whole 8 s read budget); a CORS-closed or slow host then goes to the relay chain exactly as it does today after a failure
//   (5) READ_GRACE_MS: once `want` pages are read, reads still in flight get 1.5 s more, then the turn goes on (was: wait for every read, up to 8 s each)
// Flags: localStorage "fold-chat:e2cap"="off" / "fold-chat:e2grace"="off" restore the tracked behaviour (A/B on the same file).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PARTS = (process.env.E2_PARTS || "cap,grace").split(",");
const OUTFILE = process.env.E2_OUT || path.join(HERE, "patched/fold-chat-web-f.js");
let s = fs.readFileSync(path.join(HERE, "../../../fold-chat-web.js"), "utf8");
const rep = (from, to, label) => { if (!s.includes(from)) { console.error("ANCHOR MISSING:", label); process.exit(1); } s = s.replace(from, to); };
if (PARTS.includes("cap")) {
  rep(`  try { return await attempt(url, "direct", null); } catch (e) {}`,
`  try { return await attempt(url, "direct", null, (() => { try { return localStorage.getItem("fold-chat:e2cap") === "off" ? timeoutMs : Math.min(timeoutMs, DIRECT_BUDGET_MS); } catch { return Math.min(timeoutMs, DIRECT_BUDGET_MS); } })()); } catch (e) {}   // E2: a CORS-closed host answers only to be refused (5-7 s measured); the relay chain follows as before`, "direct");
  rep("export const GATEWAY_BUDGET_MS = 3500;", "export const GATEWAY_BUDGET_MS = 3500;\nexport const DIRECT_BUDGET_MS = 1500;   // E2: the browser's own read of a page; past it the relay chain is tried", "const cap");
}
if (PARTS.includes("grace")) {
  rep(`  await Promise.all(Array.from({ length: Math.min(CONC, chosen.length) }, worker));
  reads.sort((x, y) => x.i - y.i);`,
`  { const all = Promise.all(Array.from({ length: Math.min(CONC, chosen.length) }, worker));
    const graceMs = (() => { try { return localStorage.getItem("fold-chat:e2grace") === "off" ? Infinity : READ_GRACE_MS; } catch { return READ_GRACE_MS; } })();
    let release = null; const enough = new Promise((res) => { release = res; });
    const poll = setInterval(() => { if (okReads >= want) { clearInterval(poll); setTimeout(release, graceMs === Infinity ? 0 : graceMs); } }, 50);
    if (graceMs === Infinity) { clearInterval(poll); await all; } else { await Promise.race([all, enough]); clearInterval(poll); } }   // E2: enough pages read, do not wait for stragglers
  reads.sort((x, y) => x.i - y.i);`, "reads wait");
  rep("export const GATEWAY_BUDGET_MS = 3500;", "export const GATEWAY_BUDGET_MS = 3500;\nexport const READ_GRACE_MS = 1500;   // E2: once enough pages are read, how long reads still in flight may keep the turn waiting", "const grace");
}

if (PARTS.includes("webgrace")) {
  // (6) the web's 6 s budget is a flat clock. When another source has already answered with a usable list, the web gets WEB_GRACE_MS more from that moment, not what is left of 6 s.
  rep(`  const webOrLate = new Promise((res) => { timer = setTimeout(() => res(null), webBudgetMs); });`,
`  const wg = (() => { try { return localStorage.getItem("fold-chat:e2webgrace") === "off" ? Infinity : WEB_GRACE_MS; } catch { return WEB_GRACE_MS; } })();
  const webOrLate = new Promise((res) => { timer = setTimeout(() => res(null), webBudgetMs); const iv = setInterval(() => { if (firstApiAt != null && Date.now() - firstApiAt > wg) { clearInterval(iv); res(null); } }, 50); setTimeout(() => clearInterval(iv), webBudgetMs + 100); });`, "web budget");
  rep(`  const settled = [];`, `  const settled = [];\n  let firstApiAt = null;`, "first api decl");
  rep(`      settled.push(list);
      return { ok: true, list };`, `      settled.push(list);
      if (s !== "web" && firstApiAt == null && list.length >= 3) firstApiAt = Date.now();
      return { ok: true, list };`, "first api");
  rep("export const GATEWAY_BUDGET_MS = 3500;", "export const GATEWAY_BUDGET_MS = 3500;\nexport const WEB_GRACE_MS = 2000;   // E2: once another source has answered with a usable list, how much longer the open web may keep the turn waiting", "const webgrace");
}

if (PARTS.includes("doors")) {
  // (7) DEAD-DOOR MEMORY. Measured 2026-10-06 over 29 turns: of 5 public proxies asked for EVERY page the browser could not read itself, allorigins answered 1 of 132, codetabs/corsproxy.io/cors.eu.org/thingproxy 0 of 132 each
  // (660 requests, each telling a third party the page's address, for 1 page); the relay answered 168 of 208; the browser's own read of a page answered 10 of 142. A door with no success in its first tries is not asked again
  // for DOOR_TTL_MS; a host whose own read failed is not read directly again for that long. The relay and the text readers are never skipped.
  rep("export const GATEWAY_BUDGET_MS = 3500;", `export const GATEWAY_BUDGET_MS = 3500;
export const DOOR_TTL_MS = 10 * 60 * 1000;   // E2: how long a door that has never answered is left alone
const DOORS = new Map();
const doorUp = (key) => { try { if (localStorage.getItem("fold-chat:e2doors") === "off") return true; } catch {} const d = DOORS.get(key); if (!d) return true; if (Date.now() - d.at > DOOR_TTL_MS) { DOORS.delete(key); return true; } return !(d.fail >= d.limit && d.ok === 0); };
const doorSaw = (key, ok, limit) => { const d = DOORS.get(key) || { ok: 0, fail: 0, at: Date.now(), limit }; if (ok) d.ok++; else d.fail++; d.at = Date.now(); DOORS.set(key, d); };
export const _doors = DOORS;`, "doors const");
  const re = /^  try \{ return await (attempt\(url, "direct", null.*?\)); \} catch \(e\) \{\}/m;
  if (!re.test(s)) { console.error("ANCHOR MISSING: direct line"); process.exit(1); }
  s = s.replace(re, (m, call) => `  const dKey = "direct:" + hostKey(url);\n  if (direct || doorUp(dKey)) { try { const v = await ${call}; doorSaw(dKey, true, 1); return v; } catch (e) { if (!(e && e.name === "AbortError")) doorSaw(dKey, false, 1); } }`);
  rep(`  const viaProxy = await firstOf(CORS_PROXIES.map((p, i) => (ctl) => attempt(p(url), i === 0 ? "the fold's relay" : "a public proxy", ctl, Math.min(timeoutMs, GATEWAY_BUDGET_MS))));`,
`  const viaProxy = await firstOf(CORS_PROXIES.map((p, i) => ({ p, i })).filter(({ i }) => i === 0 || doorUp("proxy:" + i)).map(({ p, i }) => (ctl) => attempt(p(url), i === 0 ? "the fold's relay" : "a public proxy", ctl, Math.min(timeoutMs, GATEWAY_BUDGET_MS)).then((v) => { if (i) doorSaw("proxy:" + i, true, 6); return v; }, (e) => { if (i && !(e && e.name === "AbortError")) doorSaw("proxy:" + i, false, 6); throw e; })));`, "proxies");
}
fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
fs.writeFileSync(OUTFILE, s);
console.log(OUTFILE, "written");
