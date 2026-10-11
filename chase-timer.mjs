// chase-timer.mjs — chase a working countdown timer: the model writes the page
// (SYN), a real browser runs it (EVA by observation), the finding re-opens the
// void (REC→NUL), until it holds or the budget ends.
import { chromium } from "playwright";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

const MODEL = "qwen2.5-coder:1.5b";
async function draw(finding) {
  const fix = finding ? `\n\nYour previous page FAILED when it was run: ${finding}. Write a version without that failure.` : "";
  const prompt = `You write ONE complete, self-contained HTML document that actually works when opened in a browser. Inline CSS and JavaScript only; no external files; no prose.\n\nBuild a countdown timer: it shows a number of seconds and counts DOWN over time when the page opens. It must actually change on screen.\n\nOutput only the HTML document, inside a single fenced code block.${fix}`;
  const r = await fetch("http://127.0.0.1:11434/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { num_predict: 1600, temperature: 0.1 } }), signal: AbortSignal.timeout(180000) });
  const j = await r.json();
  const m = String(j.response || "").match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  const html = (m ? m[1] : j.response || "").trim();
  return /<\s*(!doctype|html|body|div|button|script)/i.test(html) ? html : null;
}
const b = await chromium.launch();
async function observe(html) {
  const p = await b.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  let t0 = "", t1 = "", nodes = 0;
  try {
    await p.setContent(html, { waitUntil: "load", timeout: 8000 });
    nodes = await p.evaluate(() => document.getElementsByTagName("*").length);
    t0 = await p.evaluate(() => document.body.innerText);
    await p.waitForTimeout(1600);
    t1 = await p.evaluate(() => document.body.innerText);
  } catch (e) { errs.push(String(e.message)); }
  await p.close();
  const finding = errs.length ? `the page threw: ${errs[0].slice(0, 120)}` : nodes < 4 ? "the page rendered nothing" : t0.trim() === t1.trim() ? "nothing changes over time — it does not count down" : null;
  return { finding, t0: t0.trim().slice(0, 60), t1: t1.trim().slice(0, 60), nodes, errs: errs.length };
}
const W = fs.mkdtempSync(path.join(os.tmpdir(), "timer-"));
let finding = null;
for (let round = 1; round <= 5; round++) {
  console.log(`\n— round ${round} · SYN (${MODEL})${finding ? "  [NUL re-opened with the finding]" : ""}`);
  let html = null; try { html = await draw(finding); } catch (e) { console.log("  draw failed:", e.message); }
  if (!html) { console.log("  REC · the model returned no page"); finding = "the model returned no page"; continue; }
  fs.writeFileSync(path.join(W, `timer-r${round}.html`), html);
  console.log(`  page: ${html.length} bytes`);
  const obs = await observe(html);
  console.log(`  EVA · errors ${obs.errs} · nodes ${obs.nodes} · t0=${JSON.stringify(obs.t0)} t1=${JSON.stringify(obs.t1)}`);
  if (!obs.finding) { console.log(`\n✅ HELD — a countdown timer that counts (${path.join(W, `timer-r${round}.html`)})`); await b.close(); process.exit(0); }
  console.log(`  REC · finding: ${obs.finding}`);
  finding = obs.finding;
}
console.log(`\n❌ WALLED after 5 rounds — last finding: ${finding}`);
await b.close();
