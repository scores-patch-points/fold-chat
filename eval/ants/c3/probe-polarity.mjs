// eval/ants/c3/probe-polarity.mjs — does the vendored relation extractor READ polarity (and does the door expose it)? Local, no network. Verbs = the labels the door itself found on the C3 battery.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractRelations } from "../../../vendor/khora/native/adapters/text/relations.js";
import { functionWordsOf } from "../../../fold-chat-snippets.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const door = JSON.parse(fs.readFileSync(path.join(here, "door-raw.json"), "utf8"));
const verbs = new Set(); for (const p of door.pairs) for (const k of ["claim", "sentence"]) for (const r of p[k].relations || []) verbs.add(String(r.relation).toLowerCase());
const fw = functionWordsOf("en");
const tests = ["Spiders have eight legs.", "Spiders do not have eight legs.", "Brutus stabbed Caesar.", "Brutus never stabbed Caesar.", "Caesar was stabbed by Brutus.", "Curie was born in 1867.", "Curie was not born in 1876.", "Concorde was retired from service in 2003.", "Large studies have found no link between vaccines and autism."];
const out = {};
for (const t of tests) { const rel = extractRelations(t, { verbs: new Set([...verbs, "have", "stabbed", "retired", "born", "found"]), functionWords: fw }); out[t] = rel; console.log(JSON.stringify(t), "->", JSON.stringify(rel)); }
console.log("polarity key present on edges:", Object.values(out).flat().some((r) => "polarity" in r), "| door relation keys:", Object.keys(door.pairs[0].claim.relations[0] || {}).join(","));
