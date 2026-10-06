// fold-e2e-foldview.mjs — the Fold viewer in a real browser: three tabs, a live log, real diffs, per-line authorship.
import { chromium } from "/private/tmp/fold-e2e/node_modules/playwright/index.mjs";
const URL = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const SHOTS = process.env.SHOTS || "/private/tmp/claude-501/-Users-mlacy-Documents-3-0-the-fold/15dae887-0b2d-47ae-beb8-a1593b0ff362/scratchpad/fold-shots";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 640, height: 900 } })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e.message) + " @ " + String(e.stack).split("\n").slice(1, 4).join(" ⏎ ")));
await page.goto(URL + "README.md", { waitUntil: "domcontentloaded" });          // a script-free same-origin page
await page.evaluate(async () => {
  document.body.innerHTML = '<div id="host" style="max-width:560px;margin:12px"></div>';
  const F = await import("/fold-chat-fold.js?" + Date.now()); const V = await import("/fold-chat-foldview.js?" + Date.now());
  const fold = F.createFold({ task: "a counter" });
  window.__fold = fold; window.__F = F;
  const PEN = { kind: "penelope" }, REM = { kind: "remote", model: "openai-fast" };
  window.__resets = [];
  const v = V.mountFold(document.getElementById("host"), fold, { live: true, onReset: (r) => window.__resets.push(r && { round: r.version.round, code: r.version.code, partial: r.version.partial, index: r.index }) });
  window.__v = v;
  F.addEvent(fold, { type: "read", referents: 0, relations: 0, gaps: 0 }); F.addEvent(fold, { type: "requirements", terms: ["increment", "decrement", "reset"] }); v.update();
  F.addVersion(fold, { round: 1, maker: PEN, kind: "js", code: "function counter() {\n  let n = 0;\n  return n;\n}\n\nexport function increment() {\n  return 1;\n}", units: ["counter", "increment"], activity: [{ tool: "swarm", status: "done", title: "counter" }, { tool: "field", status: "done", title: "counter" }, { tool: "mouth", status: "done", title: "increment" }, { tool: "gate", status: "passed", title: "spec-conformant" }] });
  F.addEvent(fold, { type: "check", round: 1, name: "loads without errors", ok: false, detail: "SyntaxError: Unexpected token 'export' (line 6)" });
  F.addEvent(fold, { type: "derive", round: 1, ok: false, refuted: 2, held: 0 });
  F.addEvent(fold, { type: "repair", round: 2, findings: ["You asked for a web page, but the answer was a script", "The page is blank"] });
  F.addEvent(fold, { type: "escalate", round: 2, why: "stuck", reason: "the same problems came back after a repair" });
  F.addVersion(fold, { round: 2, maker: REM, kind: "html", code: '<!doctype html>\n<title>Counter</title>\n<div id="n">0</div>\n<button id="inc">Increment</button>\n<button id="dec">Decrement</button>\n<script>\nvar n = 0;\ninc.onclick = function () { n++; show(); };\n</script>' });
  F.addEvent(fold, { type: "check", round: 2, name: "controls respond", ok: false, detail: "Clicking “Decrement” causes an error: show is not defined" }); v.update();
  F.addVersion(fold, { round: 3, maker: REM, kind: "html", code: '<!doctype html>\n<title>Counter</title>\n<div id="n">0</div>\n<button id="inc">Increment</button>\n<button id="dec">Decrement</button>\n<button id="rst">Reset</button>\n<script>\nvar n = 0;\nfunction show() { document.getElementById("n").textContent = n; }\ninc.onclick = function () { n++; show(); };\ndec.onclick = function () { n = Math.max(0, n - 1); show(); };\nrst.onclick = function () { n = 0; show(); };\n</script>' });
  F.addEvent(fold, { type: "check", round: 3, name: "controls respond", ok: true, detail: "clicked 3" });
  F.addEvent(fold, { type: "done", ok: true, rounds: 3, passed: 3 }); v.update();
});
const out = {};
const shot = async (name) => { await page.locator(".fv").screenshot({ path: `${SHOTS}/${name}.png` }); };
const tab = async (label) => { await page.locator(".fv-tab", { hasText: label }).first().click(); await page.waitForTimeout(250); };
// Live (the default tab)
await page.waitForTimeout(400);
out.status = await page.locator(".fv-chip").innerText();
out.title = await page.locator(".fv-title").innerText();
out.tabs = await page.locator(".fv-tab").allInnerTexts();
out.chips = await page.locator(".fv-vchip").allInnerTexts();
out.iframe = await page.locator(".fv-art iframe").count();
await shot("1-live");
await page.locator(".fv-vchip", { hasText: "attempt 1" }).click(); await page.waitForTimeout(200);
out.attempt1Shows = await page.locator(".fv-chips .fv-cap").innerText(); out.attempt1Problems = await page.locator(".fv-problems li").allInnerTexts();
await shot("1b-live-attempt1");
await page.locator(".fv-vchip", { hasText: "attempt 3" }).click(); await page.waitForTimeout(150);
// Actions
await tab("Actions");
out.logStages = await page.locator(".fv-stage").allInnerTexts();
await page.locator(".fv-more").first().click(); await page.waitForTimeout(200);
out.diffLines = await page.locator(".fv-d-add, .fv-d-del").count();
await shot("2-actions");
await page.locator(".fv-filter", { hasText: "problems" }).click(); await page.waitForTimeout(150);
out.problemRows = await page.locator(".fv-row.bad").count(); out.nonBadRows = await page.locator(".fv-row.ok, .fv-row.mut").count();
// EOT
await tab("EOT");
out.eotMeta = await page.locator(".fv-eotmeta").innerText();
out.eotStages = (await page.locator(".fv-evstage").allInnerTexts()).map((x) => x.toLowerCase());
out.eotRows = await page.locator(".fv-ev").count();
out.eotRanges = await page.locator(".fv-evr").allInnerTexts();
out.eotUnits = await page.locator(".fv-evunit").allInnerTexts();
await shot("3-eot");
await page.locator(".fv-ev .fv-id").nth(3).click(); await page.waitForTimeout(150);
out.eventJson = await page.locator(".fv-ev .fv-raw").first().innerText();
await page.locator(".fv-more", { hasText: "sources" }).click(); await page.waitForTimeout(150);
out.sourceRows = await page.locator(".fv-src-row").count();
await shot("3b-eot-expanded");
await page.locator(".fv-filter", { hasText: "raw JSON" }).click(); await page.waitForTimeout(200);
out.raw = (await page.locator(".fv-raw").first().innerText()).slice(0, 400);
await shot("3c-eot-raw");
// Folded
await tab("Folded");
out.foldedLines = await page.locator(".fv-cl:not(.fv-cl-del)").count();
out.plainGutters = await page.locator(".fv-gut").count();
out.sourceText = (await page.locator(".fv-fold").innerText()).slice(0, 120);
await shot("4-folded-plain");
await page.locator(".fv-filter", { hasText: "who wrote" }).click(); await page.waitForTimeout(200);
out.gutters = [...new Set(await page.locator(".fv-gut").allInnerTexts())].filter(Boolean);
out.legend = await page.locator(".fv-legend").innerText();
await shot("4b-folded-who");
await page.locator(".fv-filter", { hasText: "who wrote" }).click(); await page.waitForTimeout(100);   // back to the default view
// EOT → click an event → the code that change was, in full
await tab("EOT"); await page.locator(".fv-filter", { hasText: "events" }).click(); await page.waitForTimeout(150);
const evByTag = async (re) => page.evaluate((src) => { const r = new RegExp(src); const all = [...document.querySelectorAll(".fv-ev")]; const k = [...all].reverse().findIndex((e) => r.test(e.querySelector(".fv-codetag")?.textContent || "")); return k < 0 ? -1 : all.length - 1 - k; }, re.source);
const diffIdx = await evByTag(/\+\d+ −[1-9]/);
out.codeTags = await page.locator(".fv-codetag").allInnerTexts();
await page.locator(".fv-ev").nth(diffIdx).locator(".fv-evline").click(); await page.waitForTimeout(250);
out.diffCap = await page.locator(".fv-codehead .fv-cap").innerText();
out.diffAdd = await page.locator(".fv-cl-add").count(); out.diffDel = await page.locator(".fv-cl-del").count(); out.diffAll = await page.locator(".fv-cl").count();
await shot("7-eot-code-diff");
await page.locator(".fv-ev").nth(diffIdx).locator(".fv-evline").click(); await page.waitForTimeout(150);
out.closedAgain = await page.locator(".fv-codebox").count();
const rangeIdx = await evByTag(/lines 1–\d+/);
if (rangeIdx >= 0) { await page.locator(".fv-ev").nth(rangeIdx).locator(".fv-evline").click(); await page.waitForTimeout(250); out.rangeCap = await page.locator(".fv-codehead .fv-cap").innerText(); out.rangeText = await page.locator(".fv-codelines").innerText(); await shot("7b-eot-code-range"); }
await page.locator(".fv-latest").click(); await page.waitForTimeout(150); await tab("Live");   // back to following the run (no attempt chips exist mid-draft — the latest button does it)
const noCode = await page.evaluate(() => [...document.querySelectorAll(".fv-ev")].filter((e) => /artifact→observation|task→/.test(e.textContent)).every((e) => !e.querySelector(".fv-codetag")));
out.checksHaveNoCode = noCode;
// THE CURSOR — steps through frames where the CONTENT changes (never actions about it); every view follows; reset hands the point to the app
await tab("Live");
out.scrubVisible = await page.locator(".fv-scrub").isVisible(); out.resetHiddenAtEnd = (await page.locator(".fv-reset").innerText()) === "Change this";
const frames = await page.evaluate(() => window.__F.framesOf(window.__fold).map((f) => f.kind + (f.complete ? "*" : "")));   // the fixture's frames, for the assertions below
out.frameKinds = frames; out.maxFrame = Number(await page.locator(".fv-range").getAttribute("max"));
const setCursor = async (i) => { await page.locator(".fv-range").evaluate((r, v) => { r.value = String(v); r.dispatchEvent(new Event("input", { bubbles: true })); }, i); await page.waitForTimeout(200); };
const REV = frames.indexOf("revision*"), MID = frames.lastIndexOf("change") - 0;   // attempt 2 whole · a half-applied change of attempt 3
await setCursor(REV);
out.scrubWhere = await page.locator(".fv-where").innerText();
out.liveAtCursor = await page.locator(".fv-vchip.on").innerText();
out.liveSrcHas = await page.locator(".fv-art iframe").evaluate((f) => f.srcdoc.includes('id="rst"'));
out.resetShown = await page.locator(".fv-reset").isVisible();
await shot("5-cursor-at-attempt-2");
await tab("Folded"); out.foldedAtCursor = await page.locator(".fv-fold").innerText(); out.foldedCap = await page.locator(".fv-cap").last().innerText();
out.foldedAdds = await page.locator(".fv-cl-add").count(); out.foldedDels = await page.locator(".fv-cl-del").count();
await tab("Actions"); await page.locator(".fv-filter", { hasText: "everything" }).click(); await page.waitForTimeout(100); out.future = await page.locator(".fv-row.future").count(); out.cur = await page.locator(".fv-row.cur").count();
await tab("EOT"); await page.locator(".fv-filter", { hasText: "events" }).click(); await page.waitForTimeout(100); out.eotFuture = await page.locator(".fv-ev.future").count(); out.eotCur = await page.locator(".fv-ev.cur").count();
await setCursor(MID); await tab("Live");
out.midCap = await page.locator(".fv-cap, .fv-empty").allInnerTexts(); out.midChip = await page.locator(".fv-vchip.on").innerText();
await tab("Folded"); out.midFoldedCap = await page.locator(".fv-cap").last().innerText(); out.midFoldedText = await page.locator(".fv-fold").innerText();
await page.evaluate(() => { window.__resets.length = 0; });
await page.locator(".fv-reset").click(); await page.waitForTimeout(200);
out.midReset = await page.evaluate(() => window.__resets[0]); out.midFrameCode = await page.evaluate((i) => window.__F.framesOf(window.__fold)[i].code, MID); out.midMarker = await page.locator(".fv-marker").innerText();
await page.locator(".fv-undo").click(); await page.waitForTimeout(150);
await setCursor(0); await tab("Live");
out.beforeAnyDraft = await page.locator(".fv-empty").innerText(); out.resetBeforeDraft = await page.locator(".fv-reset").isVisible();
await page.evaluate(() => { window.__resets.length = 0; });
await setCursor(REV); await page.locator(".fv-reset").click(); await page.waitForTimeout(200);
out.marker = await page.locator(".fv-marker").innerText();
await shot("6-reset-marked");
await page.locator(".fv-undo").click(); await page.waitForTimeout(150);
out.resets = await page.evaluate(() => window.__resets); out.afterUndo = out.resets.length; out.markerGone = await page.locator(".fv-marker").isHidden();
await page.locator(".fv-vchip", { hasText: "attempt 3" }).click(); await page.waitForTimeout(150);
out.followAgain = (await page.locator(".fv-reset").innerText()) === "Change this";
// PLAY — replay the fold by itself, one content change at a time
await tab("Live");
await page.locator(".fv-speed").click(); await page.locator(".fv-speed").click();      // 1× → 2× → 4×
out.speed = await page.locator(".fv-speed").innerText();
await page.locator(".fv-play").click(); await page.waitForTimeout(450);
out.playBtn = await page.locator(".fv-play").innerText();
out.w1 = await page.locator(".fv-where").innerText();
await page.waitForTimeout(700); out.w2 = await page.locator(".fv-where").innerText();
await page.locator(".fv-play").click();                                                  // pause
const pausedAt = await page.locator(".fv-where").innerText(); await page.waitForTimeout(700);
out.pausedStill = pausedAt === (await page.locator(".fv-where").innerText()); out.pausedLabel = await page.locator(".fv-play").innerText();
await shot("8-playing-paused");
await page.locator(".fv-play").click(); await page.waitForTimeout(4500);                // play on to the end
out.finishedFollowing = (await page.locator(".fv-scrub.on").count()) === 0; out.endLabel = await page.locator(".fv-play").innerText();
out.endAttempt = await page.locator(".fv-vchip.on").innerText();
await page.locator(".fv-play").click(); await page.waitForTimeout(350);                  // at the end, Play starts over from the beginning
out.restarted = await page.locator(".fv-where").innerText();
await page.locator(".fv-range").evaluate((r) => { r.value = "5"; r.dispatchEvent(new Event("input", { bubbles: true })); }); await page.waitForTimeout(1500);
out.scrubStops = (await page.locator(".fv-play").innerText()) === "▶ Play" && (await page.locator(".fv-where").innerText()).startsWith("05");
out.overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
await browser.close();
const ok = [];
const check = (n, c, e) => { ok.push(c); console.log(`${c ? "✔" : "✘"} ${n}\n     ${e}`); };
check("four views, LIVE leftmost: Live · Actions · EOT · Folded — and the card says it works", out.tabs.join(",") === "Live,Actions,EOT,Folded" && /it works/.test(out.status) && /3 attempts/.test(out.title), `${out.tabs.join(" | ")} · ${out.status} · ${out.title}`);
check("LIVE: the running page, with an attempt chip per draft; stepping back shows that draft's own problems", out.iframe === 1 && out.chips.length === 3 && /local writer/.test(out.attempt1Shows) && out.attempt1Problems.some((p) => /SyntaxError/.test(p)), `iframes=${out.iframe} · ${out.chips.join(", ")} · ${out.attempt1Problems.join(" | ")}`);
check("ACTIONS: the log of actions, staged, with every edit expandable into its real +/− diff", ["READ", "WRITE", "EDIT", "FOLD", "TRY", "CHECK", "FIX", "HELP", "RESULT"].every((w) => out.logStages.map((z) => z.toUpperCase()).includes(w)) && out.diffLines > 0, `${out.logStages.length} entries · ${out.diffLines} diff lines`);
check("ACTIONS: the problems filter keeps only what failed", out.problemRows >= 3 && out.nonBadRows === 0, `${out.problemRows} failing · ${out.nonBadRows} others`);
check("EOT: it is penelope's Provenance@2 shape, and says who gave it", /ArrangementEOT@2 › Provenance@2/.test(out.eotMeta) && /the-fold \(browser\)/.test(out.eotMeta), out.eotMeta);
check("EOT: events use penelope's own stages and cover the whole story (intent → read → draw → fold → verify → repair → materialize)", ["intent", "read", "draw", "fold", "verify", "repair", "materialize"].every((w) => out.eotStages.includes(w)) && out.eotRows >= 15, `${out.eotRows} events · ${[...new Set(out.eotStages)].join(" ")}`);
check("EOT: content is addressed in BYTES — each unit's draw carries its byte range", out.eotRanges.length >= 4 && out.eotRanges.every((r) => /^bytes \d+–\d+$/.test(r)) && out.eotUnits.some((u) => /increment/.test(u)), `${out.eotRanges.slice(0, 4).join(", ")} · ${out.eotUnits.join(", ")}`);
check("EOT: an event opens to its raw record; the sources are listed; the raw document is one click away", /"event_id"/.test(out.eventJson) && out.sourceRows >= 4 && /"schema": "ArrangementEOT@2"/.test(out.raw), `${out.eventJson.split("\n")[1]} · ${out.sourceRows} sources`);
check("FOLDED: the folded content is plain source by default (line numbers, no authorship clutter)", out.foldedLines >= 12 && out.plainGutters === 0 && /<!doctype html>/i.test(out.sourceText), `${out.foldedLines} lines · "${out.sourceText.split("\n")[0]}"`);
check("FOLDED: 'who wrote each line' adds the attempt and maker per line", out.gutters.length >= 2 && /online AI/.test(out.legend), `${out.gutters.join(", ")} · ${out.legend.replace(/\n/g, " ")}`);
check("no page errors and no horizontal scroll", errors.length === 0 && out.overflowX <= 0, `errors=${JSON.stringify(errors)} overflowX=${out.overflowX}`);
check("EOT: clicking an edit event opens the WHOLE file with every added/removed line marked", /vs attempt \d/.test(out.diffCap) && out.diffAdd > 0 && out.diffDel > 0 && out.diffAll >= out.diffAdd + out.diffDel && out.diffAll >= 8, `${out.diffCap} · +${out.diffAdd} −${out.diffDel} of ${out.diffAll} lines`);
check("EOT: clicking again closes it; a unit's draw opens exactly its own lines; checks carry no code", out.closedAgain === 0 && (out.rangeText === undefined || (/function counter/.test(out.rangeText) && !/export function increment/.test(out.rangeText))) && out.checksHaveNoCode, `${out.rangeCap || "(no range event)"} · tags: ${out.codeTags.slice(0, 5).join(", ")}`);
// A script that merely loads must not be called "it works": nothing tested its behaviour against the ask.
const jsOnly = await (async () => {
  const b2 = await chromium.launch(); const p2 = await (await b2.newContext({ viewport: { width: 640, height: 900 } })).newPage();
  await p2.goto(URL + "README.md", { waitUntil: "domcontentloaded" });
  const r = await p2.evaluate(async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const F = await import("/fold-chat-fold.js?" + Date.now()); const V = await import("/fold-chat-foldview.js?" + Date.now());
    const f = F.createFold({ task: "a slugify function" }); const hv = V.mountFold(document.getElementById("host"), f, { live: true });
    F.addVersion(f, { round: 1, maker: { kind: "penelope" }, kind: "js", code: "function slugify(t) { return t; }" });
    F.addEvent(f, { type: "done", ok: true, rounds: 1, passed: 2 }); hv.update();
    return { chip: document.querySelector(".fv-chip").textContent, cap: document.querySelector(".fv-chips .fv-cap").textContent };
  });
  await b2.close(); return r;
})();
check("HONESTY: a script that only loads is 'loads cleanly', never 'it works', and says its behaviour was not tested", jsOnly.chip === "loads cleanly" && /NOT tested/.test(jsOnly.cap), JSON.stringify(jsOnly));
check("FRAMES: the cursor steps through moments the CONTENT changes — start, unit by unit, one revision, one frame per change — and none for reads, checks or escalations", JSON.stringify(out.frameKinds) === JSON.stringify(["start", "unit", "unit*", "revision*", "change", "change", "change*"]) && out.maxFrame === 6, JSON.stringify(out.frameKinds));
check("CURSOR: a slim row scrubs the frames; at the newest frame the button says Change this (continue from the result)", out.scrubVisible && out.resetHiddenAtEnd, `frames=${out.maxFrame + 1}`);
check("CURSOR: scrubbed to attempt 2's frame, LIVE runs attempt 2 (not 3) and the position reads in plain words", /attempt 2/.test(out.liveAtCursor) && !out.liveSrcHas && /^0\d \/ 6 · attempt 2/.test(out.scrubWhere) && out.resetShown, `${out.liveAtCursor} · ${out.scrubWhere}`);
check("CURSOR: FOLDED shows the code as it stood, with what that change added in green and removed in red; attempt 3 is not in it", !/rst/.test(out.foldedAtCursor) && /attempt 2/.test(out.foldedCap) && out.foldedAdds > 0 && out.foldedDels > 0, `${out.foldedCap} · +${out.foldedAdds} −${out.foldedDels}`);
check("CURSOR: ACTIONS and EOT dim what had not happened yet, and mark the cursor row", out.future > 0 && out.cur === 1 && out.eotFuture > 0 && out.eotCur === 1, `actions future=${out.future} cur=${out.cur} · eot future=${out.eotFuture} cur=${out.eotCur}`);
check("CURSOR: mid-change, LIVE keeps the last COMPLETE attempt and says the content is mid-change; FOLDED shows exactly the half-applied code", out.midCap.some((c) => /mid-change/.test(c)) && /attempt 2/.test(out.midChip) && /change \d of 3/.test(out.midFoldedCap), `${out.midChip} · ${out.midFoldedCap}`);
check("CURSOR: before any content Live says so, and there is nothing to reset from", /Nothing had been written/.test(out.beforeAnyDraft) && out.resetBeforeDraft === false, out.beforeAnyDraft);
check("RESET: from a half-applied frame it hands the app that EXACT code, flagged partial, and the card names the change", !!out.midReset && out.midReset.partial === true && out.midReset.round === 3 && out.midReset.code === out.midFrameCode && /attempt 3 \(change \d of 3\)/.test(out.midMarker), JSON.stringify({ partial: out.midReset?.partial, round: out.midReset?.round, same: out.midReset?.code === out.midFrameCode, marker: out.midMarker }));
check("RESET: from attempt 2 it hands the app exactly attempt 2's code; the card says the next change starts there; undo clears it", out.resetShown && out.resets[0]?.round === 2 && !out.resets[0].code.includes('id="rst"') && out.resets[0].partial === false && /attempt 2/.test(out.marker) && out.resets[1] === null && out.markerGone, JSON.stringify({ shown: out.resetShown, r: out.resets?.[0]?.round, hasRst: out.resets?.[0]?.code?.includes('id="rst"'), partial: out.resets?.[0]?.partial, m: out.marker, second: out.resets?.[1], markerGone: out.markerGone }));
check("CURSOR: clicking the newest attempt follows the run again", out.followAgain, "");
check("PLAY: it advances by itself (content changes tick forward), pauses where you stop it, and finishes on the newest frame", out.playBtn === "❚❚ Pause" && out.w1 !== out.w2 && out.pausedStill && out.pausedLabel === "▶ Play" && out.finishedFollowing && out.endLabel === "▶ Play" && /attempt 3/.test(out.endAttempt), JSON.stringify({ speed: out.speed, w1: out.w1, w2: out.w2, pausedStill: out.pausedStill, end: out.endAttempt }));
check("PLAY: at the end, Play starts over from the beginning; touching the slider stops it", /^0[0-2] \//.test(out.restarted) && out.scrubStops, JSON.stringify({ restarted: out.restarted, scrubStops: out.scrubStops }));
// RESULTS — for a function, what it DID when called is on the card, and the person can call it themselves
const results = await (async () => {
  const b3 = await chromium.launch(); const p3 = await (await b3.newContext({ viewport: { width: 640, height: 900 } })).newPage();
  await p3.goto(URL + "README.md", { waitUntil: "domcontentloaded" });
  const r = await p3.evaluate(async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const F = await import("/fold-chat-fold.js?" + Date.now()); const V = await import("/fold-chat-foldview.js?" + Date.now());
    const f = F.createFold({ task: "a slugify function" });
    const calls = [];
    const hv = V.mountFold(document.getElementById("host"), f, { live: true, tryCall: async (code, expr) => { calls.push(expr); return expr.includes("boom") ? { ok: false, expr, error: "Error: nope" } : { ok: true, expr, value: '"hello-world"' }; } });
    F.addVersion(f, { round: 1, maker: { kind: "penelope" }, kind: "js", code: "function slugify(title) { return title; }" });
    F.addEvent(f, { type: "check", round: 1, name: "tried it", ok: null, detail: 'slugify("Hello, World!") → "hello--world"\nslugify("") → ""\nslugify(3) threw TypeError: x' });
    F.addEvent(f, { type: "done", ok: true, rounds: 1, passed: 1 }); hv.update();
    const rows = [...document.querySelectorAll(".fv-trow")].map((x) => x.innerText.replace(/\s+/g, " "));
    const bad = document.querySelectorAll(".fv-trow.bad").length;
    const ph = document.querySelector(".fv-tryin").placeholder;
    document.querySelector(".fv-tryin").value = 'slugify("My Title")';
    document.querySelector(".fv-try").requestSubmit(); await new Promise((r2) => setTimeout(r2, 200));
    return { rows, bad, ph, out: document.querySelector(".fv-tryout").innerText, calls };
  });
  await b3.close(); return r;
})();
check("RESULTS: a function's card shows what it DID when called — each call, its value, and the ones that threw", results.rows.length === 3 && /hello--world/.test(results.rows[0]) && results.bad === 1 && /threw/.test(results.rows[2]), JSON.stringify(results.rows));
check("RESULTS: a box lets the person call the code themselves, prefilled with a sample call, and shows the answer", /^slugify\(/.test(results.ph) && results.calls[0] === 'slugify("My Title")' && /→ "hello-world"/.test(results.out), JSON.stringify({ ph: results.ph, calls: results.calls, out: results.out }));
console.log(`\n${ok.filter(Boolean).length}/${ok.length} stand · screenshots in ${SHOTS}`);
process.exit(ok.every(Boolean) ? 0 : 1);
