// canon-scan.mjs — find a READABLE canonical source for asks whose first canon was blocked/404 (gold stays the same; only the source of verification changes).
import fs from "node:fs";
import { get, closeNet } from "./lib/net.mjs";
import { gnorm, visibleNorm, decodeEntities } from "./lib/text.mjs";
const { asks } = JSON.parse(fs.readFileSync(new URL("./asks.json", import.meta.url), "utf8"));
const C = {
  rec6: ["https://www.loveandlemons.com/how-to-cook-rice/", "https://www.recipetineats.com/how-to-cook-rice/", "https://thefoodcharlatan.com/how-to-cook-rice/"],
  how7: ["https://www.seriouseats.com/knife-skills-how-to-sharpen-a-knife", "https://www.montanaknifecompany.com/blogs/news/how-to-sharpen-a-knife-with-a-whetstone", "https://www.mediocrechef.com/blog/how-to-sharpen-kitchen-knives"],
  prd5: ["https://www.consumerreports.org/home-garden/mattresses/buying-guide/", "https://www.goodhousekeeping.com/home-products/a25695/mattress-buying-guide/", "https://www.mattressnerd.com/mattress-buying-guide/"],
  prd6: ["https://www.itpro.com/hardware/laptops/360012/4-best-laptops-for-programming", "https://www.rtings.com/laptop/reviews/best/by-usage/programming", "https://www.pcmag.com/picks/the-best-laptops-for-programmers"],
  law2: ["https://www.usa.gov/apply-adult-passport", "https://www.usps.com/international/passports.htm", "https://citizenpath.com/apply-for-a-us-passport-ds-11/"],
  str8: ["https://www.usatoday.com/story/travel/news/2026/01/07/passport-application-processing-times/88064071007/", "https://thepointsguy.com/news/passport-processing-status/", "https://www.visaverge.com/passport/us-passport-processing-times-current/"],
};
const re = (s) => new RegExp(s, "iu");
for (const [id, urls] of Object.entries(C)) {
  const a = asks.find((x) => x.id === id);
  for (const u of urls) {
    const r = await get(u, { transport: "chromium" });
    let note = "HTTP " + r.status;
    if (r.status >= 200 && r.status < 300) { const raw = r.body.toString("utf8"); const t = gnorm(visibleNorm(raw) + " " + decodeEntities([...raw.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join(" "))); const miss = a.gold.all.filter((x) => !re(x).test(t)); note = `ok ${t.length}c miss=[${miss.map((m) => m.slice(0, 20)).join("|")}] ${(/<title[^>]*>([^<]*)/i.exec(raw) || [])[1]?.slice(0, 50) || ""}`; }
    console.log(id.padEnd(5), u.slice(8, 80).padEnd(72), note);
  }
}
await closeNet();
