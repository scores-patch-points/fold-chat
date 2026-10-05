// readings-to-json.mjs — compiles reading.txt (my per-ask reading, one line per ask) into judgments.json for judge.mjs.
// line:  id | sat or = (keep the auto label) | irrelevant snip ids (comma, or -) | D (dangerous) or - | one-line reason
import fs from "node:fs";
const here = new URL(".", import.meta.url).pathname;
const lines = fs.readFileSync(here + "reading.txt", "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
const confirmed = [], edits = {};
for (const l of lines) {
  const [id, sat, irr, d, ...why] = l.split("|").map((x) => x.trim());
  confirmed.push(id);
  // irr: "auto" = accept the token-overlap proxy for this ask's snips; "-" = I judged every snip relevant; a list = exactly these are irrelevant
  const irrelevant = irr === "auto" ? undefined : irr === "-" ? [] : irr.split(",").map((x) => x.trim());
  edits[id] = { ...(sat !== "=" ? { sat } : {}), ...(irrelevant ? { irrelevant } : {}), ...(d === "D" ? { dangerous: true } : {}), why: why.join("|") };
}
fs.writeFileSync(here + "judgments.json", JSON.stringify({ confirmed, edits }, null, 1));
console.log(confirmed.length, "asks read;", Object.keys(edits).length, "with an edit or a stated reason");
