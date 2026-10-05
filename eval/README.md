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
