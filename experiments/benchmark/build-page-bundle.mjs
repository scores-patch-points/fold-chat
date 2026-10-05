// Build a self-contained, comment-free copy of the REAL fold-chat-snippets.js that can be pasted into a
// browser page, so the rule evaluated against browser-collected results is the shipped rule — not a hand
// port. Imports are stripped and shimmed (word segmentation, folding); language is passed explicitly.
//   node experiments/benchmark/build-page-bundle.mjs > /tmp/snippets-page.js
//   --langs es,fr,ru,zh,en   also inline those languages' function words (the v3 rule asks the priors first)
import fs from "node:fs";
const langs = (process.argv.includes("--langs") ? process.argv[process.argv.indexOf("--langs") + 1] : "").split(",").filter(Boolean);
const fwMod = langs.length ? await import("../../fold-chat-function-words.js") : null;
const fwData = fwMod ? JSON.stringify(Object.fromEntries(langs.filter((l) => fwMod.FUNCTION_WORDS[l]).map((l) => [l, fwMod.FUNCTION_WORDS[l]]))) : "{}";
let s = fs.readFileSync(new URL("../../fold-chat-snippets.js", import.meta.url), "utf8");
s = s.replace(/^import .*?;\s*$/gm, "").replace(/^export const /gm, "const ").replace(/^export function /gm, "function ");
const shim = `const __seg = new Intl.Segmenter("en", { granularity: "word" });
const segments = (text) => [...__seg.segment(String(text ?? ""))].filter((x) => x.isWordLike).map((x) => ({ text: x.segment }));
const fold = (s) => String(s ?? "").normalize("NFKD").replace(/\\p{M}+/gu, "").toLowerCase();
const detectLang = () => ({ lang: "unknown" });
const FUNCTION_WORDS = ${fwData};
`;
s = (shim + s).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n").replace(/\s+\/\/[^\n"'`]*$/gm, "").replace(/\n{2,}/g, "\n");
process.stdout.write(s);
