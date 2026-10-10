# Stages 4 SEG, 5 CON, 6 SYN: the structure domain, three faces each

Status: design prototypes (stage designer 2, 2026-10-07). Three self-contained mocks, nothing wired into the app. No model, no network: every word in a quoted position is a substring of a real recorded turn, embedded inline.

Open `seg.html`, `con.html`, `syn.html` in a browser. Four recorded turns sit behind the chips at the top: Great Wall (`eval/ants/falsify-checks/f3/real-b.json` #10, two laps, six pages), Telephone, Eiffel and President (`docs/playback/fixtures/turns.json`, first three turns). Deep links: `#t=<turn 0..3>&f=<face 0..2>&o=<source>.<line>` opens a face and the reader sheet (used by the screenshots).

Rebuild: `node docs/playback/structure/prep.mjs && node docs/playback/structure/build.mjs`. Check: `node audit.mjs` (contrast, underlines, horizontal scroll, button names, 375 and 1200, both themes via media query and via `data-theme`) and `node shots.mjs` (Playwright, own context; PNGs in `shots/`).

## 0. The cube, and why each stage has three faces

`khora/native/kernel/cube.js`: an operator is Mode x Domain; a third axis, grain (Ground, Figure, Pattern), turns each operator into three cells. The wheel note (`THE-WHEEL.md`) names the grains Void/hub, Beings/spokes, Fold/rim. For the structure domain:

| stage | Ground (hub) | Figure (spoke) | Pattern (rim) |
|---|---|---|---|
| SEG (Differentiate) | Field, **Clearing** | Link, **Dissecting** | Network, **Unraveling** |
| CON (Relate) | Field, **Tending** | Link, **Binding** | Network, **Tracing** |
| SYN (Generate) | Field, **Cultivating** | Link, **Making** | Network, **Composing** |

(Terrain comes from domain x grain, stance from mode x grain; `cellOf(op, grain)`.) The playback today draws one cell per stage, in effect Figure, and every Ground and Pattern face is unused. The reading I used, which is the user's own gloss: **Ground is the field the thing sits in, Figure is the thing, Pattern is the thing recurring across the other things.** Each face has to answer a different question with different data, or it is not a face:

* Ground answers "what was this cut / joined / built from?" (the material, including what was left out)
* Figure answers "what did the step do to this one?" (the act itself, on verbatim words)
* Pattern answers "does it recur?" (across pages, or across sentences)

### How a person moves between faces

A three-stop dial under the caption (labelled in plain words; the EO cell is the small line under each label), arrow keys on the dial, and a breadcrumb (`question > face > source > the box you tapped`). The reader sheet carries the same three as "See this as": from any passage you are reading, one tap shows that atom in another face. No menu, no mode. The face change is a 220 ms scale-and-fade, off under `prefers-reduced-motion`. It is navigation, not a recorded event, so it is the only motion apart from SEG's cut (below).

### The reader sheet (all three)

Tap any atom (a box, a copied run, a bar, a square, a ribbon label) and the source opens: a bottom sheet at 375, a docked right column at 1000 and up. It shows the page's own type (site face, paper colour), the line before, the line, the line after, previous and next through the page's kept lines, a tick strip (taller tick = a line this step used), the line's position ("line 2 of 7 kept, kept 795 of 4,922 characters of this page"), and an "open page" link that carries a text fragment. When the tape holds only 900 characters of a page the sheet says so. Esc closes it and focus goes back to the atom.

## 1. SEG ｜ the sentence, cut (`seg.html`)

**What a person learns:** "Here is the sentence it picked from each page, and where in the sentence the action sits."

**Visual form: a ruler over the verbatim line.** The user's favourite look (ruled grid, rounded SUBJ / VERB / OBJ boxes, favicon first in each row) with one change that matters: the boxes are drawn **on the sentence itself, in the page's type, in the page's word order**. Small words between boxes stay in the line instead of being struck through in a "dropped:" list, and a box holds a contiguous run of original words, so nothing is rewritten ("Great Wall of China", not the "Great Wall China" the current boxes show). The boxes draw in once, subject, verb, object, 150 ms apart (`deep` k=3 sub 0 to sub 2); no staggered loading. A missing subject is an empty dashed SUBJ box; a guess (question, no verb found) is a dashed VERB box with "?".

| face | shows | tape and record fields |
|---|---|---|
| Ground, "The page" (Field, Clearing) | one column per page: a bar per kept line (length = the line's length), the cut line(s) solid, joined lines bracketed, a hatched meter for kept vs cleared characters, the cut sentence's first words under the column | `web[read].chars`, `.kept`; passage text split on `\n`; the cut sentence located by text |
| Figure, "The cut" (Link, Dissecting) | the sentence, boxed; which of your words it contains; flags: joined N lines, question, verb guessed, no subject | `deep` k=3 `ps` -> the app's `deriveGraph` (run as shipped); ask words |
| Pattern, "Across pages" (Network, Unraveling) | every cut aligned on its verb (a concordance): left context flush right, verb in the middle, right context flush left, grouped by verb | the same cuts |

Ground is the page strip because the bad cuts are explained there: the checkthisfact "sentence" is three lines (a heading, a quoted myth, a caption) glued together, which the strip shows as a bracket over three bars. Pattern is lined up on the verb because that is where the pages differ, in the first words after it: aligned on "is", the Great Wall pages read "visible", "not visible", "cannot be seen" one under another.

**Data the tape lacks (specific):**
1. The cut. `deep` k=3 carries only `ps` (the clipped passages); `deriveGraph` is recomputed at paint, so a replay drifts when the heuristics do. Needs `rows[{url, sentence, line, toks[{t, role}], verbGuess, ...}]` (PLAYBACK-STEPS section 5).
2. Where on the page a kept line sat. Only `chars` and `kept` totals exist, so the Ground face can show the kept lines and the cleared amount but not the cleared parts' positions. Needs each kept line's `start` offset in the page text.
3. Full passage text for pages that reached the tape only through a later lap: `slimP` clips to 900 characters (en.wikipedia.org in the Great Wall turn is one line).
4. A reason a page was `skipped:true` in `web` (chinahighlights.com and greatwalltravelguide.com carry it but are read and kept).

**What I cut:** the "dropped:" strike-through list (replaced by the words staying in the line); the 3-source limit and one-row-at-a-time pager from PLAYBACK-STEPS (a vertical list of all rows costs nothing at 375 and shows the Pattern's evidence); the word-by-word layout engine (`tokenStage`) and the three sub-step dwells; the 4-word and 5-word box caps are shown, not hidden (a plain "rest" tail after the OBJ box and "+N more words"), and I recommend removing them.

## 2. CON ⋈ the bind (`con.html`)

**What a person learns:** "These pages name the same thing, and here is what each one says about it, side by side."

**Visual form: a bow-tie.** Pages run into one node (the shared thing, in the words the pages use) and out the other side into what each page says, verbatim. Wide: curves converge on the hub and fan out. Narrow: the same diagram turned into a trunk down the left edge with a branch per page. In the right-hand cards, only words that two or more pages share in the same order are bold, so the places where the pages differ ("is visible" against "is not visible") are the places that stay light. One emphasis, weight, no fill, no underline. Pages that never use the words are not hidden: a dashed "Not joined" card shows their sentence.

| face | shows | tape and record fields |
|---|---|---|
| Ground, "What was on offer" (Field, Tending) | every kept sentence as a square: filled = names the selected thing, outlined = names another shared thing, dashed = stands alone ("26 of 59 sentences name Great Wall; 20 name nothing shared") | all kept passages, split into sentences |
| Figure, "The bind" (Link, Binding) | the bow-tie for the selected thing, with nested things as chips ("Great Wall" 5 pages contains "Great Wall of China" 3 pages) | same |
| Pattern, "The network" (Network, Tracing) | the pages as nodes on a ring, a line between two pages when they share a thing; the selected thing's lines are teal; tap a line to read the words behind it, tap a word to jump to its bind | same |

The three are different questions: how much of the material could be joined at all, what one join says, and which pages are one cluster.

**What I changed from the current rule.** The code merges two nodes when they share any word of five or more letters, so "history of France" and "history of Paris" merge. Here a join is a **capitalised name that appears word for word in sentences of two or more pages** (`prep.mjs`), so a shared common word is no join. It is still English-only (capitals decide), and I say so in the page footer; the omnilingual route is the referents the khora reader already produces (the Pattern face is where they would plug in).

**What the real data showed.** In the President turn the pages share "Donald Trump" (3 pages) and "January 20 2025" (3 pages) while "Joe Biden", the name in the answer, is on 2 of 5 pages (one kept line each; found by searching the kept text). I am not claiming the answer is wrong from this (the pages are Wikipedia list pages and I did not read them whole), only that the bind view puts that disagreement on screen where the current table cannot.

**Data the tape lacks:**
1. `deep` k=4 carries only `ps`; nodes and edges are recomputed. Needs `nodes[{id, label, rows, via}]` and `edges[{from, to, verb, row}]` with `via` = the shared words (so a bind records why it was made).
2. Referents. `docs/GROUNDING-BY-MEANING.md` records that the live read door returns none at sentence grain, so "the same thing" can only be "the same words" today.
3. Polarity. Disagreement is shown by adjacent words, not detected; whether two predicates contradict is a verdict (step 8's `fz`), not available at step 5.

**What I cut:** the two-column node graph with floating verb labels (unreadable at 375); "merged" on a one-word overlap; numbering and counts ("3 bonds") that are not facts a person can use; the verb as an edge label (the verb stays inside each page's own words).

## 3. SYN △ the sentence, stitched (`syn.html`)

**What a person learns:** "This answer sentence is made of these pieces of these pages, joined here, and these words are the model's own."

**Visual form: the sentence typeset from its sources.** Each answer sentence is set as a patchwork: a run copied word for word is upright, in its source's own typeface, led by the source's small icon; the model's own words are italic with no icon. A segmented bar above the sentence is the same thing as a measure (solid = copied, hatched = own). Next to it, one card per run shows the **source line** with the run in bold, so the seams show: "According to NASA," comes from line 7 of checkthisfact.com, "is not as visible from orbit as modern desert roads" from line 5 of the same page, which opens "| Scientific American". Underneath, one plain sentence says what the record itself cited (or that it found nothing), so the two readings can be compared.

| face | shows | tape and record fields |
|---|---|---|
| Ground, "The pool" (Field, Cultivating) | every kept line of every page as a square; filled with the sentence number if the answer copies from it; ringed if the record cites it; pages the answer did not touch say so | passages, `coverage.entries` (span, ref) |
| Figure, "The sentence" (Link, Making) | the patchwork, the stitch cards, the record's citation | final answer, passages, `coverage` |
| Pattern, "The flow" (Network, Composing) | a flow from pages to sentences (ribbon width = words copied), a hatched slice of each sentence for its own words, a dashed line where the record's citation points and no ribbon ends | same |

**What the real data showed (all from the recorded turns):**
* Great Wall, s1: the whole sentence "The Great Wall of China is not visible from space." is on halleyspace.com line 1 word for word (10 of 10), but the record cites checkthisfact.com `#45-71`, six words, "The Great Wall of China is". On that page the line reads "The Great Wall of China is visible from space." (it is quoting the myth). The record's citation points at a line that says the opposite, and the model's "not" is outside the cited span. The Figure face shows both cards and the plain sentence "the longest copied run is on another page".
* Great Wall, s2: stitched from two lines of one page, joined by the model's "the wall" (see above).
* Telephone: the record says the sentence is ungrounded (`why: terms`, "award, peopl"), yet 13 of 24 words are copied word for word from sciencefocus.com and britannica.com. Coverage tests one span in one source; the answer is a stitch of several. The Figure face states both facts.
* The Britannica "passage" in that turn is two FAQ questions from the page chrome ("Who is credited as the inventor of the telephone?"); the SEG face flags it as a question and draws its subject as an empty box.

**Data the tape lacks:**
1. Per-sentence `draft` entries. The kinds on these tapes are only `start ev st quick deep writing done`, with `writing` carrying `srcs` only. So SYN cannot replay composition in time; the mock does not simulate it (no animation). With `draft` entries each sentence would arrive as a recorded step, and the patchwork would grow one sentence at a time.
2. Which passage a cite's span belongs to. `coverage.entries[].span` is an offset into one of the passages, but nothing names it. In the Great Wall turn checkthisfact.com has two passage texts (800 and 661 characters, from lap 0 and lap 1) and `#405-456` is valid only in the second. `address` is `ref#start-end`, with no passage hash. Needs `pid` or the passage hash on the cite and on `facing.sources`.
3. The copied runs themselves. They are computed here by a plain string match (two or more words in order, not made only of small words) on the kept lines; the app does not record them. The `lean` list proposed in PLAYBACK-STEPS (`draft.lean[{url, sentence, overlap}]`) would be this.
4. Who wrote the answer (`by: model|mechanical`, model name): a slot-ask answer would have no italic words and no "model's own".

**What I cut:** the numbered "path the answer takes" (it names a plan that does not exist); the bonds as pills; the dark panel; typing the sentence in a second time (the figure here is the sentence, once); the claim of time in "writing".

## 4. How the three differ from each other and from the other six

SEG is a **partition of a line**: the one place the verbatim sentence is the canvas and the picture is boxes cut out of it. CON is a **convergence**: the only stage whose picture has one node fed by many pages and fanning out again, with the pages' words at the edges. SYN is a **typeset composite**: the picture is the answer sentence itself, with its provenance as typeface and icon, so unlike the other eight stages (rows, tables, matrices, funnels, cards) it carries no chart chrome at all in its Figure face.

Faces: SEG Ground is a page (bars), Pattern is a concordance (columns aligned on the verb). CON Ground is a field of squares, Pattern a ring network. SYN Ground is a field of squares keyed to sentences, Pattern a flow. The two "field of squares" Grounds look alike by design (a Ground is the material); they differ in the one question each answers (can it be joined at all / what did the answer use).

## 5. Checks run

`node audit.mjs`: text contrast >= 4.5:1 (computed from the rendered colours including opacity), no `text-decoration` underline anywhere, every button named, no horizontal page scroll, at 375 and 1200 wide, in light and dark by `prefers-color-scheme` and by `data-theme`, on every face of two turns and with the reader sheet open. Keyboard: arrow keys move the dial, Enter on an atom opens the sheet, Esc closes it and returns focus to the same atom.

Not checked: real touch devices; screen-reader output beyond accessible names; the SEG cut for non-English text (the app's `deriveGraph` uses English closed lists; the mock inherits that and says "the cut is a guess" only for questions and verb-less sentences, not for other languages).
