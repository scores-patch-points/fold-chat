// fold-e2e-falsify2.mjs — harder falsification of the MECHANICAL summary and
// the discourse rules. Each check TRIES TO BREAK a claim; a falsified claim is
// the finding. Node-only where possible; browser for the live ones.
//
//   node fold-e2e-falsify2.mjs

import { chromium } from "/private/tmp/fold-e2e/node_modules/playwright/index.mjs";
import * as FOLD from "./vendor/the-fold/fold.js";
import { classifyTurn } from "./fold-chat-discourse.js";

const results = [];
const ok = (claim, survived, evidence, falsifier) => results.push({ claim, verdict: survived ? "STANDS" : "FALSIFIED", evidence, falsifier });

// ── Node-level: the veto must catch drift, and accept a clean summary ──
{
  const folds = ["Q: who led the Office? A: Eleanor Voss led the Office of the Keeper."];
  const records = [FOLD.buildWarrantRecord({ turn: 1, gist: "Eleanor Voss led the Office of the Keeper", channels: ["model"], refs: [], unsupported: [], open: [] })];
  const prev = { ...FOLD.emptySummary(), entities: ["Eleanor Voss", "Office of the Keeper"], folds, records, turnCount: 1 };
  // an empty entity list is the model's ABSTAIN — the previous value carries, so
  // a loss is impossible by that path; confirm the abstain path cannot lose.
  const abstain = FOLD.updateSummaryWithFold(prev, "x", JSON.stringify({ topic: "t", flow: "f", entities: [], context: "", language: "en" }));
  ok("an empty entity list is an abstain (previous carries) — no loss by that path",
    abstain.entities.includes("Eleanor Voss"),
    JSON.stringify(abstain.entities),
    "an empty list blanks entities → the model can erase the discourse");
  // the REAL drift: a non-empty list that silently drops a cited entity.
  const drift = FOLD.updateSummaryWithFold(prev, "x", JSON.stringify({ topic: "t", flow: "f", entities: ["Office of the Keeper"], context: "", language: "en" }));
  const c1 = FOLD.extractSummaryFindings(prev.entities, drift.entities, { records, folds });
  ok("a non-empty summary that DROPS a cited entity is refused",
    !c1.ok && c1.findings.some((f) => f.kind === "lost_live_entity"),
    JSON.stringify(c1.findings),
    "the veto accepts a real drop → drift is possible");
  const add = FOLD.updateSummaryWithFold(prev, "x", JSON.stringify({ topic: "t", flow: "f", entities: ["Eleanor Voss", "Office of the Keeper", "Zorp Quux"], context: "", language: "en" }));
  const c2 = FOLD.extractSummaryFindings(prev.entities, add.entities, { records, folds });
  ok("a summary that ADDS an unsupported entity is refused", !c2.ok && c2.findings.some((f) => f.kind === "unsupported_addition"), JSON.stringify(c2.findings), "the veto accepts an invention → a model could plant an entity");
}

// ── Node-level: a 40-turn mechanical projection never drifts or grows ──
{
  let summary = FOLD.emptySummary();
  const turns = Array.from({ length: 40 }, (_, i) => ({ role: "user", content: `Note ${i}: Delta ${i} did the thing.` }));
  let clean = true, anyCount = 0;
  for (const t of turns) {
    const line = FOLD.mechanicalFoldLine(t.content, "ok");
    const rec = FOLD.buildWarrantRecord({ turn: summary.turnCount + 1, gist: line, channels: ["model"], refs: [], unsupported: [], open: [] });
    summary = FOLD.addWarrantRecord(FOLD.advanceSummaryFold(summary, line), rec);
    const c = FOLD.extractSummaryFindings(summary.entities, summary.entities, { records: summary.records, folds: summary.folds });
    if (!c.ok) clean = false;
    anyCount = summary.turnCount;
  }
  const msgs = FOLD.buildTurnMessages({ basePrompt: "sys", summary, history: turns, question: "and?" });
  ok("40 turns: the fold store accrues and the projection stays clean + bounded",
    clean && anyCount === 40 && msgs.length <= 6 && msgs.reduce((n, m) => n + m.content.length, 0) < 8000,
    `turnCount=${anyCount} clean=${clean} msgs=${msgs.length} chars=${msgs.reduce((n, m) => n + m.content.length, 0)}`,
    "turnCount stops matching, the veto fires, or the projection grows with the transcript");
}

// ── Node-level: the classifier never routes a plain writing ask to research ──
{
  const mustGenerate = ["write an essay about dolphins", "write about the potential extinction", "compose a poem", "draft a report on the audit"];
  const mustResearch = ["who is the president?", "when was it created", "what is a closure"];
  const bad = [...mustGenerate.filter((q) => classifyTurn(q) !== "generate"), ...mustResearch.filter((q) => classifyTurn(q) !== "research")];
  ok("the classifier routes write→generate and question→research with no crossover", bad.length === 0, `misfired: ${JSON.stringify(bad)}`, "a write ask routes to research (the original bug) or a question routes to generate");
}

// ── Browser: the live pipeline NEVER asks a model for JSON (Gary's P80) ──
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const sent = [];
await page.route("**/v1/chat/completions", async (route) => {
  try { const b = JSON.parse(route.request().postData() || "{}"); sent.push((b.messages || []).map((m) => m.content || "").join("\n")); } catch {}
  await route.continue();
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message)));
await page.goto(process.env.FOLD_URL || "http://127.0.0.1:8814/", { waitUntil: "networkidle", timeout: 60000 });
const ask = async (t, ms = 26000) => { await page.fill("#input", t); await page.click("#send"); await page.waitForTimeout(ms); };
await ask("The Marden Act created the Office of the Keeper in 1907. Eleanor Voss led it.", 22000);
await ask("Who led it?", 26000);
await ask("write a short note about it", 30000);
await page.waitForTimeout(6000);

const JSON_ASK = /\b(reply|respond|return|output)\b[^.]{0,40}\b(?:in|as|with)\b[^.]{0,20}\bjson\b|\bjson\s+(?:object|only|format)\b/i;
const offenders = sent.filter((s) => JSON_ASK.test(s));
ok("no prompt in the live pipeline asks for JSON (Gary P80, no-json-ask)",
  offenders.length === 0,
  `offenders=${offenders.length} of ${sent.length} calls`,
  "a prompt asks for JSON in prose → the local model will echo it and the decoder never gets its structure");

// ── Browser: mechanical summary populated, no invented entity ──
{
  const s = await page.evaluate(() => { const x = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"))[0]; return { topic: x?.summary?.topic, entities: x?.summary?.entities || [], turnCount: x?.summary?.turnCount, refused: x?.summary?.refreshRefused || null }; });
  // The entities must be a subset of names actually present in the turns.
  const material = await page.evaluate(() => { const x = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"))[0]; return (x?.messages || []).map((m) => m.content).join(" "); });
  const invented = s.entities.filter((e) => !material.includes(e.split(" ")[0]));
  ok("the mechanical summary names only entities present in the turns, none invented",
    s.entities.length > 0 && invented.length === 0 && s.turnCount >= 3,
    `entities=${JSON.stringify(s.entities)} invented=${JSON.stringify(invented)} turnCount=${s.turnCount}`,
    "an entity appears that no turn named → the mechanical summary is not material-bound");
}

ok("no page error across the harder run", errors.length === 0, JSON.stringify(errors), "any uncaught error falsifies the port");

await browser.close();

const falsified = results.filter((r) => r.verdict === "FALSIFIED");
console.log("\n=== E2E + FALSIFY (mechanical summary) ===");
for (const r of results) console.log(`${r.verdict === "STANDS" ? "✔ stands " : "✘ FALSIFIED"} — ${r.claim}\n    evidence: ${r.evidence}\n    falsifier: ${r.falsifier}`);
console.log(`\n${results.length - falsified.length}/${results.length} stand · ${falsified.length} falsified`);
process.exit(falsified.length ? 1 : 0);