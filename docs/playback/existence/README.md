# The Existence stages (1 NUL, 2 SIG, 3 INS): three forms, three faces each

Designer 1. Prototype only: no app code was touched. Open `nul.html`, `sig.html`, `ins.html` directly (self-contained: no fetch, no fonts, no external scripts). The "Mock controls" strip at the top is for review only (it is not product chrome): switch between three real turns (Mount Everest, the telephone, Australia), light/dark/auto, and scrub the recorded clock. URL hash: `#d=everest|telephone|australia&f=ground|figure|pattern&t=<seconds>&theme=light|dark`.

Screenshots: `shots/<stage>-<face>-<turn>-<375|1200>-<light|dark>.png` (108 files). Rebuild: `node extract.mjs && node build.mjs && DATA=everest node shots.mjs`. `shots.mjs` also runs a text-contrast audit (WCAG 4.5:1, 3:1 for large text) and a horizontal-overflow check on every shot; the last run reported 0 findings.

## Data used (all real, no model calls, no network)

* Everest: `eval/ants/falsify-checks/f3/real-a.json` item 1. Two laps, three searches, ten page reads, three pages that would not open, three results read last, one cited sentence, contested.
* Australia: same file, item 0. The web search gave no answer in 6 s; Wikipedia only.
* Telephone: `docs/playback/fixtures/turns.json` item 0 (the only turn that had finished writing when I built this). Nothing cited; the record's `void` is "unsupported".
* `extract.mjs` turns a record into the small model the mocks draw from. Everything printed as a source's words is copied from the record. The only derived things are: lap boundaries (from the `Reframe, lap N` tape line), and the INS Pattern "recurring runs and figures" (string comparison of the passages the record keeps; see "tape lacks").

## How a person moves between the three faces

Figure is home. The two neighbouring faces are never a menu: each neighbour appears as one line of what it found (for example "Nothing to read for 12.9 s"), at the bottom of the panel on a phone and as left/right side columns at 1000 px and wider. Tap the line, press Left/Right arrow, or swipe. Escape returns to Figure. Going to Ground is a zoom-out (the face scales down into place), going to Pattern is a pan. A three-dot mark (hub, spoke, rim) and a breadcrumb `Reading > 2 · SIG ○ > Figure: Entity · Binding` say where you are; tapping the stage crumb returns to Figure. In SIG and INS a tap on a lane, a passage or a page ruler opens the atom in place. Motion: face changes (150-240 ms, off under reduced-motion), and bars/lanes/counters moving as the recorded clock advances. Nothing else moves.

## Where I disagree with `docs/PLAYBACK-STEPS.md`

* It proposes merging NUL into SIG. I keep NUL as its own stage but say what it honestly is: the one stage whose picture is an absence, and the stage that should dwell only for as long as the first search takes. Its real content is at the end of the turn (what filled the blank, or that nothing did).
* SIG as a funnel (found, opened, set aside). I chose a timeline instead, because the tape's `at` clock is the only real quantity at this stage, and it answers "why did I wait 44 s?" (the web search used its whole 6 s budget; two page opens took 12 s and 13 s to fail). The funnel's counts survive as the caption and the lane end-labels.
* "Set aside" is wrong for a demoted result: the tape line is "Read look-alike pages last", so they are read last, not dropped. I use the record's own wording.
* INS minimap of "where on the page": the tape cannot support it (see below). I draw sizes, and a position only for the one thing whose position is recorded (the cited sentence).

## Stage 1 · NUL ∅ (Differentiate x Existence): the open slot

**What a person learns:** "It is holding my question as a blank; here is whether anything ever filled it."

Form: a dashed, hatched blank the shape of an answer, the question as its caption, and three odometers (pages read, passages in hand, sentences cited) that move only when the tape moves. At the end the blank is either solid with one page's sentence in it, or still dashed with the record's own "to close it" list.

| face | cell | shows | tape fields |
|---|---|---|---|
| Ground | Void · Clearing | how long nothing had arrived: a hatched ruler from 0 to the first page text (12.9 s on Everest), numbered arrivals (first results 7.2 s, first page 12.9 s, first passage 25 s), and a ledger of what it stood on | `st` found/read times, `quick.at`; `process[0..1]` (kind, effort), `language`, `answerMode` |
| Figure | Entity · Dissecting | the blank, the question verbatim, the counters; fills at the end from `facing.sources[0].text` and `loop.processLine`, or stays open from `void.read`, `void.closeBy` | `st` read entries, `quick`, `facing.sources`, `loop`, `void` |
| Pattern | Kind · Unraveling | the same blank per lap with the words it was asked in, verbatim: on Everest the second lap's query is `Mount Everest 848.86 meters 29 031.7 feet above sea level.` and why it went back | `loop.passes[].failing[]` (`s`, `why`, `query`), `web[]` per lap, `coverage` |

**Tape lacks:** (1) what was carried from earlier (a follow-up's referent): the ledger shows a dashed "not on the tape" cell. Needs `start.carried`. (2) The question's focus words and kind exist only as the heuristic output recomputed at replay; I did not draw them. Needs `start.focus`, `start.kind`. (3) The material the turn began with (only the first read time is known, so "nothing to read for N s" is the honest claim, not "nothing was known").

**Cut:** the underlined question words and coloured chips of today's frame (meaningless colours, English-only stop-word list); a guessed answer shape ("a name", "a number with a unit") because it needs per-language wh-word lists and would break the omnilingual rule.

## Stage 2 · SIG ○ (Relate x Existence): the swimlane on the tape's own clock

**What a person learns:** "It looked in two places, tried eight pages, two would not open, and here is where the time went."

Form: one lane per search and per page; the bar is as long as it really took, hatched where it waited on one source alone, ending in a glyph (filled dot read, open dot read but not handed on, cross could not open). The favicon starts every lane, as in SEG. Laps are separate panels on the same seconds-per-pixel scale, each headed by the query it ran. Tap a lane for title, address, how it was opened (`via`), characters, and the stored start of the text in the site's type.

| face | cell | shows | tape fields |
|---|---|---|---|
| Ground | Void · Tending | a wheel: the question as hub, the six places it could ask as spokes; solid if asked (with result counts, "10 + 10" across laps), dashed if not, red dashed if it gave no answer; the router's own reason per picked place | `web[]` route (`picked`, `skipped`, `why`, `webDown`), `st` found/failed, `web[]` engines (`n`, `why`) |
| Figure | Entity · Binding | the swimlane | `st` searching/waiting/found/failed/reading/read/unread with `at`; `web[]` reads (`via`, `skipped`, `ok`, `lap`); `ev end` notes ("no text came back") |
| Pattern | Kind · Tracing | a two-column gate: read first (with favicons) against read last (with the recorded reason `shares-only-the-name` / `no-shared-word`), then a lap-by-lap strip of the same pages (what failed again, in how many seconds) | `web[]` topic (`demoted` strings), `st` reads per lap |

**Findings the real data exposes (not written into the UI):** on the telephone and Australia turns the gate sets the answer pages last (`Alexander Graham Bell`, `Canberra`, both `no-shared-word`), and the Australia turn reads five Wikipedia articles including "Capital punishment in Australia". Britannica failed in lap 1 after 12 s and again in lap 2 in 24 ms. The lap-2 query `848.86 meters 29 031.7 feet` has lost the leading `8` of `8,848.86`. These are visible only because the words are shown verbatim.

**Tape lacks:** the result lists themselves. `found` records `n` only, so almost all of the 40 Everest results (and every Australia result beyond the pages read) have no title or address on the tape; only the opened pages and the demoted titles survive, and those without addresses (so they get an empty favicon). Per-skipped-place reasons (the router records `why` only for picked places). The reason a gate code means what it means (I print the code, not a rule). Needs `st.found.results[{url,title,site}]` (capped), `st.routed.skipped[{scope,why}]`.

**Cut:** the three colour dots per row; "kept 40%" as a headline (kept is shown as "kept 2,927 of 24,000 characters", unprocessed); the three engine rows as separate screens; the funnel (see above).

## Stage 3 · INS ● (Generate x Existence): the page and its clippings

**What a person learns:** "Of each page it read, it kept this, in the page's own words, and most of every page was left behind."

Form: a page-by-page contact sheet: each page's header in the margin (at 700 px and wider; above on a phone), its kept passages pulled out as paper in that site's own typeface and colours, the sentence the answer rests on set apart with the matched words in bold weight (no underline, no highlighter). Pages that gave the writer nothing are one quiet line each.

| face | cell | shows | tape fields |
|---|---|---|---|
| Ground | Void · Cultivating | the pages themselves as rulers: each bar is the whole page (to a common scale), filled to how much was kept; tap a page to open its stored text on paper with a torn edge and "18,989 more characters are not stored"; for the cited page, a loupe from the kept bar to the kept text with the cited span as a tick | `st read` (`chars`, `kept`, `text`), `facing.sources[].span`, `kept` |
| Figure | Entity · Making | the clippings, grouped by page, tagged "lap 2 · passage 3 of 4"; tap to expand to the full passage | `quick` entries (`n`, `of`, `p.text`, `p.url`, `at`), `passages` (full text), `facing.sources` |
| Pattern | Kind · Composing | a concordance: runs of four or more words and figures that stand in the passages of two or more pages, one dot per page. Everest: `is 8,848.86 metres` on two pages, `8,848.86` on four, `8,844.43` on three | `passages` (full text per lap) compared by string; marked derived |

**Tape lacks:** (1) where in the page the kept text sits: `kept N of M chars` has no offset, so the ruler shows sizes only, left-aligned, and says "where in the page is not recorded". (2) Positions of passages: only the cited span has `start/end`, and it indexes the kept text, not the page. (3) The page text itself beyond 1,400 characters (`slimSt` clips it), and passages beyond 900 characters on the tape (the record's `passages` has up to 2,400). (4) Why this passage out of the page (salience counts). (5) Which sentences of a passage were the ones scored. Needs `quick.p.off` (offset of the passage in the full page text), `read.keptFrom`, and the `salientSentences` hit counts.

**Cut:** the scrolling sentence scan, the keyed-word underlining and `<mark>` fill, and the "N passages worth keeping" number derived from `kept / 160` (a made-up count).

## What differs across the three forms

NUL is negative space (an absence with a counter); SIG is time (a Gantt on the tape's clock); INS is place and paper (page rulers and site-typed clippings, then a dot concordance). Their Ground faces differ too (a ruler of emptiness, a wheel of places, a stack of page rulers); so do their Patterns (small multiples of the blank, a sorting gate, a concordance).

## Checks done

Rendered at 375 and 1200 px, light and dark (auto via `prefers-color-scheme`, forced via `data-theme`), three real turns, every face: no horizontal overflow, no page errors, contrast audit clean. Keyboard: Left/Right/Escape travel between faces; lanes, passages and page rulers are buttons with `aria-expanded`; the page's scrollable stored text is a focusable region. Not checked: a screen reader pass, real touch swipe (pointer events only emulated), and Safari (the layout uses `@container` and `color-mix`, as the app already does).
