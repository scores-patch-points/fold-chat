// eval/freshness/e2e-freshness.mjs — the freshness note in the REAL page. Two turns, the same ask, the model and the web stubbed (as fold-e2e-pivot.mjs does).
// Turn 2 re-reads the page: CONTROL leaves it unchanged (conjecture: NO note), CHANGED adds a paragraph above it (conjecture: ONE note, "Earlier citations
// have moved", and the stored answer is not rewritten). Verdicts: STANDS · FALSIFIED (the evidence quoted) · UNMEASURED if the harness could not reach a
// second web turn (never a pass).
//   node eval/freshness/e2e-freshness.mjs       # against FOLD_URL (default http://127.0.0.1:8814/)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_ = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const src = fs.readFileSync(path.join(HERE, "../../fold-e2e-pivot.mjs"), "utf8");
const EIFFEL = new Function("return (" + /const EIFFEL = (\{[^\n]*\});/.exec(src)[1] + ")")();
const sse = (text) => text.split(/(?<=\s)/).map((t) => "data: " + JSON.stringify({ choices: [{ delta: { content: t } }] }) + "\n\n").join("") + "data: [DONE]\n\n";
const DRAFT = "The Eiffel Tower is a wrought-iron lattice tower in Paris, France.";
const ASK = "Tell me about the Eiffel Tower";
const NOTE = /Earlier citations have moved/;

async function run(changeAtTurn2) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  let text = EIFFEL.text, pageReads = 0;
  const cors = { "access-control-allow-origin": "*" };
  await page.route("**/v1/chat/completions", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(DRAFT) }));
  await page.route(/wikipedia\.org\/w\/api\.php/, (route) => {
    const u = route.request().url();
    if (/list=search/.test(u)) return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ query: { search: [{ title: EIFFEL.title, snippet: text.slice(0, 120), wordcount: 5000 }] } }) });
    if (/prop=extracts/.test(u)) { pageReads++; return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ query: { pages: { 1: { title: EIFFEL.title, extract: text } } } }) }); }
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: "{}" });
  });
  const wikiUrl = "https://en.wikipedia.org/wiki/Eiffel_Tower";
  await page.route(/(workers\.dev|duckduckgo|brave\.com|api\.github\.com|archive\.org|openalex\.org|crossref\.org|r\.jina\.ai|allorigins|corsproxy|microlink)/, (r) => /workers\.dev/.test(r.request().url())
    ? r.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ engine: "stub", results: [{ title: EIFFEL.title + " - Wikipedia", url: wikiUrl, snippet: text.slice(0, 160) }] }) })
    : r.abort());
  await page.route(/127\.0\.0\.1:8790\/api\/(search|page)/, (r) => r.abort());
  const send = async (q) => {
    await page.fill("#input", q); await page.click("#send");
    await page.waitForTimeout(1200);
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled && !i.readOnly && i.getAttribute("aria-busy") !== "true" && !/stop/i.test(document.getElementById("send")?.getAttribute("aria-label") || document.getElementById("send")?.textContent || ""); }, undefined, { timeout: 120000 });
    await page.waitForTimeout(800);
  };
  const body = () => page.evaluate(() => document.body.textContent);
  const claims = () => page.evaluate(() => { const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; return (s.claims || []).map((c) => ({ id: c.id, support: c.basis?.support || null, cited: c.basis?.cited ?? null })); });
  const out = {};
  try {
    await page.goto(URL_, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
    await send(ASK);
    out.turn1 = { noteShown: NOTE.test(await body()), reads: pageReads, claims: (await claims()).length };
    if (changeAtTurn2) text = "An editor added this opening paragraph above everything else.\n\n" + text;
    // The chat memoizes pages in memory for the life of the page (fold-chat.js pageMemo), so within one load a page is never read twice. The real case is a
    // saved session reopened later: reload (a fresh memo; the session and its claims stay in localStorage), then ask again.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
    await send(ASK);
    const b2 = await body();
    out.turn2 = { noteShown: NOTE.test(b2), reads: pageReads, claims: (await claims()), note: (/Earlier citations have moved[^\n]*\n?[^\n]*/.exec(b2) || [null])[0] };
  } finally { await browser.close(); }
  return out;
}

const control = await run(false), changed = await run(true);
const reached = (r) => r.turn2.reads > r.turn1.reads && r.turn1.claims > 0;
const verdict = !reached(control) || !reached(changed) ? "UNMEASURED" : (!control.turn2.noteShown && changed.turn2.noteShown && !changed.turn1.noteShown) ? "STANDS" : "FALSIFIED";
console.log(JSON.stringify({ control, changed }, null, 1).slice(0, 2500));
console.log(`\nfreshness note in the real page: ${verdict}`);
console.log(`  control (page unchanged at turn 2): note shown = ${control.turn2.noteShown}   [want false]`);
console.log(`  changed (paragraph added above):    note shown = ${changed.turn2.noteShown}   [want true]`);
if (verdict === "UNMEASURED") console.log("  the second turn did not re-read the page, or turn 1 stored no claims: the harness did not reach what it tests.");
fs.writeFileSync(path.join(HERE, "e2e-freshness-results.json"), JSON.stringify({ at: new Date().toISOString(), verdict, control, changed }, null, 1));
process.exit(verdict === "STANDS" ? 0 : 1);
