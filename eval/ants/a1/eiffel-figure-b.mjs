import { openChat } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
import * as O from "../../../fold-chat-origin.js";
const browser = await chromium.launch(); const { page } = await openChat(browser);
for (const u of ["https://www.worldatlas.com/articles/how-tall-is-the-eiffel-tower.html", "https://eiffeltowertravel.com/height-and-facts", "https://place-du-trocadero.fr/en/eiffel-tower-height/"]) {
  const x = await page.evaluate(async (u) => { const w = await import("/fold-chat-web.js"); const r = await w.readText(u, { fetchImpl: (a, o) => fetch(a, o), memo: w.makeMemo(), timeoutMs: 6000 }); return { ok: r.ok, via: r.via, text: r.text || "", title: r.title }; }, u);
  const sents = x.text.split(/(?<=[.!?])\s+/).filter((s) => /330|1,?083|1,?063|324/.test(s)).slice(0, 3).map((s) => s.slice(0, 160));
  console.log("\n" + u, x.ok, x.via, x.text.length, JSON.stringify(sents));
  for (const c of ["The Eiffel Tower is 330 meters (1,083 ft) tall.", "The Eiffel Tower is 330 meters tall.", "The Eiffel Tower is 1,083 feet tall."]) { const s = O.supportOf(c, { url: u, title: x.title, text: x.text }, { forWhom: "How tall is the Eiffel Tower?" }); console.log("  ", s.verdict, s.why || "", s.detail || "", "|", c, "|", (s.sentence || "").slice(0, 100)); }
}
await browser.close();
