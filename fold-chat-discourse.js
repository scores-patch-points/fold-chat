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
export const GENERATE_RE = /\b(write|compose|draft|create|generate|produce|make)\b[\s\S]{0,40}\b(essay|article|story|poem|song|report|summary|letter|email|post|blog|copy|piece|outline|plan|guide|list|page|html|app|website|comparison|analysis|review|memo|brief|about)\b/i;
export const RESEARCH_RE = /^(who|what|when|where|which|why|how many|how much|is|are|was|were|did|does|do|can|tell me about|what's|who's|current|latest|news)\b/i;
// A demand for facts, proof, or a comparison — "compare X, Y, Z", "prove it",
// "cite this", "source?", "verify …", "differences between …". These are
// information-seeking whether or not they carry a wh-word or a "?", so they
// route to research (and thus search). Checked after GENERATE, so a "write a
// comparison" is still a writing turn, not a lookup.
export const DEMAND_RE = /\b(compare|contrast|prove|cite|source|citation|evidence|verify|fact[- ]?check|look\s?up|find me|find out|figure out|search for|dig up|relationship between|connection between|link between|related to|who is|who was|who are|tell me about|show me|versus|vs\.?|differences? between|how (?:does|do|did|are|is|were|was))\b/i;
// A bare conversational continuation: "well?", "so?", "and?", "go on", "ok" —
// a nudge to keep going, not a question of fact. A question mark alone must
// not make these "research" (the bug: "well?" was web-searched as a lookup and
// answered out of context). These carry the thread forward against the turns
// already in the window, so they are conversation, never a lookup.
export const CONVERSATIONAL_RE = /^(well|so|ok|okay|hmm+|hm+|right|sure|yeah|yep|yup|yes|no|nope|nah|and|but|then|also|really|nice|cool|wow|lol|haha|heh|go on|continue|carry on|keep going|more|again|wait|eh|meh|alright|fine|indeed|exactly|got it|i see)\b[\s?!.,…]*$/i;

export function classifyTurn(question) {
  const q = String(question ?? "").trim();
  if (!q) return "smalltalk";
  if (q.length < 60 && SMALLTALK_RE.test(q)) return "smalltalk";
  if (q.length < 40 && CONVERSATIONAL_RE.test(q)) return "chat";
  if (GENERATE_RE.test(q)) return "generate";
  if (RESEARCH_RE.test(q)) return "research";
  if (DEMAND_RE.test(q)) return "research";
  // A comparison/list of several entities ("Canberra, Brasília, Ottawa, and
  // Washington, D.C.") seeks facts, even with no wh-word and no "?".
  if ((q.match(/,/g) || []).length >= 2 && /\b[A-Z][a-z]/.test(q)) return "research";
  return /\?/.test(q) ? "research" : "chat";
}

// The generate instruction — the fold writes the thing, it does not interview
// the person for a brief. This is the whole fix for "it never writes it".
//
// It REPLACES the surface's persona on a generate turn, never sits after it.
// Measured live: the reading persona ("answer from the material; where it does
// not, say what is missing instead of filling it in") and this instruction are
// opposite directives — a small model handed both hedges into a teaser
// ("Certainly, I'd be happy to help you write…") instead of writing. So on a
// generate turn the base prompt IS the writer, and the persona stands down.
export const GENERATE_NUDGE = "You are a writer working ONLY from the sources provided in this context. The person asked you to WRITE or PRODUCE something. Write it now, in full, in this reply. Ground every fact in the sources you were given — never invent a date, name, figure, or event, and never write from memory. If the sources do not cover part of the piece, say plainly what is missing instead of filling it in. Do not ask them what topics to cover, do not ask for more detail, and do not offer to help later — deliver the complete piece. Never reply that you cannot write.";

// Which turns carry a grounding record — every turn that makes a claim or a
// written artifact, i.e. everything but a greeting. The fold is always grounded.
export function checkable(kind) {
  return kind === "research" || kind === "chat" || kind === "generate";
}

export function wantsWeb(kind, webOn) {
  // Retained for callers/tests; the surface itself now ALWAYS grounds (every
  // non-greeting turn searches), so this is no longer the gate.
  return !!webOn && kind === "research";
}

// THE GENERATION LANE (2026-10-04): a generate turn whose artifact penelope's
// generation system holds (prose: essays, reports, pieces) is dispatched to the
// weave — void detection + writing across prompts — instead of a single draw.
// An html/app/page ask keeps the fold's own single-draw build (the fenced-HTML
// preview the surface already renders); penelope has no html adapter yet.
const GENERATION_ARTIFACT_RE = /\b(essay|article|story|poem|song|report|summary|letter|email|post|blog|copy|piece|outline|plan|guide)\b/i;
export function generationArtifact(question) {
  return GENERATION_ARTIFACT_RE.test(String(question ?? "")) ? "text" : null;
}
