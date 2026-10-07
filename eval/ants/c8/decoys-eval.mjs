#!/usr/bin/env node
// eval/ants/c8/decoys-eval.mjs — the 20 frozen decoys (decoys.json) + mirrors against a primary-finder module, in BOTH claim wordings, three ways:
//   gate    : assertsClaim(claim, [heading + ] decoy sentence, {context: the page's own title/host})  -> accepted?
//   page    : a synthetic official-host page carrying the decoy (filler around it) through findPrimary with a WORST-CASE pointer that picks the decoy candidate whenever it is offered (prefilter off)
//   page+pf : the same page with the gate PRE-FILTERING the numbered list and the pointer taking #1 (any candidate that passes is returned)
// A decoy is ACCEPTED if any of the three accepts it under either wording. Mirrors: the TRUE sentence on a mirror/encyclopedia/farm host (and two text copies) must come back empty.
//   node eval/ants/c8/decoys-eval.mjs [a2|v2]      (a2 = fold-chat-primary.js as it stands)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const which = process.argv[2] || "v2";
const mod = await import(pathToFileURL(which === "a2" ? path.join(ROOT, "fold-chat-primary.js") : path.join(HERE, "primary-v2.mjs")).href);
const prov = await import(pathToFileURL(path.join(ROOT, "fold-chat-provenance.js")).href);
const { FUNCTION_WORDS } = await import(pathToFileURL(path.join(ROOT, "fold-chat-function-words.js")).href);
const fw = new Set(FUNCTION_WORDS.en);
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, "../primary-corpus.json"), "utf8"));
const D = JSON.parse(fs.readFileSync(path.join(HERE, "decoys.json"), "utf8"));
const claimOf = (id, lean) => { const c = corpus.claims.find((x) => x.id === id); return lean ? c.claimLean : c.claim; };
const FILL_A = "Welcome to the official information pages. Use the navigation to find opening hours, contact details, press releases and the archive of earlier announcements published by this office over many years.";
const FILL_B = "Cookies help us improve this site. You can change your preferences at any time. Follow us for updates, subscribe to the newsletter and read the accessibility statement and the legal notice of this website.";
const pageText = (d) => [FILL_A, d.heading ? d.heading : null, d.sentence, FILL_B].filter(Boolean).join("\n");
const norm = (t) => String(t).replace(/\s+/g, " ").trim();
const stubSearch = (url, title) => async () => [{ url, title, snippet: "" }];
const stubRead = (map) => async (u) => map[u] ?? null;

async function pageRun(claim, text, url, title, mode, decoyText) {
  const point = mode === "pf" ? async () => "1" : async (messages) => {
    const lines = String(messages[1].content).split("\n").filter((l) => /^\[\d+\]/.test(l));
    const hit = lines.find((l) => norm(l).includes(norm(decoyText))) || lines.find((l) => norm(l).includes(norm(decoyText).slice(0, 40)));
    return hit ? /^\[(\d+)\]/.exec(hit)[1] : "NONE";
  };
  const out = await mod.findPrimary({ claim, sentence: claim, indexHost: "en.wikipedia.org", search: stubSearch(url, title), readPage: stubRead({ [url]: text }), point, fw, limits: which === "v2" ? { prefilter: mode === "pf", fragmentMinRank: 0 } : {} });   // fragmentMinRank 0 = the STRESS setting: heading/fragment/pair candidates are offered on EVERY host, so the decoys meet the gate and not the host restriction
  return out;
}
function gateAccept(claim, d) {
  const text = (d.heading ? d.heading + " " : "") + d.sentence;
  const p = { url: "https://www." + d.host + "/page", title: d.title };
  if (which === "a2") { const rel = prov.bearsOn(claim, text, fw); return rel.ok && mod.assertsClaim(claim, text, { fw, indexHost: "en.wikipedia.org" }).ok; }
  return mod.assertsClaim(claim, text, { fw, indexHost: "en.wikipedia.org", context: mod.contextStems(p, fw) }).ok;
}
const rows = [];
for (const d of D.decoys) {
  const r = { id: d.id, cat: d.cat, claimId: d.claimId, accepted: [] };
  for (const lean of [false, true]) {
    const claim = claimOf(d.claimId, lean), url = "https://www." + d.host + "/page-" + d.id;
    if (gateAccept(claim, d)) r.accepted.push(`gate/${lean ? "lean" : "claim"}`);
    for (const mode of ["worst", "pf"]) {
      const o = await pageRun(claim, pageText(d), url, d.title, mode, d.sentence);
      if (o.passages.length) r.accepted.push(`page${mode === "pf" ? "+pf" : ""}/${lean ? "lean" : "claim"}`);
    }
  }
  rows.push(r);
}
const kl = [];
for (const k of D.knownLimit) for (const lean of [false, true]) { const o = await pageRun(claimOf(k.claimId, lean), pageText({ sentence: k.sentence }), "https://www.example-gov.gov/p", "Info", "worst", k.sentence); kl.push({ id: k.id, lean, accepted: o.passages.length > 0 }); }
const mir = [];
const TRUE = { "height-eiffel": "The Eiffel Tower is 330 metres tall.", "capital": "Canberra is the capital of Australia.", "count-senate": "The United States Senate has 100 senators.", "count-bones": "An adult human has 206 bones.", "death-curie": "Marie Curie died on 4 July 1934.", "award-einstein": "Albert Einstein won the 1921 Nobel Prize in Physics." };
for (const m of D.mirrors) for (const lean of [false, true]) {
  const claim = claimOf(m.claimId, lean), url = "https://" + m.host + "/page-" + m.id;
  const o = await pageRun(claim, pageText({ sentence: TRUE[m.claimId] }), url, "x", "pf", "");
  const o2 = await pageRun(claim, pageText({ sentence: TRUE[m.claimId] }), url, "x", "worst", TRUE[m.claimId]);
  mir.push({ id: m.id, lean, accepted: o.passages.length > 0 || o2.passages.length > 0 });
}
// text copies on an innocent-looking host: attribution line, and sentence overlap with the encyclopedia text
const wikiText = ["The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.", "It is named after the engineer Gustave Eiffel, whose company designed and built the tower from 1887 to 1889.", "The Eiffel Tower is 330 metres tall, about the same height as an 81-storey building.", "It was the first structure in the world to surpass both the Washington Monument and the Cologne Cathedral in height.", "The tower has three levels for visitors, with restaurants on the first and second levels."];
for (const [id, text, idxText] of [["M9", "From Wikipedia, the free encyclopedia\n" + wikiText.join("\n"), null], ["M10", wikiText.join("\n"), wikiText.join(" ")]]) {
  const o = await mod.findPrimary({ claim: claimOf("height-eiffel", false), sentence: claimOf("height-eiffel", false), indexHost: "en.wikipedia.org", search: stubSearch("https://www.tower-facts.gov/page", "Tower"), readPage: stubRead({ "https://www.tower-facts.gov/page": text }), point: async () => "1", fw, indexText: idxText, limits: which === "v2" ? { prefilter: true, fragmentMinRank: 0 } : {} });
  mir.push({ id, lean: false, accepted: o.passages.length > 0 });
}
// POSITIVE CONTROLS (added after the decoys were frozen; not part of the 20): true sentences a page would carry, which the pipeline must accept, so "0 decoys accepted" cannot be an artefact of a pipeline that accepts nothing.
const CONTROLS = [
  ["height-eiffel", "The Eiffel Tower is 330 meters tall.", "toureiffel.paris", "The Eiffel Tower"],
  ["count-bones", "Adults have between 206 and 213 bones.", "my.clevelandclinic.org", "Bones: How many do humans have"],
  ["count-senate", "The Senate has 100 members, two from each state.", "usa.gov", "U.S. Senate | USAGov"],
  ["award-einstein", "The Nobel Prize in Physics 1921 was awarded to Albert Einstein.", "nobelprize.org", "The Nobel Prize in Physics 1921"],
  ["event-apollo11", "Apollo 11 landed on the Moon on July 20, 1969.", "nasa.gov", "Apollo 11"],
  ["distance-moon", "The Moon is about 238,855 miles from Earth.", "jpl.nasa.gov", "How far away is space"],
  ["founding-un", "The United Nations officially began, on 24 October 1945, when its Charter was ratified.", "un.org", "History of the United Nations"],
  ["height-eiffel", "The Eiffel Tower is 1,083 feet tall.", "toureiffel.paris", "The Eiffel Tower"],
];
const controls = [];
for (const [cid, sentence, host, title] of CONTROLS) { const claim = claimOf(cid, true); const o = await pageRun(claim, pageText({ sentence }), "https://www." + host + "/p", title, "pf", sentence); controls.push({ cid, sentence, accepted: o.passages.length > 0 }); }
const acc = rows.filter((r) => r.accepted.length);
console.log(JSON.stringify({ module: which, decoys: rows.length, accepted: acc.length, acceptedDetail: acc, byCat: Object.fromEntries(["wrong_figure", "wrong_entity", "negation", "outdated_holder"].map((c) => [c, rows.filter((r) => r.cat === c && r.accepted.length).length + "/" + rows.filter((r) => r.cat === c).length])), mirrorPages: mir.length, mirrorAccepted: mir.filter((m) => m.accepted).length, mirrorAcceptedDetail: mir.filter((m) => m.accepted), knownLimit: kl, controlsAccepted: controls.filter((c) => c.accepted).length + "/" + controls.length, controlsRejected: controls.filter((c) => !c.accepted) }, null, 1));
