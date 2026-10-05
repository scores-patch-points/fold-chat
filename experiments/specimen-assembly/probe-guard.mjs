// probe-guard.mjs — send real request shapes through the de-identifier + local PII redactor and show what it changed.
import { makeGuard, diffMasked } from "./lib/guard.mjs";
import { cache, SLOTS as CS } from "./lib/cache.mjs";
import { makeEnv } from "./lib/lifecycle.mjs";
import { CACHE_POOL } from "./lib/pool.mjs";
import { assemble, gapRequest } from "./lib/solver.mjs";
const env = makeEnv([], CS);
const g = await assemble(cache, CACHE_POOL(), env, {});
const req = gapRequest(cache, g.gap);
import { OBLIGATIONS } from "./lib/cache.mjs";
const variants = { "none": [], "code token [a-z]\\d+ (whole span)": [/^[a-z]\d+$/i], "k-token + ES": [/^[a-z]\d+$/i, "ES"], "call-fragment + ES": [/^[a-z]+\([a-z]\d+,\s*\d+\)?$/i, "ES"] };
for (const [name, exempt] of Object.entries(variants)) {
const guard = makeGuard({ vocabulary: [...OBLIGATIONS, "cache", "makeCache", "limit"], exempt });
console.log("--", name);
try {
  const t = Date.now();
  const out = await guard(req);
  const changes = diffMasked(req, out.request);
  console.log("viaRedactor", out.viaRedactor, "passes", out.passes, "ms", Date.now() - t, "stats", JSON.stringify(out.stats), "changed fields:", changes.length);
  for (const c of changes) console.log(" ", c.path, String(JSON.stringify(c.was)).slice(0, 80), "->", String(JSON.stringify(c.became)).slice(0, 80));
  const reply = "export function makeCache(limit) { return {}; }";
  console.log("unmask leaves a reply with no placeholders unchanged:", out.unmask(reply) === reply);
} catch (e) { console.log("door result:", e.notSent ? "NOT SENT (fail closed)" : "error", "-", e.message); }
}
