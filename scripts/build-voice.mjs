#!/usr/bin/env node
// scripts/build-voice.mjs — the ethos side of the voice of content, as STATIC data the page can load (it cannot read the ethos repo).
//   node scripts/build-voice.mjs            → voice/voice-index.json (terms + provenance per archon) and voice/voice-bank.json (verbatim quotable sentences with byte spans)
//   node scripts/build-voice.mjs --check    → re-read every canon file, verify its sha256 and that EVERY banked sentence is canon.slice(start, end)
// Roster (DECLARED, the user's to edit): archons whose verified canon is English. A canon file whose sha256 differs from the concern field's recorded hash is REFUSED, not used.
// Deterministic, no model. The bank keeps, per archon, the sentences that carry >= 2 of its dwelling stems, best first, capped.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { functionWordsOf } from "../fold-chat-snippets.js";
import { sentencesWithOffsets } from "../fold-chat-impression.js";
import * as ground from "../fold-chat-ground.js";
import { VOICE } from "../fold-chat-voice.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORLD = path.resolve(ROOT, "..");                      // /Users/mlacy/Documents/3.0
const FIELDS = path.join(WORLD, "Zenodotus/derived-priors/concern-priors/concern-fields");
export const ROSTER = ["laozi", "whitman", "george-eliot", "zhengming", "mozi", "xunzi", "ramakrishna", "vivekananda", "solon", "mahavira", "nagarjuna", "vasana", "ise"];
const CAP = 250;
const FW = functionWordsOf("en");
const stemOf = (t) => (ground.stemOf ? ground.stemOf(t) : t);
const stemsOf = (text) => ground.tokenize(text).filter((t) => t.length >= VOICE.minStem && !FW.has(t)).map(stemOf);
const canonPath = (p) => [path.join(WORLD, p), path.join(WORLD, p.replace(/^live_priors\//, "Zenodotus/"))].find((x) => fs.existsSync(x));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const check = process.argv.includes("--check");

const index = { schema: "VoiceIndex@1", giver: "concern-priors (ethos), roster declared by the author 2026-10-06", archons: [] };
const bank = {};
let bad = 0;
for (const handle of ROSTER) {
  const f = JSON.parse(fs.readFileSync(path.join(FIELDS, handle + ".json"), "utf8"));
  const cp = canonPath(f.source.path);
  if (!cp) { console.error("MISSING canon", handle); bad++; continue; }
  const buf = fs.readFileSync(cp);
  if (sha(buf) !== f.source.sha256) { console.error("REFUSED (sha256 differs from the concern field's)", handle); bad++; continue; }
  const text = buf.toString("utf8");
  const terms = f.terms.map((t) => t.term);
  const dw = new Set(terms.flatMap((t) => stemsOf(t)));
  const rows = [];
  for (const s of sentencesWithOffsets(text)) {
    const len = s.end - s.start;
    if (len < VOICE.quoteMin || len > VOICE.quoteMax) continue;
    if (((s.text.match(/\p{L}/gu) || []).length) / len < 0.7) continue;
    if (!/[.!?]["')\]”’]*$/u.test(s.text)) continue;
    const have = [...new Set(stemsOf(s.text).filter((x) => dw.has(x)))];
    if (have.length >= 2) rows.push({ text: s.text, start: s.start, end: s.end, stems: have });
  }
  rows.sort((a, b) => b.stems.length - a.stems.length || (a.end - a.start) - (b.end - b.start) || a.start - b.start);
  bank[handle] = rows.slice(0, CAP);
  index.archons.push({ handle, giver: f.giver, work: f.work, source: { path: f.source.path, sha256: f.source.sha256, chars: f.source.chars }, terms });
  if (check) for (const e of bank[handle]) if (text.slice(e.start, e.end) !== e.text) { console.error("NOT VERBATIM", handle, e.start); bad++; break; }
  console.log(handle.padEnd(14), String(terms.length).padStart(4), "terms", String(bank[handle].length).padStart(4), "banked sentences", "(of", rows.length + ")");
}
if (!check) {
  fs.mkdirSync(path.join(ROOT, "voice"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "voice/voice-index.json"), JSON.stringify(index));
  fs.writeFileSync(path.join(ROOT, "voice/voice-bank.json"), JSON.stringify(bank));
  console.log("wrote voice/voice-index.json", fs.statSync(path.join(ROOT, "voice/voice-index.json")).size, "bytes; voice-bank.json", fs.statSync(path.join(ROOT, "voice/voice-bank.json")).size, "bytes");
}
console.log(bad ? `${bad} problem(s)` : "ok");
process.exit(bad ? 1 : 0);
