# Gate fix: pre-registration (frozen before any change to `fold-chat-ground.js`)

Frozen 2026-10-05, before the first code edit. Instrument: `eval/controls.mjs --live` (runs the working tree's own
`fold-chat-ground.js` against real Wikipedia text, no browser, no model). The only edits made to the instrument before
this freeze are the ones that ADD controls (a `--live` flag; classes SCRIPT, SCRIPTN, HOLDN, HOLDP). No existing control was
changed. Baseline = the unmodified gate, measured with that instrument (`eval/controls-baseline-live.json`).

## What is measured

| class | what | baseline (unmodified gate) |
|---|---|---|
| NEG single | 26 plainly false sentences, one article as material | 17/26 rejected |
| NEG pooled | the same 26, all 7 articles as material | 19/26 rejected |
| POS | 10 true near-verbatim | 9/10 accepted |
| DER | 12 true, not copied (units, paraphrase, markup, leaked `[W1]`) | 7/12 accepted |
| SELF | 7 verbatim same-language sentences (zh ja ru ar es fr de) | 7/7 accepted |
| SELFN | same, first number -> 7777 | 7/7 rejected |
| XLN | 4 false sentences in another language than the source | 4/4 rejected |
| XL | 12 true sentences in another language than the source | 1/12 accepted |
| SCRIPT (new) | 12 verbatim sentences, 4 each from hi / ar / zh Wikipedia (Hindi, Cairo, Beijing), split on that script's own terminator; 2 with digits + 2 without per script | 9/12 accepted (3 Hindi misses) |
| SCRIPTN (new) | the 6 digit-bearing ones with the first number -> 7777 | 6/6 rejected |
| HOLDN (new) | 12 held-out false English sentences written before the fix, NOT to be tuned against (3 are deliberately hard: h04 h07 h12) | 8/12 rejected |
| HOLDP (new) | 10 held-out true English sentences (verbatim fragments, 2 unit variants, 1 paraphrase) | 9/10 accepted |
| labels | `eval/labels.json`, 136 hand-labelled answer sentences, re-scored offline with the gate | strict precision 31/64 = 48.4%; recall 48/94 = 51.1% |

## Bars (no bar will be changed after this point; a miss is reported as a miss)

1. NEG: at least 24/26 rejected, single AND pooled.
2. The nine named false positives (n07 n08 n12 n14 n15 n20 n21 n22 n24) are all rejected, single AND pooled.
3. No regression: POS >= 9/10, SELF 7/7, SELFN 7/7, XLN 4/4, SCRIPTN 6/6, HOLDP >= 9/10.
4. DER (unit conversions and paraphrase) >= 10/12 accepted.
5. SCRIPT 12/12 accepted (verbatim hi / ar / zh must ground to the page they were copied from).
6. HOLDN (held-out) >= 10/12 rejected. (Baseline 8/12. The three deliberately hard ones may stay accepted; that is the stated limit of a lexical gate.)
7. Labels re-scored offline: strict precision rises above 48.4% AND recall stays >= 45%. The re-scorer must first
   reproduce the original app-flags on the unmodified gate (reported as agreement %, so the rig itself is checked).
   Any new citation whose quote differs from the old one is hand-read and labelled in `eval/labels-v2.json`, with a reason.
8. The two named mis-citations (labelled sentences "completed in 1889" cited to the 1887 petition page, and "capital of
   Australia is Canberra" cited to a quote that is only the question) must end up either ungrounded or cited to a quote that says it.
9. Cross-language is NOT faked: XL true sentences that cannot overlap lexically stay unaccepted unless the number+name
   evidence is real. Bar: of the XL sentences the gate does not accept, at least 11/12 carry the typed reason `cross-language`
   (a note, never a silent miss), and XLN stays 4/4 rejected.
10. `node --test` stays green (baseline 856 pass, 0 fail), with at least one test and one falsifier for every fix.

## Method guardrails

* Fixes are structural (same-window support, binding of numbers to their neighbours, tag/source stripping, unit table,
  Unicode tokenisation), never a word list built from the control sentences.
* The held-out classes are run once per gate revision and never read to decide what to change; failures there are only reported.
* Cross-language: no translation tables, no embeddings, no model.
* The khora copy is NOT edited; anything that belongs there goes to `docs/KHORA-GATE-PATCHES.md`.

---

# Results (appended after the run; nothing above this line was edited)

Gate build: working tree `fold-chat-ground.js` of 2026-10-05 (the file the tests and `eval/controls.mjs --live` ran).
Instrument outputs: `eval/controls-baseline-live.json` (before), `eval/controls-final.json` (after), `eval/rescore-baseline.json` and
`eval/rescore-live.json` (labels, before / after), `eval/replay-gate.json` (recorded turns). `node --test`: 880 pass, 0 fail
(856 before this work; the other additions in the count are other people's concurrent work).

| # | bar | before | after | verdict |
|---|---|---|---|---|
| 1 | NEG rejected >= 24/26, single and pooled | 17/26, 19/26 | **26/26, 26/26** | met |
| 2 | nine named false positives all rejected, single and pooled | 0 of 9 rejected (all 9 accepted single; 7 of the 9 accepted pooled) | **9 of 9, single and pooled** | met |
| 3 | POS >= 9/10 | 9/10 | **10/10** | met |
| 3 | SELF verbatim 7/7 | 7/7 | **7/7** | met |
| 3 | SELFN number-swapped 7/7 | 7/7 | **7/7** | met |
| 3 | XLN cross-language false 4/4 | 4/4 | **4/4** | met |
| 3 | SCRIPTN 6/6 | 6/6 | **6/6** | met |
| 3 | HOLDP (held-out true) >= 9/10 | 9/10 | **9/10** (lost hp9, see below) | met, no margin |
| 4 | DER (units, paraphrase) >= 10/12 | 7/12 | **11/12** (lost d06 "The wall came down in 1989") | met |
| 5 | SCRIPT hi / ar / zh verbatim 12/12 | 9/12 (3 Hindi) | **12/12** | met |
| 6 | HOLDN (held-out false) >= 10/12 | 8/12 | **11/12** (h04 "largest city in Australia" stays accepted: lexical limit) | met |
| 7 | labels: strict precision > 48.4% | 31/64 = 48.4% recorded; 26/55 = 47.3% on the offline rig | **36/51 = 70.6%** | met |
| 7 | labels: recall >= 45% | 48/94 = 51.1% recorded; 44/94 = 46.8% on the rig | **43/94 = 45.7%** (rig scale) | met, 1 sentence of margin |
| 8 | the two named mis-citations | cited to the 1887 petition; cited to the "Question" page | **ungrounded**; **cited to "Canberra, the capital city of Australia, is situated within the territory…" (says it)** | met |
| 9 | typed `cross-language` reason on unaccepted XL | silent | **11/11**, XLN 4/4 still rejected | met |
| 10 | `node --test` green with a test + falsifier per fix | 856/856 | **880/880** | met |

Honest readings of those numbers:

* **The offline label rig is not the recorded run.** Reconstructing what the app handed the gate (the pages each turn read, cut to
  12,000 chars) and running the OLD gate on it reproduces the recorded grounded / not-grounded flag on 125 of 136 sentences (91.9%);
  its baseline precision / recall are 47.3% / 46.8%, not the recorded 48.4% / 51.1%. Both are shown. The 45% recall bar was
  checked on the rig's scale (43/94); it is met by ONE sentence.
* **Precision needs a hand label for every new citation.** Of the 51 sentences the new gate grounds, 11 are cited to the very quote
  that was hand-labelled before (label kept); the other 40 were read against their claim and labelled in `eval/labels-v2.json` with the
  quote beside the verdict (28 say it, 12 do not). The labeller is the same agent that wrote the gate; the file is there to be audited.
* **What recall lost and gained** (labelled-supported sentences, new gate against the old gate on the same rig): 14 lost, 13 gained
  (net 44 -> 43). The 14 by reason: a content term the source never uses 5 (a model's glosses: "exceeding", "credited", "debated"),
  a figure that is on the page but not beside the claim's words 5 (e.g. "completed in 1889" when the 12,000-char passage holds 1889 only
  beside the 1887 petition, which is defect 1), cross-language 3 (by design: Spanish / Russian / French sentences against English pages
  were "grounded" on a shared figure and a proper noun; they are now typed gaps), thin evidence 1.
* **Still wrong after the fix** (labelled false or off-quote, still grounded): "The Eiffel Tower is 300 meters tall" (cited
  to "no structure had ever been built to a height of 300 m" — same words, opposite claim), "Saudi Arabia won the 2034 FIFA World Cup"
  (cited to an Amnesty sentence naming both), "Isaac Newton was born first", "33,000 cm" (that one is TRUE: 33,000 cm = 330 m; the
  label calls it false). 8 of the 33 originally off-quote citations remain off-quote; 14 are now ungrounded and 11 are now
  cited to a quote that says it. A lexical gate cannot read a negation or an ordering; that needs the janus door, not more rules here.
* **Same-language paraphrase got stricter** (`SELFP`, no bar): 3/7 before, 1/7 after. A hand-written Spanish / French / German
  sentence that uses a different verb than the article ("mide" for "tiene") is now rejected for a content term the page never says.
  That is the price of "the predicate must be on the page".
* **hp9** ("Mount Everest stands about 29,032 feet above sea level") passed under an early draft only because the clause walk
  crossed a sentence boundary to find "sea level"; with sentence ends as hard stops it correctly fails (the figure and "sea level"
  are in different sentences of the page). **d06** fails for the same reason ("came down" vs "fall of the Wall").
* **Replay of the 140 recorded turns** (`eval/replay-gate.mjs`; only the 89 turns whose pages are cached, 34 skipped): grounded
  sentences 64 -> 58 of 216; among the 15 answers judged WRONG, grounded sentences 14 -> 9 and answers with any grounded sentence 9 -> 7;
  among the 74 judged CORRECT, 50 -> 49. The frontier model's tag-wrapped sentences gain (21 -> 25), the small default model loses
  (43 -> 33). Answer correctness is the model's and is unchanged; the live cases (search + model) were not re-run.
