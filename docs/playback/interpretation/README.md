# Stages 7, 8, 9 (DEF, EVA, REC): the Interpretation face of the cube

Status: design prototypes (stage designer 3, 2026-10-07). No app code was edited. Three self-contained mocks, built from real recorded turns, no model and no network.

Open `def.html`, `eva.html`, `rec.html` (375 px and 1200 px, light and dark by `prefers-color-scheme` or the Theme button / `?theme=dark`). The turn picker at the top is mock chrome; it switches between six real turns. Views are linkable: `eva.html#face=figure&turn=real-b%3A3`. Screenshots are in `shots/` (56 files: stage x face x 375/1200 x light/dark, plus an opened reader and a second turn per stage).

Rebuild: `node extract.mjs && node build.mjs && node shoot.mjs && node audit.mjs`. `audit.mjs` checks every text run on every view for contrast (all >= 4.5:1) and size (all >= 12 px), and walks the tabs by keyboard. Last run: 8,628 text runs, 0 failures. `shoot.mjs` reports no page errors and no horizontal overflow.

## The data

* 21 real turns with answer sentences (23 records carry a tape): `eval/ants/falsify-checks/f3/real-a.json`, `real-b.json` (20) and `fixtures/turns.json` (1 at the time of reading; `make.log` showed it still writing). I ran the app's own pure `crossCheckOf` / `falsifyAnswer` over what each record saved.
* Six turns are in the picker (they cover the shapes): Mount Everest (a figure; 5 pages; went back once, still failing), Eiffel Tower (a year; went back once, recorded as cleared), Tokyo (a magnitude; 2 laps; the wrong-version test is loose), Penicillin (2 claims; going back flipped s1 from standing to differing), Pride and Prejudice (1 page; cleared by going back), Telephone (answered with no page attached; stands by cross-reference).
* The "across turns" faces use all 25 claims. Caveat stated on screen: the 21 turns were collected one fresh browser context per ask (`real-collect.mjs`), so they are not a conversation. They stand in for what a thread would show.

## What I found in the data (measured unless marked as my reading)

1. **Not one of the 23 recorded tapes has a `check` or a `loop` entry.** Tape kinds present: start, ev, st, quick, deep/3, deep/4, deep/5, writing, done. The DEF/EVA/REC playback frames and the loop arc read entries that real turns do not carry. All three mocks therefore draw from `rec.facing`, `rec.loop`, the `quick` entries and a re-run of `crossCheckOf`. `rec.loop` does hold laps (8 of the 21 turns).
2. **Going back mostly did not help.** Of the 8 turns that went back: cleared 3 (Pride and Prejudice, black hole, Eiffel), changed nothing in 2 (Everest, Tokyo), left fewer claims standing in 3 (machine learning, penicillin, Great Wall). Reading more pages gives more chances to read a sentence "differently". Counts come from `loop.passes[0].before` and `loop.after`.
3. **"Contradicts" is not a refutation in any case I read.** I read six of the flagged sentences in full (my reading, not a measurement): Everest/NatGeo (8,850 m against 8,848.86 m, 1.14 m); Everest/Britannica (flagged "gives 29,028 where the claim says 8,848.86": that is feet against metres, and the page also says 8,848 meters); Eiffel/history.com ("almost torn down and scrapped in 1909", a different event); Tokyo/populationstat ("8.3 million ... within the city's traditional boundaries", a different scope); machine learning ("isn't magic", a negation of something else); penicillin/Wikipedia ("a bacteriologist, not a chemist"). Penicillin s2 contains "not", and 5 of 5 pages are flagged "opposite polarity": that is the signature of the test, not of five refutations.
4. **Two records disagree with themselves.** Eiffel: `loop.after` says corroborated (cleared), but re-running the cross-reference over the passages the record saved says contested (history.com). Machine learning: the loop counted 3 claims, the record has 2 answer sentences. Standing must come from one recorded result.
5. **The swap's power is per source, not one boolean.** `swap.discriminates` is judged on the lead page only. Re-run per page: Tokyo "14.27 to 22,000" still matched on tokyobureau.com; penicillin "Alexander Fleming to Mary's Hospital" still matched on worldhistory.org. A null that a page cannot tell from the claim means a "states" from that page proves little (FOLD-CONSTITUTION II.4, licence).
6. Test coverage over 25 claims: a second independent page existed for 10 and did not apply for 14; the wrong-version test ran on 15 and did not apply for 10; a figure test applied to 8 of 25.

## Arguing with `docs/PLAYBACK-STEPS.md`

* **Merge DEF into EVA: half agree.** As a standalone screen with the sentence restated, DEF has nothing to say, and I agree it should not be a title card. But DEF does a different job from EVA, and the real data shows where: the "contested" claims are mostly two senses of a word (height: snow or rock, metres or feet; Tokyo: city proper or metropolis). DEF is the stage that lays the pages' own words side by side before anyone judges. So DEF stays, with a hard rule that it marks nothing right or wrong, and it is hidden (folded into the EVA claim header) when no page shares a run of words with the claim. Differentiate shows differences; Relate measures; Generate composes. Three modes, three forms.
* **A tappable verdict matrix for REC: no.** Most real turns are 1 claim x 1 to 5 pages, which makes the matrix a 1-row table. A matrix works across the thread (EVA Pattern is a claims x tests grid, which is the form the note's matrix wanted to be). REC's own forms are a lap timeline, a path across laps, and before/after small multiples.
* **"Broke / held / didn't apply": agree, with a rename.** The middle outcome is "came out differently", because the mechanical test cannot know it broke. Not-applicable is a dashed ring that is never counted, never red, collected into one quiet line ("Did not apply here: ...").
* **"Hide steps with nothing to say": agree**, applied per face. REC's laps card says "Nothing to go back for" when none ran; EVA's null column says "n/a" when nothing could be swapped.
* **"Never draw an arc from glyph to glyph"**: agree; the arc is replaced by a path across laps (a line over four standings).

## The cube, for these three stages

Canon: `khora/native/kernel/cube.js`. Interpretation is the third domain; its three grains are Atmosphere (Ground), Lens (Figure), Paradigm (Pattern). Each stage's mode gives the stance on each grain. `vendor/khora/native/the-fold/resolutions.js` defines them for a conversation: Atmosphere is where the conversation stands and where it last re-zeroed (REC); Lens is what is said about the figures in play, with their standing and disputes; Paradigm is what recurs (floor of 2).

| | Ground (Atmosphere) | Figure (Lens) | Pattern (Paradigm) |
|---|---|---|---|
| 7 DEF, Differentiate | Clearing: what the question already supplied | Dissecting: the claim's words in each page's mouth | Unraveling: whose voice, by site |
| 8 EVA, Relate | Tending: what the test had to stand on | Binding: the claim and a wrong version, against each page | Tracing: which tests ran, across turns |
| 9 REC, Generate | Cultivating: the rebuilt ground, lap by lap | Making: the standing and the attempts it survived | Composing: before and after going back, across turns |

Each page has: a breadcrumb (Answer > Checks > stage > face), three tabs that carry both names ("Setting" and "Atmosphere . Clearing"; arrow keys move between them), and a "Jump" disclosure holding the whole 3 x 3 of the face with real words in each cell, linking to the sibling pages (it also says the other two cube faces, Existence and Structure, have the same three grains). Default face is Figure. Selecting a row opens the reader: a right-hand column at >= 900 px, a bottom sheet (Close button, Escape) below that.

## Per stage

### 7 DEF "What is claimed" (`def.html`)

One thing a person learns: **which words the answer adds beyond the question, and how each page words the same thing.**

* **Setting (Ground).** The question set quiet inside the answer's sentence; the new words (what could be wrong) in bold. Words are split by exact match against the question, no stemming, no case logic. Beside it, facts. Tape fields: `rec.facing.response[].text`, the ask, `rec.language`, `rec.kind`, `rec.answerMode`, `tape st.found {scope,n}`, `st.demoted n`, count of distinct `quick` domains, `rec.facing.sources.length`.
* **This claim (Figure).** A concordance: one line per page, aligned on the longest run of words it shares with the claim (`witnesses[].run`, located in `witnesses[].sentence`), the page's own words either side. No marks, no colours. At 375 px the same lines stack as short quotes with the shared words in bold (no pan). Reader: the full sentence, the shared run, the page title, open link.
* **Whose words (Pattern).** Across the turns, each site as a bar of three counts: said it in the claim's words, words differ or close, no shared words. Tap: the claims that site was read for. Fields: `witnesses[].src/verdict` over all claims.
* **Tape lacks:** what the conversation was carried from (the `start` entry has no field; drawn as a dashed gap row); the cross-reference result (`witnesses[]`) is not on the tape at all, recomputed from clipped passages; no per-page title on `quick` beyond `ref`.
* **Cut or changed:** no "COMMITS TO" chips from capital-initial name detection (case logic); the stake is the answer's words minus the question's. No definition lookup row (not measured here how often pages carry one; `PLAYBACK-STEPS.md` section 4 reads the falsifier's DEF row as `gap` for most answers); a definition is a received thing with a giver (FOLD-CONSTITUTION II.1: the model may not be a giver), so a DEF row belongs only when a page states one.

### 8 EVA "What it was compared with" (`eva.html`)

One thing a person learns: **how far each page is from the claim, and whether the test could tell the claim from a wrong version of itself.**

* **The ground (Ground).** Three preconditions per sentence, each with a shape and a sentence: independent pages (chains), something to compare (figure or name), a rival to swap in. A missing precondition reads "did not apply", with "that is not a pass and not a failure". Fields: `crossCheckOf(rec).claims[].chains/figures/names/swap`, `witnesses[].verdict`.
* **This claim (Figure).** The paired dot plot: one row per page; on a numeric claim a scale (metres, years or millions, feet converted to metres) with a rule at the claim and each page's nearest figure, on a non-numeric claim four reading columns; beside it the same page read against a wrong version (told apart / still matches). Beneath: templated sentences with the gap size ("1.14 m away (0.01%)"). Reader: the page's sentence with the nearest figure in bold, the app's own `why` in quotes, the result on the wrong version. Fields: `witnesses[].verdict/why/sentence`, `swap`, plus two derived values (nearest figure; per-page null result, from re-running `falsifyAnswer` on the swapped sentence).
* **Which tests ran (Pattern).** A claims x tests grid (exact words, figure, pages differ, second page, wrong version), a column tally, a one-line definition per test. Never a flag for "did not apply".
* **Tape lacks:** the per-page result of the null (only `swap.discriminates`, judged on the lead page); the per-witness figure; the witnesses themselves (see finding 1). Each of these is one field on the `check` entry.
* **Cut or changed:** "contradicts" is drawn as "reads differently" with the page's own sentence one tap away, never red or a cross; the underlined shared run is gone (weight only); the four ticks are the grid's columns.

### 9 REC "Where it stands" (`rec.html`)

One thing a person learns: **which claims stand, which were tried and how, which could not be tried, and what going back changed, which often is nothing.**

* **Going back (Ground).** A timeline of cards: first reading, each lap, now. A lap card holds the failing sentence, the record's own reason in quotes, the search query verbatim (or "re-reading the pages already read was enough"), the pages re-read (kept of characters), sources added, the rewrite attempt ("did not hold either", kept as written and marked), the standing after. Fields: `rec.loop.passes[].before/failing/added/restated/reImpressed`, `loop.after/cleared/processLine`. A flagged "the record disagrees with itself" note where it does.
* **This claim (Figure).** The sentence with a trailing shape (the proposed mark for the answer, replacing underlines), the standing in words, the attempts as receipts (held / came out differently, with the verbatim fact), one line per lap, a dashed box for what did not apply, and a path across the laps (first, after each lap, now) with this sentence solid and the others dashed. A step control (First reading / After lap n) re-draws the standing, a recorded state change.
* **Did going back help (Pattern).** The turns that went back, each claim a shape, first reading to after, with "cleared / no change / fewer stand". The caption counts them.
* **Tape lacks:** per-claim verdicts at each lap (only the counts and the failing list; the others are inferred as standing); the per-sentence witnesses after a lap (the mock draws a gap where the record disagrees); `loop` entries (none exist on any tape).
* **Cut or merged:** the verdict matrix is not a main view; the amber arc is replaced by the path; the "REC" glyph row is gone. Motion: only the step control and the reader sheet slide; reduced-motion removes both.

## What is deliberately unlike the earlier six stages

Stages 1 to 6 are lists, cards, funnels, a table and a graph of the read material. These three are comparisons: a concordance (words side by side), a paired dot plot on a scale (observation against null), a timeline with a path (states over time), and across-turn grids. Emphasis is weight, not underline or fill; shapes plus words carry every verdict (filled disc stands, half disc close, diamond differs, ring nothing says it, dashed ring did not apply, ringed tick told apart); colour only echoes them.

## Honest limits

* The nearest-figure tick is my mechanical choice (nearest same-axis figure in the witness sentence), not a recorded field; it fixed a feet-against-metres false alarm in the data and could pick wrong on a page with several figures.
* "Per-page null result" is computed offline here, not recorded; it is a proposal for the tape.
* No narrow-width animation was built or tested, deliberately: every state here is a still view that follows a recorded change.
* Not run on real touch devices; the 3 x 3 jump grid and rows are >= 36 px high, the shape marks 11 to 17 px are not the tap targets (rows are).
