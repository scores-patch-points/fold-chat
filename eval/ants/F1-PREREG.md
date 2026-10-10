# F1 PRE-REGISTRATION — falsifying checks 1 NUL, 2 SIG, 3 INS of `falsifiersOf` (fold-chat-present.js)

Written 2026-10-06 BEFORE any case was built or run. Not edited after. Ant F1. I am trying to refute the checks, not defend them.
Files read (never edited): fold-chat-present.js (falsifiersOf, crossCheckOf), fold-chat-presentview.js (how the headline "N of 9 checks flagged" is counted), fold-chat-ground.js (turnRecord, unsupportedClaims, facingPage).

## What I read before registering (so the claims are about the real surface)
* The headline counts a row as FLAGGED when ANY of its three grains (ground, figure, pattern) is `gap` or `refused`, and FAILED when any is `failed` (presentview.js ~l.352). `row.status` is only the figure grain.
  So I measure TWO things per check: `figure` (row.status) and `headline` (the UI rule: flagged-or-failed on any grain). The user sees `headline`.
* NUL: figure = `gap` iff `rec.unsupported.names` (minus openers) non-empty. Ground grain is a constant `open`. Pattern is `n/a` / `open` / `gap`.
* SIG: figure = `held` iff backed === n sentences. Pattern grain = `gap` when every attestation traces to ONE site.
* INS: figure = `failed` iff a quoted span (>= 8 chars, in " or curly quotes) is absent from `facing.sources[].before+mark+after`; `n/a` with no sources. Pattern grain = `gap` unless a cited passage occurs in >1 read page.

## Definitions
* CLEAN record for a check: an honest answer, every claim and quote really in the pages read, for that check's charter.
* DEFECTIVE record for a check: the answer has a defect that check's charter names (below).
* Cases are tagged REAL (real gemma2:2b turn on the real page, real web reads), REAL-MATERIAL (real pages captured from real turns + a hand-written answer run through the real `turnRecord`), SYNTH (hand-written pages and answer, through the real `turnRecord`). All records are built by the real `ground.turnRecord` + `tape` of `quick` pages the way fold-chat.js builds them; none is a hand-assembled `facing` unless tagged SYNTH-RAW.
* Charters. NUL: a name/entity in the answer that no page read carries (fabricated name, multiword, lone, acronym, recombined from two real names). SIG: a sentence with no source (invented sentence, source present but irrelevant to the sentence, hedge / non-claim sentence "the sources do not give a clear answer" presented under a banner that says all trace). INS: a quotation not in the bytes (fabricated quote, paraphrase in quote marks, one altered word, spliced fragments).
* Per check >= 12 CLEAN and >= 12 DEFECTIVE. Hedge cases are counted as DEFECTIVE for SIG (a non-claim must not earn "all N sentences trace to a source"); I will also report SIG with hedges excluded.

## Claims (each is refuted by the counterexample named)
### Passable
* P-NUL: some honest answer gets NUL headline-unflagged. Refuted if 0 of the CLEAN NUL records are headline-unflagged.
* P-SIG: some honest, fully-sourced answer gets SIG headline-unflagged. Refuted if 0 CLEAN SIG records are headline-unflagged. PREDICTION (from reading): SIG headline is flagged for every single-site answer, so P-SIG holds only for >= 2 sites. A fully quoted single-site answer that is headline-flagged refutes "SIG measures sentence tracing".
* P-INS: some honest answer with a quote gets INS headline-unflagged. Refuted if 0 CLEAN INS records with a quote are headline-unflagged. PREDICTION: refuted for single-page quotes (pattern grain `gap`).
### Useful (thresholds)
* U-catch: defect catch rate >= 70% on the figure grain and on the headline, per check.
* U-false: clean false-flag rate <= 20%, per check, figure grain and headline.
* A check is USEFUL iff P holds AND catch >= 70% AND false-flag <= 20% on the headline. NOISE if headline false-flag > 50% (it flags clean answers about as often as bad ones) or catch < 30%. BROKEN if it cannot be un-flagged on any honest input (P refuted for all CLEAN). UNTESTABLE-AS-BUILT if its inputs are absent from real turn records (e.g. no tape / no sources persisted) so the check only runs on synthetic input.
* Discrimination (extra): headline flag-rate(defective) - flag-rate(clean) >= 0.5, else the flag carries no information.
### Truthful
* T-NUL: when NUL says `everything the answer names appears in what it read` that is true: every name token sequence is in some page read. Refuted by a recombined name ("Marie Einstein", both words on pages but never together) or a name hidden by the OPENERS filter.
* T-SIG: `all N sentences trace to a source` is true. Refuted by N = 0 (empty answer) or a hedge sentence counted as traced, or a sentence counted as backed by an irrelevant page.
* T-INS: `every cited passage is checked to occur in the page it came from` is true: the code checks the union of the excerpt windows, not the page each came from, and not the whole page. Refuted if a quote that exists verbatim in the page (outside the excerpt window) is called "not found in the bytes", or a quote taken from page B but cited to page A passes.

## Method / no-after-the-fact rules
1. Cases are written to `eval/ants/falsify-checks/f1/cases/*.json` and frozen (sha256 recorded in results) before the first scoring run.
2. Harness `eval/ants/falsify-checks/f1/f1.test.mjs` (node:test) loads the cases, runs `falsifiersOf`, writes `results.json`. Real turns collected by `collect-real.mjs` into `real-turns.json` before scoring.
3. If a case is later found mislabelled, it is NOT edited; a note goes in the results under "label disputes" and both numbers (with/without) are printed.
4. No model is used as a judge. Labels come from construction (synthetic) or from my hand audit of real turns (recorded in the file with the reason).
5. No edits to any vetoed file. Proposed fix goes in `eval/ants/falsify-checks/f1/F1-fix.diff`, unapplied.
