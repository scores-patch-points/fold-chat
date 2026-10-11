// Deterministic builder for the synthetic cases (cases/*.json). Run once, then the cases are FROZEN (hashes in results.json).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { TOPICS } from "./pages.mjs"; import { D } from "./topics-data.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sents = (t) => t.split(/(?<=\.)\s+(?=[A-Z])/);
const S = (k, p, i) => sents(TOPICS[k].pages[p].text)[i];
const keys = Object.keys(TOPICS);
const mat = (k) => TOPICS[k].pages.map((p) => ({ ref: p.ref, source: p.source, text: p.text }));
const cases = [];
const add = (id, group, topic, material, answer, labels, note = "") => cases.push({ id, origin: "SYNTH", group, topic, material, answer, labels: { NUL: null, SIG: null, INS: null, ...labels }, note });
const inPage = (k, phrase) => TOPICS[k].pages.some((p) => p.text.includes(phrase));
for (const k of keys) {
  const d = D[k], M = mat(k);
  // ---- CLEAN ----
  add(`clean-A-${k}`, "clean-two-site", k, M, d.A.map(([p, i]) => S(k, p, i)).join(" "), { NUL: "clean", SIG: "clean" });
  add(`clean-B-${k}`, "clean-one-site", k, M, d.B.map(([p, i]) => S(k, p, i)).join(" "), { NUL: "clean", SIG: "clean" });
  add(`clean-P-${k}`, "clean-paraphrase", k, M, d.P, { NUL: "clean", SIG: "clean" });
  if (!inPage(k, d.q1)) throw new Error("q1 not in page " + k);
  add(`clean-Q1-${k}`, "clean-quote-single", k, M, `The page puts it this way: “${d.q1}”. ${S(k, 0, d.B[1][1])}`, { NUL: "clean", SIG: "clean", INS: "clean" });
  if (!inPage(k, d.q2[0])) throw new Error("q2 not in page " + k);
  add(`clean-Q2-${k}`, "clean-quote-two-site", k, M, `${S(k, ...d.q2[1])} Another page adds “${d.q2[0]}”.`, { NUL: "clean", SIG: "clean", INS: "clean" });
  if (!inPage(k, d.qfar)) throw new Error("qfar not in page " + k);
  add(`clean-Qfar-${k}`, "clean-quote-far", k, M, `${S(k, 0, d.B[0][1])} It adds “${d.qfar}”.`, { NUL: "clean", SIG: "clean", INS: "clean" }, "quote verbatim in the page; may sit outside the excerpt window");
  // ---- NUL defects ----
  const base = S(k, 0, d.B[1][1]) + " " + S(k, ...d.A[1]);   // two true sentences from TWO different sites, so a flag on the defect record is the defect's, not the single-site rule's
  add(`nul-fab-${k}`, "nul-fabricated-name", k, M, `${base} ${d.fab} oversaw the final inspection.`, { NUL: "defect" });
  add(`nul-recomb-${k}`, "nul-recombined-name", k, M, `${base} ${d.recomb} was involved in this.`, { NUL: "defect" }, "both words appear in the pages, never together");
  add(`nul-acro-${k}`, "nul-fabricated-acronym", k, M, `${base} The work was financed by ${d.acro}.`, { NUL: "defect" });
  add(`nul-low-${k}`, "nul-lowercase-entity", k, M, `${base} It was later run by ${d.low}.`, { NUL: "defect" }, "fabricated entity written in lower case: reported separately");
  // ---- SIG defects ----
  add(`sig-inv-${k}`, "sig-invented-sentence", k, M, `${base} ${d.invented}`, { SIG: "defect" });
  const other = keys[(keys.indexOf(k) + 3) % keys.length];
  add(`sig-irr-${k}`, "sig-irrelevant-source", k, mat(other), d.B.map(([p, i]) => S(k, p, i)).join(" "), { SIG: "defect" }, `answer is about ${k}; the only pages read are about ${other}`);
  add(`sig-lure-${k}`, "sig-lexical-lure", k, M, `${base} ${d.lure}`, { SIG: "defect" }, "source words recombined into something no source says");
  if (keys.indexOf(k) % 2 === 0) add(`sig-hedge-${k}`, "sig-hedge-only", k, M, d.hedge, { SIG: "defect" });
  else add(`sig-hedgemix-${k}`, "sig-hedge-plus-claim", k, M, `${base} ${d.hedge}`, { SIG: "defect" });
  // ---- INS defects ----
  if (inPage(k, d.fabQuote) || inPage(k, d.paraQuote) || inPage(k, d.splice)) throw new Error("defect quote is in page " + k);
  add(`ins-fab-${k}`, "ins-fabricated-quote", k, M, `${base} The article states “${d.fabQuote}”.`, { INS: "defect" });
  add(`ins-para-${k}`, "ins-paraphrase-as-quote", k, M, `${base} In the article’s words, it is “${d.paraQuote}”.`, { INS: "defect" });
  const [ph, from, to] = d.alt; if (!inPage(k, ph)) throw new Error("alt phrase not in page " + k);
  add(`ins-alt-${k}`, "ins-one-word-altered", k, M, `${base} The page says “${ph.replace(from, to)}”.`, { INS: "defect" });
  add(`ins-splice-${k}`, "ins-spliced-fragments", k, M, `${base} It is described as “${d.splice}”.`, { INS: "defect" });
  if (!inPage(k, d.misq)) throw new Error("misq not in page " + k);
  const site0 = TOPICS[k].pages[0].ref.split(" — ")[1];
  add(`ins-mis-${k}`, "ins-misattributed", k, M, `${base} According to ${site0}, it has “${d.misq}”.`, { INS: "defect" }, `the quote is on the OTHER page, not ${site0}`);
}
// out-of-charter control: a fabricated figure (SEG's job, not NUL/SIG/INS): reported only
for (const k of keys.slice(0, 4)) { const d = D[k]; add(`ctl-fig-${k}`, "control-fabricated-figure", k, mat(k), `${S(k, 0, d.B[1][1])} It was completed in 1999 at a cost of 48 million dollars.`, {}, "no label for NUL/SIG/INS; shows what each check does with a fabricated figure"); }
fs.mkdirSync(path.join(HERE, "cases"), { recursive: true });
fs.writeFileSync(path.join(HERE, "cases", "synthetic.json"), JSON.stringify(cases, null, 1));
const byGroup = {}; for (const c of cases) byGroup[c.group] = (byGroup[c.group] || 0) + 1;
console.log(cases.length, byGroup);
