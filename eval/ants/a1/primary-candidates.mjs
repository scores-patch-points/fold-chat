// A1: for each ask, plausible PRIMARY pages: read them (Node direct chain AND the real browser page's chain) and test supportOf with the claim the chat spoke / the Wikipedia sentence it quoted.
import fs from "node:fs";
import { openChat } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
import * as web from "../../../fold-chat-web.js";
import * as O from "../../../fold-chat-origin.js";
const C = [
  ["king", "The monarch since 8 September 2022 is King Charles III, who ascended the throne on the death of his mother, Queen Elizabeth II.", ["https://www.royal.uk/the-king", "https://www.royal.uk/", "https://www.royal.uk/the-royal-family", "https://www.gov.uk/government/organisations/royal-household"]],
  ["eiffel", "The tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris.", ["https://www.toureiffel.paris/en/the-monument/key-figures", "https://www.toureiffel.paris/en/the-monument", "https://www.toureiffel.paris/en/the-monument/tower-numbers"]],
  ["australia", "One of these, Canberra, is also the national capital.", ["https://www.australia.gov.au/states-and-territories", "https://www.aph.gov.au/About_Parliament/House_of_Representatives/Powers_practice_and_procedure/Practice7/HTML/Chapter1", "https://www.nca.gov.au/", "https://www.australia.gov.au/about-australia"]],
  ["spider", "Spiders typically have eight walking legs (insects have six).", ["https://www.burkemuseum.org/collections-and-research/biology/arachnology-and-entomology/spider-myths/myth-eight-legs-always-means-spider", "https://www.britannica.com/animal/spider-arachnid", "https://www.nhm.ac.uk/discover/spiders.html"]],
  ["curie", "Marie Curie died on 4 July 1934.", ["https://www.nobelprize.org/prizes/physics/1903/marie-curie/questions-and-answers/", "https://www.nobelprize.org/prizes/physics/1903/marie-curie/biographical/", "https://www.nps.gov/people/manhattan-project-pioneers-marie-curie.htm"]],
];
const browser = await chromium.launch(); const { page } = await openChat(browser); const out = [];
for (const [ask, claim, urls] of C) for (const u of urls) {
  const t = Date.now(); const n = await web.readText(u, { fetchImpl: fetch, memo: web.makeMemo(), timeoutMs: 6000 });
  const b = await page.evaluate(async (u) => { const w = await import("/fold-chat-web.js"); const t = Date.now(); const x = await w.readText(u, { fetchImpl: (a, o) => fetch(a, o), memo: w.makeMemo(), timeoutMs: 6000 }); return { ok: x.ok, via: x.via, err: x.error, text: x.text || "", title: x.title, ms: Date.now() - t }; }, u);
  const row = { ask, u, node: { ok: n.ok, via: n.via }, browser: { ok: b.ok, via: b.via, err: b.err, ms: b.ms } };
  for (const [k, x] of [["node", n], ["browser", b]]) if (x.ok) { const s = O.supportOf(claim, { url: u, title: x.title, text: x.text }, { forWhom: ask }); row[k].verdict = s.verdict + (s.why ? "/" + s.why : ""); row[k].sentence = (s.sentence || "").slice(0, 120); }
  out.push(row); console.log(ask.padEnd(9), u.slice(0, 80).padEnd(80), "node", n.ok ? n.via + ":" + row.node.verdict : "FAIL", "| browser", b.ok ? b.via + ":" + row.browser.verdict : "FAIL " + b.err, row.browser.sentence ? "| " + row.browser.sentence : "");
}
fs.writeFileSync(new URL("./primary-candidates.json", import.meta.url), JSON.stringify(out, null, 1)); await browser.close();
