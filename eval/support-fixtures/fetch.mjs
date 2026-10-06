// fetch.mjs — save the RAW HTML of the pre-registered fixture pages ONCE (docs/CREATOR-SUPPORT-ROUTES-PREREG.md).
// At most 14 loads in total, >= 1.3 s apart, Chromium. Usage: node eval/support-fixtures/fetch.mjs id=url [id=url ...]
// Saves pages/<id>.html (third-party content: local only, ignored by git) and appends a line to loads.json.
import fs from "node:fs";
import { chromium } from "playwright";
const DIR = new URL("./", import.meta.url).pathname;
const logPath = DIR + "loads.json";
const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : [];
const MAX = 14;
const jobs = process.argv.slice(2).map((a) => { const i = a.indexOf("="); return [a.slice(0, i), a.slice(i + 1)]; });
if (log.length + jobs.length > MAX) { console.error(`refusing: ${log.length} loads done + ${jobs.length} asked > ${MAX}`); process.exit(2); }
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
let first = true;
for (const [id, url] of jobs) {
  if (!first) await new Promise((r) => setTimeout(r, 1400)); first = false;
  const entry = { id, url, at: new Date().toISOString() };
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    entry.status = res ? res.status() : 0; entry.finalUrl = page.url();
    const body = res ? await res.text() : "";
    entry.bytes = body.length;
    fs.writeFileSync(`${DIR}pages/${id}.html`, body);
  } catch (e) { entry.error = String(e.message).slice(0, 120); }
  log.push(entry); fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
  console.log(id, entry.status ?? entry.error, entry.bytes ?? "");
}
await browser.close();
