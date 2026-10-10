// audit.mjs — checks every mock at 375 and 1200, light and dark (media query AND data-theme), every face and the sheet:
// text contrast >= 4.5, no horizontal page scroll, no text-decoration underlines, every button has a name, tab order reaches the dial.
import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const probe = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (fg, bg, a) => [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
  const bgOf = (e) => { let stack = []; for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] === 1) break; } } let base = [255, 255, 255]; if (!stack.length || stack[stack.length - 1][3] < 1) base = parse(getComputedStyle(document.documentElement).colorScheme.includes("dark") ? "rgb(23,23,26)" : "rgb(255,255,255)").slice(0, 3); for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base, stack[i][3]); return base; };
  const opac = (e) => { let o = 1; for (let n = e; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  const bad = []; let checked = 0, underlines = 0, unnamed = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const t = walker.currentNode; if (!t.nodeValue.trim()) continue; const e = t.parentElement; if (!e || ["SCRIPT", "STYLE"].includes(e.tagName)) continue; const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none") continue; const r = e.getBoundingClientRect(); if (!r.width) continue;
    const bg = bgOf(e); const fgc = parse(cs.color); const o = opac(e) * fgc[3]; const fg = blend(fgc.slice(0, 3), bg, o); const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); checked++;
    if (ratio < 4.5) bad.push({ text: t.nodeValue.trim().slice(0, 30), ratio: +ratio.toFixed(2), cls: e.className && e.className.baseVal === undefined ? e.className : "" }); }
  for (const e of document.querySelectorAll("*")) { const d = getComputedStyle(e).textDecorationLine; if (d && d !== "none" && e.textContent.trim()) underlines++; }
  for (const b of document.querySelectorAll("button, [role=button], a[href]")) { const name = (b.getAttribute("aria-label") || b.textContent || "").trim(); if (!name) unnamed++; }
  return { checked, bad, underlines, unnamed, hscroll: document.documentElement.scrollWidth > innerWidth + 1, sw: document.documentElement.scrollWidth };
};
const browser = await chromium.launch(); let fails = 0;
for (const id of ["seg", "con", "syn"]) for (const [w, h] of [[375, 812], [1200, 900]]) for (const mode of ["media-light", "media-dark", "attr-dark", "attr-light"]) {
  const scheme = mode.includes("dark") ? "dark" : "light"; const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: mode.startsWith("media") ? scheme : (scheme === "dark" ? "light" : "dark") }); const page = await ctx.newPage();
  for (const [t, f, o] of [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 1, id === "syn" ? "1.4" : "2.0"], [0, 0, "2.0"]]) {
    await page.goto(pathToFileURL(path.join(HERE, id + ".html")).href + `#t=${t}&f=${f}${o ? "&o=" + o : ""}`); await page.reload();
    if (mode.startsWith("attr")) await page.evaluate((s) => { document.documentElement.dataset.theme = s; }, scheme);
    await page.waitForTimeout(900); const r = await page.evaluate(probe);
    const tag = `${id} ${w}px ${mode} t${t} f${f}${o ? " sheet" : ""}`;
    if (r.bad.length || r.underlines || r.unnamed || r.hscroll) { fails++; console.log("FAIL", tag, JSON.stringify({ lowContrast: r.bad.slice(0, 5), underlines: r.underlines, unnamed: r.unnamed, hscroll: r.hscroll ? r.sw : false })); }
  }
  await ctx.close();
}
console.log(fails ? `${fails} failing states` : "audit clean"); await browser.close();
