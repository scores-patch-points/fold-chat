// eval/pivot/live.mjs — the Pivot with a REAL small model (eval/pivot/PREREG.md, "Live battery"). Node + Ollama only; no browser.
//   node eval/pivot/live.mjs            # run the battery, write eval/pivot/live-results.json, print the table
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pivotText, verifyPivot, readUnits } from "../../fold-chat-pivot.js";
import { sourcesPrompt } from "../../fold-chat-gaps.js";
import * as ground from "../../fold-chat-ground.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.PIVOT_MODEL || "gemma2:2b";
const OLLAMA = process.env.OLLAMA || "http://127.0.0.1:11434";
const TITLES = ["Eiffel Tower", "Canberra", "Spider", "Marie Curie", "Photosynthesis", "Great Wall of China", "Mount Everest", "Penicillin"];
const FOLD = (() => { const src = fs.readFileSync(path.join(HERE, "../../fold-chat.js"), "utf8"); const m = /fold: \{ label: "Fold", system: "((?:[^"\\]|\\.)*)"/.exec(src); return JSON.parse('"' + m[1] + '"'); })();

async function pages() {
  const f = path.join(HERE, "data", "pages.json");
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const out = {};
  for (const t of TITLES) {
    const u = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=0&exchars=2500&redirects=1&format=json&titles=" + encodeURIComponent(t);
    const r = await fetch(u, { headers: { "user-agent": "the-fold-pivot-eval/1.0 (research)" } });
    const j = await r.json(); const p = Object.values(j.query.pages)[0];
    out[t] = { title: p.title, text: p.extract, url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(p.title.replace(/ /g, "_")) };
  }
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  return out;
}
async function chat(system, user) {
  const r = await fetch(OLLAMA + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, stream: false, options: { temperature: 0, num_predict: 400 }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
  return String((await r.json()).message?.content ?? "").trim();
}

// independent oracles on a text
const REFLEX = /(sorry to hear|here'?s what i can tell|no easy answer|i'?m here to listen|based on the information i have|hi there|great question|feel free to|i hope this helps|as an ai|i need more information)/i;
const defects = (t) => ({
  markup: /(\*\*|__|`|^\s*[-*•]\s|^\s*\d+[.)]\s|^\s*#)/m.test(t),
  exclaim: /[!！]/.test(t),
  reflex: REFLEX.test(t),
  manyQuestions: (t.match(/[?？]/g) || []).length > 1,
  fragment: !!t.trim() && /[\p{L}\p{N}]$/u.test(t.trim()),
});
const anyDefect = (d) => Object.values(d).some(Boolean);

const P = await pages();
const sourced = [];
for (const title of TITLES) {
  sourced.push({ id: "S-" + title + "-1", ask: `Tell me about ${title}.`, title });
  sourced.push({ id: "S-" + title + "-2", ask: `What is the most notable fact about ${title}?`, title });
}
const judgment = [
  "My dad died last month and I keep replaying our last argument. I don't know what to do with it.",
  "Should I tell my friend that her husband is cheating, or stay out of it?",
  "I have a job offer that pays 30% more but I'd hate the work. Take it?",
  "Is it wrong to lie to someone to spare their feelings?",
  "I failed the exam I studied a year for and I feel hollow.",
  "Do we owe anything to strangers?",
].map((ask, i) => ({ id: "J" + (i + 1), ask }));

const rows = [];
for (const c of [...sourced, ...judgment]) {
  const isS = !!c.title;
  const mats = isS ? [{ ref: P[c.title].title + " — Wikipedia", source: P[c.title].url, text: P[c.title].text }] : [];
  const system = isS ? FOLD + "\n\n" + sourcesPrompt(mats.map((m) => ({ ref: m.ref, text: m.text }))) : FOLD;
  const draft = await chat(system, c.ask);
  const pv = pivotText({ draft, ask: c.ask, material: mats, requireGrounding: isS, kind: "chat" });
  const ver = verifyPivot(pv, draft);
  const cov = (t) => { if (!isS || !t.trim()) return null; const x = ground.coverage(t, mats); return { grounded: x.grounded, total: x.total, ratio: x.total ? x.grounded / x.total : null }; };
  const uns = (t) => { if (!isS || !t.trim()) return null; const x = ground.unsupportedClaims(t, mats); return x.numbers.length + x.names.length; };
  rows.push({
    id: c.id, sourced: isS, ask: c.ask, draft, spoken: pv.text, stats: pv.stats, gap: pv.gap?.kind || null, verified: ver.ok,
    withheld: pv.dropped.map((d) => ({ why: d.why, text: d.text })),
    rawDefects: defects(draft), spokenDefects: defects(pv.text),
    covRaw: cov(draft), covSpoken: cov(pv.text), unsRaw: uns(draft), unsSpoken: uns(pv.text),
  });
  process.stdout.write(".");
}
console.log();
fs.writeFileSync(path.join(HERE, "live-results.json"), JSON.stringify({ model: MODEL, at: new Date().toISOString(), rows }, null, 1));

// ── the table ──
const S = rows.filter((r) => r.sourced), J = rows.filter((r) => !r.sourced);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const pct = (n, d) => (d ? (100 * n / d).toFixed(0) + "%" : "n/a");
const rawBad = rows.filter((r) => anyDefect(r.rawDefects)).length, spokenBad = rows.filter((r) => anyDefect(r.spokenDefects)).length;
console.log(`cases ${rows.length} (sourced ${S.length}, judgment ${J.length})   model ${MODEL}`);
console.log(`L1 defects (markup/!/reflex/>1 question/fragment): raw ${rawBad}/${rows.length} cases   spoken ${spokenBad}/${rows.length}`);
for (const k of ["markup", "exclaim", "reflex", "manyQuestions", "fragment"]) console.log(`    ${k.padEnd(14)} raw ${rows.filter((r) => r.rawDefects[k]).length}  spoken ${rows.filter((r) => r.spokenDefects[k]).length}`);
console.log(`L2 verifyPivot ok: ${rows.filter((r) => r.verified).length}/${rows.length}`);
const both = S.filter((r) => r.covRaw && r.covSpoken);
console.log(`L3 coverage ratio (sourced, both non-empty n=${both.length}): mean raw ${(sum(both.map((r) => r.covRaw.ratio)) / both.length).toFixed(2)} → spoken ${(sum(both.map((r) => r.covSpoken.ratio)) / both.length).toFixed(2)};  spoken < raw on ${both.filter((r) => r.covSpoken.ratio < r.covRaw.ratio - 1e-9).length} case(s)`);
console.log(`L4 unsupported figures+names: raw total ${sum(S.map((r) => r.unsRaw || 0))} → spoken ${sum(S.map((r) => r.unsSpoken || 0))};  spoken > raw on ${S.filter((r) => (r.unsSpoken || 0) > (r.unsRaw || 0)).length} case(s)`);
console.log(`L5 sourced: withheld ${sum(S.map((r) => r.stats.dropped))}/${sum(S.map((r) => r.stats.in))} sentences (${pct(sum(S.map((r) => r.stats.dropped)), sum(S.map((r) => r.stats.in)))});  nothing_survived ${S.filter((r) => r.gap).length}/${S.length}`);
console.log(`L6 judgment: withheld ${sum(J.map((r) => r.stats.dropped))}/${sum(J.map((r) => r.stats.in))} (${pct(sum(J.map((r) => r.stats.dropped)), sum(J.map((r) => r.stats.in)))});  keep >=2 sentences: ${J.filter((r) => r.stats.kept >= 2).length}/${J.length}`);
const why = {}; for (const r of rows) for (const w of r.withheld) why[w.why.split(":")[0] + (w.why.startsWith("ungrounded") ? ":" + w.why.split(":")[1] : "")] = (why[w.why.split(":")[0] + (w.why.startsWith("ungrounded") ? ":" + w.why.split(":")[1] : "")] || 0) + 1;
console.log("withheld by reason:", JSON.stringify(why));
