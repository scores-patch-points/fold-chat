// fold-mouth-webllm.mjs — THE SHARED IN-PAGE MOUTH (2026-10-10).
//
// "Use WebLLM for the model": this is the one mouth organ any generation
// surface in the Fold draws through. It wraps the existing page engine
// (fold-chat-webllm.js — WebLLM in this tab) with Penelope's mouth CONTRACT,
// so the browser mouth and the server mouth speak the same shape:
//
//   draw(prompt, { model, maxTokens, temperature, kind }) -> { ok, text, model }
//
// It carries the house laws across the seam, not around them:
//   - MOUTH-LAST is structural: this organ only phrases the residue a caller
//     already framed (field first, hunt second). It never reasons (khora FOLD II.9).
//   - the ration mirrors Penelope's Mouth@1 numbers (measured house law), so
//     the tab and the server agree about pacing.
//   - kindFor() is the browser mirror of Penelope's resolver: a task lands in
//     a modality (markdown/page/data/talk/code/text) AND a GFP grain
//     (Ground/Figure/Pattern), so a surface can say which face a turn is.
//
// Pure parts (admit, kindFor, frame, MOCK-era draw) need no GPU and no
// network; draw() needs the engine, which the caller supplies (the page
// engine's load()/chat() are injectable for tests).
import { createPageEngine, canonicalModelId } from "./fold-chat-webllm.js";

export const FOLD_MOUTH_SCHEMA = "FoldMouth@1";

// The measured house numbers (Penelope organs/mouth.mjs Mouth@1) — mirrored,
// never re-derived. The page is a courtesy ration so the tab does not hammer;
// the SERVER's mouth stays the authority.
export const HOUSE = { ration: 40, windowMs: 15 * 60 * 1000, retryAfterFloorMs: 1000 };

export const MODALITY_WORDS = {
  markdown: ["markdown", "brief", "notes", "readme", ".md", "summar", "document"],
  page: ["page", "html", "markup", "doctype", "section", "widget", "app"],
  data: ["json", "data", "record", "feed", "list", "csv", "api", "meeting", "launch", "spreadsheet"],
  talk: ["talk", "say", "answer", "reply", "respond", "chat", "turn", "speak"],
  code: ["code", "module", "function", "js", "py", "script", "program", "test"],
  text: ["essay", "prose", "story", "paragraph", "write about", "poem"],
};
const GRAIN_WORDS = {
  Ground: ["data", "feed", "bytes", "raw", "material", "source", "record", "json", "read"],
  Figure: ["function", "unit", "name", "character", "being", "hero", "module", "who"],
  Pattern: ["page", "app", "layout", "shape", "template", "essay", "widget", "document", "weave"],
};

const count = (text, words) => words.reduce((n, w) => n + (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text) ? 1 : 0), 0);

/** Route a generation task to the artifact form (modality) + the GFP grain it
 *  faces. Pure, dependency-free. Defaults to text·Pattern, never an invented list. */
export function kindFor(task) {
  const t = String(task ?? "");
  let bestM = "text", bestN = 0;
  for (const [k, words] of Object.entries(MODALITY_WORDS)) { const n = count(t, words); if (n > bestN) { bestM = k; bestN = n; } }
  let bestG = "Pattern", bestGN = 0;
  for (const [k, words] of Object.entries(GRAIN_WORDS)) { const n = count(t, words); if (n > bestGN) { bestG = k; bestGN = n; } }
  return { kind: bestM, grain: bestG, gfp: bestG[0], note: bestM === "text" && bestN === 0 ? "unclassified prose — the mouth's residue" : null };
}

/** The browser ration mirror of Penelope's mouth admit(): the same shape, the
 *  same house numbers, so a surface and the server pace together. `hop` = 1
 *  when the draw already passed the server's doorway (never re-queued). */
export function admit(identity, { log = [], now = Date.now(), hop = 0 } = {}) {
  if (Number(hop) >= 1) return { ok: true, place: 0, hop: true };
  const recent = log.filter((d) => d && d.ts >= now - HOUSE.windowMs);
  const inFlight = recent.filter((d) => d && d.kind !== "embed").length;
  if (inFlight >= HOUSE.ration) {
    const oldest = recent.length ? Math.min(...recent.map((d) => d.ts)) : now;
    return { ok: false, status: 429, retryAfterMs: Math.max(HOUSE.retryAfterFloorMs, HOUSE.windowMs - (now - oldest)), reason: `the tab drew its ration (${HOUSE.ration}/${HOUSE.windowMs}ms) — wait, never retry` };
  }
  return { ok: true, place: inFlight };
}

/** Frame a mouth draw so it may only phrase the ground (khora FOLD II.9 + the
 *  house's mouth-last). Pure. The markers it may cite are given, never drawn. */
export function frame(spec, { topic = "", cast = [], deeds = [], hunt = [] } = {}) {
  const lines = ["You are the mouth of a fold. Speak ONLY what the ground holds; never reason, infer, or add a name the record does not carry (khora FOLD II.9)."];
  if (topic) lines.push(`TOPIC: ${topic}`);
  if (Array.isArray(cast) && cast.length) lines.push(`Cast (your figures): ${cast.join(", ")}.`);
  if (Array.isArray(deeds) && deeds.length) lines.push(`Deeds (their patterns): ${deeds.join(", ")}.`);
  if (Array.isArray(hunt) && hunt.length) lines.push(`You may cite these source markers VERBATIM and never write one of your own: ${hunt.join(" ")}.`);
  return lines.join("\n") + "\n\n" + String(spec ?? "");
}

/**
 * The whole mouth, one engine. `engine` is injectable (createPageEngine), so
 * tests pass a fake and extension pages can pass null (a typed refusal, never
 * a crash). draw() answers the SAME shape the server door's executor seam
 * expects: { ok, text, model }. load() waits for the download gate as always.
 */
export function createPageMouth({ engine = null, storage = null, makeEngine = null } = {}) {
  const getEngine = () => engine || (makeEngine ? makeEngine({ storage }) : (typeof localStorage !== "undefined" ? createPageEngine({ storage: storage || localStorage }) : null));
  return {
    schema: FOLD_MOUTH_SCHEMA,
    admit,
    kindFor,
    frame,
    async draw(prompt, { model = null, maxTokens = 260, temperature = 0, kind = "chat" } = {}) {
      const eng = getEngine();
      if (!eng) return { ok: false, error: "no in-page engine — this surface cannot draw on this device (no WebGPU or extension page)" };
      try {
        if (typeof eng.load === "function") await eng.load(model ? canonicalModelId(model) : undefined);
        const { text, tokens, finish } = await eng.chat([{ role: "user", content: String(prompt ?? "") }], { maxTokens, temperature });
        if (!text) return { ok: false, error: "the in-tab model returned no text" };
        return { ok: true, text, tokens, finish, model: (eng.loadedId && eng.loadedId()) || model, place: "tab", kind };
      } catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    },
    async status() {
      const eng = getEngine();
      if (!eng?.status) return { schema: FOLD_MOUTH_SCHEMA, engine: false };
      return { schema: FOLD_MOUTH_SCHEMA, engine: true, ...(await eng.status()) };
    },
  };
}

export default { FOLD_MOUTH_SCHEMA, HOUSE, kindFor, admit, frame, createPageMouth };