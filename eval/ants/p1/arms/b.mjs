// arm B — the slot pipeline (fold-chat-answerwire.js runSlotTurn): model-free. Handoff / gap / contest = a typed gap.
import { slotDeps, passagesForTurn } from "../../../../fold-chat-answerwire.js";
import { runAnswerTurn } from "../../../../fold-chat-answerturn.js";
import { passageSet, gradeStated, store, timed, selected, norm } from "../lib.mjs";
import { cfetch, NET } from "../cfetch.mjs";
export async function runB(q, passages = passageSet(q)) {
  // runAnswerTurn = runSlotTurn minus the post-hoc "follow the encyclopedia pointer to its origin page" step (originateTurn), which only adds a citation
  // and costs many rate-limited page fetches; the ANSWER is decided inside runAnswerTurn.
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 180000);
  let turn;
  try {
    const deps = slotDeps({ fetchImpl: (u, o = {}) => cfetch(u, { ...o, signal: ac.signal }), signal: ac.signal, lang: "en" });
    turn = await runAnswerTurn({ question: q.q, lang: { code: "en", by: "function words" }, passages: passagesForTurn(passages, { query: q.q }), now: new Date("2026-10-07"), deps });
  } finally { clearTimeout(to); }
  if (turn?.handoff) return { kind: "handoff", why: turn.handoff.kind, text: "" };
  if (turn?.answer) return { kind: "answer", text: turn.answer.text || turn.answer.row?.sentence || "", standing: turn.answer.standing, row: turn.answer.row?.sentence, source: turn.answer.row?.source?.title };
  if (turn?.contest?.length) return { kind: "contest", text: "", rows: turn.contest.length };
  if (turn?.gap) return { kind: "gap", why: turn.gap.kind, text: "", closest: turn.gap.closest?.sentence?.slice(0, 200) };
  return { kind: "none", text: "" };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const st = store("B");
  for (const q of selected()) {
    if (st.done.has(q.id)) continue;
    const { out, err, ms } = await timed(() => runB(q));
    const o = out || { kind: "error", text: "" };
    const gap = o.kind !== "answer";
    const g = gradeStated(q, o.text, { gap });
    st.put({ id: q.id, rung: q.rung, ms, err, ...o, grade: g });
    console.log(q.id, g.ok ? "OK " : "-- ", o.kind, o.why || "", g.why, ms + "ms", "|", (o.text || "").slice(0, 80));
  }
  console.log("net", JSON.stringify(NET));
}
