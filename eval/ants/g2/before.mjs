// G2 I4: 'before' = a MODEL of what the current fold-chat.js does with a generate turn, built from the SAME pure functions the page calls
// (classifyTurn, planTurn, snipsOf, strandText, unreachedGap, gapAnswerLine, errorNotice, emptyNotice, declinedFallbackNotice, noModelFallbackNotice, aloneTurn).
// It is NOT the page: branch conditions are transcribed from fold-chat.js (cited by line). Cross-checked against live runs in live-batch.log (see G2-RESULTS.md).
import { classifyTurn } from "../../../fold-chat-discourse.js";
import { skipsSearch } from "../../../fold-chat-kinds.js";
import { planTurn } from "../../../fold-chat-flow.js";
import { snipsOf, strandText } from "../../../fold-chat-strand.js";
import { unreachedGap, gapAnswerLine, errorNotice, emptyNotice, declinedFallbackNotice, noModelFallbackNotice, aloneTurn, modelSpeaksAlone } from "../../../fold-chat-gaps.js";
// fold-chat.js:128-137 (copied: the function is module-private)
const REFUSAL_RE = /\b(i (?:can(?:no|')t|am unable|cannot|do not have access|don'?t have access|won'?t|will not)|i'm sorry,? but|as an ai|i am not able|i'm not able)\b/i;
const isRefusal = (text) => { const t = String(text ?? "").trim(); if (!t || t.length > 320) return false; return REFUSAL_RE.test(t) && !/\b(source|according to|https?:|\b\d{3,4}\b)/i.test(t); };

/** -> { kind, searchQ, drawn, text, quotesSourceAsOutput, typedGapDrawn, namesType, notes } */
export function before(c) {
  const ask = c.ask, type = String(c.outputType?.type || "").toLowerCase();
  const kind = classifyTurn(ask, { hasMaterial: !!c.hasMaterial });
  const plan = planTurn(ask, c.prior || [], {});
  const searchQ = plan.search || ask;
  const out = { kind, searchQ, drawn: null, text: "", quotesSourceAsOutput: false, typedGapDrawn: false, namesType: false, notes: [] };
  const done = (drawn, text, extra = {}) => { Object.assign(out, { drawn, text: String(text || "") }, extra); out.namesType = !!type && new RegExp(`\\b${type.replace(/ /g, "[\\s-]+")}s?\\b`, "i").test(out.text); return out; };
  // fold-chat.js:2109-2110 aloneBarred (ALONE_KINDS is empty) -> aloneTurn
  if (skipsSearch(kind) && !modelSpeaksAlone(kind) && !c.passages?.length) return done("note: no sources for this kind", aloneTurn(kind).notice?.text || "", { notes: ["compose/transform/code/self: aloneTurn, no void drawn"] });
  if (kind !== "generate") return done("not a generate turn: " + kind, "", { notes: [`classifyTurn says ${kind}: it is searched/answered as a question, no gap about the output`] });
  // fold-chat.js:2104-2108: wantWeb && no passages -> plan -> typed 'unreached' gap, model barred. gapAnswerLine is what is drawn where the answer would be.
  if (!c.passages?.length && !c.hasMaterial) { const g = unreachedGap([], ask); return done("typed gap: unreached", gapAnswerLine(g), { typedGapDrawn: true, notes: [`gap.note "${g.note.slice(0, 90)}"`] }); }
  // the model is called. A failure: fold-chat.js:2193-2205 (no model) and 2238-2252 (catch): strand fallback for ANY kind when sources were read
  if (c.failure) {
    const fk = c.failure.kind || null;
    if (fk === "stopped" || c.failure.name === "AbortError") return done("stopped note", "Stopped.", { notes: ["Stop: its own note"] });
    const fb = c.passages?.length ? snipsOf(c.passages, searchQ) : null;
    if (fb && fb.snips.length) {
      const notice = fk === "no-model" ? noModelFallbackNotice({ code: "bridge-down" }, { from: "facing" }) : declinedFallbackNotice(c.failure, { from: "facing" });
      return done("source strand drawn as the turn (" + fb.snips.length + " snip(s))", notice.text, { quotesSourceAsOutput: true, strandText: strandText(fb.snips).slice(0, 400), notes: ["notice then FROM THE SOURCES, UNCHANGED"] });
    }
    return done("error note", errorNotice(c.failure).text, { notes: ["snipsOf found nothing quotable: errorNotice"] });
  }
  const mr = c.modelResult;
  if (mr) {
    const t = String(mr.text || "").trim();
    if (!t) return done("empty note", emptyNotice({ tokens: mr.tokens || 0, model: "model" }).text);
    if (isRefusal(t)) return done("refusal note", "The model declined to answer from the sources it was given. This is a model-side refusal, not a finding — the sources were read; try again or rephrase.", { notes: ["fold-chat.js:2327 refusal notice"] });
    return done("model text shown as the answer", "", { notes: ["a stub, a question back, a tutorial or an off-topic draft is shown as the piece (record.creative: nothing is scored); the pivot may withhold sentences or fall back to the strand (observed live for the stub)"] });
  }
  return done("model called; unknown", "", { notes: ["no model result in the case"] });
}
