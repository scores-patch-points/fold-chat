// eval/pivot/salience.mjs — S1 of PREREG Amendment 4: does the salience excerpt KEEP the answer? Offline, no model, no network.
//   node eval/pivot/salience.mjs [chars]       default budget = SALIENCE.sourceChars; pass a number to stress it (informative, not the registered criterion)
// 8 real Wikipedia intros (eval/pivot/data/pages.json), 2 asks each, hand-listed needles that occur VERBATIM in the page (checked below).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askTerms, salientExcerpt, verifyExcerpt, SALIENCE } from "../../fold-chat-salience.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const pages = JSON.parse(fs.readFileSync(path.join(HERE, "data/pages.json"), "utf8"));
const CASES = [
  ["Eiffel Tower", "How tall is the Eiffel Tower?", "330 metres"], ["Eiffel Tower", "Who designed the Eiffel Tower?", "Gustave Eiffel"],
  ["Canberra", "How many people live in Canberra?", "484,630"], ["Canberra", "Why was Canberra established as the capital?", "compromise between Sydney and Melbourne"],
  ["Spider", "How many species of spider are there?", "53,680"], ["Spider", "How many limbs does a spider have?", "eight limbs"],
  ["Marie Curie", "When did Marie Curie win her first Nobel Prize?", "1903 Nobel Prize in Physics"], ["Marie Curie", "Where was Marie Curie born?", "born in Warsaw"],
  ["Photosynthesis", "What does photosynthesis release as a byproduct?", "releases oxygen as a byproduct"], ["Photosynthesis", "What do plants convert light energy into?", "chemical energy"],
  ["Great Wall of China", "How long is the Great Wall of China?", "21,196.18 km"], ["Great Wall of China", "Which dynasty built the best-known sections of the Great Wall?", "Ming dynasty"],
  ["Mount Everest", "How high is Mount Everest?", "8,848.86 m"], ["Mount Everest", "How many people have died on Everest?", "340 people have died"],
  ["Penicillin", "What mould produces penicillin?", "P. chrysogenum"], ["Penicillin", "What percent of Americans claim penicillin allergies?", "10% of the population"],
];
const chars = Number(process.argv[2]) || SALIENCE.sourceChars;
const fw = functionWordsOf("en");
let kept = 0, verbatim = 0; const misses = [];
for (const [title, ask, needle] of CASES) {
  const p = { ref: title, text: pages[title].text };
  if (!p.text.includes(needle)) throw new Error("needle not in page (hand-list error): " + needle);
  const ex = salientExcerpt(p, askTerms({ question: ask }, fw), { chars });
  const has = !!ex && ex.text.includes(needle);
  if (ex && verifyExcerpt(p, ex)) verbatim++;
  if (has) kept++; else misses.push({ ask, needle, excerpt: ex ? ex.text.length + " chars" : "page dropped" });
}
const n = CASES.length;
console.log(`S1 budget=${chars} chars/page (${chars === SALIENCE.sourceChars ? "registered default" : "stress"}); page lengths ~1200`);
console.log(`needle kept in ${kept}/${n} = ${(100 * kept / n).toFixed(0)}%  (criterion >= 90% at the default budget) · excerpts re-derived verbatim ${verbatim}/${n}`);
if (misses.length) console.log("misses:", JSON.stringify(misses, null, 1));
