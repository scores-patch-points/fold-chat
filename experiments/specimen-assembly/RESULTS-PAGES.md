# Pages — results of the official run (2026-10-05)

Criteria: `PAGES.md`, hash recorded in `PAGES.sha256` and re-checked by the run (**matches: true**). Run script
`run-pages.mjs`; raw output `out/run-pages-2.log`, `out/pages-results.json`, ledgers `out/ledger-pages*.jsonl`.
Run 1 (`out/run-pages-1-crashed.log`) crashed: `attribute()` filtered CSS atoms out of the list before cutting, so
parent links pointed at the wrong atoms. That is a code bug, not a result; it was fixed (and leaf detection fixed to
use position, not id) and the whole script re-run. Nothing in `PAGES.md` was changed. Run 2 is the only complete run.

Demo: `node build-show.mjs`, then the `assembly-demo` entry in `.claude/launch.json` (port 8817) serves
`out/show/index.html`. It was opened in the built-in browser and driven by hand: bill 100, 15%, 2 people → tip 15.00,
per person 57.50; bill −50 → tip 0.00, per person 0.00.

## Scoreboard

| # | Verdict | What happened |
|---|---|---|
| T1 pool evaluation | **FALSIFIED** (2/3) | `tip-suite` 11/11; every other specimen fails some (`bill-splitter` 6, `counter` 2, `todo` 2, `contact-form` 2). The third check was wrong: I predicted `bill-splitter` holds `shell`, but `shell` includes `P-layout`, which needs the three tip buttons, so it holds only `bill-input`, `people-input` and `guard`. A wrong prediction on my side, not a bug in the splitter. |
| T2 model-off assembly | **PASS** (7/7) | Picked the superset, deleted 22 byte ranges, 6832 → 3346 bytes (51 % smaller), **0 bytes generated**, all 11 obligations hold in Chromium, the receipt's deletions re-applied to the original reproduce the output sha256, and the output is a subsequence of the input. |
| T3 what subtraction cannot do | **PASS** (1/1) | History list, theme toggle, copy button, custom tip, round-up and clear are gone. **The currency select remained**, as predicted (see below). |
| T4 marks, not names | **PASS** (1/1) | 35 of 35 surviving leaf atoms break at least one obligation when deleted alone. |
| T5 the void | **FALSIFIED** (13/15) | No page passes (void), nearest is `bill-splitter` (6/11), every seam statement is found at its byte range. But the void set is `tip-buttons`, `compute`, `display` **and `shell` (partial)**, not the three I pre-registered, and `shell` has no seam (it is a layout failure, not a statement to attach to). Same cause as T1. |
| T6 asks and the door | **FALSIFIED** (2/4) | Four asks, not three (the `shell` void gets one); each ≤ 2500 chars (787–1657). Every ask went through the real redactor and masking **altered 3–12 fields per ask** (below). |
| T7 screenshot extractor | reported | Passes 2/11 (`P-title`, `P-clean`). |
| T8 cost | reported | 134 atoms, 208 oracle calls, 3 rounds, 1191 browser loads, 203 s on a lightly loaded machine. |

## What the passes actually are, read plainly

- **The page is real.** I read the 3346-byte output. It is a working tip calculator: bill input, 10/15/20 buttons,
  people input, tip and per-person text that follow the inputs live, clamps so nothing shows negative.
- **It has a visible defect the obligations did not catch.** The currency `<select>` stays (the script reads its
  value inside `money()`, an expression, and statement deletion cannot rewrite expressions) but all its `<option>`
  elements were deleted, so the select is empty, `currencyEl.value` is `""`, and the result shows `15.00` with no
  `$`. The page's static text still says `$0.00` until the first change. No obligation requires a currency symbol,
  so the assembler had no reason to keep the options. This is the `P-live` lesson again: **the obligations are the
  whole definition of the ask**, and whatever they do not state is fair game. A `P-currency` obligation would force
  the options (or the whole select) to be handled; adding it after seeing this would be a new, dated run.
- **A second oracle gap was fixed during development** and is disclosed in `PAGES.md`: `P-live` first changed only
  the bill, the subtractor deleted the people-field listener, and the page stopped following people changes.
- **Names are not what holds things up.** Leaf marks by holon: compute 56 atoms, display 31, shell 25, guard 18,
  tip-buttons 3, bill-input 2, people-input 2 (an atom that breaks two holons' checks counts under both, so these
  overlap).
- **The superset was written by Claude** and is unusually cooperative (named ids, one statement per line). The 51 %
  figure says nothing about found pages.

## The void, as the demo shows it

For the pool without `tip-suite`, `bill-splitter` is nearest: it holds `bill-input`, `people-input` and `guard`. The
void report names `tip-buttons` (no 10/15/20 buttons; consumer: `compute` needs `pct`), `compute` (tip null, per
person 50 instead of 115), `display` (does not follow a change of the bill), and `shell` (partial: it fits the page
except the buttons). Each carries its path (`ask › page › result › compute`), contract, neighbours with element ids,
its unmet scenarios with what was observed, and a seam: the six statements of `bill-splitter` that touch `#bill`
and `#people`, with byte ranges. One ask per void, in dependency order, 787–1657 characters each.

## The door, measured: the redactor shreds code

Every ask went through `fold-chat-redact.js` `deidentify` and the live Python redactor, values only (keys and JSON
punctuation never sent). Structure survives. The text does not:

- `var bill = document.getElementById("bill");` → `ORG_… bill = NAME_…");`
- `var people = document.getElementById("people");` → `NAME_… people = URL_…ElementById("people");`
- `Math.max(0, parseFloat(bill.value) || 0)` → `NAME_…, parseFloat(URL_…lue) || 0)`
- scenario text `bill 100, 1 person…` → `NAME_… 100, …`; `390px` → `ORG_…`; `NaN or Infinity` → `ORG_… or ORG_…`;
  `observed… per person=50` → `per LOC_…`

So the ask a model would receive cannot be acted on: the seam code it is meant to edit is mangled. This is not a
bug in the redactor so much as a conflict of purpose. The statements are not private (they are the specimen's own
code, authored here); the redactor has no way to know that. The fork and the de-id owner need to decide a rule, for
example: values that come from a specimen of known public or authored origin go unmasked, and only user-supplied
text (the ask, pasted code) is masked. I have not implemented that, because it relaxes the door, which is not mine
to relax. `exempt` rules fix specific classes (the call-shaped `CODE_CALLS` fixed the earlier cache-request
over-masks) but cannot cover arbitrary JavaScript.

## Where a model would still be needed

The void asks above. No model was called. What the machinery can do without one: find the superset, cut it down to
the obligations, say exactly which holon is missing and where it attaches. What it cannot do: attach three buttons
and a percentage to `bill-splitter` without writing code. In this pool the missing holons exist whole in
`tip-suite`; a transplant rule (copy the atoms that hold up `tip-buttons`/`compute`/`display` into the nearest
page) would fill the void with no model too. That is the natural next experiment and is not built.

## Limits and not-yet

- Five authored pages, one browser, one viewport, eleven scenarios.
- Subtraction deletes statements and elements; it cannot rewrite an expression, so entanglement stays (the currency).
- `html-snip.mjs` handles balanced markup; found pages with sloppy HTML will need the harder cases.
- Found pages with licences (the real-specimen step) are not done; nothing here comes from the wild.
- `P-layout` is judged at 390 px only.
- Not committed.
