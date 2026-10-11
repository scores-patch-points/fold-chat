# Mind-wandering — results

Run 2026-10-08. Corpus: `Zenodotus/01-literature-books/gutenberg/pg345_Dracula.txt` (189,950 events,
9,510 forms), order 2. All runs model-free except the two OOV runs named below. Numbers are reproduced
by `out/*.summary.json`; every run is reproducible from its seed.

## Criteria

| id | verdict | evidence |
|---|---|---|
| **W1** it runs model-free | **stands** | `node --test` 10/10 pass; in-vocab runs report `modelCalls: 0`, every event `source: "prior"`. |
| **W2** reproducible | **stands** | same seed → identical event sequence; seed 4 differs (test). |
| **W3** starts on-topic, does drift | **stands** | first window `overlap = 1`; long runs reach `maxDriftRun` 9–233 and `distinctHubs` 1–16. |
| **W4** re-anchor rule works | **partly falsified** | returns home on well-connected topics (castle, train); for a sparse topic (`blood`) and a model-seeded one (`blockchain`) a drift run reaches **233** and **23** steps against a bound of 30 — the re-anchor cannot find home because the topic's neighbourhood is not reachable from the prior's own continuation. Disclosed, not hidden. |
| **W5** unfamiliar topic named, not invented around | **stands** | `blockchain` under `model none`: `oov: true`, 0 calls. Under `model tiny`: exactly **1** call; the model's gloss enters the transcript as seed, then the prior leads. |
| **W6** transcript stays locally English | **stands** | `bitsPerEvent` 5.87–10.58, near the corpus's own rate; no run collapsed to mostly-unseen tokens. |

## Run matrix (300 steps, seed 1)

| topic | meanOv | home | excur | maxDriftRun | hubs | bits | anchor/assoc/drift/reopen |
|---|---|---|---|---|---|---|---|
| castle | 0.072 | 0.04 | 0.337 | 9 | 14 | 5.87 | 30 / 15 / 33 / 0 |
| night | 0.092 | 0.053 | 0.417 | 52 | 11 | 7.08 | 77 / 10 / 27 / 23 |
| doctor | 0.062 | 0.063 | 0.563 | 65 | 7 | 8.14 | 95 / 9 / 21 / 50 |
| train | 0.073 | 0.08 | 0.493 | 33 | 9 | 7.67 | 111 / 9 / 25 / 6 |
| blood | 0.030 | 0.053 | 0.917 | 233 | 12 | 10.58 | 52 / 1 / 2 / 216 |

A 400-step `castle` run reached 16 distinct hubs with a 16-step maximum excursion — the transcript
walked castle → wall → van helsing → lucy → dracula → vampire → head, and read as a gothic wander
throughout (`out/castle--s1.txt`).

## The "little model" case (the one call)

`blockchain` is out of the corpus's vocabulary. `model none` reports the gap and spends nothing.
`model tiny` makes **one** call to `gemma2:2b`, which supplies a gloss; the mechanical prior then
wanders from the gloss into Dracula's world:

> Blockchain blockchain is a secure and transparent digital record of transactions that can be shared
> across many computers. It is my sole heir. If he did not disturb now. Necessity sure, when a. In of,
> and shall but to it each thus with

That is the whole thesis in one transcript: **one model call to name what the corpus never heard, and
everything after it is the prior's own continuation.** The model did not write the wander; it only
supplied the seed.

## Interpretation

- **How much wandering:** unbounded by the loop, bounded by the prior. Within 300 steps the text drifts
  into 7–16 distinct recurring hubs and can spend hundreds of steps away from the topic. The drift is a
  function of the topic's connectivity in the corpus, not of any model's choice.
- **The re-anchor is lexical and therefore fallible.** It works when the corpus connects the topic to
  its neighbourhood; it fails when it does not (`blood`, `blockchain`), where it reopens forever without
  ever measuring "home." That is the finding worth the experiment: a mechanical home-detector that
  measures *words* cannot guarantee return when the generator cannot produce those words.
- **Little to no model is enough** for the wandering itself. The model's only irreducible role here was
  naming an unheard topic — a gap the machinery pointed at precisely.

## Reproduce

```bash
node --test experiments/mind-wandering/
node experiments/mind-wandering/run.mjs --topic castle --steps 400
node experiments/mind-wandering/run.mjs --topic blockchain --model tiny   # needs Ollama + gemma2:2b
node experiments/mind-wandering/serve.mjs --open                          # http://127.0.0.1:8871
```
