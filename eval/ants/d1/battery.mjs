// battery.mjs — generate the 18 scripted conversations (seeded, deterministic) and freeze them in cases.json.
//   node eval/ants/d1/battery.mjs        → eval/ants/d1/cases.json  (+ prints its sha256; the sha goes in D1-RESULTS.md)
import fs from "node:fs";
import { createHash } from "node:crypto";
const J = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), "utf8"));
const ASKS = J("./corpus/asks.json"), CUES = J("./corpus/cues.json"), NEEDLES = J("./corpus/needles.json");
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const shuffle = (r, a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k]);

// probe kinds (global round-robin so every (distance x kind) cell is covered evenly); non-en has no ellipsis form
const KINDS = ["pron", "elide", "repeat", "para", "partial", "explicit", "explicitPartial", "wrong", "none", "return", "correction"];
const D = [3, 10, 25, 50];
let rr = 0;

const CONVS = [
  // id, lang, length, anchor topic, sibling-in-roster, roster (other topics)
  ["E01", "en", 30, "eiffel", false], ["E02", "en", 30, "greatwall", true], ["E03", "en", 30, "everest", false], ["E04", "en", 30, "panama", true],
  ["E05", "en", 45, "telephone", false], ["E06", "en", 45, "berlinwall", true], ["E07", "en", 45, "curie", false], ["E08", "en", 45, "suez", true],
  ["E09", "en", 60, "titanic", false], ["E10", "en", 60, "pisa", true], ["E11", "en", 60, "photo", false], ["E12", "en", 60, "canberra", false],
  ["S01", "es", 30, "colon", false], ["S02", "es", 36, "garcia", false], ["S03", "es", 30, "teide", false],
  ["F01", "fr", 30, "montblanc", false], ["F02", "fr", 36, "pasteur", false], ["F03", "fr", 30, "eiffelfr", false],
];

const SET = process.env.SET || "A";
let CONV_LIST = CONVS;
if (SET === "B") {   // battery B (added after A's first analysis, to raise n; pooled AND reported apart): 24 en + 3 es + 3 fr, new seeds, anchors cycled
  const en = ["eiffel", "greatwall", "everest", "panama", "telephone", "berlinwall", "curie", "suez", "titanic", "pisa", "photo", "canberra"], sib = new Set(["greatwall", "panama", "berlinwall", "suez", "pisa", "eiffel"]);
  const lens = [30, 45, 60]; CONV_LIST = [];
  for (let i = 0; i < 24; i++) { const a = en[(i * 5 + 1) % en.length]; CONV_LIST.push([`X${String(i + 1).padStart(2, "0")}`, "en", lens[i % 3], a, sib.has(a) && i % 2 === 0]); }
  [["S11", "es", "garcia"], ["S12", "es", "teide"], ["S13", "es", "colon"], ["F11", "fr", "montblanc"], ["F12", "fr", "pasteur"], ["F13", "fr", "eiffelfr"]].forEach(([id, l, a]) => CONV_LIST.push([id, l, 30, a, false]));
  rr = 5;
}
const cases = [];
CONV_LIST.forEach(([id, lang, L, anchor, sibIn], ci) => {
  const r = rng((SET === "B" ? 90000 : 1000) + ci * 77);
  const bank = ASKS[lang], cue = CUES[lang], T = (k) => bank[k];
  const sibling = (CUES.en[anchor] && CUES.en[anchor].sibling) || null;
  const all = Object.keys(bank).filter((k) => k !== anchor && !(sibling && k === sibling && !sibIn));
  const roster = shuffle(r, all).slice(0, Math.min(all.length, 7));
  if (sibIn && sibling && !roster.includes(sibling)) roster[0] = sibling;
  const turns = Array.from({ length: L }, () => null);
  const set = (n, o) => { turns[n - 1] = { n, ...o }; };
  const greet = { en: "Hello", es: "Hola", fr: "Bonjour" }[lang];
  set(1, { role: "filler", kind: "greet", text: greet });
  const warm = roster.find((k) => k !== sibling) || roster[0];
  set(2, { role: "filler", kind: "ask", topic: warm, text: T(warm).qa[0] });
  set(3, { role: "anchor", topic: anchor, text: T(anchor).qa[0] });
  // turn 4: the near control (anaphor with the anchor still the last topic): distance 1
  const nearKind = ci % 2 === 0 || !cue[anchor] || !cue[anchor].elide ? "pron" : "elide";
  set(4, { role: "probe", probe: { kind: nearKind, distance: 1, near: true, topic: anchor, gold: { type: "needle", idx: 0 } }, text: nearKind === "pron" ? T(anchor).pron[0] : cue[anchor].elide });
  // probe slots
  const slots = [];
  for (const d of D) { const t1 = 3 + d, t2 = 3 + d + 2; if (t2 <= L - 1) { slots.push([t1, d], [t2, d + 2]); } }
  const wrongOk = !sibIn;
  const used = new Set();
  for (const [t, d] of slots) {
    let kind, guard = 0;
    do { kind = KINDS[rr++ % KINDS.length]; guard++; } while (guard < 40 && ((lang !== "en" && ["elide", "para", "return"].includes(kind)) || (kind === "wrong" && !wrongOk) || (kind === "wrong" && !(cue[anchor] && cue[anchor].wrong)) || (used.has(t) )));
    used.add(t);
    const n = T(anchor).name, c = cue[anchor] || {};
    const tp = CUES.templ[lang];
    const q1 = T(anchor).qa[1];
    const text = { pron: T(anchor).pron[0], elide: c.elide, repeat: T(anchor).qa[0], para: q1, partial: fill(tp.partial, { partial: c.partial }), explicit: fill(tp.explicit, { name: n }), explicitPartial: fill(tp.explicitPartial, { partial: c.partial }), wrong: fill(tp.wrong, { wrong: c.wrong }), none: tp.none, return: fill(tp.return, { name: n, q: q1 }), correction: fill(tp.correction, { fake: lang === "en" ? "1877" : "1877" }) }[kind];
    const gold = kind === "wrong" ? { type: "none" } : kind === "none" ? { type: "turn-last" } : ["explicit", "explicitPartial"].includes(kind) ? { type: "turn" } : kind === "correction" ? { type: "conversation" } : { type: "needle", idx: kind === "para" || kind === "return" ? 1 : 0 };
    set(t, { role: "probe", probe: { kind, distance: d, topic: anchor, gold, wrongKind: kind === "wrong" ? c.wrongKind || "pure" : null }, text });
  }
  // fillers: episodes of a standalone ask (+ immediate pronoun follow-up | chit-chat | meta) on roster topics, never the anchor
  const eps = [];
  let ti = 0;
  const nextTopic = () => roster[ti++ % roster.length];
  let n = 5;
  const free = (k) => !turns[k - 1];
  while (n <= L) {
    if (!free(n)) { n++; continue; }
    const r0 = r();
    const prevProbe = turns[n - 2] && turns[n - 2].role === "probe";
    if (prevProbe || r0 < 0.6) { const tk = nextTopic(); const useQ = r() < 0.7 ? 0 : 1; set(n, { role: "filler", kind: "ask", topic: tk, text: T(tk).qa[useQ], qi: useQ }); if (free(n + 1) && n + 1 <= L && r() < 0.45) { set(n + 1, { role: "filler", kind: "pron-bg", topic: tk, text: T(tk).pron[useQ === 0 ? 1 : 0] }); n++; } }
    else if (r0 < 0.78) set(n, { role: "filler", kind: "chit", text: pick(r, CUES.chit[lang]) });
    else if (r0 < 0.88) set(n, { role: "filler", kind: "meta", text: pick(r, CUES.meta[lang]) });
    else { const tk = nextTopic(); set(n, { role: "filler", kind: "ask", topic: tk, text: T(tk).qa[0], qi: 0, repeatOfBg: true }); }
    n++;
  }
  cases.push({ id, lang, length: L, anchor: { topic: anchor, turn: 3, qa0: T(anchor).qa[0], needle0: NEEDLES[lang][anchor][0], needle1: NEEDLES[lang][anchor][1] }, siblingInRoster: sibIn, roster, turns });
});
const body = JSON.stringify(cases, null, 1);
fs.writeFileSync(new URL(SET === "B" ? "./cases-B.json" : "./cases.json", import.meta.url), body);
const sha = createHash("sha256").update(body).digest("hex");
const nProbe = cases.reduce((a, c) => a + c.turns.filter((t) => t && t.role === "probe").length, 0);
console.log("conversations", cases.length, "turns", cases.reduce((a, c) => a + c.length, 0), "probes", nProbe, "sha256", sha);
const cell = {}; for (const c of cases) for (const t of c.turns) if (t && t.role === "probe") { const k = `${t.probe.near ? "near" : "d" + t.probe.distance}|${t.probe.kind}`; cell[k] = (cell[k] || 0) + 1; }
console.log(JSON.stringify(cell));
