// g.mjs — arm G, the Pevear-Volokhonsky composite, computed from the stored per-question outputs of the other arms (no extra model call).
//   mechanical first: cue-route -> D+ -> B -> E -> C, each behind a mechanical CHECK; escalate to F (the model arm's stored draft) only on a typed gap or a failed check;
//   then the mechanical final pass: pivotText + verifyPivot (fold-chat-pivot.js) over the draft against the passages (what the model said is kept only as far as it re-derives).
// The pure gate is exported as escalate(features, params); thresholds are fitted on the ODD-indexed questions of each rung and scored on the EVEN-indexed ones.
import fs from "node:fs";
import path from "node:path";
import { pivotText, verifyPivot } from "../../../fold-chat-pivot.js";
import { BATTERY, passageSet, gradeStated, gradeStated2, gradeSnippets, RESULTS, norm, refuses } from "./lib.mjs";
const COMPOSED = new Set(["B", "D", "E", "F", "Fg", "Fo", "Freal", "Dh"]);
/** rows of an arm; composed arms are REGRADED with gradeStated2 (the v1 grade is kept as grade1; lib.mjs explains the two grader errors v2 fixes) */
export const load = (arm, { v1 = false } = {}) => {
  const f = path.join(RESULTS, arm + ".jsonl"); const m = new Map();
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split("\n").filter(Boolean)) { try { const o = JSON.parse(l); m.set(o.id, o); } catch {} }
  if (!v1 && COMPOSED.has(arm)) {
    const qs = new Map([...BATTERY].map((q) => [q.id, q]));
    for (const o of m.values()) { const q = qs.get(o.id); if (!q) continue; const gap = arm === "B" ? o.kind !== "answer" : (arm === "D" || arm === "E") ? !!o.gap : false; o.grade1 = o.grade; o.grade = gradeStated2(q, o.text, { gap }); }
  }
  return m;
};

// ── the pure part: cue class and the gate ──
export function cueClass(question) {
  const q = String(question).trim();
  if (/\b(?:should i|is it (?:morally )?(?:right|wrong|good|bad|ethical)|better (?:leader|scientist|programming)|better than|greater (?:scientist|than)|best\b|most beautiful|a good thing|worth it)\b/i.test(q)) return "opinion";
  if (/^summari[sz]e/i.test(q)) return "summarise";
  if (/^do these sources agree/i.test(q)) return "agree";
  if (/^which of (?:these|the following)\b.*\b(?:not|n't)\b|^is .* one of\b/i.test(q)) return "negation";
  if (/^how many (?:years|metres|meters|kilometres|kilometers|feet|miles)\b.*\b(?:between|passed|separate|before|after|taller|longer|live|old|separate)|^how old\b|^how many years did|^what is the combined|^how much (?:taller|longer)|^how many metres (?:taller|longer)/i.test(q)) return "arithmetic";
  if (/^(?:which|who)\b.*\b(?:taller|longer|higher|deeper|more people|older|came first|first[,:]|lived longer|born first|died first|earlier)\b/i.test(q)) return "compare";
  if (/^(?:why|how (?:does|do|is|did))\b|^what causes\b/i.test(q)) return "causal";
  if (/\bin (?:feet|metres|meters|kilomet(?:re|er)s|miles|fahrenheit|celsius|km|kilometres per second)\b|^how (?:tall|long|deep|far|fast|high)\b|^at what temperature/i.test(q)) return "figure";
  if (/^(?:name|which (?:countries|nobel|of the)|who were|what are the (?:four|stages)|what (?:were|are) the )/i.test(q)) return "list";
  if (/^what (?:is|are) (?:a |an |the )?[^?]{2,40}\?$/i.test(q) && !/\bcapital\b|\bchemical symbol\b/i.test(q)) return "definition";
  if (/^(?:who|when|what (?:year|date|city|prize|is the)|where|on what date|in (?:what|which)|which (?:president|city|theatre|nobel))/i.test(q)) return "slot";
  return "other";
}
const shaped = (cue, text) => {   // does a composed answer carry a filler of the asked shape?
  const t = String(text);
  if (/\byear|when|date\b/i.test(cue)) return /\b\d{4}\b/.test(t);
  return true;
};
export const PARAMS = { tauCov: 0.6, snipRoute: { summarise: "C" } };
/** escalate(features, params) -> { escalate, route, why }: PURE. features come from the question and the mechanical arms' own outputs, never from gold or a model.
 *  params.snipRoute maps a cue class to the snippet arm the gate trusts for it ("C" = the precise one-sentence snip; "S"/"A2"/"A" = the passage walls); a cue with no entry has no trusted snippet arm. */
export function escalate(f, params = PARAMS) {
  if (f.cue === "opinion") return { escalate: false, route: "gap", why: "opinion/advice cue: a typed gap, no verdict (no model is asked)" };
  for (const st of (params.trust || ["D", "B", "E"])) if (f[st] && f[st].answered && f[st].check) return { escalate: false, route: st, why: `${st} answered and its check passed` };
  const arm = params.snipRoute?.[f.cue];
  if (arm === "C" && f.C?.answered && (f.cue === "summarise" || (f.C.cov >= params.tauCov && f.C.shaped))) return { escalate: false, route: "C", why: `C: best sentence covers ${f.C.cov?.toFixed(2)} >= ${params.tauCov}, shape ok` };
  if (arm && arm !== "C" && f[arm]?.answered) return { escalate: false, route: arm, why: `${arm}: the passage excerpt for cue ${f.cue}` };
  return { escalate: true, route: "F", why: f.C?.answered ? `cue ${f.cue}: no trusted mechanical route (C coverage ${f.C.cov?.toFixed(2)})` : "every mechanical arm returned a typed gap" };
}
export function featuresOf(q, rows) {
  const cue = cueClass(q.q);
  const f = { cue };
  const d = rows.D.get(q.id); if (d) f.D = { answered: !d.gap, check: !d.gap && (d.evidence || []).length > 0 && shaped(q.q, d.text) };
  const b = rows.B.get(q.id); if (b) f.B = { answered: b.kind === "answer", check: b.kind === "answer" && shaped(q.q, b.text) && /\b(?:who|when|where|what|how)\b/i.test(q.q) };
  const e = rows.E.get(q.id); if (e) f.E = { answered: !e.gap, check: !e.gap && shaped(q.q, e.text) && cue === "agree" };
  const c = rows.C.get(q.id); if (c) { const top = c.text.split("\n")[0] || ""; f.C = { answered: !c.gap, cov: c.best?.cov ?? 0, shaped: /\bwho|when|year|how many|how tall|how long|how deep|how far\b/i.test(q.q) ? (/\d/.test(top) || /\b[A-Z][a-z]+/.test(top)) : true }; }
  for (const a of ["S", "A2", "A"]) { const r = rows[a]?.get(q.id); if (r) f[a] = { answered: !!r.nsnips }; }
  return f;
}
const loadAll = () => ({ D: load("D"), B: load("B"), E: load("E"), C: load("C"), F: load("F"), S: load("S"), A2: load("A2"), A: load("A") });
/** F's draft after the mechanical final pass (pivotText + verifyPivot), graded; computed once per question */
export function pivoted(q, fr, { normalize = true } = {}) {
  const t0 = performance.now(); let text = "", grade, pv = null;
  if (!fr) return { text: "", grade: { ok: false, why: "no-F-row" }, ms: 0 };
  const ps = passageSet(q).map((p) => ({ ref: p.ref, text: p.text, url: p.url }));
  try {
    // a bare one-token answer ("Canberra", "1969") has no terminal mark and the pivot reads it as a draft cut off mid-sentence; normalize adds a full stop (content-free). normalize:false is the pre-registered raw call.
    const draft = normalize && fr.text.trim() && !/[.!?。！？…:;"')\]”’」』»]$/u.test(fr.text.trim()) ? fr.text.trim() + "." : fr.text;
    pv = pivotText({ draft, ask: q.q, material: ps, read: "en" });
    const v = verifyPivot(pv, draft);
    text = pv.text || ""; grade = gradeStated2(q, text, { gap: !text.trim() }); grade.pivotOk = v.ok; grade.pivotDropped = pv.dropped?.length || 0; grade.beforePivot = fr.grade.ok;
  } catch (e) { grade = gradeStated2(q, fr.text, {}); grade.pivotErr = String(e).slice(0, 80); text = fr.text; }
  return { text, grade, ms: fr.ms + Math.round(performance.now() - t0) };
}
export function buildG({ params = PARAMS, ids = null, rows = loadAll(), pivCache = new Map() } = {}) {
  const out = [];
  for (const q of BATTERY) {
    if (ids && !ids.has(q.id)) continue;
    const f = featuresOf(q, rows);
    const dec = escalate(f, params);
    let text = "", grade, ms = 0;
    const t = (a) => rows[a]?.get(q.id)?.ms || 0;
    const order = ["D", "B", "E", "C"];
    if (dec.route === "gap") { grade = gradeStated2(q, "", { gap: true }); ms = 1; }
    else if (!dec.escalate) {
      if (["D", "B", "E", "C"].includes(dec.route)) { for (const a of order) { ms += t(a); if (a === dec.route) break; } } else { for (const a of order) ms += t(a); ms += t(dec.route); }
      const r = rows[dec.route].get(q.id); text = r.text; grade = r.grade;
      if (["C", "S", "A2", "A"].includes(dec.route) && DERIVED.has(f.cue) && !params.allowDerivedSnip) grade = { ok: false, why: "evidence-only: a quoted snippet is not a composed answer", lenientOk: r.grade.ok };
    } else {
      for (const a of order) ms += t(a);
      if (!pivCache.has(q.id)) pivCache.set(q.id, pivoted(q, rows.F.get(q.id)));
      const pc = pivCache.get(q.id); text = pc.text; grade = pc.grade; ms += pc.ms;
    }
    out.push({ id: q.id, rung: q.rung, stage: dec.route, escalated: dec.escalate, why: dec.why, cue: f.cue, text, grade, ms, features: f });
  }
  return out;
}
/** fit tauCov and the per-cue snippet route on a set of question ids: for each cue the arm (or escalation) with the best accuracy on those ids; a mechanical arm wins ties */
export const DERIVED = new Set(["compare", "arithmetic", "negation", "agree"]);   // cues whose answer is COMPOSED from facts: a quoted snippet is evidence, not the answer
export function fit(ids, { arms = ["C"], rows = loadAll(), pivCache = new Map(), allowDerivedSnip = false, trust } = {}) {
  let best = null;
  for (const tau of [0.4, 0.5, 0.6, 0.7, 0.8, 1.0]) {
    const snipRoute = {};
    const cues = [...new Set(BATTERY.filter((q) => ids.has(q.id)).map((q) => cueClass(q.q)))];
    for (const cue of cues) {
      let top = { arm: null, acc: -1 };
      const qs = BATTERY.filter((q) => ids.has(q.id) && cueClass(q.q) === cue);
      if (!qs.length) continue;
      const accOf = (arm) => qs.filter((q) => {
        if (arm !== null && !allowDerivedSnip && DERIVED.has(cue)) return false;
        if (arm === null) { if (!pivCache.has(q.id)) pivCache.set(q.id, pivoted(q, rows.F.get(q.id))); return pivCache.get(q.id).grade.ok; }
        const f = featuresOf(q, rows);
        if (arm === "C") { if (!(f.C?.answered && (cue === "summarise" || (f.C.cov >= tau && f.C.shaped)))) return false; }
        return !!rows[arm].get(q.id)?.grade?.ok;
      }).length / qs.length;
      for (const arm of [...arms, null]) { const a = accOf(arm); if (a > top.acc + 1e-9) top = { arm, acc: a }; }
      if (top.arm && top.acc > 0) snipRoute[cue] = top.arm;
    }
    const r = buildG({ params: { tauCov: tau, snipRoute, allowDerivedSnip, ...(trust ? { trust } : {}) }, ids, rows, pivCache });
    const acc = r.filter((x) => x.grade.ok).length / (r.length || 1);
    if (!best || acc > best.acc + 1e-9) best = { tau, snipRoute, acc };
  }
  return best;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const odd = new Set(), even = new Set(); const per = {};
  for (const q of BATTERY) { per[q.rung] = (per[q.rung] || 0) + 1; (per[q.rung] % 2 ? odd : even).add(q.id); }
  const rows = loadAll(), pivCache = new Map();
  for (const [name, arms, lenient, trust] of [["G", ["C"], false, undefined], ["Gw", ["C", "S", "A2", "A"], false, undefined], ["Gl", ["C", "S", "A2", "A"], true, undefined], ["Gs", [], false, ["D"]]]) {
    const best = fit(odd, { arms, rows, pivCache, allowDerivedSnip: lenient, trust });
    const params = { tauCov: best.tau, snipRoute: best.snipRoute, allowDerivedSnip: lenient, ...(trust ? { trust } : {}) };
    const all = buildG({ params, rows, pivCache });
    fs.writeFileSync(path.join(RESULTS, name + ".jsonl"), all.map((x) => JSON.stringify(x)).join("\n") + "\n");
    fs.writeFileSync(path.join(RESULTS, name + "-params.json"), JSON.stringify({ fit: "odd-indexed questions per rung", tauCov: best.tau, snipRoute: best.snipRoute, oddAcc: best.acc, order: ["cue-route", "D+", "B", "E", "snippet route (fitted per cue)", "F+pivot"] }));
    console.log(name, "fit", JSON.stringify({ tau: best.tau, route: best.snipRoute, oddAcc: +best.acc.toFixed(2) }), "| accuracy odd/even:", all.filter((x) => odd.has(x.id) && x.grade.ok).length + "/" + odd.size, all.filter((x) => even.has(x.id) && x.grade.ok).length + "/" + even.size, "| escalated", all.filter((x) => x.escalated).length, "of", all.length);
  }
}
