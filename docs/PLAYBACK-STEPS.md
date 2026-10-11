# The reading playback, step by step: how to make each of the nine steps legible and meaningful

Status: design note (agent C, 2026-10-06). Nothing here is built. I read code and docs only; I did not run the app, so every statement about what is on screen is from reading `fold-chat-presentview.js`, `fold-chat-present.js` and the `.pv-*` CSS in `index.html`, not from a screenshot. Nothing below is a measured result.

The user's words this answers, verbatim: "improve each of the steps of the reading playback to be more intuitive and actually meaningful"; "the animation is not legible when narrow"; "this is hard to read"; "lots of chrome"; "i dont like the underlining of everything and highlighting of everything"; "lets be able to expand from these atoms to the source content and navigate through the content"; "the modal ... should be more graphical, like some of the images in the animation" (the SEG stage: grid, SUBJ/VERB/OBJ boxes, a favicon at the start of each row).

---

## 0. The summary table

| # | step (glyph) | what a person should get in 3 s | today (what is drawn) | proposed |
|---|---|---|---|---|
| 1 | NUL ∅ | "It understood my question, and knows what to look for." | the question in 24px type, up to 3 words underlined in three colours, three outlined chips (`FRAMES[0]`) | **Merge into step 2.** Question plain (no underlines), one line "looking for: a, b", one line for the kind of ask and the language, and a "carried from earlier" note when the question had no topic words |
| 2 | SIG ○ | "It looked in 3 places, found 14 things, opened 4, set 6 aside." | engine rows + up to 6 page rows with three colour dots and "kept 40%" (`FRAMES[1]`) | a **funnel**: found → opened → set aside → could not open, each row a favicon + the result's own title; set-aside rows are tappable and say why |
| 3 | INS ● | "Out of each page it kept this one passage, here, in the page's own words." | paper sheets in the site's type with keyed words underlined; while reading, a scroll of 9 sentences with hit lines highlighted (`FRAMES[2]`) | one card per page: the **kept passage verbatim** in the page's type, a **page minimap** showing where on the page it came from, tap = reader sheet with prev/next paragraph |
| 4 | SEG ｜ | "Here is the sentence, here is who does what to what." | favicon + SUBJ/VERB/OBJ boxes, a struck-through "dropped:" list (`FRAMES[3]`) | **keep the look.** Add the whole sentence above the boxes, words slide into boxes, "?" on low-confidence cuts, tap a box = that sentence in its page |
| 5 | CON ⋈ | "These two pages are talking about the same thing; here is what each says about it." | two-column node graph, floating verb labels (`graphFrame`) | a **who-says-what table** (one row per shared thing, favicon columns, verbatim verb + object in each cell); **hidden unless two pages actually share a thing** |
| 6 | SYN △ | "The answer is being written now; each sentence leans on these kept sentences." | four numbered "steps" (top bonds), plus the sentence typed again below the streaming answer (`synFrame`) | drop the numbered path. Show, per drafted sentence, the 1 to 2 kept sentences it resembles (verbatim, favicon), and say plainly when it resembles none |
| 7 | DEF ⊢ | "Each sentence says something that could be wrong; here is the part that could be." | a ledger: the sentence again, plus "COMMITS TO" chips (`FRAMES[6]`) | **Merge into step 8**: the claim card's header. Show the stake (figure or name) pulled out of the sentence; say "nothing here a source could contradict" when there is none |
| 8 | EVA ⊨ | "The source says exactly this" or "the source does not." | claim card + source card + ticks + swap card, one sentence per 2.6 s (`FRAMES[7]`) | claim over source, **one plain-language verdict**, ticks behind "how checked", swap as its own small card, dots s1..sN to jump, tap the source card = reader |
| 9 | REC ∗ | "These stand. This one is weak. This one has no source. (And this is what I did about it.)" | sorted matrix, favicon columns, ✓✗~· cells readable only by tooltip (`FRAMES[8]`); arc animation for a loop (`loopFx`) | the same matrix with plain verdict words and tappable cells; if it went back, a per-sentence "went back" strip showing what came back, and the matrix changes in place |

Nine steps become seven screens: **Asked and looked (1+2) · Read (3) · Cut (4) · Joined (5, only if it fired) · Written (6) · Checked (7+8, one per sentence) · Verdict (9)**.

---

## 1. The principles that every step below follows

These come from the project's own rules (find/snip/cite never rewrite; the model is never alone; honest gaps are drawn, not hidden; the holograph's "every part points at the whole, the consumer never gets addresses", `khora/native/docs/THE-HOLOGRAPH.md` section 1) and from the user's complaints.

1. **One idea per screen, said in plain words above the drawing.** The plain title for each level already exists (`PH_TITLE`), but `.pv-live .pv-ph-k { display: none }` hides it in the live view, so in the live panel the only words are the status line and the glyph strip. The caption (section 2) is always visible, one line, built from counts on the tape.
2. **Motion shows a recorded state change or does not happen.** Today, levels 4, 5 and 6 are a script: `mountLive.passages()` pushes five `deep` entries at fixed dwells (1.8, 2.0, 2.2, 2.8, 2.2 s) after the passages, and the check entries at 1.8 s, 2.6 s per sentence, 2.6 s. Those seconds are not time the system spent; the graph is derived instantly by `deriveGraph`. Say so by drawing these screens as results the person can step through, not as work in progress.
3. **Every word in a quoted position is verbatim from a source or the answer.** App-authored words are limited to templated captions with counts and the fixed verdict sentences. The swap probe (step 8) is the one place an edited sentence appears; it is drawn struck-and-bold, labelled "a wrong version we tried", never in quote style.
4. **At most one emphasis per card, and it is weight, not underline or fill.** The user does not want everything underlined or highlighted. Today `keyed()` underlines question words in step 1, 3 and in every sub-header; `.pv-run` underlines in step 8; `.scan .ln.hit` fills. Rule: step 1, 2, 5, 6, 7, 9 have no emphasis in running text. Step 3 has none (the kept passage is the emphasis). Step 4 has the boxes. Step 8 emphasises only the shared phrase, in bold, in both cards.
5. **Every atom is tappable and expands to its source.** An atom is any small thing the playback draws that came from a page: a result row, a kept passage, a SUBJ/VERB/OBJ box, a source card in step 8, a matrix cell. One component (`atomEl`) and one expansion (the reader sheet, section 3) serve all of them. There are no tooltips (`title=`): touch has none, and the REC matrix and the glyph strip currently depend on them.
6. **A dropped thing is a visible thing you can open.** Results set aside in step 2, pages that gave nothing in step 3, small words set aside in step 4, sentences with no source in steps 8 and 9 are drawn (dashed, quiet, counted) and tapping one says why. Never a silent omission (today: only 3 of up to 7 sources reach step 4; only the last 3 of up to 7 kept passages are drawn in step 3; sentence 6 of an answer is never drawn in step 7).
7. **Show a test only if it ran.** Several of the nine falsifiers (`falsifiersOf`) are `gap` or `open` for most answers (see section 4, "Failure that is not failure"). In the playback, a step that did not apply is collapsed into one quiet line or not shown.
8. **Chrome budget at 375 px: caption, stage, progress. Nothing else.** The live panel today stacks a status line with a hide button, nine glyph chips, the stage, and a foot with a "doing" line and two ledger lines that restate the status line. The answer is streaming above all of it.

---

## 2. Shared pieces (build once, used by every step)

### 2.1 The caption (always visible, one line)

Replaces `P.say` as the person-facing line; `P.say` stays as the one-line status. Templated from tape fields (no model words):

| step | caption (counts come from the tape) |
|---|---|
| 1+2 | "Asked in 3 places · 14 results · opened 4" |
| 3 | "Kept 5 passages from 4 pages" |
| 4 | "Cut 3 sentences into who · does · what" |
| 5 | "2 things named by more than one page" (screen hidden when 0) |
| 6 | "Writing · sentence 2 of 4" |
| 7+8 | "Checking sentence 2 of 4 against the pages" |
| 9 | "3 stand · 1 on one page only · 1 has no source" |

### 2.2 The progress row

Replace the nine glyph chips (`.pv-levels`, built in `buildPanels`) with four labelled acts: **Ask · Read · Understand · Check**. The nine ticks stay as thin marks under them (they are the scrubber's keyframes). The glyphs remain as a quiet key inside the full-screen sheet only. Reason: `∅ ○ ● ｜ ⋈ △ ⊢ ⊨ ∗` carry no meaning to a person, and at 375 px nine chips are about 34 px wide each.

Mapping: Ask = 1+2, Read = 3, Understand = 4+5+6, Check = 7+8+9.

### 2.3 The atom

```
atom = { src:{ id, domain, site, title, url },        // favicon from fav(domain, site)
         text,                                       // verbatim
         sel:{ exact, prefix, suffix, start, end },  // address into the page text (section 5)
         kind: "result"|"passage"|"sentence"|"box"|"claim"|"cell" }
```

`atomEl(atom)` draws: favicon, domain, the verbatim text clamped to 2 lines (3 in the sheet), in the site's own type (`typeOf(domain)`, which `clipping()` already uses). It is a button; tapping it opens the reader sheet. The SEG row layout the user loves (favicon first, then boxes) is the template for atoms in rows.

### 2.4 The reader sheet (the expansion)

The user: "expand from these atoms to the source content and navigate through the content." One sheet, reusing the existing bottom-sheet CSS (`.pv-pop.sheet`, already used for the answer-sentence evidence popover in `showPop`).

```
 ┌─────────────────────────────────────┐
 │ ▪ en.wikipedia.org   Eiffel Tower ↗ │  favicon, domain, page title verbatim, open (with text fragment)
 │ paragraph 4 of 38 (kept)            │
 │ …the paragraph before, muted…       │
 │ ┃ THE KEPT PASSAGE, verbatim        │  one bold phrase = the span that was cited
 │ …the paragraph after, muted…        │
 │ [◂ previous]  ▪▪▫▪▫▫▫▫▪  [next ▸]   │  prev/next paragraph; minimap dots; dot filled = kept
 └─────────────────────────────────────┘
```

* Desktop (container wider than 820 px): a right-hand drawer next to the stage, hover on an atom previews (Wikipedia Reference Previews pattern), click pins. At 375 px and in the full-screen sheet: bottom sheet, tap to open, swipe or buttons for prev/next.
* The sheet navigates the page's paragraphs, not just the passage: prev/next move through `paras`; the kept ones carry a mark in the minimap strip.
* "open ↗" links to the page with a text-fragment (`#:~:text=prefix-,start,end,-suffix`) so the real page opens at the quote. Today `credit()` links the bare URL.
* If the page text is no longer stored (an old conversation), the sheet shows the stored passage and its neighbours if recorded, and says "the rest of this page is not stored in this conversation" with the open link. A gap is drawn, not hidden.
* Holograph rule: the playback never writes an address; the record holds them and the sheet asks the record (the `/reopen` door) for the expansion.

---

## 3. Per-step design

For each step: (1) the three-second thing; (2) what it draws now; (3) what is confusing or meaningless; (4) the redesign; (5) what the tape must record that it does not.

Reading note: the tape entry kinds today are `start`, `ev`, `st`, `book`, `quick`, `deep`, `writing`, `draft`, `check` (k = 6, 7, 8), `loop`, `done` (see `mountLive` and `applyEntry`).

---

### Step 1. NUL ∅ "your question, held"

**(1) Three seconds.** "It understood my question, and here is what it is going to look for." (Merged into step 2's screen; one idea: *what was asked*.)

**(2) Today.** `applyEntry` case `start` draws `pv-qtiles` into the hidden `P.L`; the visible frame is `FRAMES[0]`: the question in `bigq` (24px/600) with up to three words underlined in three colours (`keyed`, `.pv-k-w { box-shadow: inset 0 -3px 0 var(--kc) }`) and three outlined chips of the same words. The words come from `askWords()` = 4+ letters not in `FUNC`, `FUNC` built from English closed lists.

**(3) Confusing or meaningless.**
* The colours mean nothing until step 2's three dots, which have no legend. The underline is exactly the "underlining of everything" the user dislikes.
* The word choice is English-only: for a non-English question, function words are not in `FUNC`, so they appear as "look for" chips. This also breaks the project's omnilingual rule.
* The level is a title screen. It lasts as long as the first search takes and changes nothing the person can use.
* The older replay (`mountReplay`) said what kind of question it was ("a question of fact · it needs a source", "a question about a book · it needs the text itself", "part fact, part invention"). The new frame dropped that, which was the only meaningful state on this level.

**(4) Redesign.** Merge with step 2 as the screen's top block, then it stays as a one-line header while results arrive beneath it.
* Drawn: the question verbatim, plain weight 600, no underline. Under it, two quiet lines: "Looking for: *tower*, *height*" (the words from the tape, plain, not coloured) and "A question of fact, so it needs a source · English".
* If the question had no topic words (a follow-up), the line is "No topic words in this question, so I'm using *Eiffel Tower* from earlier" with the carried referent verbatim from the conversation. This is a real, recorded state change (what `ask.size ? … : "a short question — it carries what the conversation was about"` gestures at today without saying what was carried).
* Moves: nothing. A question does not move. (The only motion allowed is the header sliding up to one line when results start, because that is a real change.)
* One interaction: tap a "looking for" word = a small card "I'm matching pages against this word. Remove it?" is a later feature (needs a re-run). In this pass the word is not interactive.
* 375 px: the question wraps to 3 lines at 20px; the two lines under it at 14px. Sheet: same, centred, more air.

**(5) Tape additions.** `start` entry gains `{ focus: [..words], lang: "en", kind: "fact"|"retell"|"book"|"creative", carried: null | { text: "Eiffel Tower", from: "turn 3" } }`. Today none of this is on the tape; `focus` is recomputed in `phState` by `askWords`, so replays change when the heuristics change.

---

### Step 2. SIG ○ "where it's looking"

**(1) Three seconds.** "It looked in three places, found 14 results, opened 4, and set the rest aside."

**(2) Today.** `phState` collects `ph.engines` (searching / found n / failed with `why`) and `ph.pages` (reading / read / unread / snippet, `chars`, `kept`). `FRAMES[1]` draws one row per engine, then up to 6 page rows: favicon, bold title, site, three colour dots (one per question word, filled if the word is in the title), and a status "reading… / could not read / snippet / kept 40% / read".

**(3) Confusing or meaningless.**
* The three dots are unlabelled; they reuse step 1's colours and only test the title, not the page.
* "kept 40%" is `kept/chars` of the page. A percentage of characters kept says nothing a person can act on (is 40% good?).
* The most meaningful decision at this level is never drawn: which results were **set aside as off-topic** and which sources were **skipped** (`step({ phase: "demoted", n, titles })`, `{ phase: "skipped", n }`, `{ phase: "routed", picked, skipped }` in `fold-chat-web.js`). They reach the feed as `ev` lines ("Set aside off-topic results", "Chose where to look") but `slimSt` keeps only `phase scope q n url site title chars kept why text`, so `titles`, `picked`, `skipped` and `engine` are thrown away before the tape. The funnel cannot be drawn from the tape today.
* "could not read" and "failed" are drawn as struck-through rows at half opacity: honest, but the person is not told what to do (open it themselves), and the link is not there.

**(4) Redesign.** A funnel, not a list.

```
 Asked in 3 places                      (caption)
 Wikipedia 5 · The web 9 · Dictionary 0
 ─────────────────────────────────────
 ▪ opened   en.wikipedia.org  Eiffel Tower          read
 ▪ opened   britannica.com    Eiffel Tower          read
 ▪ opened   toureiffel.paris  Official site         headline only
 ▪ opened   example.com       Tower history         couldn't open
 ▸ set aside 6 results that did not match            (tap)
```

* Rows: favicon + the result's own title verbatim (no rewriting) + one status word. Statuses: *read*, *headline only* (snippet), *couldn't open* (with the engine's reason on tap), *set aside*.
* The engine line is one line of counts, not three rows (at 375 px three engine rows used up the stage).
* The set-aside rows live behind one collapsed row "set aside 6 results that did not match" with their titles verbatim when tapped, and the stated reason ("none of the words you asked about are in its title or first lines"; the real rule from `keepOnTopic`, recorded as a short code, shown as a templated sentence).
* Motion that is real: a result row appears when its `found` entry arrives; rows that are set aside slide down into the collapsed group when the `demoted` entry arrives (a recorded state change); a row's status word changes when its read finishes. No staggered fade-in just for show.
* One interaction: tap a row = the atom expansion. For an opened page: the reader sheet. For a set-aside result: title, domain, the engine's own snippet if there is one, the reason, and "open ↗".
* Colour dots: removed. Emphasis: none.
* 375 px: rows are 48 px tall (title clamped to one line, status right-aligned); the stage shows about 4 rows and scrolls vertically; the engines line wraps. Sheet: all rows visible, the reader drawer on the right when the sheet is wide.

**(5) Tape additions.** `st.found` gains `results: [{ url, title, site }]` capped at 12 (today `n` only). `st.demoted` keeps `titles` and gains `urls` and `reason: "off-topic"|"duplicate"|"thin"`. `st.skipped` keeps `n` and gains `urls`. `st.routed` keeps `picked`, `skipped`, `webDown` (extend the `slimSt` whitelist: `titles picked skipped engine results reason urls`). `st.failed` already has `why`; keep it.

---

### Step 3. INS ● "what it kept, in each page's own type"

**(1) Three seconds.** "Out of this page it kept this one passage; this is where on the page it was."

**(2) Today.** While a page is being read, `FRAMES[2]` draws `scan`: up to 9 of the page's sentences, hit lines (those containing a question word) shaded with an inset bar and keyed words underlined, other lines clipped to 52 characters and faded, and a foot "N sentences of 9 carry what you asked about". After passages arrive it draws up to 3 `sheet` cards (the last three of up to 7 kept), each in the site's face (`typeOf`) with the first 300 characters of the passage in a `<mark>` with keyed words underlined.

**(3) Confusing or meaningless.**
* The scan's foot counts hits among the first 9 sentences only (`.slice(0, 9)`), but reads as a statement about the page.
* "N passages worth keeping" in the scan header is `Math.round(latest.kept / 160)`: a number computed from a character count and a constant, not a recorded count. It must not be shown (a fake).
* Only the last 3 passages are drawn although up to 7 are kept (`mats.slice(-3)`), and kept passages from the same page are not grouped, so the person cannot tell "3 passages from 3 pages" from "3 passages from one page".
* There is no answer to "why this passage out of the whole page": the salience (`salientSentences`: question-word hits, names, figures, density, boilerplate penalty) is computed and thrown away.
* The scan is the user's complaint in miniature: underline plus shading plus clipped faded lines is "highlighting of everything".
* The site-typeface idea is the strongest thing here: it says "borrowed text" at a glance. Keep it.
* `ph.scanNewer` is read but never set anywhere in the file; the scan-after-first-passage branch is dead.

**(4) Redesign.** One card per page, the kept passage verbatim, and a minimap.

```
 ▪ en.wikipedia.org · Eiffel Tower                       ←  atom header (favicon, domain, page title)
 ┌───────────────────────────────────────────┐
 │ The Eiffel Tower is a wrought-iron …      │  ← passage verbatim, site's own type, 4 lines
 │ … 330 metres (1,083 ft) tall …            │     (the one sentence the question is about is
 └───────────────────────────────────────────┘      set in semi-bold; nothing is underlined or filled)
 page ▕▏▏▕▏▏▏▕██▕▏▏▏▏▏▏▏▕▏▏▏   kept 1 of 38 paragraphs     ←  minimap: kept paragraph at its true place
```

* The minimap is a thin row of one tick per paragraph of the page, the kept ones filled. It is the "where on the page" the person has never been shown, and it is drawn from recorded indices, not invented. A page where nothing was kept shows an empty strip and "read, nothing in it was about your question" (a dropped page is a visible thing).
* While a page is being read there is no animated scan of sentences. The honest state is "reading en.wikipedia.org…" with the empty minimap; when the passage is chosen the filled tick appears and the card shows. (If a short sentence scroll is wanted for liveness, it must be the real first lines of the page and take its time from the real read, not `i * .22s`.)
* Cards stack newest on top, grouped by page; a count chip "3 more kept" opens the list. At most two cards are drawn at once at 375 px.
* One interaction: tap the card or a minimap tick = reader sheet at that paragraph, prev/next through the page. Tapping a hollow tick shows that paragraph muted, with "not kept".
* 375 px: one card (passage clamped to 4 lines), minimap beneath, "+3 kept from other pages". Sheet: two cards side by side or one card with the reader drawer.

**(5) Tape additions.** `quick` entry gains `{ paras: 38, idx: 4, span: [start, end], sel: { exact, prefix, suffix }, why: { hits: ["height"], names: 1, figs: 1 }, ctx: { before, after } }` where `ctx` are the neighbouring paragraphs (cap 400 characters each) so the sheet can open without re-fetching, and `why` is the output of `salientSentences` scoring exposed as counts (never shown as a score, only used for the one-line "why this one: it contains *height*"). A page with `kept: 0` gets an entry too (`{ kind: "quick", none: true, url }`) so the empty minimap can be drawn. `slimP` currently clips passage text to 900 characters; keep that, but record the span against the full page text.

---

### Step 4. SEG ｜ "each kept sentence, cut into who | does | what"

**(1) Three seconds.** "This is the sentence it picked from each page, and who does what to what in it."

**(2) Today.** `deriveGraph` takes up to the first 3 passages, picks the most salient sentence of each (`salientSentences(text, question, 1)`), tags tokens (`tagOf`), finds a verb position, assigns roles s/v/o/f(unction)/x, and `FRAMES[3]` draws, per source, a favicon (`fav`) then labelled boxes: `.c-s` teal outline "SUBJ", `.c-v` filled italic "VERB", `.c-o` orange outline "OBJ", unlabelled dashed boxes for the rest, on a ruled grid background (`--side2` lines), then "dropped: the · of · …" struck through.

This is the screen the user likes. Keep the grid, the labelled boxes, the favicon-first row.

**(3) Confusing or meaningless.**
* The sentence the boxes were cut from is never shown whole. The person sees pieces without the thing that was cut, and the "dropped" list shows only function words ("the · of"), the least interesting part.
* The roles are a position guess: `deriveGraph` takes the first auxiliary or "-ed/-ing" word after position 0 as the verb, up to 4 words before it as subject, up to 5 after as object, with English closed lists (`PREP`, `PRON`, `AUXILIARY_VERBS`, determiners) and capital-initial name detection (`tagOf`, the `\p{Lu}` test). Consequences: a passive ("was designed by Eiffel's company") labels the agent OBJ; when no verb is found the code falls back to `Math.min(2, toks.length - 1)` (a pure guess, drawn as confidently as a good cut); a non-English sentence is cut with English lists; the capital-initial test is the case logic the project rules forbid. `docs/GROUNDING-BY-MEANING.md` records that the live read door returns no referents at sentence grain and no voice, so this cut cannot honestly claim "subject" and "object". It is "what comes first, the action, what follows".
* Only 3 sources, only one sentence each, with no statement of why those; at 375 px three rows do not fit the 250 px stage.
* The sub-steps of the `deep` k=3 entries (sub 0 = sentences, 1 = words tagged, 2 = roles) used to animate words moving into place in `tokenStage`, but `.pv-live-m > .pv-mid { display: none }` hides that view; the visible `FRAMES[3]` is identical for sub 0, 1 and 2. The 6 seconds of dwell (1.8 + 2.0 + 2.2) change nothing on screen; and `tokenStage` still runs a full word-by-word layout whose only surviving output is `ctx.g.G` (the graph data).

**(4) Redesign.** Same visual language; add the sentence; make the cut honest.

```
 ▪ en.wikipedia.org                                           ← favicon row, as now
 The Eiffel Tower is a wrought-iron lattice tower …          ← the whole sentence, verbatim, site's type,
 ╭────────────╮ ╭──────────────╮ ╭─────────────────╮            1 line, tap to expand
 │ Eiffel Tower│ │ is           │ │ a wrought-iron …│        ← the words slide DOWN into the boxes
 ╰────────────╯ ╰──────────────╯ ╰─────────────────╯
   SUBJ            VERB             OBJ
 about "height"                                              ← why this sentence: the question words in it
```

* Motion that shows a real change: the sentence's words move down and group into boxes at the keyframe where the cut is made. The tape holds the cut (below), so the replay performs the identical cut. No staggered "loading" delay.
* Words that were set aside (the, of) are not strung out in a struck-through line. They dim in the sentence and a small chip "7 small words set aside" opens the list. Rule: the cut loses nothing silently.
* Low-confidence cuts are drawn as such: a VERB box with a dashed outline and a "?" when the verb was a fallback guess or the sentence is a passive; a one-line note "this cut is approximate" when the language is not one the closed lists cover (`detectLang` already gives `lang`; show it as a small tag on the row, as `tokenStage` did).
* The labels may stay SUBJ/VERB/OBJ (the user likes them), with a quiet key in the sheet: "first thing named · the action · what follows".
* One interaction: tap a box = the reader sheet scrolled to the sentence in its page, with the box's words in bold. Tap the favicon row = the page overview (step 3's card).
* 375 px: one row at a time, full size; the other two rows are collapsed to one line each ("▪ britannica.com · tower · designed · Eiffel's company") and tap to swap. Dots under the stage (● ○ ○) show there are three. No horizontal pan (the old `tokenStage` kept a 520 px layout and panned at narrow widths; that is the "not legible when narrow" bug). Sheet: all three rows full size, the reader drawer to the right.

**(5) Tape additions.** A `cut` per row, frozen at record time so the replay cannot drift when the heuristics change:
`deep` k=3 entry gains `rows: [{ url, sentence, sel, toks: [{ t, role: "s"|"v"|"o"|"f"|"x" }], verbFallback: bool, passive: bool, lang, why: { hits: ["height"] } }]`. Today only `ps` (the passages) is on the tape and `deriveGraph` is recomputed at paint time.

---

### Step 5. CON ⋈ "the same things merge; the verbs become links"

**(1) Three seconds.** "These two pages are talking about the same thing; this is what each says about it."

**(2) Today.** `graphFrame(ctx, false)`: nodes placed in a left and a right column (up to 4 each, fixed 58 px rows), merged nodes with a thick green border and "merged · 2 sources", curves between nodes with the verb as a floating label (`.verb`, max width 22% of the stage), a caption "5 things · 3 bonds · 1 merged across sources".

**(3) Confusing or meaningless.**
* "Merged" means two nodes share a word of 5 or more letters (`nodeFor`: `keys.some(k => k.length >= 5 && n.keys.includes(k))`). "history of France" and "history of Paris" merge on "history". The screen claims "the same things merge", which overstates a shared-word test. There are no referents at sentence grain to say they are the same thing (`docs/GROUNDING-BY-MEANING.md`).
* At 375 px each node column is 38% of about 343 px, about 130 px, and the verb label between the columns is about 70 px, so labels truncate to a few characters; node text wraps to three lines inside a 58 px row and overlaps. This is the "hard to read" case.
* When no two sentences share a thing, the screen is a set of disconnected boxes with nothing joined, which looks like a failed step, and it is unusual neither for one-source answers nor for small question sets.
* The graph is not used afterwards for anything except step 6's top bonds (and step 6's meaning is itself questionable, see there).

**(4) Redesign.** From a graph to a table, and hide it unless it fired.

```
 2 things named by more than one page                            (caption)
 "tower height"
   ▪ wikipedia       is → 330 metres (1,083 ft) tall
   ▪ britannica      stands → 300 m, 330 m with antennas
 "Gustave Eiffel"
   ▪ wikipedia       designed → the tower
   ▪ toureiffel      built → the tower in 1889
 ▸ 4 things named by one page only                               (collapsed)
```

* One row per thing that two or more pages name (the shared word shown as the heading, verbatim from the pages: "both say *tower*"), one line per page under it with that page's own verb and object words, verbatim.
* Where two pages give a different verb or object for the same thing, the two lines sit adjacent so the difference is visible at a glance (this foreshadows steps 8 and 9 and is the first honest place a disagreement can show).
* If nothing is shared, this screen does not appear. One quiet line on the SEG screen says "no two pages named the same thing, so each stands alone".
* Motion: the matching word in two source rows draws a thin connector, then the two lines settle under one heading. That is the merge; it happens once per merge, on the recorded merge entry.
* One interaction: tap a line = reader at that sentence. Tap the heading = the shared word in every kept sentence.
* 375 px: the table is naturally vertical and needs no change. Sheet: heading column + source columns.

**(5) Tape additions.** `deep` k=4 entry gains `nodes: [{ id, label, rows: [srcIdx], via: "tower" }]` and `edges: [{ from, to, verb, row }]`, with `via` naming the shared word that caused the merge. Today these are recomputed from `ps` in `deriveGraph`.

---

### Step 6. SYN △ "the path the answer takes"

**(1) Three seconds.** "The answer is being written now, and each sentence leans on these kept sentences."

**(2) Today.** `synFrame`: up to four "steps" (the bonds with the most sources) as numbered rows `[subject pill] →verb→ [object pill]`, those the drafted sentence touches lit in teal on a dark panel; beneath, the drafted sentence typed in (`writingEl`), with a caret. `applyEntry` case `draft` also types each finished sentence into a (now hidden) `pv-drafts` list with chips of the graph nodes it uses or "uses nothing in the graph".

**(3) Confusing or meaningless.**
* "The path the answer takes" is not true. The model is handed passages; the graph is derived for display, and the answer is not constrained to follow its steps. The "steps" are the four bonds with the most sources, ordered by that count; the title promises planning that does not happen. This is a display construct presented as a mechanism.
* In the live view the answer is streaming above the panel, so the drafted sentence is shown twice; in replay it is the only copy. The panel does not know which.
* For answers produced without a model (slot asks per `docs/ANSWER-PIPELINE.md`: "the model is not called at all"), a step titled "the model is writing" or "Writing the answer from this graph" (the `writing` case in `applyEntry`) is false. The tape records nothing about who wrote the answer.
* The most meaningful thing recorded at this level is `uses nothing in the graph`: a drafted sentence that leans on nothing that was kept. Today it is an `<em>` in a hidden list.

**(4) Redesign.** Cut the numbered path; draw lean.

```
 Writing · sentence 2 of 4                                       (caption)
 "The tower is 330 metres tall."                  ← the draft sentence (replay only; live: the answer above)
   leans on  ▪ wikipedia  "… stands 330 metres (1,083 ft) tall …"
             ▪ britannica "… 330 metres including antennas …"
 (or)  ⚠ no kept sentence resembles this one yet   ← amber, no icon fuss
```

* For each drafted sentence: the 1 to 2 kept sentences it most resembles, verbatim with favicons (the same match the evidence popover on the final answer uses), so the person sees the answer being tied to the pages as it is written. If none resembles it, say so; that is information (it will likely show as "no source" at step 9).
* If the answer was mechanical (no model), the caption is "Answer read straight from the page" and there are no drafts. If a model wrote it, the caption names the model's role neutrally: "Writing from the kept passages" (the model is never alone: the next screens check it).
* Live: do not retype the sentence; show only the lean list and the sentence's number, because the sentence is on screen above. Replay: show the sentence.
* Motion: a lean row fades in when its draft entry arrives. The numbered outline is cut.
* One interaction: tap a lean row = reader at that sentence. Tap the sentence (replay) = nothing.
* 375 px: sentence clamped to 3 lines, lean rows each 2 lines. Sheet: the sentence and its lean rows side by side.

**(5) Tape additions.** `writing` entry gains `by: "model"|"mechanical"`, `model: "gemma2:2b"|null`. `draft` entries gain `lean: [{ url, sentence, overlap: [words] }]` (up to 2; empty array when none), computed at record time from `fullMat`, not at paint time from the clipped material.

---

### Step 7. DEF ⊢ "each sentence becomes a claim"

**(1) Three seconds.** "Each sentence says something that could be wrong; here is the part that could be."

**(2) Today.** `FRAMES[6]`: a ledger grid `# | CLAIM | COMMITS TO`: the sentence (clipped to 140), and chips for each figure (`figuresIn`) or name (`namesIn`) in it, or "a judgement · no figure or name". `.slice(0, 5)`. In the old frame (`checkStage` k=6) the sentences fade in one by one.

**(3) Confusing or meaningless.**
* It is the answer's text restated for the third time (streaming above, then in step 6's draft, then here). It animates nothing that is not just "the list appears".
* "COMMITS TO" is jargon. The idea is real and good: what the sentence stakes (a figure, a name) is what a source can contradict. That sentence has no stake is as important to say.
* Sentence 6 is silently dropped (`slice(0, 5)` while `checkSents` holds up to 6).
* The user's mental mapping of DEF is "definitions" (the falsifier row, `FALSIFIERS[6]`: "Is each term used inside its definition?", "fix the definition and re-read for the same for-whom"). The playback's DEF frame shows no definitions. Two meanings of the same glyph in the same panel (the Checks tab uses ⊢ for definitions) is confusing.
* Name detection depends on capital-initial heuristics (`namesIn`), so "commits to" will list sentence-initial words in languages or styles where capitals mean something else.

**(4) Redesign.** Merge into step 8: DEF stops being a screen and becomes the header of each claim card (see step 8). If kept as a screen, it is one beat of 1.2 s with this content only:
* each sentence as one line; beside it the stake pulled out as tags (figures first, then names), or the quiet note "nothing a source could contradict here" (a judgement or a connective);
* no repeat of the whole sentence if the answer is on screen above;
* sentence numbers match the dots in step 8.

Also, the definition test belongs here when (and only when) it ran: for terms the answer leans on that the sources define, show the term and the sources' definition verbatim ("*ketogenic*: your sources define it as '…'"). If no term was defined, do not draw a definition row at all (see section 4).

* One interaction: tap a sentence = scroll the answer above to that sentence (a transient outline, then gone). Tap a stake = (once step 8 has run) the source sentence that states it.
* 375 px: sentence clamped to 2 lines, stake tags beneath. Sheet: ledger with the three columns.

**(5) Tape additions.** `check` k=6 entry gains, per sentence, `stakes: [{ raw: "330 metres", kind: "figure"|"name" }]`, `hedged: bool`, and `terms: [{ t, def, url, sel }]` for any term with a definition found (today `falsifiersOf` computes this from `rec.tape` and `rec.facing` at inspection time, not on the tape). The limit of 5 sentences vs 6 recorded is a bug to remove, not a design.

---

### Step 8. EVA ⊨ "claim against source — then the swap"

**(1) Three seconds.** "The source says exactly this" or "the source does not."

**(2) Today.** `FRAMES[7]` for the current sentence (`ph.evaI`, advanced by `check` k=7 entries every 2.6 s): a `pair` of cards, the claim and the source sentence (the longest shared run of words in a `.pv-run` underline in both), four ticks (shared run of N words; each figure "in the sentence"; "no source contradicts it"; "N independent sources"), and a `swap` card ("swap · would a wrong version pass?", the sentence with the figure struck and a competitor in bold, then a verdict "No longer matches. The source tells the two apart.").

This is the strongest "show your work" in the playback. Keep claim/source pairing and the swap. The weaknesses are in the data and in the words.

**(3) Confusing or meaningless.**
* The ticks and the swap are computed at paint time (`falsifyAnswer([s], ctx.material)`) against `ctx.material`, which is built from the `quick` entries whose `p.text` is clipped to 900 characters by `slimP`. The verdict `checks[i]` stored at record time (`computeCheck(s, fullMat)`) was computed against the full passages. So a replay can draw "no shared run" in red next to a stored verdict of backed, or a swap that "still matches" because the clipped passage lacks the competitor. The same applies live, because live also builds `ctx.material` from clipped entries. I did not measure how often these disagree; the code path says they can.
* "shared run · 6 words" is jargon. "Longest run" is the algorithm, not what a person needs: "the source uses these exact words".
* A paraphrase that passes the meaning check (`c.meaning.level` "same" or "related") shows `no shared run` with a red ✗, because the tick tests `c.runN >= 4`. The frame does pick the meaning's source sentence, but it does not draw the relation comparison (the old `pv-mean` view did: who | does | what in both).
* The swap card is a rewritten sentence on screen. It is labelled "swap" and styled struck/bold, which is the right idea, but the rule "find/snip/cite never rewrite" means it must look unlike a quote. When no figure or name can be swapped the card is simply absent, with no explanation.
* One sentence per 2.6 s up to 6 sentences is 16 seconds with no overview, and the person cannot jump.

**(4) Redesign.** Claim over source, one verdict in plain words, tests behind a toggle.

```
 Checking sentence 2 of 4 against the pages                      (caption)  ● ○ ○ ○  (tap to jump)
 THE ANSWER SAYS
 "The tower is **330 metres** tall."                  ← claim, verbatim; stake in semi-bold (from step 7)
   ╎  the source says it in the same words
 ▪ wikipedia.org · Eiffel Tower
 "… stands **330 metres** (1,083 ft) tall …"          ← source sentence, verbatim, site's type
 ✓ Held up   · exact words: "330 metres"             ← verdict: one plain sentence; "how checked ▾"
 We tried changing 330 metres to 300 metres:          ← swap card, own box, never in quote style
   the source no longer matches, so it really says 330.
```

* Verdict sentences (fixed, app-authored; the existing `L` strings reworded to plain): *"The source says it in the same words."* · *"The source says the same thing in different words."* · *"Close: the source does not give '330 metres'."* · *"A source says otherwise."* (with the contradicting sentence in the source card, in red edge) · *"Nothing it read says this."*
* Honest gap drawn: for "nothing it read says this", the source card is dashed and empty ("no page states this") with "closest it read:" and the nearest sentence muted below it (labelled "closest, not a match").
* "How checked" (collapsed) holds the ticks in plain words: the exact-words test, the figure test, the contradiction test, the independent-source count. They are the same four tests as today, behind one tap.
* The swap sits in its own bordered box: "We tried changing *330 metres* to *300 metres*" (old struck, new bold), then the verdict in one sentence. If nothing can be swapped: "Nothing to swap in this sentence (no figure or name), so it was tested on wording alone." That sentence is the honest version of today's missing card.
* Motion: the card switches when `check` k=7 advances (a recorded step); within a sentence the only motion is the shared phrase appearing in bold in both cards, once. No mark pulse.
* Interaction: tap the source card = reader sheet at that sentence with prev/next paragraph (the fix for "I want to see the page this came from"). Tap the dots to jump to a sentence. Tap the swap box = shows the competitor's source sentence.
* 375 px: claim above, source below, verdict under; each card clamped to 3 lines; swap box collapsed to one line "Tried changing 330 → 300: caught" that opens on tap. Sheet: claim and source side by side, the reader drawer at the right, ticks open by default.

**(5) Tape additions.** `check` k=6 entry's per-sentence record gains the cross-reference result computed on the FULL passages at record time: `fz: { verdict, witnesses: [{ src, verdict: "states"|"contradicts"|"near"|"silent", sentence, sel }], swap: { armed, from, to, discriminates, competitorSource }, chains }`. Then `FRAMES[7]` and `FRAMES[8]` read these and call no `falsifyAnswer` at paint time. Size is about 6 claims × 3 witnesses × 300 characters, roughly 5 to 6 KB per turn. Each `witnesses[].sentence` is a substring of the page text.

---

### Step 9. REC ∗ "every claim against every source"

**(1) Three seconds.** "These stand. This one is weak. This one has no source. And here is what I did about the weak ones."

**(2) Today.** `FRAMES[8]`: a matrix. Rows are sentences sorted into "stands", "weak or contested", "no source" groups; columns are up to 5 source favicons; cells are ✓ ✗ ~ · (`XC`); a verdict word at the right ("corroborated", "one source", "weak", "contested", "no source"). If a `loop` entry arrived, one line "∗ lap 1: going back for 2 sentences" is appended. Separately `loopFx` draws an amber arc from the ∗ chip back to ● and a teal rail forward, the panel's "one animation".

**(3) Confusing or meaningless.**
* The matrix is computed at paint time from `ctx.material` (clipped to 900 characters per passage; `falsifyAnswer(sents, ctx.material)`), but the marks the final answer wears come from `crossCheckOf(rec)`, computed from `passagesOfRecord(rec)`. They are different grounds, so the playback's "what the answer stands on" may differ from the answer's own marks. I did not measure this; the code path says it can.
* The cell meaning (✓ ✗ ~ ·) appears in the table's cell `title` only. There are no tooltips on touch, and nothing is tappable, so the user cannot answer "what does that source actually say?" from here, which is the first thing a person asks.
* The most dramatic real event, the system going back (`fold-chat.js` REC loop: re-impress pages already read, search with the claim as the query, re-run the cross-reference, restate only the sentences still failing, up to two laps), is recorded on the tape as `{ lap, failing: [{ i, verdict, query }] }` only. What came back (`reImpressed`, `added`, `restated`, `afterIns`) is in `rec.loop` but not on the tape, so the replay can show that it went back but never what it found. The arc animation illustrates a loop in the abstract; the person never learns whether it helped.
* "∗" and "REC" mean nothing to a person. "Rebuild-and-retest" (`FALSIFIERS[8]`: "Is it still true on the rebuilt ground?") is, for most answers, the trivially-held row "the ground was rebuilt this turn".
* Columns beyond 5 sources are dropped silently (`fz.sources.slice(0, 5)`).

**(4) Redesign.** The verdict table, tappable; and a "went back" strip only when it happened.

```
 3 stand · 1 on one page only · 1 has no source                  (caption)
                                   ▪W  ▪B  ▪T
 s1 The tower is 330 metres tall.   ●   ●   ○     stands · 2 pages
 s2 It was finished in 1889.        ●   ○   ●     stands · 2 pages
 s3 It is the most visited …        ○   ●   ○     one page only
 s4 It was criticised by artists …  ○   ○   ○     no source
 ── went back, 1 time ─────────────────────────────────────────────
 s4 had no source → searched “eiffel tower artists protest”
    read 2 more pages → still no source, so it stays and is marked in the answer
```

* Cells are small filled (states) / hollow (silent) / struck (contradicts) / half (close) dots, with a one-line legend. Verdict words are plain: "stands · 2 pages", "one page only", "weak", "a source says otherwise", "no source".
* Tap a cell = the reader sheet at that source's sentence for that claim (verbatim, `witnesses[].sentence`). A hollow cell says "this page is silent on it" with the closest sentence muted if there is one. Tap a sentence = scroll the answer above to it.
* If it went back: one strip per failing sentence with the verbatim query used, how many more pages were read (their favicons appear as new columns), and the outcome in fixed words ("now stands", "still no source, kept and marked", "restated"). The matrix then **changes in place**: new columns slide in, a hollow dot becomes filled where the new page states it. That is a recorded state change and the real payoff of the loop.
* The `loopFx` arc is retired. If an arc is wanted, it points from the sentence that broke to the new column that fixed it, not from a glyph chip to a glyph chip.
* If there was no loop, no loop UI is drawn.
* The last frame hands over to the answer: each row shows "show in answer ↑". The answer's own marks (the quiet dotted sentence mark and the evidence popover) are computed from the same recorded result as this table.
* 375 px: the table is two lines per sentence (the sentence clamped to one line above, dots and verdict below it); at most 4 columns shown with "+2 more pages" opening the rest. Sheet: full table with the reader drawer.

**(5) Tape additions.** `loop` entry gains outcomes: `{ lap, failing: [{ i, verdict, query }], reImpressed: [{ url, segments }], added: [{ url, site, title }], restated: [{ i, to? , kept?, why? }], after: { corroborated, held, weak, contested, unsupported }, cleared: bool }`. This needs one new hook where `fold-chat.js` finishes each lap (`pvLive.lapDone(lap, pass)` beside the existing `pvLive.loop(lap, pass.failing)`), because the outcome is known only after the search. The matrix reads `check` k=6's `fz` (step 8) and, after a loop, the `after` summary and per-claim witnesses re-recorded as `check` k=8 entries with `lap: n`.

---

## 4. Failure that is not failure: the falsifier rows that always look broken

The nine falsifier rows in the Checks tab (`falsifiersOf`, `FALSIFIERS`) are the user's "definitions, comparison against a null, rebuild-and-retest" levels. They are a separate surface from the playback's frames 7 to 9, and they share glyphs, which is its own confusion. Reading `falsifiersOf`, these are `gap` or `open` for most answers, so the "2 of 9 checks flagged" summary (`inspectorEl`: `flag` counts `gap` and `refused`) fires often without anything being wrong:

| row | status for a typical answer | why |
|---|---|---|
| 7 DEF (row index 6) | `gap` "none of the answer's terms is defined in what it read — their sense is the model's" | needs a "X is …" definition in the pages for a term the answer uses; most pages do not give one |
| 8 EVA (row index 7) | `gap` "no rival figure or name of the same kind … so the swap could not run — not a pass, and not a failure" when no figure to swap; `failed` "with no declared null — no verdict" for any comparison word (`most`, `first`, `only`, `record`...) without a baseline figure in the pages | the null is a baseline the answer's sources rarely state |
| 9 REC (row index 8) | `held` "the ground is this turn's reading" when no cross-reference | trivially true |
| ground and pattern cells | `open` "not run" for 4 of 9 rows in each of the two extra grains | `GP` rows 4, 6, 7, 8 pattern cells are hard-coded `open` ("the cut is not re-checked", "usage drift … is not measured", "later updates are not tracked yet") |

The honest wording is right ("a gap, not a fact", "not a pass, and not a failure"), but the count in the summary line collapses "could not test" into "flagged", and a flag reads as a warning. Recommendation (applies to the Checks tab and to the playback):
* Three outcomes, not five: **held** (ran, survived), **broke** (ran, failed), **didn't apply** (could not run on this answer). Today's `gap`, `open`, `n/a`, `refused` are all "didn't apply" for the headline count; `refused` ("no traceable source") is the exception and remains a visible amber, because it is a finding about the answer.
* Headline: "Tried 4 tests: 3 held, 1 broke. 5 didn't apply here (nothing to swap, no definition to compare, ...)." The 5 are one collapsed line, not five rows.
* In the playback, a test that did not apply is not a screen. DEF's definition row and EVA's null/swap card appear only when they ran.

---

## 5. What the tape needs that it does not record today (consolidated)

| entry | add | why | used by |
|---|---|---|---|
| `start` | `focus[]`, `lang`, `kind`, `carried{text, from}` | question facts recomputed today by English-only heuristics at paint time | 1 |
| `st` (`slimSt` whitelist) | keep `titles`, `picked`, `skipped`, `engine`; add `results[{url,title,site}]` (cap 12), `reason`, `urls` | `slimSt` drops them, so the funnel cannot be drawn | 2 |
| `quick` | `paras`, `idx`, `span[start,end]`, `sel{exact,prefix,suffix}`, `why{hits,names,figs}`, `ctx{before,after}`; `{none:true,url}` for pages that kept nothing | minimap, reader prev/next, "why this passage", empty pages | 3, all atoms |
| `deep` k=3 | `rows[{url,sentence,sel,toks[{t,role}],verbFallback,passive,lang,why}]` | frozen cut, honest "?" | 4 |
| `deep` k=4 | `nodes[{id,label,rows,via}]`, `edges[{from,to,verb,row}]` | the table; hide-unless-fired | 5 |
| `writing` | `by:"model"|"mechanical"`, `model` | slot-ask answers have no model; "the model is writing" is false there | 6 |
| `draft` | `lean[{url,sentence,overlap[]}]` computed on full material | drafts tied to evidence, "leans on nothing" | 6 |
| `check` k=6 | per sentence: `stakes[]`, `hedged`, `terms[{t,def,url,sel}]`, and `fz{verdict,witnesses[{src,verdict,sentence,sel}],swap{armed,from,to,discriminates},chains}` computed on FULL passages; remove the 5-vs-6 sentence mismatch | one ground for the playback and the answer's marks; no paint-time `falsifyAnswer` on 900-char clips | 7, 8, 9 |
| `loop` | `reImpressed`, `added`, `restated`, `after`, `cleared`; new hook `pvLive.lapDone` | the loop's content, matrix changes in place | 9 |
| every entry | `by:"timer"|"event"` on the `at` stamp | replays should know which times are real (an event) and which are script dwell | all |

Sizing: `sel`+`ctx` per kept passage ≈ 1 KB × up to 7 = 7 KB; `fz` ≈ 6 KB; `rows`/`nodes` ≈ 2 KB. About 15 to 20 KB more per turn. The reader sheet degrades (draws the stored passage and says the rest is not stored) when it is absent, so old tapes still play.

---

## 6. Ranking: value to the person / effort

Value 1 to 5 (does the person understand or act on something new), effort 1 to 5 (diff size and risk). The shared pieces (reader sheet, atom, caption row) are counted separately because every step needs them.

| step | value | effort | ratio | note |
|---|---|---|---|---|
| 8 EVA | 5 | 2 | 2.5 | the data fix (record `fz`) removes a real inconsistency; plain verdict is a string change |
| 4 SEG | 4 | 2 | 2.0 | user's favourite; add the sentence line, record the cut, dashed "?" |
| 2 SIG (with 1) | 4 | 2 | 2.0 | needs `slimSt` whitelist + the funnel rows; merge removes a screen |
| 9 REC | 5 | 3 | 1.7 | table is small; loop-outcome recording crosses into `fold-chat.js` |
| 3 INS | 5 | 3 | 1.7 | minimap + record `idx`/`paras`; hosts the first reader use |
| shared: caption + progress row | 4 | 2 | 2.0 | fixes "no words visible live", removes glyph strip and foot |
| shared: atom + reader sheet | 5 | 3 | 1.7 | the user's explicit ask |
| 6 SYN | 3 | 2 | 1.5 | cut the numbered path; lean list from recorded `lean` |
| 1 NUL | 2 | 1 | 2.0 only as part of 2 | standalone it is worth nothing |
| 7 DEF | 2 | 2 | 1.0 | worth only as the claim card's header in 8 |
| 5 CON | 3 | 4 | 0.75 as a table; 2/1 = 2.0 if just hidden unless fired | redesign last |

---

## 7. Recommended order: small diffs

Each is independently shippable and testable with the model off. Files are the-fold unless noted. CSS lives in `index.html` (and `styles/*.css`, currently being edited by others), so every UI diff below needs a matching CSS change that I have not made.

1. **Record the ground once (no UI).**
   * `fold-chat-presentview.js` `slimSt`: extend the whitelist (`titles picked skipped engine results reason urls`); `mountLive().wrote()`: put `fz` (from `falsifyAnswer(sents, fullMat)`), `stakes`, `terms` into each `checks[i]`; `passages()`: put `paras idx span sel why ctx` on `quick` entries (needs the passage objects from `fold-chat-web.js` to carry the paragraph index; that file owns the chunking).
   * Test: a node test that every `witnesses[].sentence`, `sel.exact` and `ctx` string is a substring of the stored page text (verbatim check).
2. **One ground for the frames (the consistency fix).** `FRAMES[7]` and `FRAMES[8]`: read `checks[i].fz` instead of calling `falsifyAnswer` at paint time; delete `ph.fzEva`/`ph.fzRec` caching. Test: replay's matrix equals `crossCheckOf(rec)` for the same turn.
3. **The caption and the progress row.** `paintPhase`: always render a one-line caption from `CAPTION[L](ctx, ph)`; `buildPanels`: replace `.pv-levels` chips with four act labels; delete `P.foot` (the do/eot lines). Keep glyphs in the full-screen sheet only.
4. **Plain verdict in step 8.** `FRAMES[7]`: the five fixed verdict sentences, ticks behind a "how checked" toggle, swap in its own box with the "nothing to swap" line, dots to jump (`ph.evaI`). Replace `.pv-run` underline with weight.
5. **The atom and the reader sheet.** New `fold-chat-reader.js` (`atomEl`, `openReader(atom)`), reusing `showPop`'s sheet CSS and the click-delegation pattern at the top of the file (`__pvClipTap`). Wire it to step 8's source card first, then to the final answer's evidence popover (`showPop`) so one expansion serves both. Add the text-fragment to `credit()`'s "open ↗".
6. **SEG: sentence line, frozen cut, "?".** `deriveGraph`: output `toks[{t,role}]`, `verbFallback`, `passive`; `mountLive().passages()`: put `rows` on the `deep` k=3 entry; `FRAMES[3]`: draw the sentence above the boxes, words slide into boxes on the keyframe, small-words chip. Remove the `tokenStage` word layout (it only fills a hidden element) and the `sub` dwells (6 s of dead time): collapse `[3,0],[3,1],[3,2]` to one `deep` k=3 entry.
7. **SIG funnel (merge 1+2).** `phState`: collect `results`, `demoted`, `skipped`; `FRAMES[1]` (and fold `FRAMES[0]` into its header): funnel rows, set-aside group, status words; drop the three colour dots. Remove `keyed` from `FRAMES[0]`, the header and the scan.
8. **INS cards and minimap.** `FRAMES[2]`: one card per page, grouped, the kept passage in the site's type, the minimap from `idx/paras`; delete the `scan` branch, the `Math.round(kept / 160)` count, and `ph.scanNewer`; tap = reader.
9. **REC table and loop outcomes.** `FRAMES[8]`: filled/hollow dots, plain verdict words, tap = reader; `fold-chat.js`: call `pvLive.lapDone(lap, pass)` after each lap; `applyEntry` `loop` case: draw the went-back strip and update the table in place; retire `loopFx`.
10. **SYN: lean list and `by`.** `synFrame`: drop the numbered bonds, draw `draft.lean`; `writing` case: say "Answer read straight from the page" when `by === "mechanical"`; in live, do not retype the sentence (check `body.classList.contains("pv-live-on")` with the answer element visible).
11. **Merge 7+8 and hide CON unless fired.** In `paintPhase`, map levels to screens (`SCREEN = [0,0,1,2,3,4,5,5,6]` for caption/progress purposes) and render DEF's stakes as the claim card's header inside `FRAMES[7]`; `FRAMES[4]`: the who-says-what table, and skip drawing when `G.nodes.every(n => n.rows.length < 2)`.
12. **Falsifier counts.** `falsifiersOf`/`inspectorEl`/`falsifyEl`: three outcomes and "didn't apply" collapsed (section 4); applies to the Checks tab, not the playback.

---

## 8. Steps I would cut or merge (honestly)

* **Merge 1 into 2.** A one-second title screen is not a step. The question, what it looks for and what kind of ask it is become the header of the "looked" screen.
* **Merge 7 into 8.** "Each sentence becomes a claim" and "the claim against the source" are two screens for the same sentences. The claim card's header is the DEF step; one screen per sentence.
* **Hide 5 (CON) unless two pages actually named the same thing.** When nothing merges, the screen is disconnected boxes that look like failure. A one-line note on step 4's screen replaces it.
* **Cut the numbered "path" in 6 (SYN).** It claims a plan that does not exist. Keep the draft and the lean list.
* **Hide the REC loop UI unless a lap ran.** Most turns are `firstTry` (`recLoop.firstTry`). When they are, REC is just the table.
* **Cut the `tokenStage` word layout and the three SEG sub-steps.** The animation is hidden (`.pv-live-m > .pv-mid { display: none }`), its sub-steps change no visible pixel, and 6 seconds of scripted dwell is drawn from them. Keep `deriveGraph` for the data.
* **Cut the nine glyph chips and the foot (do + two ledger lines) from the live view.** They restate the status line. The glyph key survives in the full-screen sheet.
* **Cut "kept 40%" and the `kept/160` passage count.** Neither is a recorded fact a person can use; the second is invented.
* **Do not draw a falsifier row that did not apply** (section 4).
* **Not cut, on purpose:** the site-typeface rendering of kept passages (it is what says "borrowed"), the SEG box look, the swap card, the favicon-first row, the scrubber with keyframe ticks and the 1/20× replay speed (all of which already work and which the user did not complain about).

---

## 9. How we would know it worked (cheap, honest)

* **Three-second test.** Cover the caption; show one frame at 375 px for 3 s; ask "what just happened?" One person per step is enough to catch a failure; five is better. A step fails if the viewer cannot say the sentence in section 0's "3 s" column in their own words. Record the words verbatim; do not average them.
* **Verbatim test.** Every string drawn in a quoted position (atoms, boxes, claim and source cards, matrix cells) must be a substring of recorded material. A node test over the replay's DOM for a fixed tape catches a rewrite.
* **Narrow test.** At 375 px and at 560 px the stage has no horizontal scroll and no overlapping text, and no step relies on `title=` or hover.
* **Consistency test.** For the same turn, step 9's matrix and the final answer's sentence marks are produced from the same recorded `fz`.
* **Old tapes.** A tape recorded before these fields exist still plays; missing fields draw as the explicit gaps in section 2.4, not as errors.

---

## 10. Prior art

What I actually opened (F) versus what I only saw in search results (S) is marked, because several fetches failed.

1. **Wikipedia Page Previews and Reference Previews** (F). https://www.mediawiki.org/wiki/Page_Previews and https://meta.wikimedia.org/wiki/WMDE_Technical_Wishes/ReferencePreviews. Took: hover to preview and click to jump is "the behavior most people expect" (their testing); users asked for *larger* previews, not smaller, so the card should not be clamped to a thumbnail; exposing the reference's *type* helps readers decide fast how far to trust it (our site-typeface header plays that role); on mobile the platform did not ship the hover card because the position-loss problem is already solved there (so on touch, our sheet should be a real destination, not a tooltip).
2. **Scroll-to-text-fragment** (F). https://github.com/WICG/scroll-to-text-fragment. Took: a quote can be addressed as `prefix-,start,end,-suffix`, where the prefix and suffix only disambiguate and are not highlighted; the browser scrolls and indicates the match. So "open ↗" should carry a text fragment built from the recorded `sel`, and the reader sheet should highlight only the match, not its context. Support differs by browser; verify before relying on it.
3. **W3C Web Annotation TextQuoteSelector and Hypothesis fuzzy anchoring** (F for Hypothesis, S for the W3C model). https://web.hypothes.is/blog/fuzzy-anchoring/ and https://anchorpoint.readthedocs.io/en/stable/api/selectors.html. Took: store an address as `exact` + `prefix` + `suffix` plus position, and re-anchor in strategies from exact to fuzzy as the page changes. That is the shape of the `sel` field in section 5. The Hypothesis post does not say how an orphaned quote is shown to the reader; our rule is to draw the gap ("the page changed; here is the passage as it was read").
4. **Gemini Deep Research and Perplexity Deep Research** (S). https://techcrunch.com/2024/12/11/gemini-can-now-research-deeper/ and https://hub-prod.perplexity.ai/hub/blog/introducing-perplexity-deep-research. Took: the plan or steps are visible *before and while* the work happens, and sources accumulate as a count, so the person has something to look at during a long wait. Not taken: both stream model-written reasoning text; ours is a recorded state change with templated captions and verbatim source words, never model prose. Also a caution: running logs of steps are exactly the "lots of chrome" the user dislikes, so ours is one caption.
5. **Explorable explanations and Distill's "Why Momentum Really Works"** (S; both page fetches failed, so only what the search results said). https://flowingdata.com/2017/04/20/why-momentum-works/ (the page I saw summarised) and https://distill.pub/2017/momentum/. Took, from the search summary: the explanation is in the interaction, where the reader changes something and sees the consequence. For us the equivalent is tap an atom, see its source, step the tape with the scrubber, and jump between sentences in step 8, rather than watch a fixed-speed animation.
6. **spaCy displaCy** (not verified: the fetch failed and I did not search it). I reference it only as the familiar pattern of labelled spans over a sentence (entity and dependency views), which is the SEG look the user already likes. I took nothing from it in this note that I could not take from the existing SEG frame itself.

---

## 11. Open questions for the user

1. Is it acceptable that the playback's step count drops from nine to seven screens (the nine ticks stay on the scrubber, so nothing is lost for anyone replaying)?
2. Should "set aside as off-topic" results be visible at all in the default view, or only on tap? The note assumes a collapsed row.
3. For answers with no model (slot asks), do you want step 6 to disappear or to say "read straight from the page"? The note assumes the second.
4. The tape grows by roughly 15 to 20 KB per turn if `ctx` neighbours and `fz` are stored; is that acceptable for stored conversations, or should `ctx` be fetched through `/reopen` only?
