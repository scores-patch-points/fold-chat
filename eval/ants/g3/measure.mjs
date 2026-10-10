// G3 measure: the corpus through the REAL planTurn (fold-chat-flow.js) with a REAL referent record (admitReferents over each prior turn), the way
// fold-chat.js builds the call (lang from detectLang + thread language, hints for that language). No model.   node eval/ants/g3/measure.mjs <label>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planTurn } from "../../../fold-chat-flow.js";
import { admitReferents, emptyReferents } from "../../../fold-chat-mind.js";
import { hintsFor } from "../../../fold-chat-hints.js";
import { detectLang, threadLanguage } from "../../../fold-chat-lang.js";
const WHICH = process.argv[3] || "1";
const { CORPUS } = WHICH === "2" ? { CORPUS: (await import("./corpus2.mjs")).CORPUS2 } : await import("./corpus.mjs");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const label = (process.argv[2] || "run") + (WHICH === "2" ? "-c2" : "");
const wilson = (k, n, z = 1.96) => { if (!n) return [0, 0]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), a = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - a) / d), Math.min(1, (c + a) / d)]; };
const INHERIT_KINDS = new Set(["carried", "elliptical", "meta", "move", "source-ask", "retry"]);

export function runCase(s, plan = planTurn) {
  const messages = []; let ref = emptyReferents();
  for (const t of s.prior) {
    messages.push({ role: "user", content: t.ask }, { role: "assistant", content: t.answer, grounding: { kind: "research" } });
    ref = admitReferents(ref, { question: t.ask, answer: t.answer, sources: (t.titles || []).map((x) => ({ title: x })) });
  }
  const lang0 = detectLang(s.ask, { prior: threadLanguage(messages) }).lang;
  const p = plan(s.ask, messages, { referents: ref, rejected: [], hints: hintsFor(lang0 === "unknown" ? "en" : lang0), lang: lang0 === "unknown" ? s.lang : lang0 });
  const searchQ = p.search || s.ask;
  const inherits = INHERIT_KINDS.has(p.kind) || p.mode === "thread" || searchQ.trim() !== s.ask.trim();
  const blob = `${searchQ} ${(p.carried || []).join(" ")} ${p.topic || ""}`;
  const rightRef = s.ref ? blob.toLowerCase().includes(s.ref.toLowerCase()) : null;
  return { id: s.id, cls: s.cls, lang: s.lang, ask: s.ask, expect: s.expect, kind: p.kind, mode: p.mode, searchQ, reason: p.reason, why: p.gate?.why || null, inherits, ok: (s.expect === "carry") === inherits, rightRef, lang0 };
}

export function summarise(rows) {
  const out = {};
  for (const [key, f] of [["follow", (r) => r.cls === "follow"], ["switch", (r) => r.cls === "switch"], ["hard", (r) => r.cls === "hard"],
    ["follow/en", (r) => r.cls === "follow" && r.lang === "en"], ["follow/es", (r) => r.cls === "follow" && r.lang === "es"], ["follow/fr", (r) => r.cls === "follow" && r.lang === "fr"],
    ["switch/en", (r) => r.cls === "switch" && r.lang === "en"], ["switch/es", (r) => r.cls === "switch" && r.lang === "es"], ["switch/fr", (r) => r.cls === "switch" && r.lang === "fr"],
    ["switch/share", (r) => r.cls === "switch" && CORPUS.find((c) => c.id === r.id).share]]) {
    const rs = rows.filter(f); const k = rs.filter((r) => r.ok).length; const [lo, hi] = wilson(k, rs.length);
    out[key] = { n: rs.length, ok: k, acc: +(k / (rs.length || 1)).toFixed(3), ci: [+lo.toFixed(2), +hi.toFixed(2)] };
  }
  const fol = rows.filter((r) => r.cls === "follow" && r.inherits);
  out.followRightReferent = { n: fol.length, ok: fol.filter((r) => r.rightRef !== false).length };
  out.thread_mode_on_non_follow = rows.filter((r) => r.cls !== "follow" && r.mode === "thread").map((r) => r.ask);
  return out;
}
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const rows = CORPUS.map((s) => runCase(s));
  const sum = summarise(rows);
  fs.writeFileSync(path.join(HERE, `measure-${label}.json`), JSON.stringify({ label, at: new Date().toISOString(), summary: sum, rows }, null, 1));
  console.log(JSON.stringify(sum, null, 1));
  console.log("\nFAILURES:");
  for (const r of rows.filter((r) => !r.ok)) console.log(`  ${r.id} ${r.cls}/${r.lang} expect=${r.expect} got kind=${r.kind} mode=${r.mode} q="${r.searchQ}"  ← "${r.ask}"`);
}
