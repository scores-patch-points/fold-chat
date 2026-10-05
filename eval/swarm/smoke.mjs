import * as H from "./lib.mjs";
const page = await H.fetchPage("https://www.alattefood.com/banana-bread/");
console.log("page", page.ok, page.status, page.html.length, page.cached ? "(cached)" : "");
const s = await H.snip(page, "banana bread recipe");
console.log("snips:", s.snips.map((x) => `${x.rung}:${x.type} ${x.chars}c verbatim=${x.verbatim}`), "structured:", s.structuredTypes);
const c = await H.contact(page);
console.log("contact:", JSON.stringify(c));
await H.close();
