// eval/pivot/show/build.mjs — turn eval/pivot/live-results.json (REAL gemma2:2b drafts) into one static page that shows, per ask,
// what the model wrote and what would be spoken, with every withheld sentence marked where it stood and the reason beside it.
//   node eval/pivot/show/build.mjs && python3 -m http.server 8818 --bind 127.0.0.1 --directory eval/pivot/show
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pivotText, standingLine, verifyPivot } from "../../../fold-chat-pivot.js";
import { noteRun, report, loadLedger, PIVOT_GATES } from "../../../fold-chat-gates.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const live = JSON.parse(fs.readFileSync(path.join(HERE, "../live-results.json"), "utf8"));
const pages = JSON.parse(fs.readFileSync(path.join(HERE, "../data/pages.json"), "utf8"));
const WHY = { no_words: "no words, only a mark or emoji", label: "a lead-in line, not a sentence", boilerplate: "stock chat reflex", third_person: "talks about “the person”, not to them", number_not_given: "a figure nobody gave", question: "a question barrage", truncated: "cut off mid-sentence", attribution: "an attribution no source made", empty: "empty" };
const whyText = (w) => w.startsWith("ungrounded") ? "no source says this" : (WHY[w] || w);

const mem = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)) }; })();
const cases = live.rows.map((r) => {
  const title = r.sourced ? Object.values(pages).find((p) => r.ask.includes(p.title))?.title : null;
  const mats = title ? [{ ref: title + " — Wikipedia", source: pages[title].url, text: pages[title].text }] : [];
  const pv = pivotText({ draft: r.draft, ask: r.ask, material: mats, requireGrounding: r.sourced, kind: "chat", experiencer: { who: live.model, read: "live-draft:" + r.id } });
  noteRun(pv, { verified: verifyPivot(pv, r.draft).ok, at: 0, storage: mem });
  // the draft cut into runs: kept / withheld (with reason) / glue — offsets slice back into the draft
  const marks = pv.dropped.map((d) => ({ start: d.start, end: d.end, why: whyText(d.why), code: d.why })).sort((a, b) => a.start - b.start);
  const runs = []; let pos = 0;
  for (const m of marks) { if (m.start > pos) runs.push({ t: r.draft.slice(pos, m.start) }); runs.push({ t: r.draft.slice(m.start, m.end), why: m.why }); pos = m.end; }
  if (pos < r.draft.length) runs.push({ t: r.draft.slice(pos) });
  return { id: r.id, ask: r.ask, sourced: r.sourced, source: title ? { title, url: pages[title].url } : null, runs, spoken: pv.text, gap: pv.gap?.kind || null, stats: pv.stats, standing: standingLine(pv), edits: [...new Set([...pv.units.flatMap((u) => u.edits.map((e) => e.split(":")[0])), ...(pv.felt?.paragraphed ? ["paragraphs at Murch's blink points"] : [])])] };
});
const html = fs.readFileSync(path.join(HERE, "template.html"), "utf8").replace("/*DATA*/null", JSON.stringify({ model: live.model, at: live.at, cases, gates: report(loadLedger(mem)).map((g) => ({ gate: g.gate, verdict: g.verdict, runs: g.cumulative.runs, rejected: g.cumulative.rejected })) }).replace(/</g, "\\u003c"));
fs.writeFileSync(path.join(HERE, "index.html"), html);
console.log("wrote", path.join(HERE, "index.html"), cases.length, "cases");
