// docs/playback/interpretation/audit.mjs — contrast (>= 4.5:1) and minimum size (>= 12px) of every text run on every stage x face x scheme x width; keyboard walk of the tabs.
//   node docs/playback/interpretation/audit.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const b = await chromium.launch(); const bad = new Map(); let checked = 0;
for (const stage of ["def", "eva", "rec"]) for (const scheme of ["light", "dark"]) for (const w of [375, 1200]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme }); const p = await ctx.newPage();
  for (const face of ["ground", "figure", "pattern"]) for (const turn of ["real-a:1", "real-b:0", "real-b:9"]) {
    await p.goto(pathToFileURL(path.join(HERE, stage + ".html")).href + `#face=${face}&turn=${encodeURIComponent(turn)}`); await p.reload();
    const r = await p.evaluate(() => {
      const out = [];
      const lum = (c) => { const f = (x) => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(",").map(Number); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
      const bgOf = (el) => { while (el) { const c = parse(getComputedStyle(el).backgroundColor); if (c && c[3] > 0.5) return c; el = el.parentElement; } return [255, 255, 255, 1]; };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = walker.nextNode())) {
        if (!n.data.trim()) continue; const el = n.parentElement;
        if (!el || el.closest(".sr,script,style") || el.closest(".rail:not(.open)") && matchMedia("(max-width:899px)").matches) continue;
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue;
        const rect = el.getBoundingClientRect(); if (!rect.width) continue;
        const fg = parse(cs.color), bg = bgOf(el), L1 = lum(fg), L2 = lum(bg);
        out.push([(Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05), parseFloat(cs.fontSize), n.data.trim().slice(0, 30), el.className || el.tagName]);
      }
      return out;
    });
    for (const [ratio, size, t, c] of r) { checked++; if (ratio < 4.5 || size < 12) bad.set(`${stage}/${face}/${scheme}/${w}: ${ratio.toFixed(2)}:1 ${size}px "${t}" ${c}`, 1); }
  }
  await ctx.close();
}
console.log("text runs checked:", checked);
console.log([...bad.keys()].slice(0, 40).join("\n") || "all >= 4.5:1 and >= 12px", "| failures:", bad.size);
// keyboard: arrow keys move between the three faces; Tab reaches the first row; Enter opens the reader
const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const p = await ctx.newPage();
await p.goto(pathToFileURL(path.join(HERE, "eva.html")).href + "#face=figure&turn=real-a%3A1"); await p.reload();
await p.focus("#tab-figure"); await p.keyboard.press("ArrowRight");
const f1 = await p.evaluate(() => document.querySelector("[role=tab][aria-selected=true]").dataset.k);
await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft");
const f2 = await p.evaluate(() => document.querySelector("[role=tab][aria-selected=true]").dataset.k);
await p.keyboard.press("ArrowRight"); await p.keyboard.press("Tab"); await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
const act = await p.evaluate(() => document.activeElement.className); await p.keyboard.press("Enter");
const opened = await p.evaluate(() => document.querySelector(".rail h3")?.textContent);
console.log("keyboard: ArrowRight ->", f1, "| ArrowLeft x2 ->", f2, "| focus after 3 Tabs:", act, "| Enter opens:", opened);
await b.close();
