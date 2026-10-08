#!/usr/bin/env node
// scripts/build-thinkers.mjs — the thinker PROFILES (docs/VOICE.md, eval/ants/B1-PREREG.md): per-thinker word-level profiles of CONTENT STEMS, from each thinker's own verified English canon.
//   node scripts/build-thinkers.mjs            → voice/thinkers-profile.json  (fit on the TRAIN units only; calibration is written into it by eval/ants/B1-eval.mjs --write)
//   node scripts/build-thinkers.mjs --check    → re-verify every canon file's sha256 against the concern field's, and that the profile on disk is what this script would build
// Roster = every concern field (Zenodotus/derived-priors/concern-priors/concern-fields) whose source file (a) exists, (b) has the sha256 the field records (a different file is REFUSED), (c) is English
// (function-word share), (d) has at least MIN_CHARS characters of text. Handles sharing one source collapse to the first. Everything else is named in `gaps`, never silently dropped.
// Deterministic, no model. Also exports loadCanon()/splitOf() so the evaluation uses the very same units and split.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { contentStems, DECLARED } from "../fold-chat-thinkers.js";
import { sentencesWithOffsets } from "../fold-chat-impression.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WORLD = path.resolve(ROOT, "..");
export const FIELDS = path.join(WORLD, "Zenodotus/derived-priors/concern-priors/concern-fields");
export const MIN_CHARS = 30000, UNIT_MIN = 40, UNIT_SPLIT = 150, RUN = 20, ENGLISH_MIN = 0.12;
export const splitOf = (unitIndex) => { const b = Math.floor(unitIndex / RUN) % 5; return b <= 2 ? "train" : b === 3 ? "dev" : "test"; };
// DECLARED (the user's to edit, docs/VOICE.md open decision 1): canons whose subject is a technical craft, not a view of how to live. They stay in the profile as DISTRACTOR classes — science text
// belongs to them, so it is not mistaken for a thinker's view — but they are never offered as a voice (`speaks: false`).
export const TECHNICAL = ["brahmagupta", "koopman", "liu-hui", "lovelace", "sockeye", "strunk-white", "synapse", "thrax", "xushen", "shizhen", "panini", "wigmore", "tala", "bharata", "brillat-savarin"];
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const canonPath = (p) => [path.join(WORLD, p), path.join(WORLD, p.replace(/^live_priors\//, "Zenodotus/"))].find((x) => fs.existsSync(x));
const EN = new Set("the of and to in is that it was he for as with his by be this which are from or at have not but they had you said all her she their there one would what we been were when who will more if no out so up".split(" "));
const englishShare = (t) => { const w = t.slice(0, 300000).toLowerCase().match(/[a-z']+/g) || []; if (!w.length) return 0; let k = 0; for (const x of w) if (EN.has(x)) k++; return k / w.length; };

/** The canon text proper: outside Project Gutenberg's START/END markers, and without paragraphs that name it. */
export function stripBoilerplate(text) {
  let s = text;
  const a = s.search(/\*\*\* ?START OF[^\n]*\n/); if (a >= 0) s = s.slice(s.indexOf("\n", a) + 1);
  const b = s.search(/\*\*\* ?END OF/); if (b >= 0) s = s.slice(0, b);
  return s;
}
/** Units: consecutive paragraphs (a paragraph over UNIT_SPLIT stems is cut at sentences) accumulated to >= UNIT_MIN content stems. */
export function unitsOf(text) {
  const paras = stripBoilerplate(text).split(/\n\s*\n/).filter((p) => !/project gutenberg/i.test(p));
  const pieces = [];
  for (const p of paras) {
    const st = contentStems(p);
    if (st.length <= UNIT_SPLIT) { if (st.length) pieces.push({ text: p, stems: st }); continue; }
    for (const s of sentencesWithOffsets(p)) { const ss = contentStems(s.text); if (ss.length) pieces.push({ text: s.text, stems: ss }); }
  }
  const units = []; let cur = null;
  for (const pc of pieces) {
    if (!cur) cur = { text: pc.text, stems: pc.stems.slice() }; else { cur.text += "\n\n" + pc.text; cur.stems.push(...pc.stems); }
    if (cur.stems.length >= UNIT_MIN) { units.push(cur); cur = null; }
  }
  if (cur && cur.stems.length >= UNIT_MIN / 2) units.push(cur);
  return units.map((u, i) => ({ ...u, i, split: splitOf(i) }));
}

/** Read the roster. Returns { thinkers: [{ handle, giver, work, source, units }], gaps: [{ handle, why }] }. `keepText`: keep each unit's text (the evaluation prints sentences). */
export function loadCanon({ keepText = false, log = () => {} } = {}) {
  const thinkers = [], gaps = [], seenSource = new Map();
  for (const file of fs.readdirSync(FIELDS).filter((f) => f.endsWith(".json")).sort()) {
    const handle = file.replace(/\.json$/, "");
    const f = JSON.parse(fs.readFileSync(path.join(FIELDS, file), "utf8"));
    const cp = canonPath(f.source.path);
    if (!cp) { gaps.push({ handle, why: "canon file missing" }); continue; }
    const buf = fs.readFileSync(cp);
    if (sha(buf) !== f.source.sha256) { gaps.push({ handle, why: "REFUSED: sha256 differs from the concern field's" }); continue; }
    const text = buf.toString("utf8");
    if (text.length < MIN_CHARS) { gaps.push({ handle, why: `too little canon (${text.length} chars < ${MIN_CHARS})` }); continue; }
    const en = englishShare(text);
    if (en < ENGLISH_MIN) { gaps.push({ handle, why: `not English (function-word share ${en.toFixed(2)} < ${ENGLISH_MIN})` }); continue; }
    if (seenSource.has(f.source.path)) { gaps.push({ handle, why: `same source as ${seenSource.get(f.source.path)} (collapsed)` }); continue; }
    seenSource.set(f.source.path, handle);
    const units = unitsOf(text);
    if (!keepText) for (const u of units) delete u.text;
    thinkers.push({ handle, giver: f.giver, work: f.work, source: { path: f.source.path, sha256: f.source.sha256, chars: f.source.chars }, units });
    log(handle.padEnd(16), String(units.length).padStart(6), "units", String(units.reduce((a, u) => a + u.stems.length, 0)).padStart(8), "stems");
  }
  return { thinkers, gaps };
}

/** Fit the profile on the TRAIN units. */
export function buildProfile(canon, { minMax = 4, minSum = 8 } = {}) {
  const per = canon.thinkers.map((t) => { const c = new Map(); let n = 0; for (const u of t.units) if (u.split === "train") for (const s of u.stems) { c.set(s, (c.get(s) || 0) + 1); n++; } return { c, n }; });
  const tot = new Map(), mx = new Map();
  for (const { c } of per) for (const [s, k] of c) { tot.set(s, (tot.get(s) || 0) + k); if (k > (mx.get(s) || 0)) mx.set(s, k); }
  const vocab = [...tot.keys()].filter((s) => mx.get(s) >= minMax || tot.get(s) >= minSum).sort();
  const id = new Map(vocab.map((s, i) => [s, i]));
  const thinkers = canon.thinkers.map((t, k) => ({
    handle: t.handle, speaks: !TECHNICAL.includes(t.handle), giver: t.giver, work: t.work, source: t.source, n: per[k].n,
    c: [...per[k].c].filter(([s]) => id.has(s)).map(([s, v]) => [id.get(s), v]).sort((a, b) => a[0] - b[0]).map(([i, v]) => i + ":" + v).join(","),
  }));
  return {
    schema: "ThinkerProfile@1",
    giver: "per-thinker content-stem counts from each thinker's own verified English canon (ethos concern-priors roster; sha256 verified)",
    split: `by position: units of >= ${UNIT_MIN} content stems, runs of ${RUN}; run b mod 5 in {0,1,2} train, 3 dev, 4 test; this profile is fit on TRAIN only`,
    features: "content stems (fold-chat-thinkers.js contentStems)",
    declared: { minMax, minSum },
    calibration: { mu: DECLARED.mu, T: DECLARED.T, m: DECLARED.m, tau: DECLARED.tau, bonus: DECLARED.bonus, note: "fall-backs: eval/ants/B1-eval.mjs --write replaces these with the DEV-chosen values" },
    gaps: canon.gaps,
    vocab: vocab.join(" "),
    thinkers,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes("--check");
  const OUT = path.join(ROOT, "voice/thinkers-profile.json");
  const canon = loadCanon({ log: (...a) => console.log(...a) });
  for (const g of canon.gaps) console.log("GAP", g.handle.padEnd(16), g.why);
  const prof = buildProfile(canon);
  if (check) {
    const disk = JSON.parse(fs.readFileSync(OUT, "utf8"));
    const same = disk.vocab === prof.vocab && JSON.stringify(disk.thinkers) === JSON.stringify(prof.thinkers);
    console.log(same ? "ok: profile on disk == this build (every canon sha256 verified)" : "STALE: profile on disk differs from this build");
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(OUT, JSON.stringify(prof));
  console.log("wrote voice/thinkers-profile.json", fs.statSync(OUT).size, "bytes;", prof.thinkers.length, "thinkers;", prof.vocab.split(" ").length, "stems");
}
