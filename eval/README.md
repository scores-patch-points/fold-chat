# fold-chat accuracy eval

A small, reproducible harness that drives the REAL chat page headlessly (Playwright), records every turn from the
persisted session JSON, and scores it against gold facts that were checked against Wikipedia.

## Files

| file | what |
|---|---|
| `cases.json` | 73 cases / 83 turns in 9 strata, each with a one-line rationale, gold answer, gold check(s), gold URL(s). Built by `build-cases.mjs` (the multilingual block is generated from one table). |
| `run.mjs` | the driver. One fresh browser context per case, model chosen through Settings -> Models (the app's own drawer), composer polled until enabled, session read from `localStorage["fold-chat:sessions"]`. Writes `raw/<label>__<case>__r<k>.json` (resumable). |
| `lib/snapshot.mjs` | freezes the working tree into `eval/.app/` (sha256 of every file in `.app/_meta.json`) and serves it on a private port, so concurrent edits by other people cannot change a run mid-way. |
| `score.mjs` | deterministic metrics + merges `judgments.json` (my per-case reading, with a reason) -> `results.json`. |
| `controls.mjs` | offline gate tests (no browser, no model): feeds hand-written true/false sentences to the app's own `fold-chat-ground.js` against real Wikipedia text -> `controls-results.json`. |
| `worksheet.mjs` | lays out answer sentences beside the evidence for hand-labelling -> `labels.json`. |
| `judgments.json`, `labels.json` | the human (reading) part of the scoring, kept auditable. |
| `run-all.sh` | the full sequence: default model (all cases) -> sealed frontier model (subset) -> 3x repeats of the flakiness subset. |

## Rerun

```
node eval/build-cases.mjs                         # (re)generate cases.json
node eval/run.mjs --resnap                        # default model (autoPick = gemma2:2b), all cases, snapshot the CURRENT tree first
node eval/run.mjs --label frontier --model claude-sonnet-4-6 --only frontier
node eval/run.mjs --only repeat --reps 3          # flakiness: runs r2,r3 for the repeat subset
node eval/controls.mjs                            # gate controls (needs eval/.app from a run)
node eval/score.mjs                               # -> eval/results.json + tables
node eval/run.mjs --appdir .app-cur --rawdir raw-cur --label cur --resnap --ids a2_austen   # a different build in its own dirs
```

Needs: heimdall bridge on `:8790`, Playwright at `/private/tmp/fold-e2e/node_modules/playwright/index.mjs` (or `npm i playwright`).
`--app live` points at `FOLD_URL` (default `http://127.0.0.1:8814/`) instead of a snapshot.

## Honesty notes

* Requests are serialised with delays. The app does its own public-API calls from the page; 429/502 are recorded in the
  app's own trace (`grounding.web`) and never retried by the harness (only a *dead* case, e.g. bridge 403, is retried once).
* The headline table uses ONE run per case; the `repeat` subset has 3 runs to show flakiness.
* `answer_correct` = a judgment (reading the output) when one exists, else the deterministic gold check. Both are reported.
* Retrieval relevance is judged by a per-case `topic` regex over the page URL/title (a proxy, spot-checked by hand).
* Gold was verified with curl against en.wikipedia.org on 2026-10-05; some gold are ranges because Wikipedia itself
  gives several measurements (Eiffel 324/330 m, Mariana 35,760-35,876 ft, Iceland population).
* The app is a moving target. Every run records which build it ran against (`raw/_app.json`, `.app/_meta.json`).

## Builds measured (the app changed under the eval, so each result set names its build)

| set | raw dir | snapshot | what it is |
|---|---|---|---|
| **A** | `raw/` (`default` = gemma2:2b, `frontier` = claude-sonnet-4-6, 3x repeats) | `.app/` taken 15:41Z, repo HEAD 5a20a32 + dirty tree | full 73 cases. Already has the content-channel fix (void is `record.void`, notices in `message.notices`; 0 of 140 answers contain a "void" paragraph). |
| **cur** | `raw-cur/` (`cur`, gemma2:2b) | `.app-cur/` taken 17:57Z, HEAD 68a7000 | full 73 cases on the newer build (source router, language module, attribution pass, answer modes). Frontier column UNMEASURED: from ~19:00Z the bridge's `/api/tags` lists only gemma2:2b, qwen2.5-coder, nomic-embed. |
| **cur2** | `raw-cur2/` (`cur2`, gemma2:2b) | `.app-cur2/`, HEAD 619c063 | 12-case spot check of the newest tree (default answer mode is now `snips`). |

Files kept for the record: `raw-cur-broken1/` (a snapshot taken mid-edit whose composer never unlocked: `body.querySelector is not a function`,
then `Cannot access 'turn' before initialization`), `raw-extra/` (runs discarded because the bridge answered 403/429, or because
autoPick fell back to the sealed `openai-fast` model when `/api/tags` briefly listed no local model).
Rows with no entry in `judgments.json` were read and the deterministic gold check stands.
`results.json` (A), `results-cur.json`, `results-cur2.json`, `controls-results.json` (+`-cur`) are the outputs; `labels.json` holds the 136 hand-labelled sentences (A only).

## Gate-fix instruments (docs/GATE-FIX-PREREG.md)

| file | what |
|---|---|
| `controls.mjs --live` | now scores the working tree's `fold-chat-ground.js` (the repo root) instead of a snapshot; new classes SCRIPT / SCRIPTN (hi, ar, zh verbatim from Wikipedia, number-swapped), HOLDN / HOLDP (held-out false / true, never tuned against); results carry `why` (the typed reason a sentence was not grounded). `controls-baseline-live.json` = before, `controls-final.json` = after. |
| `rescore-labels.mjs --gate baseline\|live` | re-scores the 136 hand-labelled sentences OFFLINE with a gate build; `baseline` is `lib/ground-baseline.mjs` (the gate as committed before the fix) and checks the rig against the recorded flags. Pages are cached as `cache/pg_<sha1(url)>.txt` (the old `u_<hex40>` key collided across 12 URL groups). |
| `labels-v2.json` | hand labels of every NEW cited quote (keyed key#idx#quote), with the quote beside each verdict. |
| `replay-gate.mjs` | replays the recorded answers of `results.json` against the cached pages their turns read, old gate vs new, offline. |
