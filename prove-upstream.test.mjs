// prove-upstream.test.mjs — the falsifiable lock on the seam claim. IDENTICAL
// tell() composer over three edge inputs: raw reader edges vs edges the source
// literally says (attested) vs the same with subjects shuffled (control). If the
// discontinuity were the COMPOSER, shuffling would not matter and attested
// would not beat raw; the locked result is B ≫ A and A ≫ C → it is the DATA.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readEnglish } from "../khora/native/eval/the-fold/scene/reader-en.mjs";
import { boundEdgesFromRead, cleanEdges, sentenceWitnesses } from "./essay-seam.mjs";
import { tell, attestedEdges, attestAct } from "./telling.mjs";

const SOURCE = "/Users/mlacy/Documents/3.0/pg2600.txt";

function saysSource(telling, witnesses) {
  const sents = telling.flatMap((p) => p.sentences);
  const ok = sents.filter((l) => l.acts.every((a) => attestAct(witnesses.get(a.at), a.s, a.v, a.o)));
  return { total: sents.length, rate: sents.length ? (ok.length / sents.length) * 100 : 0 };
}

test("seam proof: the residual discontinuity is the reader's edges, not the composer", { skip: fs.existsSync(SOURCE) ? false : `corpus absent (${SOURCE})` }, async () => {
  const full = fs.readFileSync(SOURCE, "utf8");
  const offset = full.indexOf("CHAPTER I");
  const excerpt = full.slice(offset, offset + 80000);
  const read = await readEnglish({ text: excerpt });
  const witnesses = sentenceWitnesses({ sourceText: full, excerptStart: offset, excerpt, read });
  const A = cleanEdges(boundEdgesFromRead({ sourceText: full, excerptStart: offset, excerpt, read }));
  const B = attestedEdges(A, witnesses);
  const C = B.map((e, i) => ({ ...e, s: B[(i + 7) % B.length].s }));
  const a = saysSource(tell({ edges: A }).telling, witnesses);
  const b = saysSource(tell({ edges: B }).telling, witnesses);
  const c = saysSource(tell({ edges: C }).telling, witnesses);
  assert.ok(b.rate >= 80, `attested telling says the source ${b.rate.toFixed(0)}%`);
  assert.ok(b.rate - a.rate >= 25, `clean beats raw (${b.rate.toFixed(0)} vs ${a.rate.toFixed(0)}) — the reader's edges are the noise`);
  assert.ok(a.rate - c.rate >= 25, `shuffling destroys it (${a.rate.toFixed(0)} vs ${c.rate.toFixed(0)}) — the composer is not the cause`);
});