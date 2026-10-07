// fold-chat-voiceswire.js — the PAGE side of "voices on this question" (fold-chat-voices.js). Pure except for the injected fetch and storage. NOT wired yet: eval/ants/c2/wire.diff proposes the hooks.
// The server (fold-chat-voiceshost.mjs) holds the canon files and the thinker profile; the page cannot read them. The page therefore CHECKS what it can without the canon — the shape, <= 3 voices, a short giver,
// the frame and the line equal the module's own templates — and draws only what passes. It cannot re-check the quote against the canon (that needs the file); the server did, and the stored record carries the address
// (path, sha256, offsets) so "how was this found" can be re-verified by anyone holding the file (verifyVoices in fold-chat-voices.js).
// Default OFF: eval/ants/C2-RESULTS.md measured the on-topic rate far below the pre-registered bar. A person turns it on (localStorage "fold-chat:voices" = "on").
import { VOICES, lineFor, frameFor, shortGiver } from "./fold-chat-voices.js";

export const VOICES_KEY = "fold-chat:voices";
export const VOICES_URL = "/fold/api/voices";
export function voicesEnabled(storage = (typeof localStorage !== "undefined" ? localStorage : null)) {
  try { return !!storage && storage.getItem(VOICES_KEY) === "on"; } catch { return false; }
}

const isStr = (x, max = 700) => typeof x === "string" && x.trim().length > 0 && x.length <= max;
/** A server reply -> the record the page may store and draw, or null. Nothing is repaired: a voice that does not match the templates is dropped with all the rest (the display is all or nothing). */
export function checkStored(x) {
  if (!x || !Array.isArray(x.voices) || !x.voices.length || x.voices.length > VOICES.max) return null;
  const seen = new Set(), voices = [];
  for (const v of x.voices) {
    if (!v || !isStr(v.handle, 40) || seen.has(v.handle) || !isStr(v.quote, 340) || !v.source || !isStr(v.source.path, 200) || !isStr(v.source.sha256, 64)) return null;
    if (!Number.isInteger(v.source.start) || !Number.isInteger(v.source.end) || v.source.end <= v.source.start) return null;
    if (v.giver !== shortGiver({ handle: v.handle, giver: v.giver }) || /[\d()]/.test(v.giver) || v.giver.length > 30) return null;
    if (v.frame !== frameFor({ handle: v.handle, giver: v.giver })) return null;
    seen.add(v.handle);
    voices.push({ handle: v.handle, giver: v.giver, quote: v.quote, frame: v.frame, source: { path: v.source.path, sha256: v.source.sha256, work: isStr(v.source.work, 400) ? v.source.work : null, section: isStr(v.source.section, 90) ? v.source.section : null, start: v.source.start, end: v.source.end } });
  }
  if (x.line !== lineFor(voices.length)) return null;
  return { voices, line: x.line };
}

/** Ask the server. Never throws except on abort; a failure is "no voices" (silence is the default). */
export async function askVoices({ question, fetchFn = (typeof fetch !== "undefined" ? fetch : null), signal = null, url = VOICES_URL } = {}) {
  const q = String(question ?? "").trim();
  if (!q || !fetchFn) return null;
  try {
    const r = await fetchFn(`${url}?q=${encodeURIComponent(q.slice(0, 300))}`, { signal, headers: { accept: "application/json" } });
    if (!r || !r.ok) return null;
    return checkStored(await r.json());
  } catch (e) {
    if (signal?.aborted || e?.name === "AbortError") throw e;
    return null;
  }
}

/** The drawing as data: [{ kind:"line"|"frame"|"quote"|"cite", text }]. The quote's whitespace is collapsed for the eye only (the stored quote keeps the canon's exact characters). */
export function voicesParts(stored) {
  if (!stored?.voices?.length) return [];
  const out = [{ kind: "line", text: stored.line }];
  for (const v of stored.voices) {
    out.push({ kind: "frame", text: v.frame });
    out.push({ kind: "quote", text: v.quote.replace(/\s+/g, " ").trim() });
    out.push({ kind: "cite", text: [v.source.work, v.source.section].filter(Boolean).join(", ") });
  }
  return out;
}
