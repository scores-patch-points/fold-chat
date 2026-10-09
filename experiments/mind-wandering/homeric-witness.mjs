// homeric-witness.mjs — GIVE THE WITNESS BACK HIS OWN TEXT. The Homer archon in
// the penelope manifest is byte-anchored (c0 382 · c1 520) to the SAME Odyssey
// file the fold reads — but the manifest's source path (penelope/eo-teachings/
// sources/) is an empty submodule in this checkout, so loadVoice returns null
// and the most meaningful witness available is muted. Per the directive (full
// janus + penelope power to make the stray thoughts mean), this is the missing
// seam: the archon's verified words ARE the material being read.
//
// VERIFICATION IS BY CONSTRUCTION, NOT BY STRING-SPLITTING: the excerpt is
// sliced from the source file's OWN bytes at the manifest's anchor, so the
// words are the poem's words by identity. The refrains are the poem's whole
// finite sentences that mention the cast — located as substrings of the same
// bytes. Meaning, not paraphrase: what your words mean is what the READ
// attests at the address (see khora …/scene/accuracy.mjs, DMD-bounded).
import fs from "node:fs";

export const HOMER_PATH = "/Users/mlacy/Documents/3.0/Zenodotus/11-multi-language/greek-originals/homer-odyssey.txt";
export const HOMER_C0 = 382, HOMER_C1 = 520;

/** homericVoice({ at }) -> { excerpt, anchor, ref } — the Odyssey's own verified
 *  words, sliced around the manifest's anchor; the bytes ARE the source (the
 *  slice is taken from the file itself, so location is by construction). */
export function homericVoice({ path = HOMER_PATH, c0 = HOMER_C0, c1 = HOMER_C1 } = {}) {
  const text = fs.readFileSync(path, "utf8");
  const excerpt = text.slice(c0, c1).trim();
  return { excerpt, anchor: `${path}#${c0}-${c1}`, ref: "Homer", located: true, bytes: c1 - c0 };
}

/** homericRefrains({ names, verbs, path, limit }) -> whole finite sentences from
 *  the Odyssey itself that mention the cast — the material's OWN words about
 *  this, arranged (never invented). Verified = the sentence is a substring of
 *  the source bytes (a contradiction would mean the read is a lie). */
export function homericRefrains({ names = [], verbs = [], path = HOMER_PATH, limit = 6 } = {}) {
  const raw = fs.readFileSync(path, "utf8");
  // source carries line-number prefixes ("415 ἂν δ' ἄρα…") — strip them so the
  // sentence is pure text; verified against the source after stripping.
  const numPrefix = /^\s*\d+\s+/;
  const sents = raw.split(/(?<=[.!?])\s+/).map((s) => s.replace(numPrefix, "").trim()).filter((s) => s.length > 20);
  const wants = [...names, ...verbs].map((w) => String(w).toLowerCase());
  const scored = [];
  for (const s of sents) {
    const low = s.toLowerCase();
    let hit = 0;
    for (const w of wants) if (low.includes(w)) hit += 1;
    if (hit > 0) scored.push({ s, hit });
  }
  scored.sort((a, b) => b.hit - a.hit);
  const picked = scored.slice(0, limit);
  return picked.map((p) => ({ text: p.s.replace(/\s+/g, " ").trim(), hit: p.hit, verified: raw.includes(p.s) }));
}