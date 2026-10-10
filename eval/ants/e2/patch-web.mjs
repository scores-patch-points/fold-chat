// eval/ants/e2/patch-web.mjs — builds patched/fold-chat-web.js from the tracked fold-chat-web.js (never edits it): L6 "hedge the browser's direct read".
// Today a page read tries the browser's own fetch first and the relay only after it FAILS; a CORS-closed host fails only when its answer arrives (measured 5-7 s), then the relay returns the
// page in 0.2-3 s. Hedge: if the direct fetch has not answered in DIRECT_HEDGE_MS, start the relay chain beside it and take whichever delivers first. A host that answers directly in time
// never touches the relay (same privacy as today); a slow or CORS-closed one costs at most the hedge delay instead of its whole failure time. localStorage "fold-chat:e2hedge"="off" disables.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let s = fs.readFileSync(path.join(HERE, "../../../fold-chat-web.js"), "utf8");
const A = `  try { return await attempt(url, "direct", null); } catch (e) {}\n`;
const Z = `  return { ok: false, text: "", title: "", via: null, url, error: "unreachable" };\n}\n`;
const i = s.indexOf(A); if (i < 0) { console.error("ANCHOR A"); process.exit(1); }
const j = s.indexOf(Z, i); if (j < 0) { console.error("ANCHOR Z"); process.exit(1); }
const mid = s.slice(i + A.length, j);   // the continuation: direct-only guard, bridge, proxies, readers
const wrapped = `  // E2 L6: the direct attempt and (when it is slow) the relay chain run together
  const directTry = attempt(url, "direct", null).then((v) => v, () => null);
  const slow = async () => {
${mid.split("\n").map((l) => (l ? "  " + l : l)).join("\n")}
  return { ok: false, text: "", title: "", via: null, url, error: "unreachable" };
  };
  const hedgeMs = (() => { try { return localStorage.getItem("fold-chat:e2hedge") === "off" ? Infinity : DIRECT_HEDGE_MS; } catch { return DIRECT_HEDGE_MS; } })();
  const quick = await Promise.race([directTry, new Promise((r) => setTimeout(() => r(undefined), hedgeMs))]);
  if (quick) return quick;                               // answered directly in time: nothing else was asked
  if (quick === null || direct) return slow();            // refused (CORS / HTTP error): the relay chain, as before, without the rest of the wait
  return await new Promise((resolve) => {                 // slow: race the pending direct read against the relay chain
    let left = 2, done = false;
    const take = (v) => { if (done) return; if (v && v.ok) { done = true; resolve(v); } else if (--left === 0) resolve(v && !v.ok && v.error ? v : { ok: false, text: "", title: "", via: null, url, error: "unreachable" }); };
    directTry.then(take, () => take(null));
    slow().then(take, () => take(null));
  });
}
`;
s = s.slice(0, i) + wrapped + s.slice(j + Z.length);
s = s.replace("export const GATEWAY_BUDGET_MS = 3500;", "export const GATEWAY_BUDGET_MS = 3500;\nexport const DIRECT_HEDGE_MS = 1200;   // E2 L6: how long the browser's own read of a page gets before the relay is asked beside it");
fs.writeFileSync(path.join(HERE, "patched/fold-chat-web.js"), s);
console.log("patched/fold-chat-web.js written");
