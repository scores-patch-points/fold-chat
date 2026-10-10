// penelope.mjs — wire in Penelope for the creativity, the pathos.
//
// THE THIRD FACE. khora Differentiates (the wander — what the corpus puts
// together), janus Relates (the logical spine — what follows from the record),
// penelope Generates (the mouth — the utterance a reader meets). This stage
// uses Penelope ONLY for her creative, pathos face: it gives the Janus-cleaned
// spine a felt frame. It does not gate, it does not judge, and — per direction —
// it calls no model at all.
//
// HOW A CREATIVE PASS CAN BE MODEL-FREE. Penelope's cast is 66 archons with
// VERIFIED words, byte-addressed in their own sources (organs/pythia.mjs:
// manifest → source slice around the anchored quote). Creativity here is
// SELECTION and ARRANGEMENT, not invention: the archon whose dwelling best
// matches the topic is routed mechanically, and the passage is built from that
// archon's OWN sentences, chosen by overlap with the Janus spine and laid in
// their source order. Every quoted line is verified against the source it came
// from (Penelope's rejectfab, organs/quotes.js); the response carries no
// archon's name (the veil), while the record names who was routed. The POV
// conditions the frame — what matters, the mood — never the words.

import { loadManifest, loadVoice, loadRole } from "../../../penelope/organs/pythia.mjs";
import { scentOf } from "../../../penelope/organs/stigmergy.mjs";
import { verifyQuotes } from "../../../khora/native/organs/quotes.js";

export const PATHOS_SCHEMA = "EOMindWanderPathos@1";
export const REGISTERS = Object.freeze(["attentive", "elegiac", "dread", "tender", "plain"]);

const STOP = new Set("the a an and or of to in on at it is was were be been being i you he she we they his her their its as for with that this from by not but if so then than there here what which who how when where why all any some no nor do did does have has had will would can could may might must about into over under out up down".split(" "));
const words = (s) => (String(s ?? "").toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length > 3 && !STOP.has(w));
export const sentencesOf = (t) => String(t ?? "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 40 && s.length <= 240);

/** Mechanical routing: the archon whose giver+work+role+own-words best overlap
 *  the topic and the spine, weighted so a word every archon has (idf ~ 0) can
 *  not route on its own. Deterministic; ties break on handle. */
export function routeArchon(cast, { topic = "", spine = "" } = {}) {
  const query = [...new Set([...words(topic), ...words(spine).slice(0, 80)])];
  const panels = [];
  for (const rec of cast.values()) {
    if (!rec.speakable || !rec.quote || !rec.source?.path) continue;
    const voice = (() => { try { return loadVoice(rec)?.excerpt ?? ""; } catch { return ""; } })();
    const hay = [rec.giver, rec.work, loadRole(rec), voice.slice(0, 4000)].join(" ");
    panels.push({ rec, voice, counts: words(hay).reduce((m, w) => (m.set(w, (m.get(w) ?? 0) + 1), m), new Map()) });
  }
  if (!panels.length) return null;
  const df = new Map();
  for (const p of panels) for (const w of p.counts.keys()) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = (w) => Math.log(1 + panels.length / (df.get(w) ?? 1));
  let best = null;
  for (const p of panels) {
    let score = 0;
    for (const w of query) score += (p.counts.get(w) ?? 0) * idf(w);
    score /= Math.sqrt(1 + p.counts.size);
    if (!best || score > best.score || (score === best.score && String(p.rec.handle) < String(best.rec.handle))) best = { rec: p.rec, score, voice: p.voice };
  }
  return best;
}

/**
 * weavePathos({ topic, logicalTranscript, register, k }) -> {
 *   drew, passage, archon{handle,giver,work}, role, register, quotes{located,fabricated}, modelCalls:0
 * }
 *
 * Creativity = selection + arrangement of the routed archon's real sentences
 * against the spine's content. No model is called; `drew:false` names the gap
 * when the cast is empty, never a fabricated passage.
 */
export function weavePathos({ topic, logicalTranscript = "", register = "elegiac", k = 5 } = {}) {
  if (!REGISTERS.includes(register)) register = "attentive";
  let cast;
  try { cast = loadManifest(); } catch (e) { return { schema: PATHOS_SCHEMA, drew: false, register, gap: `the cast could not be read: ${String(e?.message ?? e).slice(0, 160)}` }; }
  const routed = routeArchon(cast, { topic, spine: logicalTranscript });
  if (!routed?.voice) return { schema: PATHOS_SCHEMA, drew: false, register, gap: "no speakable archon matched — the cast holds no verified words for this" };
  const { rec, voice } = routed;

  const spineWords = new Set(words(`${topic} ${logicalTranscript}`));
  const hubs = [...words(logicalTranscript).reduce((m, w) => (spineWords.has(w) && (m.set(w, (m.get(w) ?? 0) + 1)), m), new Map())]
    .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);

  // Rank the archon's own sentences by overlap with the spine, keep the best k,
  // then LAY THEM IN SOURCE ORDER — arrangement, not invention.
  const sents = sentencesOf(voice).map((text, at) => {
    const bag = new Set(words(text));
    let hit = 0; for (const w of spineWords) if (bag.has(w)) hit += 1;
    return { text, at, hit };
  }).sort((a, b) => b.hit - a.hit || a.at - b.at).slice(0, k).sort((a, b) => a.at - b.at);
  if (!sents.length) return { schema: PATHOS_SCHEMA, drew: false, register, gap: "the routed archon's words held no usable sentence" };

  const role = String(loadRole(rec) ?? "").split("\n")[0].slice(0, 140);
  // The veil (Penelope's law): the record names who was routed; the passage
  // carries no name. The role text can itself name people, so it is NOT read
  // into the frame — the chosen words carry the register, the record carries
  // the source.
  const ant = /^[aeiou]/i.test(register) ? "an" : "a";
  const frame = `In ${ant} ${register} register, from a witness routed for this topic — unnamed, as the law requires — the spine is given these words:`;
  const body = sents.map((s) => `  “${s.text.replace(/^["“]|["”]$/g, "")}”`).join("\n");
  const trail = hubs.length ? `\n\n  ⁂ the spine kept: ${hubs.join(" · ")}` : "";
  const passage = `${frame}\n\n${body}${trail}`;

  const report = verifyQuotes(passage, [{ text: voice, source: rec.source.path, ref: rec.handle }]);
  const fabricated = report.quotes.filter((q) => q.status === "unlocated" || q.status === "partial").map((q) => q.text);
  const located = report.quotes.filter((q) => q.status === "verbatim" || q.status === "drifted").length;

  return {
    schema: PATHOS_SCHEMA,
    drew: true,
    register,
    passage,
    archon: { handle: rec.handle, giver: rec.giver, work: rec.work, score: +routed.score.toFixed(3) },
    role,
    hubs,
    quotes: { offered: sents.length, located, fabricated: fabricated.length, statuses: report.quotes.map((q) => q.status) },
    modelCalls: 0,
    basis: `routed ${rec.handle} by idf-weighted overlap (score ${routed.score.toFixed(2)}); selected ${sents.length} of its verified sentences against the spine; ${located}/${report.quotes.length} quotes located in ${rec.source.path.split("/").pop()} — no model called`,
  };
}

/**
 * makePathos({ topic, register, refrainEvery }) -> { ok, push, render, record }
 *
 * THE LIVE OUTPUT WRITER. Penelope owns the single passage the reader meets.
 * She routes ONE archon from the topic at construction (mechanical, no model),
 * then writes the Janus-licensed tokens into one flowing passage in the
 * register, and at intervals where her archon's own words touch the recent
 * context she sets down one of that archon's VERIFIED sentences as a refrain.
 * So the stream the reader watches is a single thing: khora's words, admitted
 * by Janus, carried in Penelope's voice. The record names the archon; the
 * passage never does (the veil).
 */
export function makePathos({ topic, register = "elegiac", refrainEvery = 9 } = {}) {
  if (!REGISTERS.includes(register)) register = "attentive";
  let rec = null, voice = "", sentences = [];
  try {
    const routed = routeArchon(loadManifest(), { topic, spine: topic });
    if (routed?.voice) {
      rec = routed.rec; voice = routed.voice;
      sentences = sentencesOf(voice).map((text, at) => ({ text, at, bag: new Set(words(text)) }));
    }
  } catch { /* no cast on this machine — disclosed below, never faked */ }
  const ok = !!rec && sentences.length > 0;

  let text = "";
  let cap = true;
  let sinceRefrain = 0;
  const used = new Set();
  const recent = [];
  const refrains = [];

  const write = (t) => {
    if (/^[.,;:!?]$/.test(t)) { text = text.replace(/\s+$/, "") + t; cap = /[.!?]/.test(t); return; }
    text += (text && !/\s$/.test(text) ? " " : "") + (cap ? t.charAt(0).toUpperCase() + t.slice(1) : t);
    cap = false;
  };

  function maybeRefrain() {
    if (sinceRefrain < refrainEvery) return null;
    const near = new Set(recent.slice(-12));
    let best = null;
    for (const s of sentences) {
      if (used.has(s.at)) continue;
      let hit = 0; for (const w of s.bag) if (near.has(w)) hit += 1;
      if (hit > 0 && (!best || hit > best.hit)) best = { s, hit };
    }
    if (!best) return null;
    used.add(best.s.at);
    const line = best.s.text.replace(/^["“]|["”]$/g, "");
    if (text && !/[.!?…"”]$/.test(text)) text += ".";
    text += `${text && !/\s$/.test(text) ? " " : ""}“${line}”`;
    refrains.push(line); sinceRefrain = 0;
    return line;
  }

  /** push(token) -> the refrain added at this step, or null. */
  function push(token) {
    write(String(token ?? ""));
    const w = String(token ?? "").toLowerCase();
    if (/^[a-z]/.test(w) && w.length > 2 && !STOP.has(w)) { recent.push(w); if (recent.length > 40) recent.shift(); sinceRefrain += 1; }
    return maybeRefrain();
  }

  const render = () => text;

  function record() {
    const report = ok ? verifyQuotes(text, [{ text: voice, source: rec.source.path, ref: rec.handle }]) : { quotes: [] };
    const located = report.quotes.filter((q) => q.status === "verbatim" || q.status === "drifted").length;
    const fabricated = report.quotes.filter((q) => q.status === "unlocated" || q.status === "partial").length;
    return {
      schema: PATHOS_SCHEMA, drew: ok, register, passage: text,
      archon: rec ? { handle: rec.handle, giver: rec.giver, work: rec.work, source: rec.source.path } : null,
      refrains, refrainsUsed: used.size,
      quotes: { offered: report.quotes.length, located, fabricated },
      modelCalls: 0,
      basis: ok
        ? `one archon routed for "${topic}" (mechanical, no model); ${refrains.length} of its verified sentences laid in as refrains; ${located}/${report.quotes.length} quotes located — rejectfab holds`
        : "no cast of verified words was reachable — the passage is the spine alone, undisguised",
    };
  }

  return { ok, push, render, record };
}
