// compare.mjs — lays the screenshots of the four models side by side (one row per model) into shots/compare-*.png
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const HERE = path.dirname(fileURLToPath(import.meta.url)), S = path.join(HERE, "shots");
const M = [["a-sheets", "A sheet stack"], ["b-push", "B push + spine"], ["c-zoom", "C spatial zoom"], ["d-split", "D split / sheets"]];
const SETS = [
  ["375-light", "375", "light", [["d1", "depth 1 card"], ["d3", "depth 3 page"], ["d5", "depth 5 passage"], ["d6", "depth 6 site"], ["wall6", "wall, 6 deep"], ["mid", "mid-transition"]], 190],
  ["375-dark", "375", "dark", [["d0", "chat"], ["d1", "depth 1"], ["d3", "depth 3"], ["d5", "depth 5"], ["d6", "depth 6"], ["wall6", "wall, 6 deep"]], 190],
  ["1200-light", "1200", "light", [["d1", "depth 1"], ["d3", "depth 3"], ["d5", "depth 5"], ["d6", "depth 6"]], 290],
  ["1200-dark", "1200", "dark", [["d1", "depth 1"], ["d3", "depth 3"], ["d5", "depth 5"], ["d6", "depth 6"]], 290],
];
const b = await chromium.launch();
for (const [name, vp, scheme, cols, w] of SETS) {
  const html = `<body style="margin:0;background:#777;font:12px system-ui;color:#fff"><table style="border-spacing:6px">${M.map(([f, l]) => `<tr><td style="vertical-align:top;width:70px;font-weight:700">${l}</td>${cols.map(([d, cl]) => `<td style="vertical-align:top"><div style="font-size:10px;opacity:.85">${cl}</div><img width="${w}" src="${pathToFileURL(path.join(S, `${f}-${vp}-${scheme}-${d}.png`)).href}"></td>`).join("")}</tr>`).join("")}</table></body>`;
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } }); const hf = path.join(S, `.compare-${name}.html`); fs.writeFileSync(hf, html); await p.goto(pathToFileURL(hf).href); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(S, `compare-${name}.png`), fullPage: true }); await p.close(); fs.unlinkSync(hf);
}
await b.close(); console.log("compare done");
