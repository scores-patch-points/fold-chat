// fold-chat-thread.js — the conversation is a source: follow the thread before any search. Pure: no DOM, no IO, no model.
//
// Measured 2026-10-05 in the live app:
//   • after a cookie-recipe turn the person said "i want a chewier one". The app searched that literal phrase, got a
//     bot-challenge page and two unrelated snippets (Chinese takeout), and showed them as the answer. The referent was lost.
//   • the person said "what?" after an answer. The app searched the web for "what?", got a 502 and drew a gap.
//
// What this module decides, from the ask and the turns BEFORE it (never from the web):
//   meta        "what?", "why?", "explain that", "shorter", "I don't get it" — a request about the PREVIOUS ANSWER. No search
//               is made. With an earlier answer to follow, the model may reply, grounded ONLY in that earlier turn, labelled
//               "answered from this conversation" and citing the turn. With NO earlier answer (a cold "what?") nothing is
//               written: an app-authored note, no model call.
//   carried     the language's pronoun triggers (fold-chat-hints.js, from the ethos priors) + the referent record
//               (fold-chat-mind.js resolveQuestion): "what happened to him?" is searched about the last answer's referent.
//   elliptical  a short ask with no name of its own that leans on the last topic ("i want a chewier one"): the search query
//               carries the earlier topic ("chewier chocolate chip cookie recipe"). The person's words are never rewritten;
//               the feed shows what was searched.
//   standalone  everything else: searched as asked.
//
// DECLARED, NOT MEASURED (Constitution II.11): the word limit below (a short ask is ≤ 8 words — the ethos study measured
// 85% wrong inheritance on UNGATED short asks, so a cue is still required) and the cue lists, each with its giver: the
// author's reading of how English follow-ups are phrased; a language without these cues is simply never treated as
// elliptical or meta (a typed gap, not a guess).

import { casedRuns, resolveQuestion, searchQueries, scriptOf } from "./fold-chat-mind.js";

export const THREAD = Object.freeze({
  ellipticalMaxWords: 8,   // "i want a chewier one" is 5; a nine-word ask names enough on its own
  topicMaxWords: 9,        // a search topic drawn from an earlier ask is clipped here
  quoteChars: 70,          // how much of the earlier turn the citation quotes
});

const words = (q) => String(q ?? "").toLowerCase().match(/[\p{L}\p{N}'’]+/gu) || [];

// A request about the previous answer: closed list, nothing else in the ask. (`more`, `go on`, `continue` are left to the
// old path on purpose: they ask for NEW material, which a thread-only reply may not write.)
const META_ALTS = [
  "what", "huh", "eh", "hm+", "why", "why (?:is that|is it|so|not|did you say that|does that matter)", "how come", "how so", "really", "sorry", "pardon", "come again",
  "what (?:do you mean|does that mean|did you (?:say|mean)|was that|is that|are you (?:saying|talking about)|the \\w+)",
  "say (?:that )?again", "repeat (?:that|it)", "i (?:don'?t|do not) (?:get|understand)(?: (?:it|that|this))?", "i'?m (?:confused|lost)", "that'?s confusing", "not sure i follow",
  "explain(?: (?:that|it|this|more|further|please|again|why))?", "elaborate", "can you (?:explain|clarify|elaborate)(?: (?:that|it|more))?", "clarify(?: (?:that|it))?",
  "shorter", "make it shorter", "simpler", "make it simpler", "in short", "tl;?dr", "eli5", "in (?:simple|plain) (?:words|terms|english)", "summari[sz]e(?: (?:that|it))?",
  "which one", "which", "who", "meaning", "so\\s+what", "and\\s+so", "what about (?:that|it)",
];
export const META_RE = new RegExp(`^\\s*(?:${META_ALTS.join("|")})\\s*[?!.,…]*\\s*$`, "iu");

// An ask that leans on the last topic: a pointer word, or a comparative ("chewier", "crispier", "cheaper", "more X").
const BACKREF_RE = /\b(?:one|ones|that|this|it|them|those|these|another|other|instead|same|similar|also|too|more|less|rather|different)\b/iu;
const COMPARATIVE_RE = /\b\p{L}{3,}ier\b|\b(?:bett|wors|cheap|easi|hard|fast|slow|bigg|small|larg|long|short|thick|thin|soft|crisp|sweet|spic|healthi|light|strong|smooth|rich|tough|tender)er\b|\b(?:more|less|a bit|a little|much|way|super|very)\s+\p{L}{3,}\b/iu;
// Words that carry no topic: openers, pointers, fillers. (An ask's CONTENT is what is left.)
const STOP = new Set(["a", "an", "the", "me", "my", "i", "we", "you", "your", "it", "its", "this", "that", "these", "those", "one", "ones", "some", "any", "show", "give", "tell", "find", "get", "want", "wanna", "need", "like", "love", "prefer", "please", "pls", "can", "could", "would", "should", "will", "do", "does", "did", "is", "are", "was", "were", "be", "to", "for", "of", "on", "in", "at", "with", "without", "and", "or", "but", "so", "how", "what", "which", "who", "whom", "where", "when", "why", "about", "good", "best", "great", "nice", "another", "other", "instead", "same", "similar", "also", "too", "rather", "different", "try", "something", "anything", "let", "lets", "let's", "make", "have", "has", "i'd", "i'm", "ill", "i'll", "id", "im", "just", "really", "very", "much", "way", "super", "bit", "little", "than", "then", "up", "out", "there", "here", "know", "see", "look", "looking", "search", "help", "us", "hmm", "ok", "okay"]);

const contentWords = (q) => words(q).filter((w) => !STOP.has(w) && w.length > 1);
const clipWords = (arr, n) => arr.slice(0, n);

/** Is this ask a request about the previous answer ("what?", "why?", "explain that", "shorter")? */
export function isMeta(question) {
  const q = String(question ?? "").trim();
  return !!q && q.length <= 60 && META_RE.test(q);
}

/** Does this short ask lean on the last topic and name nothing of its own? ("i want a chewier one") */
export function isElliptical(question) {
  const q = String(question ?? "").trim();
  const w = words(q);
  if (!w.length || w.length > THREAD.ellipticalMaxWords) return false;
  if (isMeta(q)) return false;
  if (casedRuns(q, scriptOf(q)).length) return false;              // it names its own entity: it stands alone
  return BACKREF_RE.test(q) || COMPARATIVE_RE.test(q);
}

const asText = (m) => String(m?.content ?? "").replace(/\s+/g, " ").trim();
const isFollowLike = (q) => isMeta(q) || isElliptical(q) || /^continue\.?$/i.test(String(q).trim());

/** The earlier turns this ask can follow: the last answer that WROTE something (a gap or a failure is nothing to follow),
 *  the ask that produced it, and the topic of the nearest earlier ask that stood on its own. `priorMessages` are the
 *  stored messages BEFORE this ask. */
export function threadOf(priorMessages) {
  const msgs = Array.isArray(priorMessages) ? priorMessages : [];
  let ai = -1;
  for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; if (m?.role === "assistant" && asText(m) && m.mode !== "agent") { ai = i; break; } }
  let ask = null, askIndex = -1;
  if (ai >= 0) for (let i = ai - 1; i >= 0; i--) { if (msgs[i]?.role === "user" && asText(msgs[i])) { ask = asText(msgs[i]); askIndex = i; break; } }
  // the topic: the nearest earlier user ask that is neither a follow-up nor the synthetic "Continue."
  let topicAsk = null;
  for (let i = (ai >= 0 ? ai : msgs.length) - 1; i >= 0; i--) { const m = msgs[i]; if (m?.role === "user" && asText(m) && !isFollowLike(asText(m))) { topicAsk = asText(m); break; } }
  const turn = ai >= 0 ? msgs.slice(0, ai + 1).filter((m) => m?.role === "assistant").length : 0;
  return { has: ai >= 0, answer: ai >= 0 ? asText(msgs[ai]) : "", answerIndex: ai, ask, askIndex, topicAsk, turn };
}

/** The topic words of an earlier ask: "Show me a good chocolate chip cookie recipe" → "chocolate chip cookie recipe". */
export function topicOf(askText) {
  const w = contentWords(askText);
  return clipWords(w, THREAD.topicMaxWords).join(" ");
}

/** Read this ask in the light of the thread. Never rewrites what the person said (`said`); `query` is what to SEARCH.
 *    kind   "meta" | "carried" | "elliptical" | "standalone"
 *    thread threadOf(prior) — `thread.has` says whether there is an earlier answer to follow
 *    reason why (for the feed and the tests)
 *  `referents`: the chat's referent record (fold-chat-mind.js); `hints`: the language priors (fold-chat-hints.js). */
export function followUp(question, priorMessages, { referents = null, hints = null } = {}) {
  const said = String(question ?? "").trim();
  const thread = threadOf(priorMessages);
  const base = { said, query: said, kind: "standalone", thread, topic: "", carried: [], reason: "stands-alone" };
  if (!said) return base;
  if (isMeta(said)) return { ...base, kind: "meta", query: said, reason: thread.has ? "meta-with-thread" : "meta-cold" };
  // 1. the pronoun path (resolveQuestion's own gate: a trigger form, no entity of its own, a record to carry from)
  const r = resolveQuestion(said, referents, { hints });
  if (r.reason === "carried") {
    const q = searchQueries(r)[0] || said;
    return { ...base, kind: "carried", query: q, carried: r.carried.map((c) => c.surface), reason: "carried-referent" };
  }
  // 2. the elliptical path: a short ask leaning on the last topic → search the topic with the ask's own words
  if (thread.topicAsk && isElliptical(said)) {
    const topic = topicOf(thread.topicAsk);
    const own = contentWords(said);
    if (topic) {
      const own2 = own.filter((w) => !topic.split(" ").includes(w));
      const query = [...own2, topic].join(" ").trim();
      return { ...base, kind: "elliptical", query, topic, reason: "elliptical-topic" };
    }
  }
  return base;
}

/** What this turn does, decided before anything is searched or asked. Pure — the live turn and the tests both read it.
 *    search          the query to search, or null when the web is not asked at all
 *    mode            "web" | "thread" | "cold-gap"
 *    modelMay        the model may be asked (grounded in the thread) — ONLY mode "thread"
 *  THE FALSIFIER: a cold meta ask (nothing earlier to follow) is "cold-gap": no search, no model, an app-authored note. */
export function turnPlan(question, priorMessages, opts = {}) {
  const f = followUp(question, priorMessages, opts);
  if (f.kind === "meta") {
    if (f.thread.has) return { ...f, mode: "thread", search: null, modelMay: true };
    return { ...f, mode: "cold-gap", search: null, modelMay: false };
  }
  return { ...f, mode: "web", search: f.query, modelMay: false };
}

/** The source block a thread-grounded reply is written from: the earlier turn, verbatim. Labels are for the fold's use. */
export function threadPrompt(thread, { maxChars = 4000 } = {}) {
  const t = thread || {};
  return "The person is following up on this conversation, not asking for new facts. Answer ONLY from the earlier turn below: say again, shorten, simplify or explain what the earlier answer already says, in their language, in a few sentences. Add no fact, name, number or source that is not in it. If the earlier turn does not contain what they are asking, say so in one plain sentence. Never mention the labels [T1] [T2], and never claim a website or publication.\n\n"
    + (t.ask ? `[T1] What the person asked earlier:\n${String(t.ask).slice(0, 1200)}\n\n` : "")
    + `[T2] The answer given:\n${String(t.answer || "").slice(0, maxChars)}`;
}

/** The app-authored label under a thread-grounded answer — it names the earlier turn it answers from. */
export function threadNotice(thread) {
  const t = thread || {};
  const q = t.ask ? String(t.ask).replace(/\s+/g, " ").trim() : "";
  const quote = q.length > THREAD.quoteChars ? q.slice(0, THREAD.quoteChars - 1).trimEnd() + "…" : q;
  return { kind: "thread", turn: t.turn || null, askIndex: t.askIndex ?? null, answerIndex: t.answerIndex ?? null, text: `Answered from this conversation${t.turn ? `, turn ${t.turn}` : ""}${quote ? ` (your question: “${quote}”)` : ""}. No web source was used; the model wrote this from that earlier turn alone.` };
}

/** The app-authored note for a follow-up with nothing earlier to follow. No model, no search. */
export function coldFollowUpNotice() {
  return { kind: "alone", text: "There is nothing earlier in this chat to follow up on, and I won't guess. Ask a question and I'll show what the sources say." };
}
