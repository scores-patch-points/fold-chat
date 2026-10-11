// docs/playback/interpretation/shoot.mjs — headless screenshots (Playwright, own context; no Browser pane, no network) of every stage x face x width x scheme.
//   node docs/playback/interpretation/shoot.mjs [stage ...]
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const stages = process.argv.slice(2).length ? process.argv.slice(2) : ["def", "eva", "rec"];
const SHOTS = {
  def: [["ground", "real-a:1"], ["figure", "real-a:1"], ["pattern", "real-a:1"]],
  eva: [["ground", "real-a:1"], ["figure", "real-a:1"], ["pattern", "real-a:1"]],
  rec: [["ground", "real-b:0"], ["figure", "real-b:9"], ["pattern", "real-b:0"]],
};
const EXTRA = { // an opened reader / another turn, to show the same form on different data
  def: [["figure", "real-b:3", "w1", "tokyo"]],
  eva: [["figure", "real-b:3", "w1", "tokyo"], ["figure", "real-b:9", "", "penicillin"]],
  rec: [["figure", "real-a:1", "", "everest"], ["ground", "real-b:3", "", "tokyo"]],
};
fs.mkdirSync(path.join(HERE, "shots"), { recursive: true });
const browser = await chromium.launch();
const problems = [];
for (const stage of stages) {
  for (const [w, h] of [[375, 812], [1200, 900]]) for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: w < 500 ? 2 : 1 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(`${stage} ${w} ${scheme}: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") problems.push(`${stage} ${w} ${scheme} console: ${m.text()}`); });
    const list = [...SHOTS[stage].map(([f, t]) => [f, t, "", ""]), ...EXTRA[stage]];
    for (const [face, turn, sel, tag] of list) {
      const hash = `face=${face}&turn=${encodeURIComponent(turn)}${sel ? "&sel=" + sel : ""}`;
      await page.goto(pathToFileURL(path.join(HERE, stage + ".html")).href + "#" + hash);
      await page.reload();
      await page.waitForTimeout(80);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (over > 1) problems.push(`${stage} ${face} ${turn} ${w} ${scheme}: horizontal overflow ${over}px`);
      const name = `${stage}-${face}${tag ? "-" + tag : ""}-${w}-${scheme}.png`;
      await page.screenshot({ path: path.join(HERE, "shots", name), fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close();
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "no page errors, no horizontal overflow");
