import * as H from "./lib.mjs";
const page = await H.fetchPage("https://www.alattefood.com/banana-bread/");
const s = await H.snip(page, "banana bread recipe");
const lex = s.snips.find((x) => x.rung === "d");
// replicate isVerbatim's internals
const dec = (x) => String(x ?? "").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (x) => dec(x).replace(/<[^>]+>/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
const hay = norm(H.visibleText(page.html));
const parts = norm(lex.text).replace(/\s*(…|\.\.\.)\s*/g, "\u0000").split("\u0000").map((x) => x.trim()).filter((x) => x.length > 3);
console.log("parts:", parts.length, parts.map((p) => p.length));
for (const p of parts) { console.log("in hay:", hay.includes(p)); if (!hay.includes(p)) { let k = p.length; while (k > 10 && !hay.includes(p.slice(0, k))) k -= 10; console.log("  longest prefix found ~", k, "of", p.length, "| next chars snippet:", JSON.stringify(p.slice(k, k + 40)), "| hay at:", JSON.stringify(hay.slice(hay.indexOf(p.slice(0, 20)) + k, hay.indexOf(p.slice(0, 20)) + k + 40))); } }
console.log("isVerbatim:", H.isVerbatim(lex.text, page.html));
await H.close();
