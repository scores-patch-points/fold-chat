// shots.mjs — Playwright (headless, own context) screenshots of each mock: 375 and 1200 wide, light and dark, every face,
// plus the source sheet open.   node docs/playback/structure/shots.mjs [stage ...]
import path from "node:path"; import fs from "node:fs"; import { fileURLToPath, pathToFileURL } from "node:url";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const HERE = path.dirname(fileURLToPath(import.meta.url)); const OUT = path.join(HERE, "shots"); fs.mkdirSync(OUT, { recursive: true });
const stages = process.argv.slice(2).length ? process.argv.slice(2) : ["seg", "con", "syn"];
const SHEETS = { seg: { f: 1, o: "2.0" }, con: { f: 1, o: "2.0" }, syn: { f: 1, o: "1.4" } };
const browser = await chromium.launch();
for (const id of stages) for (const [w, h, wl] of [[375, 812, "375"], [1200, 900, "1200"]]) for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  const shots = [["ground", "t=0&f=0"], ["figure", "t=0&f=1"], ["pattern", "t=0&f=2"], ["sheet", `t=0&f=${SHEETS[id].f}&o=${SHEETS[id].o}`], ["phone-figure", "t=1&f=1"], ["president-figure", "t=3&f=1"]];
  for (const [name, hash] of shots) {
    await page.goto(pathToFileURL(path.join(HERE, id + ".html")).href + "#" + hash); await page.reload(); await page.waitForTimeout(1900);
    await page.screenshot({ path: path.join(OUT, `${id}-${name}-${wl}-${scheme}.png`), fullPage: name !== "sheet" || w >= 1000 });
  }
  if (errs.length) console.log(id, wl, scheme, "ERRORS", errs.slice(0, 3));
  await ctx.close();
}
await browser.close(); console.log("shots done");
