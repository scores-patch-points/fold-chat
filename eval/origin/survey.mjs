// eval/origin/survey.mjs — LIVE: how often does a Wikipedia sentence reach an ORIGIN page (fold-chat-origin.js followClaim)?
// Not a unit test (network). Run: node eval/origin/survey.mjs [title …]. Prints one row per sentence and a tally; paste the tally into RESULTS.md with the date.
import { followClaim, pathWords } from "../../fold-chat-origin.js";
import { splitSentences } from "../../fold-chat-ground.js";
const ua = (u, o = {}) => fetch(u, { ...o, headers: { "user-agent": "the-fold-dev/1.0 (eval/origin/survey.mjs)", ...(o.headers || {}) } });
const titles = process.argv.slice(2).length ? process.argv.slice(2) : ["Marie_Curie", "Apollo_11", "Nashville,_Tennessee", "Monarchy_of_the_United_Kingdom", "Eiffel_Tower", "Charles_III"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// politeness: Wikipedia answers "too many requests" with plain text — wait and retry once rather than crash
async function getJson(url) {
  for (let i = 0; i < 3; i++) { const r = await ua(url); const t = await r.text(); try { return JSON.parse(t); } catch { await sleep(4000 * (i + 1)); } }
  throw new Error("Wikipedia would not answer: " + url);
}
const memo = { pages: new Map(), dead: new Map() };
const tally = {}, reasons = {};
for (const title of titles) {
  await sleep(1500);
  const ex = Object.values((await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`)).query.pages)[0].extract;
  for (const s of splitSentences(ex).slice(0, 5)) {
    const t0 = Date.now();
    const tr = await followClaim({ sentence: s, passage: { url: "https://en.wikipedia.org/wiki/" + title, text: ex }, fetchImpl: ua, memo });
    tally[tr.status] = (tally[tr.status] || 0) + 1;
    const verdicts = tr.tried.filter((x) => x.verdict).map((x) => x.verdict).join("/");
    for (const x of tr.tried) if (x.read && x.supports === false) { const m = /\(([\w-]+)\)/.exec(x.why || ""); const k = x.verdict === "different" ? "different" : m ? m[1] : "other"; reasons[k] = (reasons[k] || 0) + 1; }
    for (const x of tr.tried) if (x.read === false && x.url) reasons["page-unreadable"] = (reasons["page-unreadable"] || 0) + 1;
    console.log(`${title.slice(0, 14).padEnd(14)} ${tr.status.padEnd(12)} ${String(Date.now() - t0).padStart(5)}ms refs=${tr.refs.length} ${verdicts.padEnd(18)} ${s.slice(0, 56)}${tr.origin ? "\n      → " + pathWords(tr).map((h) => h.text).join(" → ") + " @ " + tr.origin.address : ""}`);
  }
}
console.log("\nREASONS a read page did not support the claim (per page tried):", JSON.stringify(reasons));
console.log("\nTALLY", JSON.stringify(tally), "of", Object.values(tally).reduce((a, b) => a + b, 0), "sentences");
