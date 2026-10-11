// arm E — the khora read door (model-free EORead@1: referents, relations) + janus /v1/reason over STRUCTURED claims. My glue; the door and janus are the machinery under test.
//  1. read the QUESTION through the door; its relation (verb + participants), the wh-participant is the slot.
//  2. candidate sentences = the 10 passage sentences sharing most stems with the question; each read through the door.
//  3. bind: a page relation with the same verb stem whose participants overlap the question's known participant -> the OTHER participant's surface is the answer.
//  4. R13 (do the sources agree): per page the best sentence with a figure -> a GFP claim {rel, ARG0, ARG1}; janus (functional declared) says clash / OK.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { passageSet, gradeStated, store, timed, selected, norm, HERE } from "../lib.mjs";
import { stems, sentencesOfText } from "../ctx.mjs";
const DOOR = process.env.DOOR || "http://127.0.0.1:8815/heimdall/api/read";
const JANUS = process.env.JANUS || "http://127.0.0.1:11436/v1/reason";
const DIR = path.join(HERE, "cache", "door"); fs.mkdirSync(DIR, { recursive: true });
export const STATS = { door: 0, doorHit: 0, doorMs: 0 };
export async function door(text) {
  const key = crypto.createHash("sha1").update(text).digest("hex"); const f = path.join(DIR, key + ".json");
  if (fs.existsSync(f)) { STATS.doorHit++; return JSON.parse(fs.readFileSync(f, "utf8")); }
  const t0 = performance.now();
  const r = await fetch(DOOR, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(20000) });
  const j = await r.json(); STATS.door++; STATS.doorMs += performance.now() - t0;
  const slim = { ms: j.ms, relations: j.relations || [], referents: (j.referents || []).map((x) => x.surfaces), gaps: j.gaps || [] };
  fs.writeFileSync(f, JSON.stringify(slim)); return slim;
}
const WH = /^(?:who|whom|what|which|when|where|why|how)\b/i;
const lemma = (v) => String(v).toLowerCase().replace(/(?:ed|d|s|es|ing)$/, "").replace(/^wrot$/, "writ");
const IRR = { wrote: "writ", written: "writ", fell: "fall", built: "build", born: "bear" };
const lem = (v) => IRR[String(v).toLowerCase()] || lemma(v);
const surfaceStems = (s) => new Set(stems(s));
export async function runE(q, passages = passageSet(q)) {
  const t0 = performance.now(); const calls0 = STATS.door + STATS.doorHit;
  if (q.rung === 13 && q.vals) return runE13(q, passages);
  if (!q.answerable && q.rung >= 14) { /* E has no abstention of its own; it simply finds no binding */ }
  const qr = await door(q.q);
  const rel = qr.relations[0];
  if (!rel) return { gap: true, why: "question-unread (no relation in the door's reading of the question)", text: "" };
  const known = rel.participants.filter((p) => !WH.test(p.surface.trim())); const slot = rel.participants.find((p) => WH.test(p.surface.trim()));
  if (!slot) return { gap: true, why: "no-wh-slot", text: "" };
  const kstems = new Set(known.flatMap((p) => stems(p.surface)));
  if (!kstems.size) return { gap: true, why: "no-known-participant", text: "" };
  const qs = new Set(stems(q.q));
  const cands = [];
  for (const p of passages) for (const s of sentencesOfText(p.text)) { const ov = stems(s).filter((w) => qs.has(w)); const u = new Set(ov).size; if (u >= 2) cands.push({ s, u, ref: p.ref }); }
  cands.sort((a, b) => b.u - a.u);
  const V = lem(rel.relation);
  for (const c of cands.slice(0, 10)) {
    const r = await door(c.s);
    for (const pr of r.relations) {
      if (lem(pr.relation) !== V) continue;
      const parts = pr.participants.map((x) => x.surface);
      const hasKnown = parts.some((x) => stems(x).some((w) => kstems.has(w)));
      if (!hasKnown) continue;
      const other = pr.participants.find((x) => !stems(x.surface).some((w) => kstems.has(w)));
      if (other) return { gap: false, text: `${other.surface.replace(/\s+/g, " ").trim()} (${pr.relation})`, sentence: c.s, relation: pr, ref: c.ref };
    }
  }
  return { gap: true, why: `no page relation binds '${rel.relation}' to the question's participant`, text: "", tried: cands.length, qrel: rel.relation };
}
/** the number in a sentence nearest to a word the question asked about (years only when the question is about a date) */
function figureNearCue(sent, qstems, wantYear) {
  const words = [...sent.matchAll(/[A-Za-z0-9][A-Za-z0-9,.\u2019']*/g)].map((m) => ({ w: m[0], i: m.index }));
  const cuePos = words.filter((x) => qstems.has(stems(x.w)[0])).map((x) => x.i);
  let best = null;
  for (const m of sent.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = m[0].replace(/[,.]$/, ""); const v = Number(raw.replace(/,/g, ""));
    const isYear = /^(1[0-9]{3}|20[0-9]{2})$/.test(raw);
    if (isYear && !wantYear) continue; if (!isYear && wantYear && /^\d{1,2}$/.test(raw)) continue;
    if (/^\d{1,2}$/.test(raw) && /^\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)/.test(sent.slice(m.index + m[0].length))) continue;
    const d = cuePos.length ? Math.min(...cuePos.map((c) => Math.abs(c - m.index))) : m.index;
    if (!best || d < best.d) best = { d, raw };
  }
  return best ? best.raw : null;
}
async function janus(spec) {
  const r = await fetch(JANUS, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(spec), signal: AbortSignal.timeout(20000) });
  const text = await r.text(); return { flagged: (r.headers.get("x-er7-exit") ?? "0") !== "0", head: text.split("\n")[0] };
}
async function runE13(q, passages) {
  const qs = new Set(stems(q.q.replace(/^do these sources agree on/i, "")));
  const claims = []; const used = [];
  for (const p of passages) {
    const title = p.ref.replace(/^.*— /, "");
    const cands = sentencesOfText(p.text).map((s) => ({ s, u: new Set(stems(s).filter((w) => qs.has(w))).size, fig: (s.match(/\d[\d,]*(?:\.\d+)?/g) || []) })).filter((x) => x.fig.length && x.u >= 2).sort((a, b) => b.u - a.u);
    if (!cands.length) continue;
    const r = await door(cands[0].s);
    // the figure the door's participants carry (first participant surface with a digit); fall back to the sentence's first figure
    const fig = figureNearCue(cands[0].s, qs, /\b(?:year|date|born|died|published)\b/i.test(q.q));
    if (!fig) continue;
    claims.push({ ground: "/p", rel: "has-value-" + [...qs].sort().join("-").slice(0, 40), roles: { ARG0: "subject", ARG1: fig.replace(/,/g, "") }, polarity: "+", force: "default", id: "c" + claims.length, said: cands[0].s.slice(0, 120) });
    used.push({ title, fig, s: cands[0].s });
  }
  if (claims.length < 2) return { gap: true, why: "fewer than two sources gave a figure", text: "" };
  const rel = claims[0].rel;
  const j = await janus({ claims: claims.map((c) => ({ ...c, rel })), declare: { functional: [{ rel, role: "ARG1", giver: "P1 hand declaration (a 'value of X' is single-valued)" }] }, identity: "caseless" });
  const vals = used.map((u) => u.fig).join(" versus ");
  return { gap: false, text: j.flagged ? `The sources disagree: ${vals}.` : `The sources agree: ${used[0].fig}.`, janus: j.head, used };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const st = store("E");
  for (const q of selected()) {
    if (st.done.has(q.id)) continue;
    const { out, err, ms } = await timed(() => runE(q));
    const o = out || { gap: true, why: "error", text: "" };
    const g = gradeStated(q, o.text, { gap: o.gap });
    st.put({ id: q.id, rung: q.rung, ms, err, gap: o.gap, why: o.why || null, text: o.text, sentence: o.sentence || null, janus: o.janus || null, grade: g });
    console.log(q.id, g.ok ? "OK " : "-- ", o.gap ? "gap:" + (o.why || "").slice(0, 50) : "", g.why, ms + "ms", "|", (o.text || "").slice(0, 90));
  }
  console.log(JSON.stringify(STATS));
}
