# Archon sourcing and disclosure — plan

Goal: for each of the 83 archons in `khora/native/organs/archon-compendium.js`, show from primary text and credible scholarship whether our use is justified, and have AntiStrauss disclose every place we bend the author. Credit what each person actually argued; never use a name as a label; never write a "they all say the same thing" synthesis.

## Where we are (measured, not assumed)

- `scripts/archon-coverage.mjs` (no model; name-match is fuzzy, treat as a first pass): **50 of 83** archons match a verified snip manifest in `eo-teachings/manifest/`, **35** have a primary source on disk, **33 have no snip**. Those are tokenized by this plan's definition until fixed: 9 nominations, 18 fair-use (modern, copyright-limited), 5 public-domain with no snip yet (Brandeis, Martial, Ulysses, Kierkegaard, Kleene), and 1 conceptual (Tadoma).
- The engine (`eo-reason`) refuses the universal "every archon has a verified snip", as it should.
- Pilot: **Mozi** (`docs/archons/dossier/mozi.json`). Verdict **partial**, four bends. The source (Mei 1929, Anti-Fatalism I) requires three tests together (basis, verifiability, applicability); `grounding.js` mechanizes one and calls it the test, reads "senses of the common people" as string containment in bytes, and the compendium reorders the tests and presents our sentence "It is in the bytes the eyes and ears can witness" as if it were the author's. Scholarship (SEP "Mohism") confirms the three standards (root, source, use) and a live dispute (Hansen vs Graham/Harbsmeier) over whether they are about truth or appropriateness.

## The disclosure rule (what AntiStrauss enforces)

Each archon gets `docs/archons/dossier/<handle>.json` (`ArchonDossier@1`):
`snips` (verified manifests), `whatTheyArgued`, `scholarship` (with disputes named, not smoothed), `ourUse`, `verdict` (justified | partial | fails), `bends[]` (each: kind, **ours**, **theirs**), `tokenized`, `fix`.

`scripts/archon-dossier-check.mjs` refuses an entry with: no verified snip (tokenized), no scholarship, no verdict, empty `bends` without an explicit `noBendReason`, a bend missing ours or theirs, or "justified" that lists bends. Run it in CI and in the chorus-lint pre-commit.

Runtime hook (phase 3): when a turn credits an archon, the credit line carries the dossier's verdict and its bends, so a response says "Mozi, by our reading: one of his three tests, applied to bytes" instead of an unqualified credit. A credit for an archon with no dossier is refused (AntiStrauss is the gate).

## Phases

1. **Canon five (byte-grounded, highest stakes, they bind the physics sha256):** Laozi, Ramakrishna, Mozi (done), Nagarjuna, Upanishads/Mandukya. Dossiers first because changing their canon moves the ground digest. Read the span the mechanics anchor to (refutation: Nagarjuna; self-plane: Mandukya) and compare with `kernel/refutation.js` and `kernel/self.js`.
2. **Public-domain archons with a source on disk but no or weak snip (about 20):** snip with `eo-teachings/snip.mjs cut`, then dossier. Mechanical, low risk.
3. **Wire the runtime hook** and the CI check; fix the compendium's misstatements the dossiers find (Mozi first).
4. **Fair-use modern thinkers (18):** Chomsky, Goffman, Ostrom, Bourdieu, Levinas, Buber, Popper, Saltzer and others. Copyright limits quotes to short credited phrases; snips defer (`copyrighted_deferred`) where needed, but scholarship and the bend ledger are still required. These are where flattening is most likely (Levinas and Buber used for "the other" in one breath), so each is checked for an argument the code contradicts, not only for presence.
5. **Nominations and conceptual (10):** the system's own names (YadaYadaYada, output-*, Houdini, Kahanamoku, Tadoma). The honest dossier says "our name, no author's work claimed", with `noBendReason`, so these are never credited as scholarship.

## Method per archon (so findings are checkable)

Snip the primary passage with `snip.mjs` (verified back to bytes); cite at least one credible secondary source and record any dispute; compare against the organ's code and its compendium entry; write bends as ours/theirs pairs; run `eo-reason` on the strict claims and the checker. A passing run shows consistency only. Whether a source says what a bend claims is settled by reading it, which a person should spot-check on the canon five.

## Not done yet

Only Mozi has a dossier. The other 82 are plan, not result. Scholarship for each archon needs fetching and reading; I'd run phases 1 and 2 as parallel research agents, one per archon, each required to pass the checker before reporting.

## Status (2026-10-06, end of first pass)

All 83 dossiers written and passing `scripts/archon-dossier-check.mjs`: 69 partial, 12 fails, 2 justified, 300 bends. Fails: bharata, bourdieu, goffman, kleeneUp, levinas, meerkat, panini, shizhen, sockeye, solon, tungara, xunzi.

Shipped in khora (uncommitted): `native/organs/archon-dossiers.js` (generated), disclosure in `creditedQuote`/`matchArchons`/the live `groundedWisdom` credit path, corrected `pdStatus` for dai, kleeneUp, wigmore, 41 generated "X speaks" header blocks relabeled as ours, and `native/conformance/archon-dossiers.test.mjs`. In the-fold: `fold-archons.test.mjs` gates dossier validity and generated-file drift.

Known weak: many dossiers rest on Wikipedia, search summaries or abstracts (SEP/IEP/Britannica returned 403/404 to the agents) and almost none read a primary book. They are findings to verify, not settled scholarship. Open: Nagarjuna canon span is an editor's introduction (rights and attribution decision), compendium `work`/`source` prose is not yet rewritten per dossier `fix` lists, and grounding.js/ethos.js behavior is unchanged (disclosure only).
