// eval/ants/c3/score-tokens.mjs — T1 bearsOn, T2 bearsOn+assertsClaim, T3 ground.attribute, K2 khora numberSet on the C3 battery. No model, no network.
//   node eval/ants/c3/score-tokens.mjs  → writes eval/ants/c3/results-tokens.json and prints the matrices (see C3-PREREG.md; labels are fixed in battery.json)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bearsOn } from "../../../fold-chat-provenance.js";
import { assertsClaim } from "../../../fold-chat-primary.js";
import { attribute } from "../../../fold-chat-ground.js";
import { functionWordsOf } from "../../../fold-chat-snippets.js";
import * as ground from "../../../fold-chat-ground.js";
// the vendored copy of grounding.js cannot be loaded under Node (it top-level-awaits ../the-fold/canon-ground.mjs, which is not vendored); the same file from the khora checkout is read, unmodified
const { numberSet, parseWordNumber, WORD_NUM_RE } = await import("/Users/mlacy/Documents/3.0/khora/native/organs/grounding.js");
import { matrix, report } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SET = process.env.C3_SET ? "-" + process.env.C3_SET : "";   // C3_SET=cf → the counterfactual control (battery-cf.json, results-*-cf.json)
const battery = JSON.parse(fs.readFileSync(path.join(here, `battery${SET}.json`), "utf8"));
const fw = functionWordsOf("en");

/** every number a text states, digit or word, as strings of the value */
export function numbersOf(text) {
  const out = new Set([...numberSet(text)].map((x) => String(Number(x.replace(/[%a-z]+$/i, "")))));
  WORD_NUM_RE.lastIndex = 0; let m;
  const re = new RegExp(WORD_NUM_RE.source, "gi");
  while ((m = re.exec(text))) { const v = parseWordNumber(m[0].split(/[\s-]+/)); if (v != null) out.add(String(v)); }
  return out;
}

const stemsOf = (t, fw) => ground.tokenize(String(t ?? "")).filter((x) => x.length > 2 && !(fw && fw.has(x))).map((x) => ground.stemOf(x));   // the same construction as provenance.js stemsOf (not exported)
const T1 = (c, s) => bearsOn(c, s, fw);
const T2 = (c, s) => { const a = bearsOn(c, s, fw); if (!a.ok) return a; const b = assertsClaim(c, s, { fw }); return b.ok ? a : { ok: false, why: b.why }; };
const T3 = (c, s) => { const e = attribute(c, [{ ref: "page", label: "S1", text: s }])[0]; return e && e.ref ? { ok: true } : { ok: false, why: e?.why || "none" }; };
const K2 = (c, s) => {
  const a = bearsOn(c, s, fw);
  const cn = numbersOf(c), sn = numbersOf(s);
  const missing = [...cn].filter((n) => !sn.has(n));
  // bearsOn already demands the claim's DIGIT figures; K2 adds the WORD numbers and compares by value
  if (!a.ok && !a.why.startsWith("figure_missing")) return a;
  if (missing.length) return { ok: false, why: "number_missing:" + missing.join(",") };
  // a figure-only miss in bearsOn that the value comparison resolves (12 vs Twelve) is accepted if a stem is shared
  const shared = stemsOf(c, fw).filter((x) => new Set(stemsOf(s, fw)).has(x));
  return shared.length ? { ok: true } : { ok: false, why: "unrelated" };
};

const signals = { T1, T2, T3, K2 };
const rows = battery.pairs.map((p) => {
  const r = { id: p.id, label: p.label, loose: !!p.loose, type: p.type };
  for (const [k, f] of Object.entries(signals)) { const v = f(p.claim, p.sentence); r[k] = v.ok ? "ACCEPT" : "REJECT"; r[k + "_why"] = v.ok ? null : v.why; }
  return r;
});
fs.writeFileSync(path.join(here, `results-tokens${SET}.json`), JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
for (const k of Object.keys(signals)) console.log(report(k, rows, k));
console.log("per-pair:\n" + rows.map((r) => `${String(r.id).padStart(2)} ${r.label}${r.loose ? "*" : " "} T1=${r.T1[0]} T2=${r.T2[0]} T3=${r.T3[0]} K2=${r.K2[0]}  ${r.type}  [${r.T2_why || ""}]`).join("\n"));
