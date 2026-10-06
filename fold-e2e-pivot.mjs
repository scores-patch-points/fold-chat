// fold-e2e-pivot.mjs — the Pivot in the REAL page (eval/pivot/PREREG.md). A forced-bad model stub; a MutationObserver that records every
// string that EVER appears in an assistant bubble. Verdicts: STANDS · FALSIFIED (counterexample quoted) · UNMEASURED (never a pass, II.10).
//   node fold-e2e-pivot.mjs            # every case against FOLD_URL (default http://127.0.0.1:8814/)
//   node fold-e2e-pivot.mjs E1 E7      # only those
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_ = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const only = process.argv.slice(2);
const sse = (text) => text.split(/(?<=\s)/).map((t) => "data: " + JSON.stringify({ choices: [{ delta: { content: t } }] }) + "\n\n").join("") + "data: [DONE]\n\n";   // token-ish chunks, so a leak would be visible mid-stream
const EIFFEL = { title: "Eiffel Tower", text: "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower from 1887 to 1889. The tower is 330 metres tall, about the same height as an 81-storey building." };

async function withPage(browser, { draft, pivot = null }, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const chatBodies = [];
  // every string that ever appears in an assistant bubble (childList + characterData), with the time it first appeared
  await page.addInitScript(({ pivot }) => {
    if (pivot) { try { localStorage.setItem("fold-chat:pivot", pivot); } catch {} }
    window.__seen = [];
    const snap = () => { for (const b of document.querySelectorAll(".msg.assistant .body")) { const t = (b.innerText || b.textContent || ""); if (t.trim() && !window.__seen.includes(t)) window.__seen.push(t); } };
    document.addEventListener("DOMContentLoaded", () => { new MutationObserver(snap).observe(document.documentElement, { childList: true, subtree: true, characterData: true }); snap(); });
  }, { pivot });
  await page.route("**/v1/chat/completions", async (route) => {
    let body = null; try { body = JSON.parse(route.request().postData() || "{}"); } catch {}
    chatBodies.push(body);
    return route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(draft) });
  });
  const cors = { "access-control-allow-origin": "*" };
  await page.route(/wikipedia\.org\/w\/api\.php/, (route) => {
    const u = route.request().url();
    if (/list=search/.test(u)) return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ query: { search: [{ title: EIFFEL.title, snippet: EIFFEL.text.slice(0, 120), wordcount: 5000 }] } }) });
    if (/prop=extracts/.test(u)) return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ query: { pages: { 1: { title: EIFFEL.title, extract: EIFFEL.text } } } }) });
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: "{}" });
  });
  const wikiUrl = "https://en.wikipedia.org/wiki/Eiffel_Tower";
  await page.route(/(workers\.dev|duckduckgo|brave\.com|api\.github\.com|archive\.org|openalex\.org|crossref\.org|r\.jina\.ai|allorigins|corsproxy|microlink)/, (r) => /workers\.dev/.test(r.request().url())
    ? r.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ engine: "stub", results: [{ title: EIFFEL.title + " - Wikipedia", url: wikiUrl, snippet: EIFFEL.text.slice(0, 160) }] }) })
    : r.abort());
  await page.route(/127\.0\.0\.1:8790\/api\/(search|page)/, (r) => r.abort());
  try {
    await page.goto(URL_, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
    return await fn(page, { chatBodies });
  } finally { await ctx.close(); }
}
async function send(page, text, timeout = 120000) {
  await page.fill("#input", text); await page.click("#send");
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled && !i.readOnly && i.getAttribute("aria-busy") !== "true" && !/stop/i.test(document.getElementById("send")?.getAttribute("aria-label") || ""); }, undefined, { timeout }).catch(() => {});
  await page.waitForTimeout(600);
}
const lastMsg = (page) => page.evaluate(() => {
  const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
  const m = (s.messages || []).filter((x) => x.role === "assistant").pop();
  return m ? { content: m.content || "", pivot: m.pivot || null, notices: (m.notices || []).map((n) => ({ kind: n.kind, text: String(n.text || "").slice(0, 200) })), authored: m.authored || null } : null;
});
const everShown = (page) => page.evaluate(() => window.__seen || []);
const bubble = (page) => page.evaluate(() => { const m = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]; return m ? (m.querySelector(".body")?.innerText || "").replace(/\s+/g, " ").trim() : null; });

const ASK = "Tell me about the Eiffel Tower";
const never = (re, ctx) => ({ stored: re.test(ctx.m.content), everInDom: ctx.seen.some((t) => re.test(t)) });
const CASES = [
  { id: "E1", conj: "an invented designer is never shown (not at the end, not at any moment) and never stored", draft: "The Eiffel Tower stands in Paris, France. It was designed by Leonardo da Vinci. It is 330 metres tall.",
    judge: (c) => { const n = never(/Leonardo/i, c); const keeps = /Paris/.test(c.m.content) && /330/.test(c.m.content); return { bad: n.stored || n.everInDom || !keeps, ev: { ...n, keeps, stored: c.m.content, pivot: c.m.pivot?.stats, why: c.m.pivot?.dropped?.map((d) => d.why) } }; } },
  { id: "E2", conj: "markup and chat reflex are never shown; the sentence that is grounded is", draft: "Great question! Here's what I can tell you:\n\n* **Height:** The tower is 330 metres tall.\n* It stands in Paris.",
    judge: (c) => { const re = /(\*|Great question|Here's what)/i; const n = never(re, c); const keeps = /330/.test(c.m.content); return { bad: n.stored || n.everInDom || !keeps, ev: { ...n, keeps, stored: c.m.content, why: c.m.pivot?.dropped?.map((d) => d.why) } }; } },
  { id: "E3", conj: "a figure nobody gave is never shown", draft: "The Eiffel Tower is 330 metres tall. It attracts 7 million visitors a year.",
    judge: (c) => { const n = never(/7 million/i, c); const keeps = /330/.test(c.m.content); return { bad: n.stored || n.everInDom || !keeps, ev: { ...n, keeps, stored: c.m.content, why: c.m.pivot?.dropped?.map((d) => d.why) } }; } },
  { id: "E4", conj: "CONTROL: a true, witnessed draft ships whole", draft: "The Eiffel Tower is a wrought-iron lattice tower in Paris, France.",
    judge: (c) => { const same = c.m.content.trim() === "The Eiffel Tower is a wrought-iron lattice tower in Paris, France."; return { bad: !same, ev: { stored: c.m.content, pivot: c.m.pivot?.stats, why: c.m.pivot?.dropped?.map((d) => d.why) } }; } },
  { id: "E5", conj: "(amended, PREREG Amendment 3) a draft that is all reflex is never shown; sources were read, so the person gets the sources' own words, authored by the sources", draft: "I'm so sorry to hear that! Feel free to ask me more.",
    judge: (c) => { const n = never(/sorry to hear|Feel free/i, c); const gap = c.m.pivot?.gap?.kind; const fb = c.m.authored === "sources" && /Eiffel|Paris|330/.test(c.m.content); return { bad: n.stored || n.everInDom || !gap || !fb, ev: { ...n, stored: c.m.content.slice(0, 160), gap, authored: c.m.authored, notices: c.m.notices } }; } },
  { id: "E6", conj: "a draft in a language with no grammar is shown as written AND said not to have been read", draft: "หอไอเฟลตั้งอยู่ในกรุงปารีสประเทศฝรั่งเศส สูงสามร้อยสามสิบเมตร",
    judge: (c) => { const skipped = c.m.pivot?.skipped === "no_grammar_for_language"; const said = c.m.notices.some((x) => /grammar|not read/i.test(x.text)); return { bad: !(skipped && said), unmeasured: !c.m.pivot, ev: { pivot: c.m.pivot, notices: c.m.notices, stored: c.m.content.slice(0, 60) } }; } },
  { id: "E7", conj: "DISCRIMINATOR: with the switch off, E1's invented designer IS shown — E1 passes because of the Pivot", pivot: "off", draft: "The Eiffel Tower stands in Paris, France. It was designed by Leonardo da Vinci. It is 330 metres tall.",
    judge: (c) => { const n = never(/Leonardo/i, c); return { bad: !(n.stored && n.everInDom), ev: { ...n, stored: c.m.content, pivot: c.m.pivot } }; } },
];

// ── Amendment 2 (the gate history, fold a900f6e): two turns in ONE page; the history lives in localStorage["fold-chat:gates"] ──
const gateVerdicts = (page) => page.evaluate(() => { const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; const m = (s.messages || []).filter((x) => x.role === "assistant").pop(); return m?.pivot?.gates || null; });
const gateRecords = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("fold-chat:gates") || "[]").length; } catch { return -1; } });
const GATE_CASES = [
  { id: "E8", conj: "a CLEAN draft proves nothing: every gate reads unmeasured, none pass", drafts: ["The Eiffel Tower is a wrought-iron lattice tower in Paris, France."],
    judge: (v) => { const g = v[0]; return { bad: !g || Object.values(g).some((x) => x !== "unmeasured"), ev: { gates: g } }; } },
  { id: "E9", conj: "after a clean turn then a dirty one, ONLY the gates that rejected something read pass; the rest stay unmeasured", drafts: ["The Eiffel Tower is a wrought-iron lattice tower in Paris, France.", "Great question! The Eiffel Tower is in Paris, France. It was designed by Leonardo da Vinci."],
    judge: (v) => { const a = v[0], b = v[1]; const ok = a && b && Object.values(a).every((x) => x === "unmeasured") && b.boilerplate === "pass" && b.ungrounded === "pass" && b.question === "unmeasured" && b.verify === "unmeasured"; return { bad: !ok, ev: { afterClean: a, afterDirty: b } }; } },
];

let chromium;
try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const browser = await chromium.launch();
const results = [];
for (const c of CASES) {
  if (only.length && !only.includes(c.id)) continue;
  let r;
  try {
    r = await withPage(browser, { draft: c.draft, pivot: c.pivot || null }, async (page, ctx) => {
      await send(page, ASK);
      const m = await lastMsg(page); const seen = await everShown(page);
      if (!m) return { verdict: "UNMEASURED", evidence: "no assistant message was stored: " + ((await bubble(page)) || "").slice(0, 160) };
      const j = c.judge({ m, seen });
      return { verdict: j.unmeasured ? "UNMEASURED" : j.bad ? "FALSIFIED" : "STANDS", evidence: JSON.stringify(j.ev) };
    });
  } catch (e) { r = { verdict: "UNMEASURED", evidence: "harness error: " + String(e.message || e).slice(0, 200) }; }
  results.push({ id: c.id, conj: c.conj, ...r });
  console.log(`${r.verdict === "STANDS" ? "✔ STANDS     " : r.verdict === "FALSIFIED" ? "✘ FALSIFIED  " : "? UNMEASURED "} ${c.id} — ${c.conj}\n      ${r.evidence.slice(0, 600)}`);
}
for (const c of GATE_CASES) {
  if (only.length && !only.includes(c.id)) continue;
  let r;
  try {
    // one context, N turns: the draft the stub streams changes per turn
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    let turn = 0;
    const cors = { "access-control-allow-origin": "*" };
    await page.route("**/v1/chat/completions", (route) => route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(c.drafts[Math.min(turn, c.drafts.length - 1)]) }));
    await page.route(/wikipedia\.org\/w\/api\.php/, (route) => { const u = route.request().url();
      if (/list=search/.test(u)) return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ query: { search: [{ title: EIFFEL.title, snippet: EIFFEL.text.slice(0, 120), wordcount: 5000 }] } }) });
      if (/prop=extracts/.test(u)) return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ query: { pages: { 1: { title: EIFFEL.title, extract: EIFFEL.text } } } }) });
      return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: "{}" }); });
    await page.route(/(workers\.dev|duckduckgo|brave\.com|api\.github\.com|archive\.org|openalex\.org|crossref\.org|r\.jina\.ai|allorigins|corsproxy|microlink)/, (r) => /workers\.dev/.test(r.request().url()) ? r.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ engine: "stub", results: [{ title: EIFFEL.title + " - Wikipedia", url: "https://en.wikipedia.org/wiki/Eiffel_Tower", snippet: EIFFEL.text.slice(0, 160) }] }) }) : r.abort());
    await page.route(/127\.0\.0\.1:8790\/api\/(search|page)/, (r) => r.abort());
    await page.goto(URL_, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
    const seen = [];
    for (turn = 0; turn < c.drafts.length; turn++) { await send(page, ASK + (turn ? " again" : "")); seen.push(await gateVerdicts(page)); }
    const j = c.judge(seen); r = { verdict: j.bad ? "FALSIFIED" : "STANDS", evidence: JSON.stringify({ ...j.ev, ledgerRecords: await gateRecords(page) }) };
    await ctx.close();
  } catch (e) { r = { verdict: "UNMEASURED", evidence: "harness error: " + String(e.message || e).slice(0, 200) }; }
  results.push({ id: c.id, conj: c.conj, ...r });
  console.log(`${r.verdict === "STANDS" ? "✔ STANDS     " : r.verdict === "FALSIFIED" ? "✘ FALSIFIED  " : "? UNMEASURED "} ${c.id} — ${c.conj}\n      ${r.evidence.slice(0, 600)}`);
}
await browser.close();
const tally = { STANDS: 0, FALSIFIED: 0, UNMEASURED: 0 }; for (const r of results) tally[r.verdict]++;
console.log(`\n${tally.STANDS} stand · ${tally.FALSIFIED} falsified · ${tally.UNMEASURED} unmeasured  (of ${results.length}; 'stands' = survived this attempt, nothing more)`);
let head = "unknown"; try { head = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim(); } catch {}
const out = path.join(HERE, "eval", "pivot", "results.json");
let hist = []; try { hist = JSON.parse(fs.readFileSync(out, "utf8")); } catch {}
hist.push({ head, url: URL_, tally, results });
fs.writeFileSync(out, JSON.stringify(hist, null, 1));
process.exit(tally.FALSIFIED || tally.UNMEASURED ? 1 : 0);
