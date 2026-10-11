// F4 — the same cases with REAL gemma2:2b (Ollama) as the pointer, temperature 0, the app's own messages. Writes results/gemma-results.json. Pre-registered claims P2, P5(gemma), P8.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, run, rate, gemmaPointer } from "./f4-lib.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = { model: process.env.F4_MODEL || "gemma2:2b", at: new Date().toISOString(), supported: [], nonclaims: [], falsesupported: [] };
for (const c of CASES.supported) { const o = await run({ answer: c.answer, pages: c.pages, point: gemmaPointer() }); R.supported.push({ id: c.id, kind: c.kind, answer: c.answer, ...o }); console.log("S", c.id, o.none ? "NONE-NOTICE" : "verified", o.why || "", (o.log || []).map((l) => l.raw).join(" | ").slice(0, 80)); }
for (const c of CASES.nonclaims) { const o = await run({ answer: c.answer, pages: c.pages, point: gemmaPointer() }); R.nonclaims.push({ id: c.id, answer: c.answer, ...o }); console.log("N", c.id, o.none ? "NONE-NOTICE" : "VERIFIED", o.quote ? "=> " + o.quote.slice(0, 70) : ""); }
for (const c of CASES.falsesupported) { const o = await run({ answer: c.answer, pages: c.pages, point: gemmaPointer() }); R.falsesupported.push({ id: c.id, type: c.type, answer: c.answer, ...o }); console.log("F", c.id, c.type, o.none ? "rejected" : "VERIFIED", o.quote ? "=> " + o.quote.slice(0, 70) : ""); }
const S = R.supported, N = R.nonclaims, F = R.falsesupported;
R.summary = {
  P2_gemma_unsupported_on_supported: rate(S, (x) => x.none),
  P2_failed: S.filter((x) => x.none).map((x) => `${x.id}:${x.why}`),
  P5_gemma_verified_on_nonclaims: rate(N, (x) => !x.none),
  P5_gemma_notice_fires_on_nonclaims: rate(N, (x) => x.none),
  P8_gemma_verified_on_false: rate(F, (x) => !x.none),
  P8_by_type: Object.fromEntries([...new Set(F.map((x) => x.type))].map((t) => [t, rate(F.filter((x) => x.type === t), (x) => !x.none)])),
};
fs.writeFileSync(path.join(HERE, "results", "gemma-results.json"), JSON.stringify(R, null, 1));
console.log(JSON.stringify(R.summary, null, 1));
