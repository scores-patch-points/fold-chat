# Specimen assembly — results of run 1 (2026-10-05)

Criteria were frozen in `README.md` before any code ran (`PREREG.sha256`; `run.mjs` re-checks it: **README matches PREREG hash: true**).
One run of `node run.mjs`, all eight criteria, nothing edited to rescue a result. Raw output: `out/run-1.log`,
`out/results.json`, ledgers `out/ledger-main.jsonl` and `out/ledger-cache.jsonl`. The machine was heavily loaded
(load average 220–400), so **wall-clock numbers are noise**; run counts are the stable measure.

## Scoreboard

| # | Claim | Verdict | What the evidence actually shows |
|---|---|---|---|
| M1 | Model off, the Fold assembles a working program | **PASS** | Committed `key-body` + `store-setnx` + `retry-lookup` + `cancel-before-only` with a proposer that throws if called: 0 calls. Brute force over all 54 statically surviving combinations: **exactly one** passes, the same one. 6 combinations run, 46 pruned by nogoods, 2 eliminated before execution. |
| M2 | Planted defects found, replayable, no false alarm | **PASS** | `retry-blind`: 2 charges after a timeout-after-accept (6-step trace). `cancel-always`: resubmit ends `pending` after an abort that lands after the provider accepted (4-step trace). Both replay from their recorded schedule to the identical violation. Control (clean pool): commits, **0** counterexamples. |
| M3 | Distinguishing experiment | **PASS** | `store-setnx` vs `store-getset`: a 10-step interleaving of two identical submits where both read "no claim" and both charge. Control `key-body` vs reordered key: none found, reported as "assay-equivalent, not proven equivalent", bound attached. |
| M4 | Replace, keep provenance, revalidate | **PASS** | Environment without `kv.setnx`: only `store` reopened, other three kept; `setnx→cas` rule applied (two byte-range edits); re-applying them to the original bytes gives the new specimen's sha256; provenance names the original. Control without `cas` too: a gap, no commit. |
| M5 | Unknown stays unknown | **PASS** | `backend[name](...)` is `unproved` (not passed, not eliminated). Strict policy holds it out and lists it apart. Permissive policy can commit it, and the commit then says `UNPROVED: computed member call`. |
| M6 | Bound honesty | **PASS** | Takeover-after-two-waiters store: at N=2 submitters it survives, reported as "holds for every schedule of this scenario within the bound" with `requests: 2`, 20 runs. At N=3 it is eliminated (2 charges for 3 submits), found on run 1. |
| M7 | Precise gap; model code enters unverified; reuse | **PASS** | Pool alone: gap, naming per candidate the obligations violated (shrunk to 1–4 operations). Scripted proposer: proposal 1 rejected (`C-bounded`), proposal 2 accepted, recorded `model-proposed`, "witnessed under assay 7ff0638fcc15 … not proven". Guard hook ran on both requests. Task 2 (limit 2): committed from the store, **0** model calls. |
| M8 | Cost, no threshold | **reported** | See below. **Learning did not reduce assay cost here.** |

## M8, read plainly

| pool | nogood learning | assay runs | evals | combos tried | pruned |
|---|---|---|---|---|---|
| base 4/3/3/3 | yes | 641 | 114 | 6 | 46 |
| base 4/3/3/3 | no | **527** | 102 | 52 | 0 |
| enlarged 4/3/5/5 | yes | 2198 | 596 | 9 | 278 |
| enlarged 4/3/5/5 | no | **1280** | 509 | 287 | 0 |

Learning cut *combinations tried* from 52 to 6 and from 287 to 9, but each nogood is verified by running every
completion of the slots it generalises over, and that verification cost more runs than the pruning saved. In this
space, with a first-passing-combination stop, naive evaluation was cheaper. The pool grew 5.5×
(54→300 combinations) and naive cost grew 2.4× in runs; learning cost grew 3.4×. So the design note's
"more specimens can create more search work" is borne out, and its hoped-for saving from counterexample traces is
**not** shown by this experiment. Where it could still pay: a much larger space, or reuse of nogoods across
environment changes (not implemented; nogoods are scoped to one environment and assay).

## What the audit (reading the evidence behind the passes) turned up

- **M1's truth set has one member**, so "commit ∈ truth set" means "found the unique solution". It does not show
  the solver picks well among several valid combinations.
- **M2 used two different sources.** The `retry-blind` counterexample is a ledger entry from the committing run.
  The committing run never tried `cancel-always`, so its counterexample comes from a targeted run in the committed
  context (the evidence block says so).
- **M4's revalidation was total, not selective.** The invalidated-guarantees list is all five obligations,
  because every run goes through `store.claim`. The saving was in *slots* (3 of 4 kept, 313 runs against 527 for
  a naive full solve of the base pool), not in obligations re-checked.
- **M6's N=3 failure appears on run 1** because the default schedule is round-robin and already triggers it. The
  N=2 pass is the informative half: 20 schedules enumerated, bound stated.
- **A test caught a false claim in my own sandbox.** A new vm context still exposes `Date`; I had said it didn't.
  Fixed by shadowing it (`lib/specimen.mjs`) after run 1 had started. Run 1's specimens never touch `Date` (static
  elimination or no use), so its results do not depend on the fix. The fence is for determinism, not security.
- **The lifecycle is a stand-in.** Heimdall has no retry, cancel or poll today; its prototype has idempotency only.
  Nothing here tests Heimdall's code.
- **The specimens are authored for the harness**, not found code, and the proposer is scripted. M7 shows the
  gap → proposal → verification → reuse mechanism works; it shows nothing about any real model.

## What this does and does not establish

Established for this domain and these bounds: parse, interface, effect, privacy and capability constraints plus
bounded interleaving exploration were enough to pick the unique correct arrangement from 54, to find and replay
planted retry/cancel defects, to repair a slot after an environment change with a checkable receipt, to say "gap"
instead of inventing a pass, and to let an unverified model proposal in only through the assay. No model choice
was needed for any "next move".

Not established: that this scales past four slots; that real found code can be decomposed into these slots and
needs read from it (real code destructures, aliases deeply, imports); that nogood learning ever pays; that the
oracle (obligations written by hand) can be derived from a natural-language requirement; that anything holds
outside the bound.

## Next, in order of value

1. Replace authored specimens with found ones (penelope's sample store) and see how many survive `parse` +
   `needs` extraction at all. This is the first thing most likely to break the design.
2. Run the same harness against Heimdall's real request path once it has a lifecycle (read `khora/heimdall.mjs`).
3. Replace the scripted proposer with a small local model on the gap request; report accept rate and calls per
   accepted specimen (the decline must be measured, not assumed).
4. Wire `guard` to `fold-chat-deid.js` (`residual()` fail-closed) and write the ledger into the Fold viewer's EOT
   (`eotFromFold`, Provenance@2).

Test command note: Node 24 wants a file, not a directory:
`node --test experiments/specimen-assembly/specimen-assembly.test.mjs` (10 tests, ~25 s; the README line is frozen
and says the directory form).
