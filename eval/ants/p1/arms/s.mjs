// arm S — fold-chat-salience.js salientSources (the product's own "feed the model only what is salient" sentence selector), used here as a SNIP arm: verbatim sentences of the passage set that bear on the ask's terms.
import { salientSources, askTerms } from "../../../../fold-chat-salience.js";
import { functionWordsOf } from "../../../../fold-chat-snippets.js";
import { passageSet, gradeSnippets, store, timed, selected, norm } from "../lib.mjs";
export function runS(q, ps = passageSet(q)) {
  const fw = functionWordsOf("en");
  const terms = askTerms({ question: q.q, searchQ: q.q }, fw);
  const r = salientSources(ps, terms);
  return { snips: (r.passages || []).map((p) => ({ text: norm(p.text), ref: p.ref })), dropped: r.dropped };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const st = store("S");
  for (const q of selected()) {
    if (st.done.has(q.id)) continue;
    const { out, err, ms } = await timed(() => runS(q));
    const snips = out?.snips || [];
    const g = gradeSnippets(q, snips, { gap: snips.length === 0 });
    st.put({ id: q.id, rung: q.rung, ms, err, text: snips.map((s) => s.text).join("\n\n"), nsnips: snips.length, grade: g });
    console.log(q.id, g.ok ? "OK " : "-- ", g.why, g.chars, ms + "ms");
  }
}
