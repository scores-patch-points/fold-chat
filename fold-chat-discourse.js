// fold-chat-discourse.js — the discourse classifier (the holodeck's lesson).
//
// A turn is one of four kinds, and the kind decides the whole pipeline. This
// is the pure, testable core; the surface reads it to choose prompt, search,
// and whether a grounding disclosure even applies.
//
//   smalltalk — a greeting or thank-you. Plain chat: no web search, no
//               grounding. A greeting gets a greeting.
//   generate  — "write / compose / an essay on / draft / build …": the person
//               wants an ARTIFACT. No web search front-loads it and no
//               clarifying quiz — the fold writes it now. (The loud failure
//               this fixes: "write about the extinction of dolphins" became
//               "please tell me what topics to cover".)
//   research  — a question of fact ("who is / when / what is / how many", a
//               bare lookup, or anything with a "?"): search, read, answer
//               from what was read.
//   chat      — everything else: plain conversation.
//
// Pure: no DOM, no IO. Node-testable.

export const SMALLTALK_RE = /^(hi|hey|hello|yo|sup|good\s?(morning|afternoon|evening)|how are you|how's it going|how is it going|thanks|thank you|bye|goodbye|good night|see you)\b/i;
export const GENERATE_RE = /\b(write|compose|draft|create|generate|produce|make)\b[\s\S]{0,40}\b(essay|article|story|poem|song|report|summary|letter|email|post|blog|copy|piece|outline|plan|guide|list|page|html|app|website|about)\b/i;
export const RESEARCH_RE = /^(who|what|when|where|which|why|how many|how much|is|are|was|were|did|does|do|can|tell me about|what's|who's|current|latest|news)\b/i;

export function classifyTurn(question) {
  const q = String(question ?? "").trim();
  if (!q) return "smalltalk";
  if (q.length < 60 && SMALLTALK_RE.test(q)) return "smalltalk";
  if (GENERATE_RE.test(q)) return "generate";
  if (RESEARCH_RE.test(q)) return "research";
  return /\?/.test(q) ? "research" : "chat";
}

// The generate instruction — the fold writes the thing, it does not interview
// the person for a brief. This is the whole fix for "it never writes it".
export const GENERATE_NUDGE = "The person asked you to WRITE or PRODUCE something. Write it now, in full, in this reply. Do not ask them what topics to cover, do not ask for more detail, and do not offer to help later — deliver the piece. If it helps the piece to cite what was read, use it; otherwise write from your own knowledge plainly.";

// Which turns may carry a grounding disclosure. Only a claim-checkable turn
// (research or chat over real material) — never a written piece, never a
// greeting.
export function checkable(kind) {
  return kind === "research" || kind === "chat";
}

export function wantsWeb(kind, webOn) {
  return !!webOn && kind === "research";
}
