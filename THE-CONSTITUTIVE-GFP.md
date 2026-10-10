# The constitutive GFP — the three repositories as one Ground·Figure·Pattern

*Standing finding, 2026-10-10. One sentence: **khora is the Ground, janus is the
Figure, penelope is the Pattern** — the reading surface (the fold) sets a
generation task on the triangle, WebLLM is the ONE mouth that phrasings it, and
the sealed artifact is the Pattern cut where the other two repos agreed.*

## Why these three faces

The house's reader makes its relations the same way a fold is made: an
arrangement is `{end1, label, end2}` — **two recurring FIGURES with the text
BETWEEN them as the label** (`native/adapters/text/relations-gfp.js`), and the
resolver closes every task into a cell of op × **Ground · Figure · Pattern**
(`penelope/organs/resolver.mjs`). The three repos are not three servers; they
are that triad, each holding one face:

| face | repo | what it holds | its law it must not break |
|---|---|---|---|
| **G — Ground** | **khora** | the material's own bytes, addresses, cast, surprise, the read (`readToWeft`, the scene reader, `source-address.mjs`) | model-free reading; the priors it reads by live in janus/priors; FOLD II.9: the mouth never reasons on it |
| **F — Figure** | **janus** | identity, the beings, kind induction over the company graph, nomos (the figures that recur) | a kind is a CANDIDATE until null/frequency controls license it; cast does not carry across books |
| **P — Pattern** | **penelope** | the weave, the artifact, the seal — the pattern cut over G×F and grounded at byte addresses | mouth-last (field → hunt → mouth); a quote is sealed, a claim is not attested by the quote |

A generated artifact is one GFP arrangement: the anchor Figure (the subject), a
Ground label (the record's own bytes between the figures), the target Figure
(the object) — and the Fold surface is where the arrangement is READ.

## The essay thread is the first instantiated GFP

`the-fold/school.html` → `/api/essay/box`:

1. **G** (server) — khora reads an 80,000-char W&P excerpt (disclosed `partial`), the box computes
   the cast, the edges, the surprise floor, and the quotable byte addresses.
2. **F** (server) — janus induces the kinds over the real company graph; each kind is
   `standing: "candidate"` until the null/frequency controls run.
3. **P** (browser + server) — the page's WebLLM mouth phrases the essay from the
   box; penelope replaces every `⟦source@abs⟧` with the source's own bytes and
   REFUSES the address it did not hunt. Verdict `SEALED`/`UNVERIFIED`, never a
   claim-level attestation.

Measured 2026-10-10: `SEALED`, 1 snip, 0 refused; and a prose draft carrying a
verified quote returns `UNVERIFIED` (the quote is real; the claim is not).

## The organs grown to make "any form of generation" stand in the triad

- **The shared in-page mouth** — `the-fold/fold-mouth-webllm.mjs`: one WebLLM
  mouth for every generation surface in the Fold. It answers Penelope's draw
  contract (`draw → { ok, text, model }`), mirrors the house ration, routes a
  task to its form AND its GFP grain (`kindFor`), and frames every draw so the
  mouth speaks only the ground (FOLD II.9). `school.html` now uses it instead of a
  second hard-coded model instance.
- **The server seam** — `penelope/organs/generation-door.mjs` `exec`: a caller
  may hand its OWN draw executor (a WebLLM page) to the door while the box still
  answers first and the swatch still names the model. `engine.mjs` threads
  `context.mouth` down to the draw.
- **The forms** — `penelope/organs/generation/adapters/{markdown,page,data,talk}.mjs`,
  all drawing the Ground a khora read supplies (`context.read` → `ground.mjs`):
  - `markdown` — a brief/notes/README: the mouth phrases paragraphs, the test
    admits only paragraphs whose markers resolve to the hunt's own bytes.
  - `page` — a full HTML document: the mouth emits one element per unit, the
    html-snip organ keeps each element balanced, assembly shells the page.
  - `data` — box-first: the JSON record IS the ground; zero mouth draws.
  - `talk` — the mouth's own form: a spoken turn framed over the cast, deeds
    and hunt; sealing is the seal organ's, never this adapter's.
- **The Ground organ** — `penelope/organs/generation/ground.mjs`: a khora read →
  cast, deeds, company, and the byte-hunt the mouth may cite. Mouth-last is
  structural: the mouth never invents a fact, it phrases the Ground's own.

## Reconciliation with khora, stated plainly

1. **FOLD II.9 (no-model-reasoning) is carried into the fold.** The browser mouth's
   `frame` forbids derivation and invented names; its `probeUnit`s refuse a
   paragraph with no hunt marker; the seal REFUSES any marker the hunt never
   gave. The mouth phrases; nothing reasons.
2. **Mouth-last / field-first is not relaxed by WebLLM.** The box (read +
   box-settle) runs model-free on the server; the hunt supplies the addresses;
   the mouth draws the residue in the page. `data` proves the discipline: the
   record is computed with the mouth never called (measured `stages = field`).
3. **Priors keep ONE home.** khora does not carry its own wordlist priors; the
   essay reader reads the pos-prior it carries as data, and the house rule —
   priors live in janus/priors — is untouched. The Ground is bytes, not priors.

## Falsifying controls

- A paragraph/admon that reaches the Fold with **no hunt marker** that the seal
  still calls SEALED → mouth-last broke.
- A marker **at an address the hunt never gave** that the seal does not refuse →
  the byte-gate broke.
- A `weave({artifact: "data"})` over a real read that reports a mouth draw in
  its outcomes → box-first broke (it must be `field`).
- A browser mouth whose `frame` ever **invites reasoning** ("draw a conclusion
  from these facts") → khora FOLD II.9 broke.
- A kind labeled `standing: "candidate"` shown as conclusory in the page → the
  null/frequency controls were skipped, and the essay thread is only evidence,
  never a license for the full spiral stack (see `spiral-batch-20261010`'s
  still-to-implement list: canonical `readToWeft`, real kind falsifiers, weave
  through the production adapters).