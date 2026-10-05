# Specimen assembly — can the Fold build a program with the model switched off?

Question (from the design note pasted 2026-10-05): can a program be **selected from witnessed specimens by
mechanical narrowing**, with a model called only for a gap the machinery has already named precisely?

This directory is the test. Everything is dependency-free Node (acorn is vendored unmodified, see
`vendor/PROVENANCE.json`). Run it with `node experiments/specimen-assembly/run.mjs`; tests with
`node --test experiments/specimen-assembly/`.

## What this is NOT (read first)

- **The lifecycle here is a stand-in.** Heimdall has no shipped retry window, cancel or poll (confirmed by the
  Heimdall remote-compute session, 2026-10-05; its prototype has idempotency only). The "bounded request
  lifecycle" below — idempotent submit, retry on timeout, cancel, persistence, restart — is the one described in
  the design note, written as a deterministic simulation. A pass here says nothing about Heimdall's real code.
- **The specimens are authored for this harness, not found in the wild.** Their provenance says so
  (`origin: "authored-for-harness"`). The experiment tests the *machinery* (parse, effects, interface, execution,
  bounded exploration, receipts, nogoods, gap naming), not the ability to find good code.
- **The model proposer in M7 is scripted.** It tests the gap → proposal → verification → reuse path. It says
  nothing about what any real model would propose.
- **Bounded exploration is bounded.** Every verdict carries its bound. "No counterexample within bound B" is the
  strongest thing the harness will say.

## Vocabulary (this experiment's own; nothing borrowed from the impression/shadow/echo family)

| term | meaning here |
|---|---|
| specimen | source bytes + provenance + mechanically extracted facts (parse, exports, params, needs, effects) |
| slot | a named hole in a partial program with an entry name, arity, and parameter roles |
| obligation | a statement the assembled program must satisfy; static (read the specimen) or explored (run it) |
| need | an access path rooted at a parameter that the specimen calls (`kv.setnx`); checked against the environment |
| receipt | `{rule, preconditions, edits[byte ranges], in sha, out sha, preserves, introduces}`; re-applying the edits to the input must give the output bytes |
| mark | a ledger line: elimination, counterexample (with trace + scope), nogood, commit, gap |
| nogood | a counterexample generalised over slots, **verified** by running every completion of the dropped slots |
| gap | a slot (or program) for which no candidate satisfies the obligations, with each candidate's reason and nearest violation |

## Task

Program `lifecycle`, four slots: `key` (idempotency key from a request), `store` (claim/complete/release over a
key-value backend), `retry` (policy around the provider call), `cancel` (when an abort signal is honoured).
Obligations (all about a payment-like provider that does **not** dedupe by itself):

| id | obligation |
|---|---|
| S-effects | no clock, randomness, network, host, timer or console access; unresolved calls are *unproved*, not passes |
| S-needs | every `param.path(...)` the specimen calls exists in the environment |
| S-privacy | no property access to `email`, `phone`, `ssn` |
| D-restart | after a completed submit and a fresh handler over the same backend, a resubmit returns the cached result, 1 charge |
| D-timeout | provider timeout *before* accept → submit ends `ok` with 1 charge; timeout *after* accept → ≤ 1 charge |
| D-cancel | abort at every step k of a submit, then resubmit: ≤ 1 charge, resubmit ends `ok`; an abort seen before the charge decision must prevent the charge |
| D-distinct | two concurrent submits for different users → 2 charges, both `ok` (every interleaving) |
| D-dup | N concurrent identical submits → ≤ 1 charge, ≥ 1 `ok` (every interleaving, N = bound) |

Pool (lifecycle): 4 `key`, 3 `store`, 3 `retry`, 3 `cancel` specimens (+ probes used by individual criteria).
Task 2, program `cache`: one slot, a bounded result cache with seeded property tests; used for the gap/model path.

## Criteria — frozen before the first run

Each is stated with what would falsify it. Every criterion is reported, including failures. The run happens once
per script; if a criterion is falsified the code is not edited to rescue it — a new dated run is added below the
first.

**M1 — model-off assembly.** With the model port replaced by a function that throws, `assemble(lifecycle)`
commits a combination whose obligations all pass.
*Falsified if* it does not commit, makes any model call, or commits a combination not in the brute-force truth
set (every one of the surviving combinations run through every obligation, no learning, no ordering).

**M2 — planted defects found, with a control.** The pool contains a retry that retries blindly after a timeout and
a cancel that honours abort after the provider accepted. For each, the ledger holds a counterexample that
(a) names the slot and candidate, (b) replays from its recorded schedule to the same violation, (c) has a trace
of ≤ 12 steps. **Control:** a pool of only the combination the truth set accepts yields **zero** counterexamples.
*Falsified if* any planted defect has no replayable counterexample, or the control reports one.

**M3 — distinguishing experiment.** For `store-setnx` vs `store-getset` in the committed context, `distinguish`
returns a schedule where one passes and the other fails. **Control:** for `key-body` vs a reordered-concatenation
variant, it returns *no* distinguishing run and says so with the bound.
*Falsified if* it finds no difference for the first pair, or claims equivalence (rather than "none found within
bound") for the second.

**M4 — replace, keep provenance, revalidate.** Environment loses `kv.setnx` but has `kv.cas`. The solver reopens
only the `store` slot, adapts `store-setnx` with the `setnx→cas` rule, and commits again.
*Falsified if* (a) the receipt's edits re-applied to the original bytes do not reproduce the new specimen's
sha256, (b) the adapted specimen's provenance chain does not name the original, (c) the committed program fails
an obligation under the new environment, or (d) the other three slots were re-solved rather than kept.
**Control:** environment with neither `kv.setnx` nor `kv.cas` → a `gap` naming the store slot and the missing
needs, never a commit. *Falsified if* it commits.

**M5 — unknown stays unknown.** A specimen that calls through a computed member (`kv[name](...)`) is reported
`unproved` for S-effects. It is excluded from commit under the strict policy and listed apart from the
eliminated. *Falsified if* it is reported as passing S-effects, or as eliminated for a violation it did not commit.

**M6 — bound honesty.** A `store` probe whose bug needs three concurrent submitters (it takes over a claim after
the second waiter). At bound N = 2 the verdict must read *no counterexample within bound* with N recorded and
runs counted; at N = 3 it must be eliminated with a counterexample.
*Falsified if* the N = 2 verdict is a bare pass without the bound, or N = 3 fails to find it within 20 000 runs.

**M7 — precise gap, model enters as unverified, accepted code is reused.** Program `cache`, pool with no correct
member. `assemble` returns a gap naming, per candidate, the obligation it violates and a shrunken failing
operation sequence. A scripted proposer returns a wrong candidate first, then a right one. The wrong one must be
rejected by the assay; the right one enters with `origin: "model-proposed"`, `assurance: "witnessed under assay
<hash>"`. A second `cache` task with a different limit then resolves from the specimen store with **zero** model
calls. *Falsified if* the wrong proposal survives, the accepted one is recorded as anything stronger than
witnessed-under-assay, or the second task makes a model call. The request sent to the proposer must also pass
through a `guard` hook (de-id attaches there); the test checks the hook ran.

**M8 — measure, don't assume (no pass/fail).** Report assay runs spent with nogood learning and with naive
evaluation on the same pool, and the same on a pool enlarged with six extra non-solving specimens (is search cost
growing?). Reported as numbers; no threshold, because a threshold written now would be a guess.

## Known limits, written in advance

- vm contexts are not a security boundary and an infinite loop in a specimen hangs the harness (steps are bounded,
  but not time inside one synchronous run).
- Needs are derived from call sites rooted at parameters, one alias level deep; destructured parameters are
  reported unresolved.
- Nogoods are verified over the candidates present, not over all code that could exist.
- The simulation's provider and backend are our model of them. A program that passes is correct against the model.
