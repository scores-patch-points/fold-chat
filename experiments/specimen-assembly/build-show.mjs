// build-show.mjs — turn out/pages-results.json into out/show/index.html: a single static page that replays the
// run (pool, each cut, the result, the holons, the void and the ask) with the real pages live in iframes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const res = JSON.parse(fs.readFileSync(path.join(HERE, "out", "pages-results.json"), "utf8"));
const data = { ...res.show, finalObs: res.criteria.T2.evidence.finalObligations, criteria: Object.fromEntries(Object.entries(res.criteria).map(([k, v]) => [k, { verdict: v.verdict, checks: v.checks.map((c) => ({ name: c.name, ok: c.ok, detail: String(c.detail || "").slice(0, 200) })) }])), t8: res.criteria.T8 && res.criteria.T8.evidence, t7: res.criteria.T7 && res.criteria.T7.evidence, run: { startedAt: res.startedAt, preregMatches: res.pagesMatchesPrereg } };
const json = JSON.stringify(data).replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join(" ").split(String.fromCharCode(0x2029)).join(" ");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Assembly demo</title>
<style>
:root{--bg:#f6f7f9;--fg:#1c2230;--muted:#667086;--card:#fff;--line:#d9dde6;--ok:#17803d;--bad:#b42318;--warn:#a15c07;--accent:#2f5fd0;--code:#f0f2f6}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#11141b;--fg:#e7eaf2;--muted:#9aa3b8;--card:#1a1f2a;--line:#2b3242;--ok:#4cc27a;--bad:#ff7b72;--warn:#e3a94b;--accent:#8fb0ff;--code:#222938}}
:root[data-theme=dark]{--bg:#11141b;--fg:#e7eaf2;--muted:#9aa3b8;--card:#1a1f2a;--line:#2b3242;--ok:#4cc27a;--bad:#ff7b72;--warn:#e3a94b;--accent:#8fb0ff;--code:#222938}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:1120px;margin:0 auto;padding:20px 16px 64px}h1{font-size:1.5rem;margin:.2em 0}h2{font-size:1.15rem;margin:0 0 4px}
.lead{color:var(--muted);margin:0 0 18px}.ask{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);padding:10px 14px;border-radius:8px;font-size:.95rem}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:18px 0}.sub{color:var(--muted);margin:0 0 12px;font-size:.92rem}
table{border-collapse:collapse;width:100%;font-size:.85rem}th,td{padding:5px 6px;border-bottom:1px solid var(--line);text-align:center}th{font-weight:600;color:var(--muted);vertical-align:bottom}
th.rot div{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;margin:0 auto}td:first-child,th:first-child{text-align:left}
.y{color:var(--ok)}.n{color:var(--bad)}tr.pick td{background:color-mix(in srgb,var(--ok) 10%,transparent);font-weight:600}
.cols{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:18px;align-items:start}@media(max-width:900px){.cols{grid-template-columns:1fr}}
.phone{width:100%;max-width:416px;border:1px solid var(--line);border-radius:22px;padding:10px;background:#0002;margin:0 auto}.phone iframe{width:100%;height:560px;border:0;border-radius:14px;background:#fff;display:block}
.ctl{display:flex;gap:10px;align-items:center;margin:8px 0}.ctl input[type=range]{flex:1}button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--fg);padding:6px 12px;border-radius:8px;cursor:pointer}button:hover{border-color:var(--accent)}
.bar{height:10px;background:var(--code);border-radius:6px;overflow:hidden}.bar i{display:block;height:100%;background:var(--accent);transition:width .15s}
.note{font-family:ui-monospace,Menlo,monospace;font-size:.82rem;background:var(--code);padding:8px 10px;border-radius:8px;min-height:2.6em;word-break:break-all}
.log{max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:8px;font-family:ui-monospace,Menlo,monospace;font-size:.78rem}.log div{padding:3px 8px;border-bottom:1px solid var(--line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.log .cut{color:var(--ok)}.log .kept{color:var(--muted)}.log .on{background:color-mix(in srgb,var(--accent) 18%,transparent)}
.kv{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:.88rem}.kv b{color:var(--muted);font-weight:500}.mono{font-family:ui-monospace,Menlo,monospace;font-size:.8rem;word-break:break-all}
.tag{display:inline-block;padding:1px 8px;border-radius:99px;font-size:.78rem;border:1px solid var(--line);margin-right:4px}.held{color:var(--ok);border-color:var(--ok)}.void{color:var(--bad);border-color:var(--bad)}.partial{color:var(--warn);border-color:var(--warn)}
ul.tree{list-style:none;margin:0;padding-left:18px;border-left:1px solid var(--line)}ul.tree.root{padding-left:0;border:0}ul.tree li{margin:5px 0}.say{color:var(--muted);font-size:.85rem}
.atoms{margin:2px 0 0 4px;font-family:ui-monospace,Menlo,monospace;font-size:.74rem;color:var(--muted)}.atoms span{display:inline-block;background:var(--code);border-radius:5px;padding:0 6px;margin:2px 3px 0 0;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
.card{border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0;background:var(--bg)}.card h3{margin:0 0 6px;font-size:1rem}pre{background:var(--code);padding:10px;border-radius:8px;overflow:auto;font-size:.78rem;max-height:340px;margin:6px 0}
details>summary{cursor:pointer;color:var(--accent)}.score{font-variant-numeric:tabular-nums}.small{font-size:.82rem;color:var(--muted)}
.crit{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:.85rem}.crit .v{font-weight:600}
</style></head><body><main>
<h1>Assembly demo — the tip calculator, model off</h1>
<p class="lead">Nothing here is written by a model, and nothing is written at all: a page that already does the job is found, then <b>bytes are deleted</b> until only what the checks need is left. Every check is a real Chromium driving the page.</p>
<div class="ask" id="ask"></div>

<section><h2>1 · The pool, judged in a browser</h2><p class="sub">Five pages written for this test. Eleven behaviours checked on each: a ✓ means Chromium saw the page do it.</p><div id="pool"></div></section>

<section><h2>2 · Cutting by subtraction</h2><p class="sub" id="cutsub"></p>
<div class="cols"><div>
 <div class="ctl"><button id="play">▶ Play</button><input id="slider" type="range" min="0" value="0"><span id="stepno" class="score"></span></div>
 <div class="bar"><i id="barfill"></i></div><p class="small" id="bytes"></p>
 <div class="note" id="note"></div>
 <h3 style="font-size:.95rem;margin:12px 0 4px">Every decision, in order <span class="small">(green = cut, grey = kept because a check would fail)</span></h3>
 <div class="log" id="log"></div>
</div><div class="phone"><iframe id="frame" sandbox="allow-scripts" title="page at this step"></iframe></div></div></section>

<section><h2>3 · The result — try it</h2><p class="sub">This is the page left after the last cut. It is live: type a bill, press a tip, change the people.</p>
<div class="cols"><div><div class="kv" id="receipt"></div><h3 style="font-size:.95rem;margin:14px 0 4px">Obligations on the result</h3><div class="crit" id="finalobs"></div>
<details style="margin-top:10px"><summary>The receipt's deletions</summary><div class="log" id="edits" style="margin-top:6px"></div></details>
<details style="margin-top:6px"><summary>The page's source</summary><pre id="src"></pre></details></div>
<div class="phone"><iframe id="final" sandbox="allow-scripts" title="the assembled page"></iframe></div></div></section>

<section><h2>4 · Holons — which part holds up what (marks, not names)</h2><p class="sub">Each surviving piece was deleted alone; the checks that then failed say which holon it belongs to.</p><div id="holons"></div></section>

<section><h2>5 · The void, defined</h2><p class="sub" id="voidsub"></p><div id="void"></div></section>

<section><h2>6 · What was pre-registered, and what happened</h2><p class="sub" id="critsub"></p><div id="crit"></div></section>
</main>
<script id="data" type="application/json">${json}</script>
<script>
const D = JSON.parse(document.getElementById("data").textContent);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
$("ask").textContent = "The ask: " + D.ask;
const OB = Object.keys(D.pool[0].results);
// 1 pool
$("pool").innerHTML = '<table><tr><th>specimen</th><th>bytes</th>' + OB.map((o) => '<th class="rot"><div>' + esc(o.replace("P-", "")) + '</div></th>').join("") + '<th>held</th></tr>' +
  D.pool.map((r) => '<tr class="' + (r.name === D.chosen.name ? "pick" : "") + '"><td>' + esc(r.name) + (r.name === D.chosen.name ? " ← chosen" : "") + '</td><td>' + r.bytes + '</td>' + OB.map((o) => '<td class="' + (r.results[o].pass ? "y" : "n") + '" title="' + esc(r.results[o].detail) + '">' + (r.results[o].pass ? "✓" : "✗") + '</td>').join("") + '<td class="score">' + r.passed + '/' + OB.length + '</td></tr>').join("") + '</table>' +
  '<p class="small">The chosen page does all eleven, so it is a superset of the ask; the others are too small or about something else. Hover a ✗ to see what the browser observed.</p>';
// 2 cuts
const S = D.states; const first = S[0].bytes;
$("cutsub").textContent = "Start from " + D.chosen.name + " (" + first + " bytes). Try deleting each piece, largest first. Keep the deletion if all eleven checks still pass. Repeat until nothing more can go.";
const slider = $("slider"); slider.max = S.length - 1;
const cuts = D.ledger;
function show(i) {
  const s = S[i]; slider.value = i;
  $("frame").srcdoc = s.html; $("stepno").textContent = "step " + i + " / " + (S.length - 1);
  $("barfill").style.width = (100 * s.bytes / first) + "%";
  $("bytes").textContent = s.bytes + " bytes — " + Math.round(100 * (1 - s.bytes / first)) + "% removed so far";
  $("note").textContent = s.note;
  const rows = [...$("log").children]; rows.forEach((r) => r.classList.remove("on"));
  const target = rows.filter((r) => r.classList.contains("cut"))[i - 1]; if (target) { target.classList.add("on"); target.scrollIntoView({ block: "nearest" }); }
}
$("log").innerHTML = cuts.map((e) => '<div class="' + e.kind + '" title="' + esc(e.what) + '">' + (e.kind === "cut" ? "✂ cut  " : "· kept ") + esc(e.what) + '</div>').join("");
slider.oninput = () => show(+slider.value);
let timer = null;
$("play").onclick = () => { if (timer) { clearInterval(timer); timer = null; $("play").textContent = "▶ Play"; return; } if (+slider.value >= S.length - 1) show(0); $("play").textContent = "❚❚ Pause"; timer = setInterval(() => { const n = +slider.value + 1; if (n >= S.length) { clearInterval(timer); timer = null; $("play").textContent = "▶ Play"; return; } show(n); }, 350); };
show(0);
// 3 result
$("final").srcdoc = D.finalHtml; $("src").textContent = D.finalHtml;
const r = D.receipt;
$("receipt").innerHTML = '<b>from</b><span>' + esc(D.chosen.name) + '</span><b>bytes</b><span>' + r.in.bytes + ' → ' + r.out.bytes + ' (' + Math.round(100 * (1 - r.out.bytes / r.in.bytes)) + '% smaller)</span><b>written by a model</b><span>0 bytes (generated bytes = ' + r.generatedBytes + ')</span><b>deletions</b><span>' + r.edits.length + ' byte ranges</span><b>sha256 in</b><span class="mono">' + r.in.sha256.slice(0, 24) + '…</span><b>sha256 out</b><span class="mono">' + r.out.sha256.slice(0, 24) + '…</span><b>re-derivable</b><span>applying the deletions to the original gives the output exactly (checked)</span>';
const fin = D.pool.find((p) => p.name === D.chosen.name);
$("finalobs").innerHTML = OB.map((o) => { const f = D.finalObs[o]; return '<span class="' + (f.pass ? "y" : "n") + '">' + (f.pass ? "✓" : "✗") + '</span><span>' + esc(o) + ' <span class="small">— ' + esc(f.detail) + '</span></span>'; }).join("");
$("edits").innerHTML = r.edits.map((e) => '<div title="' + esc(e.preview) + '">' + e.start + '–' + e.end + ' (' + e.bytes + ' B)  ' + esc(e.preview) + '</div>').join("");
// 4 holons
const holonAtoms = D.byHolon;
function treeHtml(n, atoms) {
  const own = (atoms[n.id] || []).filter((a) => a.leaf);
  const st = '<span class="tag ' + n.status + '">' + n.status + '</span>';
  let h = '<li><b>' + esc(n.id) + '</b> ' + st + ' <span class="say">' + esc(n.say || "") + '</span>';
  if (n.obligations) h += '<div class="small">' + n.obligations.map((o) => (o.pass ? "✓ " : "✗ ") + esc(o.id)).join(" · ") + '</div>';
  if (atoms && own.length) h += '<div class="atoms">' + own.slice(0, 14).map((a) => '<span title="' + esc(a.label) + '">' + esc((a.kind === "html" ? "" : "") + a.label) + '</span>').join("") + (own.length > 14 ? " +" + (own.length - 14) + " more" : "") + '</div>';
  if (n.children) h += '<ul class="tree">' + n.children.map((c) => treeHtml(c, atoms)).join("") + '</ul>';
  return h + '</li>';
}
$("holons").innerHTML = '<ul class="tree root">' + treeHtml(D.tree, holonAtoms) + '</ul>' + '<p class="small">Pieces shown under a holon are the leaf pieces of the result whose single deletion broke one of that holon\\'s checks. A piece that breaks checks of two holons appears under both.</p>';
// 5 void
const V = D.void;
$("voidsub").textContent = "Take the superset away. No page in the pool does the job; the nearest is " + V.nearest.name + " (" + V.nearest.passed + "/" + OB.length + "). Here is exactly what is missing, holon by holon — and the only thing a model would ever be shown.";
const vt = V.def.tree;
function vtree(n) {
  let h = '<li><b>' + esc(n.id) + '</b> <span class="tag ' + n.status + '">' + n.status + '</span> <span class="say">' + esc(n.say || "") + '</span>';
  if (n.obligations) h += '<div class="small">' + n.obligations.map((o) => (o.pass ? "✓ " : "✗ ") + esc(o.id)).join(" · ") + '</div>';
  if (n.children) h += '<ul class="tree">' + n.children.map(vtree).join("") + '</ul>';
  return h + '</li>';
}
let vh = '<div class="cols"><div><ul class="tree root">' + vtree(vt) + '</ul></div><div class="phone"><iframe id="vframe" sandbox="allow-scripts" title="nearest page"></iframe></div></div>';
vh += V.def.voids.map((v) => '<div class="card"><h3>void: ' + esc(v.holon) + ' <span class="tag ' + v.status + '">' + v.status + '</span></h3><div class="say">path: ' + esc(v.path.join(" › ")) + ' — ' + esc(v.say) + '</div>' +
  '<div class="kv" style="margin-top:6px"><b>unmet</b><span>' + v.unmet.map((u) => esc(u.obligation) + ' — ' + esc(u.scenario) + ' <span class="small">(observed: ' + esc(u.observed) + ')</span>').join("<br>") + '</span>' +
  '<b>needs from neighbours</b><span>' + (v.suppliers.length ? v.suppliers.map((s) => esc(s.holon) + ' gives ' + esc(s.gives) + ' <span class="tag ' + s.status + '">' + s.status + '</span>' + (s.element ? ' <span class="mono">' + esc(s.element) + '</span>' : "")).join("<br>") : "nothing") + '</span>' +
  '<b>who needs it</b><span>' + (v.consumers.length ? v.consumers.map((c) => esc(c.holon) + ' needs ' + esc(c.needs)).join("<br>") : "nobody") + '</span>' +
  '<b>attaches at</b><span>' + (v.seam.length ? v.seam.map((s) => '<span class="mono">' + s.start + '–' + s.end + '</span> ' + esc(s.text)).join("<br>") : "(no seam found)") + '</span></div></div>').join("");
vh += '<h3 style="font-size:1rem">The asks, one per void, in dependency order</h3><p class="small">Each carries only its own path, contract, neighbours, seam and scenarios — not the page. They are passed through the de-identifier and the local PII redactor first; if it cannot be reached, nothing is sent.</p>';
vh += V.asks.map((a, i) => { const m = D.masked[i] || {}; return '<div class="card"><h3>' + esc(a.path.join(" › ")) + '</h3><div class="small">door: ' + (m.notSent ? '<span class="n">not sent — ' + esc(m.error) + '</span>' : m.viaRedactor ? '<span class="y">passed through the redactor</span> in ' + m.passes + ' pass(es); fields changed by masking: <b>' + (m.changes ? m.changes.length : "?") + '</b>' : "not evaluated") + '</div><details><summary>the ask (' + JSON.stringify(a).length + ' characters)</summary><pre>' + esc(JSON.stringify(a, null, 2)) + '</pre></details></div>'; }).join("");
$("void").innerHTML = vh; $("vframe").srcdoc = V.nearestHtml;
// 6 criteria
$("critsub").textContent = "Criteria were written and hashed (PAGES.md) before the official run. " + (D.run.preregMatches ? "The file still matches its hash." : "The file does NOT match its hash.");
$("crit").innerHTML = Object.entries(D.criteria).map(([k, c]) => '<div class="card"><h3>' + k + ' <span class="tag ' + (c.verdict === "PASS" ? "held" : c.verdict === "FALSIFIED" ? "void" : "partial") + '">' + esc(c.verdict) + '</span></h3><div class="crit">' + c.checks.map((x) => '<span class="' + (x.ok === true ? "y" : x.ok === false ? "n" : "") + '">' + (x.ok === true ? "✓" : x.ok === false ? "✗" : "–") + '</span><span>' + esc(x.name) + (x.detail ? ' <span class="small">— ' + esc(x.detail) + '</span>' : "") + '</span>').join("") + '</div></div>').join("") +
  '<div class="card"><h3>T7 — the screenshot extractor, for the record</h3><div class="small">khora\\'s screenshot-to-HTML on a screenshot of the superset passes ' + (D.t7 && D.t7.passed ? D.t7.passed.length : "?") + ' of 11: ' + esc((D.t7 && D.t7.passed || []).join(", ")) + '. It recovers words and layout, not controls or behaviour.</div></div>';
</script></body></html>`;
fs.mkdirSync(path.join(HERE, "out", "show"), { recursive: true });
fs.writeFileSync(path.join(HERE, "out", "show", "index.html"), html);
console.log("wrote out/show/index.html", html.length, "bytes");
