// A1: same candidate pages, but test the CLAIM VARIANT: whole Wikipedia sentence vs the spoken answer vs the atomic claim. Pages read through the real browser chain (relay) where Node cannot.
import fs from "node:fs";
import { openChat } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
import * as O from "../../../fold-chat-origin.js";
const C = [
  ["king", ["https://www.royal.uk/the-king", "https://www.royal.uk/"], /Charles|King/, ["The monarch since 8 September 2022 is King Charles III, who ascended the throne on the death of his mother, Queen Elizabeth II.", "King Charles III is the king of the UK.", "The King of the United Kingdom is Charles III."]],
  ["eiffel", ["https://www.toureiffel.paris/en/the-monument/key-figures"], /330|1,?083|height/i, ["The tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris.", "The Eiffel Tower is 330 meters (1,083 ft) tall.", "The Eiffel Tower is 330 metres tall."]],
  ["australia", ["https://www.australia.gov.au/states-and-territories", "https://www.nca.gov.au/"], /Canberra/, ["One of these, Canberra, is also the national capital.", "Canberra is the capital of Australia.", "The capital of Australia is Canberra."]],
  ["spider", ["https://www.britannica.com/animal/spider-arachnid", "https://www.nhm.ac.uk/discover/spiders.html"], /eight|8 legs/i, ["Spiders typically have eight walking legs (insects have six).", "A spider has eight legs.", "Spiders have eight legs."]],
];
const browser = await chromium.launch(); const { page } = await openChat(browser); const out = [];
for (const [ask, urls, re, claims] of C) for (const u of urls) {
  const b = await page.evaluate(async (u) => { const w = await import("/fold-chat-web.js"); const x = await w.readText(u, { fetchImpl: (a, o) => fetch(a, o), memo: w.makeMemo(), timeoutMs: 6000 }); return { ok: x.ok, via: x.via, text: x.text || "", title: x.title }; }, u);
  const sents = (b.text || "").split(/(?<=[.!?])\s+/).filter((s) => re.test(s)).slice(0, 3).map((s) => s.slice(0, 140));
  const row = { ask, u, ok: b.ok, via: b.via, pageSentences: sents, variants: claims.map((c) => { if (!b.ok) return { c }; const s = O.supportOf(c, { url: u, title: b.title, text: b.text }, { forWhom: ask }); return { c: c.slice(0, 70), v: s.verdict + (s.why ? "/" + s.why : ""), sentence: (s.sentence || "").slice(0, 100) }; }) };
  out.push(row); console.log("\n" + ask, u, b.ok ? b.via : "FAIL"); console.log("  page says:", JSON.stringify(sents)); for (const v of row.variants) console.log("   ", v.v, "|", v.c, v.sentence ? "| " + v.sentence : "");
}
fs.writeFileSync(new URL("./claim-variants.json", import.meta.url), JSON.stringify(out, null, 1)); await browser.close();
