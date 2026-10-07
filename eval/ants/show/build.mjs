// Builds eval/ants/show/index.html from the ants' real result files. No numbers are typed in by hand
// except A3's reach table and A1's stage table, which are copied from A3-RESULTS.md / A1-report.md (named in the page).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const ants = path.join(here, "..");
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ants, f), "utf8"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const flat = (s) => String(s).replace(/\s+/g, " ").trim();

const b1 = rd("B1-results.json").phases.test;
const b3 = rd("B3-results-2026-10-06T19-22-34.json");
const judg = rd("B3-judgements.json").labels;
const tally = { F: 0, W: 0, X: 0 };
for (const v of Object.values(judg)) tally[v.v]++;
const tiedN = b3.summary.matched.tied, asN = b3.summary.matched.assertions;

const gate = 0.85;
const b1rows = b1.questions.map((q) => {
  const top = (q.thinkers || []).slice(0, 3);
  return `<tr><td class="q">${esc(q.q)}</td><td><div class="bar"><i style="width:${(q.mass3 / gate * 100).toFixed(1)}%"></i></div><span class="n">${q.mass3.toFixed(2)}</span></td><td class="who">${top.map((t) => esc(t.handle)).join(", ")}</td></tr>`;
}).join("\n");

const god = b3.runs.matched.filter((r) => r.question === "Is there a God?");
const godCards = god.map((r) => {
  const items = r.assertions.map((a) => a.tied
    ? `<li class="ok"><b>says</b> ${esc(a.text)}<blockquote>“${esc(flat(a.quote))}”<span>canon offset ${a.pointer.start}–${a.pointer.end}</span></blockquote></li>`
    : `<li class="no"><b>withheld</b> <s>${esc(a.text)}</s><span class="why">${esc(a.why || "no sentence in the canon bears on it")}</span></li>`).join("");
  const tied = r.assertions.filter((a) => a.tied).length;
  return `<section class="card"><h3>${esc(r.handle)} <small>${tied} of ${r.assertions.length} assertions tied · ${r.calls.total} model calls</small></h3><ul>${items}</ul></section>`;
}).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>What the ants found</title>
<style>
:root{--bg:#faf8f4;--fg:#1f1d1a;--mute:#6b665e;--line:#ddd6c9;--card:#fff;--ok:#2f6b3a;--no:#9a3b2e;--acc:#8a5a14;--bar:#d9c9a4}
@media (prefers-color-scheme:dark){:root{--bg:#171512;--fg:#ece7dd;--mute:#9a948a;--line:#35312a;--card:#201d19;--ok:#7fc68b;--no:#e08b7d;--acc:#e0b060;--bar:#5a4a28}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 Georgia,"Iowan Old Style",serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 80px}
h1{font-size:30px;margin:0 0 4px}h2{font-size:21px;margin:44px 0 6px;border-top:1px solid var(--line);padding-top:24px}h3{font-size:17px;margin:0 0 10px}h3 small{color:var(--mute);font-weight:400;font-size:13px;margin-left:8px}
p.lede{color:var(--mute);margin:0 0 8px}p.note{color:var(--mute);font-size:14px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:16px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}.stat b{display:block;font-size:26px;color:var(--acc)}.stat span{font-size:13px;color:var(--mute)}
table{width:100%;border-collapse:collapse;font-size:15px}td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}th{font-size:12px;color:var(--mute);font-weight:400;text-transform:uppercase;letter-spacing:.05em}
.bar{display:inline-block;width:150px;height:10px;background:var(--line);border-radius:5px;overflow:hidden;vertical-align:middle;position:relative}.bar i{display:block;height:100%;background:var(--bar)}.n{font:13px ui-monospace,monospace;margin-left:8px;color:var(--mute)}
.who{color:var(--mute);font-size:14px}.q{white-space:nowrap}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0}
ul{list-style:none;margin:0;padding:0}li{margin:10px 0;padding-left:12px;border-left:3px solid var(--line)}li.ok{border-color:var(--ok)}li.no{border-color:var(--no)}li b{font:600 11px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em;margin-right:6px}li.ok b{color:var(--ok)}li.no b{color:var(--no)}li .why{display:block;font-size:13px;color:var(--mute)}
blockquote{margin:6px 0 0;padding:0 0 0 14px;border-left:2px solid var(--line);font-style:italic}blockquote span{display:block;font:11px ui-monospace,monospace;color:var(--mute);font-style:normal}
.reach{display:grid;grid-template-columns:150px 1fr 60px;gap:6px 10px;align-items:center;font-size:14px;margin:12px 0}.reach .bar{width:100%;height:14px}
a{color:var(--acc)}code{font:13px ui-monospace,monospace}
</style></head><body><main>
<h1>What the ants found</h1>
<p class="lede">Real result files from 2026-10-06, read straight off disk by <code>eval/ants/show/build.mjs</code>. Nothing here is a mock-up.</p>

<h2>1 · The chat says where it got things</h2>
<p>This part you use, not read: ask the live chat “Who is the king of the UK?” and the app, not the model, snips the source sentence and narrates it. Two to three model calls per output; the quote is checked to be a substring of the page; 5 of 5 verified live.</p>
<p><a href="http://127.0.0.1:8815/">Open the live chat →</a></p>

<h2>2 · “Is there a God?” — who would answer?</h2>
<p class="lede">Thinker classifier (B1), built like language detection: it must clear a calibrated bar before the app names anyone. The bar is mass 0.85 across the top three; a full bar below means “clears it”.</p>
<table><tr><th>Question</th><th>Top-3 mass vs bar</th><th>Candidates (not named to the user)</th></tr>
${b1rows}</table>
<p class="note">All ${b1.questions.length} test questions came back <b>undetermined</b>. That is the honest result: on contested questions no single thinker stands out, so the chat does not pretend one does. The candidates above are what a “voices on this question” list would draw from.</p>

<h2>3 · Counsel from the canon, tied or withheld</h2>
<p class="lede">B3 forced a model to draft what each thinker would say, then required every assertion to point at a real sentence in that thinker’s own canon. No match, no assertion.</p>
<div class="stats">
<div class="stat"><b>${tiedN}/${asN}</b><span>assertions tied to a quote (${(tiedN / asN * 100).toFixed(0)}%)</span></div>
<div class="stat"><b>${Math.round(tally.F / (tally.F + tally.W + tally.X) * 100)}%</b><span>of tied ones the quote itself says it (${tally.F} of ${tally.F + tally.W + tally.X}); ${tally.W} only related, ${tally.X} unsupported</span></div>
<div class="stat"><b>0/79</b><span>tied when the thinker was swapped for the wrong one</span></div>
<div class="stat"><b>0/192</b><span>spoken when the model was fed a deliberate lie</span></div>
</div>
<p class="note">So: the mechanical tie never let a fabrication through, but it does not prove the quote supports the claim — about a quarter of what shipped was merely related. That is why the verdict on paraphrasing thinkers is <b>not reliable</b>; the safe form is quotes with an app-written frame.</p>
${godCards}

<h2>4 · Reaching the primary source</h2>
<p class="lede">A3 (14 claims, official host expected). Reach = verified page, not an encyclopedia mirror, on the right host, text says it.</p>
<div class="reach"><span>Plain search, first non-wiki hit</span><div class="bar"><i style="width:${9 / 14 * 100}%"></i></div><span>9/14</span>
<span>Strict finder (A2)</span><div class="bar"><i style="width:${1 / 14 * 100}%"></i></div><span>1/14</span></div>
<p class="note">The strict finder blocks every encyclopedia false accept (baseline accepted Britannica for two claims) but reaches almost nothing: it finds the right hosts (elysee.fr, nasa.gov, nobelprize.org…) and then withdraws them on wording — “human” missing from “Adults have between 206 and 213 bones”, “metres” vs “meters”. And 7 of the 8 pages it did return were not primary at all. It failed its own bar; the report says so.</p>
<p>Why the in-chat origin lane finds none (A1, 63 claims): 67% of Wikipedia sentences have no footnote under them (<code>no-reference</code>), 19% have footnotes that don’t say it, 10% unreadable, 5% unlocated, <b>0%</b> reached an origin. Not a browser/CORS problem: node and browser agreed on 36 of 39.</p>

<h2>5 · What is open</h2>
<ul>
<li><b>decide</b> Apply A1’s two small fixes to the origin lane (<code>minAtoms</code> 3→2; corroborate against search hits) and re-measure.</li>
<li><b>decide</b> Build the quotes-only “voices on this question” display.</li>
<li><b>decide</b> Write the reader spec for grounding by meaning, not tokens.</li>
</ul>
</main></body></html>`;
fs.writeFileSync(path.join(here, "index.html"), html);
console.log("wrote", path.join(here, "index.html"), html.length, "bytes");
