// A1: SIMULATION of the cheapest alternative fix: for the ATOMIC spoken claim, take the web search's non-encyclopedia results, read each (real browser page chain = relay), and ask supportOf. How many of the five get a "same" page?
import fs from "node:fs";
import { openChat } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
import * as O from "../../../fold-chat-origin.js";
const Q = [["Who is the king of the UK?", "King Charles III is the king of the UK.", ["Who is the king of the UK?", "king of the United Kingdom", "current British monarch"]], ["How tall is the Eiffel Tower?", "The Eiffel Tower is 330 meters (1,083 ft) tall.", ["How tall is the Eiffel Tower?"]], ["What is the capital of Australia?", "Canberra is the capital of Australia.", ["What is the capital of Australia?"]], ["How many legs does a spider have?", "A spider has eight legs.", ["How many legs does a spider have?", "spider legs eight"]], ["When did Marie Curie die?", "Marie Curie died on 4 July 1934.", ["When did Marie Curie die?"]]];
const browser = await chromium.launch(); const { page } = await openChat(browser); const out = [];
for (const [ask, claim, queries] of Q) {
  let hits = [];
  for (const q of queries) { for (let k = 0; k < 2 && !hits.length; k++) { hits = await page.evaluate(async (q) => { const w = await import("/fold-chat-web.js"); try { const r = await w.search("web", q, 0, { fetchImpl: (a, o) => fetch(a, o) }); return (r.results || []).map((x) => ({ url: x.url, title: x.title })); } catch (e) { return [{ err: String(e) }]; } }, q); if (!hits.length || hits[0].err) { await new Promise((z) => setTimeout(z, 3000)); hits = hits.filter((h) => !h.err); } } if (hits.length) break; }
  hits = hits.filter((h) => h.url && !O.isTertiary(h.url)).slice(0, 8);
  const rows = [];
  for (const h of hits) { const b = await page.evaluate(async (u) => { const w = await import("/fold-chat-web.js"); const x = await w.readText(u, { fetchImpl: (a, o) => fetch(a, o), memo: w.makeMemo(), timeoutMs: 6000 }); return { ok: x.ok, via: x.via, text: x.text || "", title: x.title }; }, h.url);
    const s = b.ok ? O.supportOf(claim, { url: h.url, title: b.title, text: b.text }, { forWhom: ask }) : null;
    rows.push({ url: h.url, ok: b.ok, via: b.via, verdict: s ? s.verdict + (s.why ? "/" + s.why : "") : null, sentence: s && s.sentence ? s.sentence.slice(0, 110) : null }); }
  out.push({ ask, claim, hits: hits.length, read: rows.filter((r) => r.ok).length, same: rows.filter((r) => /^same/.test(r.verdict || "")).length, rows });
  console.log("\n" + ask, "| non-encyclopedia hits", hits.length, "read ok", rows.filter((r) => r.ok).length, "SAME", rows.filter((r) => /^same/.test(r.verdict || "")).length);
  for (const r of rows) console.log("   ", r.ok ? (r.via || "").slice(0, 8) : "FAIL", (r.verdict || "-").padEnd(26), r.url.slice(0, 80), r.sentence ? "| " + r.sentence : "");
}
fs.writeFileSync(new URL("./search-fix-sim.json", import.meta.url), JSON.stringify(out, null, 1)); await browser.close();
