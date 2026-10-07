// C1 mutation check: each gate of the three fixes is deleted/inverted in a copy of origin-fixed.mjs; the test file must FAIL on the copy.
//   node eval/ants/c1/mutate.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { spawnSync } from "node:child_process";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, "origin-fixed.mjs"), "utf8"), test = fs.readFileSync(path.join(HERE, "origin-fixed.test.mjs"), "utf8");
const M = [
  ["fix1: slot rule off (always min 3)", "const slot = c.atoms.some((x) => x.startsWith(\"fig:\")) && c.atoms.some((x) => x.startsWith(\"name:\"));", "const slot = false;"],
  ["fix1: slot rule always on (min 2 for every claim)", "const slot = c.atoms.some((x) => x.startsWith(\"fig:\")) && c.atoms.some((x) => x.startsWith(\"name:\"));", "const slot = true;"],
  ["fix1: slot needs figure only (name not required)", "&& c.atoms.some((x) => x.startsWith(\"name:\"));\n  if (idle", ";\n  if (idle"],
  ["fix1: slot needs name only (figure not required)", "const slot = c.atoms.some((x) => x.startsWith(\"fig:\")) && c.atoms.some", "const slot = true && c.atoms.some"],
  ["fix1: minAtomsSlot = 1", "minAtomsSlot: 2,", "minAtomsSlot: 1,"],
  ["fix6: pronunciation never skipped", "return skip;\n}", "return new Set();\n}"],
  ["fix6: any bracket skipped (no IPA test)", "if (IPA_CHAR.test(m[0])) for", "for"],
  ["fix6: speaker glyph kept", "for (let i = s.indexOf(SPEAKER); i >= 0; i = s.indexOf(SPEAKER, i + 1)) skip.add(i);", ""],
  ["fix6: slash segments not skipped", "const IPA_SEGMENT = /\\/[^\\/\\n]{1,80}\\/|\\[", "const IPA_SEGMENT = /\\/\\u0000\\/|\\["],
  ["fix6: bracket segments not skipped", "|\\[[^\\]\\n]{1,80}\\]/g, IPA_CHAR", "|\\u0000\\u0000/g, IPA_CHAR"],
  ["fix2: host gate off", "export const admitHost = (url) => { const h = hostOf(url); return !!h && absolute(url) && !tertiaryOf(url) && !NOT_A_WITNESS.some((re) => re.test(h)); };", "export const admitHost = (url) => true;"],
  ["fix2: encyclopedias admitted", "(britannica\\.com|encyclopedia\\.com|newworld", "(zzbritannica\\.com|encyclopedia\\.com|newworld"],
  ["fix2: wiki-ish/pedia mirror regex gone", "/(^|\\.)wik[a-z0-9-]*\\.[a-z.]+$/i, /(^|\\.)[a-z0-9-]*pedia\\.[a-z.]+$/i,", ""],
  ["fix2: farms admitted", "answers\\.com|reference\\.com|ask\\.com|", "answerz\\.com|reference\\.com|ask\\.com|"],
  ["fix2: social/QA hosts admitted", "(quora\\.com|reddit\\.com|", "(qzuora\\.com|reddit\\.com|"],
  ["fix2: wikipedia admitted", "&& !tertiaryOf(url) && !NOT_A_WITNESS", "&& !NOT_A_WITNESS"],
  ["fix2: last same wins, not first", "if (!origin && sup.verdict === \"same\")", "if (sup.verdict === \"same\")"],
  ["fix2: no cap on reads", "if (list.length >= max) break;", ""],
  ["fix2: no dedupe", "if (seen.has(k)) continue; seen.add(k); list.push(h);", "list.push(h);"],
  ["fix2: any verdict but different accepted", "&& sup.verdict === \"same\") origin", "&& sup.verdict !== \"different\") origin"],
  ["fix2: hit text ignored (always re-read)", "if (typeof h.text === \"string\" && h.text.trim() && !h.snippetOnly) return", "if (false) return"],
  ["fix2: snippet-only hit trusted", "h.text.trim() && !h.snippetOnly)", "h.text.trim())"],
  ["fix2: abort ignored", "if (signal && signal.aborted) return null;\n      try { return await read", "try { return await read"],
  ["fix2b: corroboration() host gate off (tertiary only)", "!absolute(p.url) || !admitHost(p.url) || p.snippetOnly", "!absolute(p.url) || tertiaryOf(p.url) || p.snippetOnly"],
  ["fix7: bound rung without the figures guard", "b.verdict === \"same\" && figuresCovered(claim, b.sentence)", "b.verdict === \"same\""],
  ["fix7: figuresCovered always true", "return nums(claim).every((n) => have.has(n));", "return true;"],
  ["fix2: followClaim ignores hits", "if (!o && Array.isArray(opts.hits) && opts.hits.length) {", "if (false) {"],
  ["fix2: hits asked before alongside", "let o = corroboration(opts.sentence, opts.alongside, { forWhom: opts.forWhom, reading: opts.reading, meaning: opts.meaning });\n  let viaSearch = false;", "let o = null;\n  let viaSearch = false;"],
  ["fix2: answerClaim ignored (sentence used)", "corroborateAnswer(opts.answerClaim || opts.sentence,", "corroborateAnswer(opts.sentence,"],
  ["fix2: originateTurn drops hits", "alongside, hits, answerClaim:", "alongside, hits: [], answerClaim:"],
  ["fix2: originateTurn answerClaim from the sentence", "turn.answer && turn.answer.row === r && typeof turn.answer.text === \"string\" && turn.answer.text.trim() ? turn.answer.text : undefined", "r.sentence"],
  ["fix2: originateTurn answerClaim for every row", "turn.answer && turn.answer.row === r && typeof", "turn.answer && typeof"],
];
let killed = 0, survived = [];
const tmp = path.join(HERE, ".mut"); fs.mkdirSync(tmp, { recursive: true });
for (const [name, a, b] of M) {
  const n = src.split(a).length - 1;
  if (n !== 1) { console.log("SKIP (pattern matches " + n + "x)", name); survived.push(name + " [pattern]"); continue; }
  fs.writeFileSync(path.join(tmp, "origin-fixed.mjs"), src.replace(a, b)); fs.writeFileSync(path.join(tmp, "origin-fixed.test.mjs"), test);
  const r = spawnSync(process.execPath, ["--test", path.join(tmp, "origin-fixed.test.mjs")], { encoding: "utf8", timeout: 60000 });
  const dead = r.status !== 0; if (dead) killed++; else survived.push(name);
  console.log((dead ? "KILLED  " : "SURVIVED") + " " + name);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${killed}/${M.length} mutants killed` + (survived.length ? "; survivors: " + survived.join("; ") : ""));
