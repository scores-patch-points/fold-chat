import { chromium } from "playwright";
import fs from "node:fs";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
await p.setContent(fs.readFileSync("pages/tip-suite.html", "utf8"));
await p.getByLabel(/bill/i).first().fill("100");
await p.screenshot({ path: "out/probe/tip-suite.png" });
await b.close();
