// contact.mjs — the contact sheet: real cached pages -> sitestyle tokens -> a specimen in each site's look, light and dark side by side.
//   node docs/playback/nav/contact.mjs          writes contact-sheet.html and shots/sites-contact-{1200,375}.png
// Text in each specimen is the page's own <h1> and first paragraphs from the cached HTML. Tokens come from inline <style> + metas only
// (the linked stylesheets are not in the cache), so what you see is the FLOOR of what the production relay would read.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
import { prepare, extractSiteTokens, tokensToVars, validateTokens, TOKEN_KEYS } from "./sitestyle.mjs";
import { typeOf } from "../../../fold-chat-present.js";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HERE, "../../..");
const SITES = [
  ["en.wikipedia.org", "encyclopedia"], ["www.bbc.com", "news"], ["www.usatoday.com", "news"], ["www.nhs.uk", "government / health"], ["www.usa.gov", "government"], ["www.cdc.gov", "government / health"],
  ["www.ssa.gov", "government"], ["www.wikihow.com", "how-to"], ["www.nobelprize.org", "organisation"], ["anitalianinmykitchen.com", "blog"], ["thediyplaybook.com", "blog"],
  ["docs.python.org", "docs"], ["developer.mozilla.org", "docs"], ["www.w3schools.com", "docs / tutorial"], ["github.com", "code host"], ["www.britannica.com", "encyclopedia"],
];
const dirs = ["eval/snips/cache", "eval/swarm/cache"].map((d) => path.join(ROOT, d));
const byHost = new Map();
for (const dir of dirs) for (const f of fs.readdirSync(dir)) { if (!f.endsWith(".json")) continue; let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; } if (!/html/.test(j.ctype || "") || /holodeck/.test(j.url)) continue; let h; try { h = new URL(j.url).hostname; } catch { continue; } if (!byHost.has(h)) byHost.set(h, []); byHost.get(h).push({ body: path.join(dir, f.replace(".json", ".body")), url: j.url }); }
const decode = (t) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&rsquo;/g, "’").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const BOILER = /cookie|log ?in|subscribe|sign up|©|copyright|official website|\.gov|browser|javascript|skip to|menu|donate|newsletter|advert/i;
function specimen(html) {
  const s = html.replace(/<(script|style|noscript|svg|template|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const h1 = (/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(s) || [])[1]; let title = h1 ? decode(h1.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : ""; if (!title) title = decode(((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "").replace(/<[^>]+>/g, "")).split(/\s[|\u2013\u2014-]\s/)[0].trim();
  const ps = []; for (const m of s.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) { const t = decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(); if (t.length >= 90 && t.length <= 420 && !BOILER.test(t) && /^[\x20-\x7e‘-”–—]+$/.test(t)) ps.push(t); if (ps.length === 2) break; }
  return { title, ps };
}
const rows = [];
for (const [host, cat] of SITES) {
  const cands = (byHost.get(host) || []).filter((c) => fs.existsSync(c.body)).map((c) => { const html = fs.readFileSync(c.body, "utf8"); const prepared = prepare({ html }); const f = (th) => extractSiteTokens({ html, prepared, domain: host.replace(/^www\./, ""), theme: th }, { typeOf }); const L = f("light"), D = f("dark"); const sp = specimen(html); return { c, L, D, found: L.meta.found + D.meta.found, sp }; });
  if (!cands.length) { console.log("no cached page for", host); continue; }
  // the LOOK is a property of the site: take it from the cached page that gives the most tokens; the SPECIMEN text from the page with the best prose
  const look = [...cands].sort((a, b) => b.found - a.found)[0];
  const prose = [...cands].sort((a, b) => (b.sp.title && b.sp.ps.length >= 2 && !/not found|moment|denied/i.test(b.sp.title) ? 1 : 0) - (a.sp.title && a.sp.ps.length >= 2 && !/not found|moment|denied/i.test(a.sp.title) ? 1 : 0) || b.found - a.found)[0];
  for (const t of [look.L, look.D]) { const e = validateTokens(t.tokens); if (e.length) throw new Error(host + " " + e); }
  rows.push({ host, cat, url: prose.c.url, L: look.L, D: look.D, sp: prose.sp, basis: look.c.url === prose.c.url ? "same page" : "look from another cached page of the site" });
}
// three ILLUSTRATIVE tiles through the stylesheet path (css: [...]); hand-written fixtures, NOT fetched from any real site
const SYN = [
  ["synthetic: editorial serif", "fixture", "body{background:#faf3e0;color:#2b2118;font-family:'Iowan Old Style',Charter,serif;max-width:34em} h1,h2{font-family:Garamond,'Times New Roman',serif;font-weight:400;text-transform:uppercase} a{color:#8a2a12} :root{--accent:#8a2a12}", { title: "ON THE ORIGIN OF A THING", ps: ["The page keeps its own paper, its own faces and its own habit of capitalising headings; the layer borrows those and nothing else.", "Nothing here was fetched: this is a hand-written stylesheet that shows what the stylesheet path reads."] }],
  ["synthetic: civic sans", "fixture", "html{background:#eef3f8;color:#0b1f33;font-family:Arial,Helvetica,sans-serif} h1{font-weight:700;font-family:Arial,sans-serif} a{color:#005ea5} .btn{border-radius:0} main{max-width:44rem} @media (prefers-color-scheme:dark){html{background:#0b1623;color:#e6eef7} a{color:#6cb4ee}}", { title: "Check how long it takes", ps: ["A plain sans, a pale blue ground, square buttons and a narrow column: the identity of a public-service site in four lines of css.", "This one declares its own dark layer, so in a dark app the layer wears that instead of a derived one."] }],
  ["synthetic: dark-first docs", "fixture", ":root{--bg:#10151c;--fg:#d6dee8;--accent:#3ddc97;--link:#6fb7ff} body{background:var(--bg);color:var(--fg);font-family:ui-monospace,Menlo,monospace} h1,h2{font-family:system-ui,sans-serif;font-weight:600} a{color:var(--link)} .card{border-radius:8px}", { title: "reference/overview", ps: ["A site that is only dark. In a light app the layer derives a light paper from this site's own hue and keeps its accent, rather than painting a dark hole in the page.", "The ink is the thing that moves when contrast is short; the paper never does."] }],
];
for (const [host, cat, css, sp] of SYN) { const prepared = prepare({ css: [css] }); const L = extractSiteTokens({ prepared, domain: "", theme: "light" }, { typeOf }), D = extractSiteTokens({ prepared, domain: "", theme: "dark" }, { typeOf }); for (const t of [L, D]) { const e = validateTokens(t.tokens); if (e.length) throw new Error(host + e); } rows.push({ host, cat, url: "", L, D, sp, basis: "hand-written stylesheet fixture" }); }
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pips = (m) => TOKEN_KEYS.map((k) => `<i class="${/^site-(css|var)|^meta-/.test(m.from[k] || "") ? "on" : /^site-type/.test(m.from[k] || "") ? "st" : ""}" title="${k}: ${esc(m.from[k])}"></i>`).join("");
const card = (t, label, sp) => `<div class="sp wear" style="${tokensToVars(t.tokens)}"><div class="meta"><b>${label}</b><span>${esc(t.meta.scheme)}</span></div><h3 class="w-title">${esc(sp.title || "(no <h1> in the cached page)")}</h3>${sp.ps.map((p, i) => `<p>${esc(p)}${i === 0 ? ` <a class="lnk">a link in the page</a>` : ""}</p>`).join("")}<hr><div class="row"><span class="btn">Button</span><span class="acc"></span><small>measure ${t.tokens.measure}ch &middot; radius ${t.tokens.radius}px &middot; title ${t.tokens.titleWeight}${t.tokens.titleCase !== "none" ? " " + t.tokens.titleCase : ""}</small></div><div class="ct">ink ${t.meta.contrast.ink}:1 &middot; link ${t.meta.contrast.link}:1 &middot; accent ${t.meta.contrast.accent}:1</div></div>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wear the site: contact sheet</title><style>
:root{--bg:#f4f4f6;--ink:#141416;--mut:#5f5f6b;--line:#d7d7de;--sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#101013;--ink:#f4f4f6;--mut:#9d9da8;--line:#2e2e33}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 var(--sans);padding:20px 16px 40px}
h1{font:700 20px/1.2 var(--sans);margin:0 0 4px}.lede{max-width:78ch;color:var(--mut);margin:0 0 18px;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}@media(max-width:820px){.grid{grid-template-columns:1fr}}
.tile{border:1px solid var(--line);border-radius:12px;padding:12px;background:color-mix(in srgb,var(--bg) 70%,transparent)}
.th{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 8px}.th b{font-size:15px}.th span{color:var(--mut);font:11px/1 var(--mono)}
.pips{display:inline-flex;gap:2px;margin-left:auto}.pips i{width:9px;height:9px;border-radius:2px;background:var(--line)}.pips i.on{background:#16793a}.pips i.st{background:#c9a227}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:520px){.pair{grid-template-columns:1fr}}
.sp{padding:12px 12px 10px;border:1px solid var(--s-rule);border-radius:var(--s-radius);background:var(--s-paper);color:var(--s-ink);font-family:var(--s-body);min-width:0}
.sp .meta{display:flex;justify-content:space-between;font:10px/1 var(--mono);color:var(--s-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}
.sp h3{font:var(--s-tw) 19px/1.2 var(--s-title);font-family:var(--s-title);font-weight:var(--s-tw);text-transform:var(--s-tcase);margin:0 0 8px;overflow-wrap:anywhere}
.sp p{margin:0 0 8px;font-size:13.5px;line-height:1.5;max-width:var(--s-measure)}.sp .lnk{color:var(--s-link)}
.sp hr{border:0;border-top:1px solid var(--s-rule);margin:8px 0}.sp .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sp .btn{background:var(--s-accent);color:var(--s-paper);border-radius:calc(var(--s-radius) + 4px);padding:5px 12px;font:600 12px/1 var(--sans)}
.sp .acc{width:14px;height:14px;border-radius:50%;background:var(--s-accent)}.sp small{font:10.5px/1.2 var(--mono);color:var(--s-muted)}.sp .ct{font:10px/1.2 var(--mono);color:var(--s-muted);margin-top:6px}
.key{display:flex;gap:14px;font:11px/1 var(--mono);color:var(--mut);margin:0 0 14px;flex-wrap:wrap}.key i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}
</style></head><body>
<h1>Wear the site: ${rows.length - SYN.length} real cached sites + ${SYN.length} stylesheet fixtures</h1>
<p class="lede">Each pair is one site, light app theme left, dark right. The twelve squares are the tokens (${TOKEN_KEYS.join(", ")}): green = read from the page's own inline css / custom properties / metas, amber = from the SITE_TYPE table, grey = neutral default or derived. Only inline &lt;style&gt;, root attributes and metas were in the cache; the linked stylesheets were not, so most sites show less identity here than the relay would read live.</p>
<div class="key"><span><i style="background:#16793a"></i>read from the site</span><span><i style="background:#c9a227"></i>SITE_TYPE entry</span><span><i style="background:var(--line)"></i>neutral / derived</span></div>
<div class="grid">${rows.map((r) => `<section class="tile"><div class="th"><b>${esc(r.host)}</b><span>${esc(r.cat)}</span><span>found ${r.L.meta.found}/12 light &middot; ${r.D.meta.found}/12 dark &middot; ${esc(r.basis)}</span><span class="pips" aria-hidden="true">${pips(r.L.meta)}</span></div><div class="pair">${card(r.L, "light", r.sp)}${card(r.D, "dark", r.sp)}</div></section>`).join("")}</div>
</body></html>`;
fs.writeFileSync(path.join(HERE, "contact-sheet.html"), html);
console.log(rows.length, "sites"); for (const r of rows) console.log(" ", r.host.padEnd(28), "found", r.L.meta.found, "/", r.D.meta.found, "|", r.L.tokens.paper, r.L.tokens.accent, r.L.meta.scheme, "|", r.D.tokens.paper, r.D.meta.scheme, "|", JSON.stringify(r.sp.title).slice(0, 50));
fs.mkdirSync(path.join(HERE, "shots"), { recursive: true });
const b = await chromium.launch();
for (const [w, h, name] of [[1200, 900, "1200"], [375, 812, "375"]]) { for (const scheme of ["light", "dark"]) { const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: w < 500 ? 2 : 1 }); const p = await ctx.newPage(); await p.goto(pathToFileURL(path.join(HERE, "contact-sheet.html")).href); await p.screenshot({ path: path.join(HERE, "shots", `sites-contact-${name}-${scheme}.png`), fullPage: true }); await ctx.close(); } }
await b.close(); console.log("contact done");
