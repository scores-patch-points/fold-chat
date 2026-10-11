// arm F — the MODEL arm (contrast): gemma2:2b via local Ollama, temperature 0, handed arm A2's strand ("F") or an oracle-ish gold context ("Fg").
import { gradeStated, store, timed, selected, refuses } from "../lib.mjs";
import { strandContext, goldContext, oracleContext } from "../ctx.mjs";
const OLLAMA = process.env.OLLAMA || "http://127.0.0.1:11434";
const MODEL = process.env.P1_MODEL || "gemma2:2b";
const SYS = "Answer the question using ONLY the passages given. Be brief and plain. If the passages do not contain what is needed to answer, say that you cannot answer from them.";
export function promptFor(q, ctx) {
  const task = q.rung === 12 ? "Summarize the passage in 3 sentences." : q.q;
  return `Passages:\n${ctx}\n\nQuestion: ${task}`;
}
export async function ask(q, ctx) {
  const body = { model: MODEL, stream: false, options: { temperature: 0, num_predict: 260, seed: 7 }, messages: [{ role: "system", content: SYS }, { role: "user", content: promptFor(q, ctx) }] };
  const r = await fetch(OLLAMA + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(240000) });
  const j = await r.json();
  return String(j?.message?.content ?? "").trim();
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const arm = process.argv.includes("--oracle") ? "Fo" : process.argv.includes("--gold") ? "Fg" : "F";
  const st = store(arm);
  for (const q of selected()) {
    if (st.done.has(q.id)) continue;
    const c = await timed(async () => (arm === "Fo" ? oracleContext(q) : arm === "Fg" ? goldContext(q) : strandContext(q)));
    const ctx = c.out || "";
    const m = await timed(() => ask(q, ctx));
    const text = m.out || "";
    const g = gradeStated(q, text, { gap: false });
    st.put({ id: q.id, rung: q.rung, ms: m.ms, ctxMs: c.ms, err: m.err || c.err, ctxChars: ctx.length, text, grade: g, refused: refuses(text) });
    console.log(q.id, g.ok ? "OK " : "-- ", g.why, m.ms + "ms", "|", text.replace(/\s+/g, " ").slice(0, 90));
  }
}
