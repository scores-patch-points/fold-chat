// arm A — Sources-only strand: snipsOf over the passage set (no model).
import { snipsOf, strandText } from "../../../../fold-chat-strand.js";
import { BATTERY, passageSet, gradeSnippets, store, timed, selected, norm } from "../lib.mjs";
// A2: the same page text under a non-encyclopedia host, so snipsOf takes its GENERIC path (impressionOf: the sentences that differ the ask)
// instead of the Wikipedia-lead shortcut (a smoke run showed A on Wikipedia text is the lead of every passage whatever the ask).
export const neutral = (ps) => ps.map((p, i) => ({ ...p, url: `https://reader${i}.example.test/page/${i}`, source: `https://reader${i}.example.test/page/${i}`, ref: "Reader \u2014 " + String(p.ref).replace(/^.*\u2014 /, "") }));
export function runA(q, passages = passageSet(q)) {
  const r = snipsOf(passages, q.q);
  return { snips: r.snips.map((s) => ({ kind: s.kind, text: s.text, credit: s.credit, p: s.p, n: s.n })), dropped: r.dropped.length, gaps: r.gaps };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const arm = process.argv.includes("--a2") ? "A2" : "A";
  const st = store(arm);
  for (const q of selected()) {
    if (st.done.has(q.id)) continue;
    const ps = arm === "A2" ? neutral(passageSet(q)) : passageSet(q);
    const { out, err, ms } = await timed(() => runA(q, ps));
    const snips = out?.snips || [];
    const g = gradeSnippets(q, snips, { gap: snips.length === 0 });
    st.put({ id: q.id, rung: q.rung, ms, err, text: snips.map((s) => s.text).join("\n\n"), nsnips: snips.length, kinds: snips.map((s) => s.kind), grade: g, sources: ps.map((p) => p.ref + (p._gold ? "*" : "")) });
    console.log(q.id, g.ok ? "OK " : "-- ", g.why, g.chars, ms + "ms", "|", q.q.slice(0, 60));
  }
}
