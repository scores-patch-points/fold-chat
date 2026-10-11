// shots.mjs — Playwright (headless, own context) screenshots of every model: 375 and 1200, light and dark, depths 0/1/3/5/6 (cold deep links),
// a mid-transition frame, and the 6-deep wall path (5 sources, the '+k earlier layers' collapse).   node docs/playback/nav/shots.mjs [model ...]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const HERE = path.dirname(fileURLToPath(import.meta.url)); const OUT = path.join(HERE, "shots"); fs.mkdirSync(OUT, { recursive: true });
const models = process.argv.slice(2).length ? process.argv.slice(2) : ["a-sheets", "b-push", "c-zoom", "d-split"];
const H3 = "c~nose~1/p~nose~0~7/g~nose~0~7", H5 = H3 + "/e~nose~blood%20vessels/p~nose~1~8", H6 = H5 + "/s~nose~1~8";
const HW = "c~wall~1/p~wall~1~4/g~wall~1~4/e~wall~NASA/p~wall~4~0/s~wall~4~0";
const STATES = [["d0", ""], ["d1", "c~nose~1"], ["d3", H3], ["d5", H5], ["d6", H6]];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
for (const file of models) for (const [vn, w, h, dpr, touch] of [["375", 375, 812, 2, true], ["1200", 1200, 800, 1, false]]) for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  const url = pathToFileURL(path.join(HERE, file + ".html")).href;
  const open = async (hash) => { await page.goto("about:blank"); await page.goto(url + (hash ? "#/" + hash : "")); await page.waitForFunction(() => window.__ready); await wait(450); };
  for (const [name, hash] of STATES) {
    await open(hash);
    if (name === "d0") { await page.evaluate(() => { const c = document.getElementById("chat"); c.scrollTop = document.getElementById("turn-nose").offsetTop - 70; }); await wait(150); }
    await page.screenshot({ path: path.join(OUT, `${file}-${vn}-${scheme}-${name}.png`) });
  }
  if (scheme === "light" || vn === "375") { await open(HW); await page.screenshot({ path: path.join(OUT, `${file}-${vn}-${scheme}-wall6.png`) }); }
  if (scheme === "light") {     // a frame in the middle of a real tap-driven transition: evidence card -> passage
    await open("c~nose~1"); const row = page.locator("#layers .layer[data-k=c] .ev").first(); await row.scrollIntoViewIfNeeded();
    const done = row.tap ? (touch ? row.tap() : row.click()) : row.click(); await wait(150); await page.screenshot({ path: path.join(OUT, `${file}-${vn}-${scheme}-mid.png`) }); await done;
    if (file === "c-zoom" || file === "a-sheets") { await open(""); await page.evaluate(() => { const c = document.getElementById("chat"); c.scrollTop = document.getElementById("turn-nose").offsetTop - 70; }); await wait(120); const mk = page.locator('#turn-nose .mark[data-claim="1"]'); const p = touch ? mk.tap() : mk.click(); await wait(170); await page.screenshot({ path: path.join(OUT, `${file}-${vn}-${scheme}-mid0.png`) }); await p; }
  }
  if (errs.length) console.log(file, vn, scheme, "ERRORS", errs.slice(0, 3));
  await ctx.close();
}
await browser.close(); console.log("shots done");
