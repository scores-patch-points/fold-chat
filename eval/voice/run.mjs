// eval/voice/run.mjs — stage 2 BASELINE (term-overlap) on REAL threads and REAL canon (eval/voice/PREREG.md V1–V5). Prints the table and every aside for a person to read.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { VOICE, buildIndex, conversationTerms, resonance, asideOf, permitted } from "../../fold-chat-voice.js";
import { readFelt } from "../../fold-chat-pathos.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
import { classifyTurn } from "../../fold-chat-discourse.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const WORLD = path.resolve(ROOT, "..");
const FW = functionWordsOf("en");
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "voice/voice-index.json"), "utf8"));
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, "voice/voice-bank.json"), "utf8"));
const index = buildIndex(idx.archons, FW);
const T = JSON.parse(fs.readFileSync(path.join(HERE, "threads.json"), "utf8")).threads;
const canon = (p) => [path.join(WORLD, p), path.join(WORLD, p.replace(/^live_priors\//, "Zenodotus/"))].find((x) => fs.existsSync(x));
const files = {};
const verify = (a) => { const p = canon(a.source.path); const buf = files[p] ??= fs.readFileSync(p); return crypto.createHash("sha256").update(buf).digest("hex") === a.source.sha256 && buf.toString("utf8").slice(a.source.start, a.source.end) === a.quote.text; };
const exchanges = (turns, k) => turns.slice(0, k).map((t) => ({ ask: t.ask, said: t.authored === "sources" ? "" : t.spoken }));
let seedN = 1; const rows = []; let v1ok = 0, v1n = 0;
for (const [id, th] of Object.entries(T)) {
  const kind = id[0] === "R" ? "reflective" : "lookup";
  let sinceLast = Infinity; const used = [];
  for (let k = 2; k <= th.turns.length; k++) {
    const conv = conversationTerms(exchanges(th.turns, k), FW);
    const msgs = th.messages.slice(0, k * 2);
    const felt = readFelt(msgs, { convo: id, memo: null });
    const state = { kind: classifyTurn(th.turns[k - 1].ask), exchangeIndex: k, sinceLast, used };
    const open = asideOf({ index, conv, bank, state });                        // stage 2, gate OFF
    const gated = asideOf({ index, conv, bank, state: { ...state, gate: true, condition: felt.condition } });   // stage 1+2, REAL pathos gate ON
    const r = { id, kind, k, ranked: (open.ranked || []).slice(0, 2).map((x) => `${x.handle}[${x.shared.join(",")}] p=${x.p.toFixed(3)}`), open: open.aside ? "ASIDE" : open.none, gated: gated.aside ? "ASIDE" : gated.none, pathos: felt.condition || ("gap:" + felt.gap), aside: open.aside || null };
    if (open.aside) { v1n++; if (verify(open.aside)) v1ok++; sinceLast = 0; used.push(open.aside.handle); } else sinceLast = Math.min(sinceLast + 1, 99);
    rows.push(r);
  }
}
// scrambled-conversation control: replace each reflective conversation's matchable stems with random roster stems (20 seeded draws per conversation)
const pool = [...index.df.keys()]; let ctlN = 0, ctlHit = 0;
const prng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
for (const [id, th] of Object.entries(T)) if (id[0] === "R") for (let d = 0; d < 20; d++) {
  const conv = conversationTerms(exchanges(th.turns, th.turns.length), FW); const m = [...conv].filter(([s]) => index.df.has(s)).length; const r = prng(1000 * id.charCodeAt(1) + d);
  const fake = new Map(); for (let i = 0; i < Math.max(m, 3); i++) fake.set(pool[Math.floor(r() * pool.length)], 2);
  ctlN++; if (asideOf({ index, conv: fake, bank, state: { kind: "advice", exchangeIndex: 3, sinceLast: Infinity }, seed: 7 + d }).aside) ctlHit++;
}
for (const r of rows) console.log(`${r.id} turn ${r.k} [${r.kind}] pathos=${r.pathos}  stage2(gate off): ${r.open}   with real gate: ${r.gated}\n    top: ${r.ranked.join(" | ") || "—"}`);
console.log("\nASIDES offered (gate off) — read these:");
for (const r of rows) if (r.aside) console.log(`\n[${r.id} turn ${r.k}] matched ${r.aside.shared.join(", ")} · p=${r.aside.p.toFixed(3)} · ${r.aside.handle}\n  ${r.aside.text}\n  provenance: ${r.aside.source.path} sha256 ${r.aside.source.sha256.slice(0, 12)}… bytes ${r.aside.source.start}-${r.aside.source.end}`);
const R = rows.filter((r) => r.kind === "reflective"), L = rows.filter((r) => r.kind === "lookup");
const threadsWith = (rs, key) => new Set(rs.filter((r) => r[key] === "ASIDE").map((r) => r.id)).size;
console.log(`\nV1 provenance verified: ${v1ok}/${v1n} asides (sha256 + canon.slice(start,end) === quote)`);
console.log(`V2 lookup threads with an aside (gate off): ${threadsWith(L, "open")}/3`);
console.log(`V3 reflective threads with an aside (gate off): ${threadsWith(R, "open")}/5 · scrambled-conversation control: ${ctlHit}/${ctlN} (${(100 * ctlHit / ctlN).toFixed(0)}%)`);
console.log(`V4 real pathos gate ON: asides ${rows.filter((r) => r.gated === "ASIDE").length} · pathos readings: ${[...new Set(rows.map((r) => r.pathos))].join(", ")}`);
