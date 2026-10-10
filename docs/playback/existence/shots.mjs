// shots.mjs — Playwright headless screenshots: each stage x face x {375, 1200} x {light, dark}, plus a contrast audit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv[2] ? process.argv[2].split(",") : ["nul", "sig", "ins"];
const faces = ["ground", "figure", "pattern"];
const sets = (process.env.DATA || "everest").split(",");
const browser = await chromium.launch();
const out = path.join(HERE, "shots"); fs.mkdirSync(out, { recursive: true });
const audit = [];
for (const stage of only) for (const w of [375, 1200]) for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 375 ? 812 : 900 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  for (const d of sets) for (const f of faces) {
    await page.goto(`file://${path.join(HERE, stage + ".html")}#d=${d}&f=${f}`);
    await page.reload(); await page.waitForTimeout(450);
    const name = `${stage}-${f}-${d}-${w}-${theme}.png`;
    await page.screenshot({ path: path.join(out, name), fullPage: true });
    const bad = await page.evaluate(contrastScript);
    for (const b of bad) audit.push({ stage, d, f, w, theme, ...b });
    // horizontal overflow check
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov > 1) audit.push({ stage, d, f, w, theme, overflow: ov });
  }
  if (errs.length) audit.push({ stage, w, theme, errors: errs.slice(0, 3) });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(HERE, "audit.json"), JSON.stringify(audit, null, 1));
console.log("audit entries:", audit.length); for (const a of audit.slice(0, 40)) console.log(JSON.stringify(a));

function contrastScript() {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; }
    const c = s.match(/color\(srgb ([^)]+)\)/); if (c) { const p = c[1].split(/[ \/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] == null ? 1 : p[3] }; } return null; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; const bc = parse(getComputedStyle(document.body).backgroundColor); if (bc) base = bc; for (const c of stack.reverse()) base = over(c, base); return base; };
  const bad = []; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || el.closest("[hidden]") || el.closest(".mock")) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let fg = parse(cs.color); if (!fg) continue; const bg = bgOf(el); fg = over({ ...fg, a: fg.a * (parseFloat(cs.opacity) || 1) }, bg);
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700; const need = px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
    if (ratio < need) { const key = el.className + "|" + n.nodeValue.trim().slice(0, 24); if (seen.has(key)) continue; seen.add(key); bad.push({ text: n.nodeValue.trim().slice(0, 40), cls: String(el.className).slice(0, 40), ratio: Math.round(ratio * 100) / 100, need, fg: cs.color, px }); }
  }
  return bad;
}
