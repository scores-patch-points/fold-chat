// fold-chat-frame.js — the question frame, shed before an encyclopedia is asked. Pure: no DOM, no IO, no model.
//
// Measured 2026-10-05 (eval/falsify/query-frame.mjs and by hand): Wikipedia's search matches TITLES on the question's frame words.
// "Who is the king of the UK?" ranks The Kid Who Would Be King, The Who and The Man Who Would Be King first and
// Monarchy of the United Kingdom fifth; "king of the UK" ranks it first. The frame ("Who is the", "What is the", "Does a") is closed-class
// words that name nothing, so it is cut from the FRONT of the ask using the language's own function-word prior (the khora's committed
// set, fold-chat-snippets.js functionWordsOf) — never a hand-typed English list. A language with no prior is returned unchanged (a typed
// gap, not a guess). The person's own words are never rewritten: the stripped form is only a SEARCH query, and the turn feed shows it.

const tokens = (q) => String(q ?? "").match(/[\p{L}\p{N}'’.-]+|[^\p{L}\p{N}\s]+/gu) || [];

/** Drop the leading run of function words (and the trailing '?'), keeping at least one content word. Returns the ask unchanged when
 *  there is no prior, nothing to cut, or cutting would leave nothing. `fw`: a Set of case-folded function words, or null. */
export function stripFrame(question, fw) {
  const q = String(question ?? "").trim();
  if (!q || !(fw instanceof Set) || !fw.size) return q;
  const isFw = (w) => fw.has(String(w).toLowerCase().replace(/[^\p{L}\p{N}']/gu, ""));
  const asked = /[?¿]\s*$/u.test(q);
  const t = q.replace(/[?!¿¡]+\s*$/u, "").trim().split(/\s+/);
  // Only a QUESTION has a frame: "The Who albums" is a name and a noun, not a frame and a topic.
  if (!asked || t.length < 3) return q;
  let i = 0;
  while (i < t.length - 1 && isFw(t[i])) i++;
  if (i === 0) return q;                                   // nothing to cut: the ask is returned exactly as said
  const rest = t.slice(i);
  if (!rest.some((w) => !isFw(w))) return q;               // what would be left names nothing ("Who are The Who?" must not become "Who")
  return rest.join(" ");
}
