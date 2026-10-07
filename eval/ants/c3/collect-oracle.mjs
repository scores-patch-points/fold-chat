// eval/ants/c3/collect-oracle.mjs — K4: the janus back end with a HAND-AUTHORED front end (the ceiling if a sentence->claim reader existed). Each pair is written by C3 as GFP claims in ONE ground (claims in different grounds are "held apart", not judged), with the declaration its relation needs.
// This measures what the BACK END can adjudicate given perfect extraction. It says nothing about how claims would be extracted.
//   node eval/ants/c3/collect-oracle.mjs [base]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:11436";
const G = "/p";
const cl = (id, rel, a0, a1, polarity = "+", said = "") => ({ ground: G, rel, roles: { ARG0: a0, ARG1: a1 }, polarity, force: "default", id, said });
const fn = (rel) => ({ functional: [{ rel, role: "ARG1", giver: "C3 hand declaration" }] });
const ac = (rel) => ({ acyclic: [rel] });
// expected: what a correct meaning check says: "conflict" for C, "consistent" for E (T/U are not tested here: they are not about contradiction)
const cases = [
  { id: 1, label: "E", claims: [cl("c", "wrote", "shakespeare", "hamlet"), cl("s", "wrote", "shakespeare", "hamlet")], declare: {} },
  { id: 3, label: "E", claims: [cl("c", "has-legs", "spider", "8"), cl("s", "has-legs", "spider", "8")], declare: fn("has-legs") },
  { id: 4, label: "C", claims: [cl("c", "has-legs", "spider", "6"), cl("s", "has-legs", "spider", "8")], declare: fn("has-legs") },
  { id: 5, label: "C", claims: [cl("c", "monarch-of", "united-kingdom", "elizabeth-ii"), cl("s", "monarch-of", "united-kingdom", "charles-iii")], declare: fn("monarch-of") },
  { id: 7, label: "C", claims: [cl("c", "visible-from-space-to-naked-eye", "great-wall", "yes", "+"), cl("s", "visible-from-space-to-naked-eye", "great-wall", "yes", "-")], declare: {} },
  { id: 8, label: "E", claims: [cl("c", "born-in-year", "curie", "1867"), cl("s", "born-in-year", "curie", "1867")], declare: fn("born-in-year") },
  { id: 9, label: "C", claims: [cl("c", "born-in-year", "curie", "1876"), cl("s", "born-in-year", "curie", "1867")], declare: fn("born-in-year") },
  { id: 12, label: "C", claims: [cl("c", "stabbed", "brutus", "caesar"), cl("s", "stabbed", "caesar", "brutus")], declare: ac("stabbed") },
  { id: "12-fn-only", label: "C", claims: [cl("c", "stabbed", "brutus", "caesar"), cl("s", "stabbed", "caesar", "brutus")], declare: fn("stabbed") },
  { id: "14-fn-only", label: "C", claims: [cl("c", "taller-than", "k2", "everest"), cl("s", "taller-than", "everest", "k2")], declare: fn("taller-than") },
  { id: "12-undeclared", label: "C", claims: [cl("c", "stabbed", "brutus", "caesar"), cl("s", "stabbed", "caesar", "brutus")], declare: {} },
  { id: 13, label: "E", claims: [cl("c", "stabbed", "brutus", "caesar"), cl("s", "stabbed", "brutus", "caesar")], declare: ac("stabbed") },
  { id: 14, label: "C", claims: [cl("c", "taller-than", "k2", "everest"), cl("s", "taller-than", "everest", "k2")], declare: ac("taller-than") },
  { id: 15, label: "E", claims: [cl("c", "taller-than", "everest", "k2"), cl("s", "taller-than", "everest", "k2")], declare: ac("taller-than") },
  { id: 19, label: "C", claims: [cl("c", "causes", "vaccines", "autism", "+"), cl("s", "causes", "vaccines", "autism", "-")], declare: {} },
  { id: 24, label: "C", claims: [cl("c", "in-service", "concorde", "now", "+"), cl("s", "in-service", "concorde", "now", "-")], declare: {} },
];
const rows = [];
for (const k of cases) {
  const spec = { claims: k.claims, declare: k.declare, identity: "caseless" };
  const r = await fetch(base + "/v1/reason", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(spec) });
  const text = await r.text();
  const head = text.split("\n")[0];
  const flagged = (r.headers.get("x-er7-exit") ?? "0") !== "0";   // the door's own exit code (an earlier regex of mine over the head line flagged everything: fixed before reading results)
  rows.push({ id: k.id, label: k.label, exit: r.headers.get("x-er7-exit"), head, flagged, text: text.slice(0, 900) });
}
fs.writeFileSync(path.join(here, "oracle-raw.json"), JSON.stringify(rows, null, 1));
for (const r of rows) console.log(`${String(r.id).padStart(2)} ${r.label} flagged=${r.flagged} exit=${r.exit} | ${r.head}`);
