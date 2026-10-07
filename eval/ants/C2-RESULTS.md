# C2 — "voices on this question", quotes only: results (2026-10-06)

Pre-registration: `eval/ants/C2-PREREG.md` (written before any run; Amendment 1 before run 1 — the shared `bearsOn` was tightened under me by someone else at 15:46; Amendment 2 after run 1 — a cache defect). Nothing below moved a bar.

## What exists
* `fold-chat-voices.js` (pure; no model, no IO; the canon is injected) + `fold-chat-voices.test.mjs` (34 tests, all pass). `voicesFor({question, candidates, thinkers, canonOf})` returns
  `{ voices:[{ handle, giver, quote, source:{ path, sha256, work, section, start, end }, frame }], line, why, considered, calls:0 }`; `verifyVoices` re-checks a result against the canon; `renderText` prints it.
* Rule: B1's `classify().candidates` (top-5 speaking thinkers) in B1's order; for each, a sentence of the thinker's canon that carries ALL of the question's content stems (<= 2 stems; ceil(2n/3) of more), passes the SHARED
  `bearsOn` and the SHARED `verifyNumber` (driven by an app-chosen number, not a model), and the extra declared filters; first three that yield a sentence are kept and shown ALPHABETICALLY (not in B1's order: that would read as a ranking).
  Frame `Here is what <giver> wrote that bears on this:` for 8 canons that are the thinker's own writing, `Here is what <giver>'s canon records that bears on this:` for the other 16. Line: `Several voices bear on this. These are their own sentences, quoted exactly; I have not paraphrased any of them and I am not saying which is right.` (one voice: `One voice bears on this ...`; none: nothing).
* Wiring helpers (NEW files, also unwired): `fold-chat-voiceswire.js` (page: default-OFF switch, checks a server reply against the templates, draws it as data), `fold-chat-voiceshost.mjs` (server: reads the profile and canons, sha256-checked, `ask(q)`), `fold-chat-voiceswire.test.mjs` (6 tests, pass).
* `eval/ants/c2/`: `c2-eval.mjs` (the real run), `c2-mutate.mjs`, `C2-judgements.json` (my F/W/X labels), the two runs' results and listings, `wire.diff` (NOT applied; `patch -p1 --dry-run` is clean against the tree as of 15:55).

## The real run (B1's 12 questions + 6 controls; REAL `classify()` over the REAL `voice/thinkers-profile.json`; REAL canon files from disk, 19 files, 29.1 MB, sha256 verified; no model, no network)
Rendering for "Is there a God?" (strict arm, data -> text): line, then Sri Ramakrishna / Swami Vivekananda / W. G. Aston, each as `frame`, the exact sentence in quotation marks, and `work, section (path, characters a–b)`.

| claim (bar) | result |
|---|---|
| **C2-a no fabrication** (100% of shown quotes found by an independent oracle: fresh read, fresh hash, `indexOf`, offsets slice back) | **MET: 34/34 strict, 43/43 loose** (incl. controls); `verifyVoices` ok 18/18 per arm |
| **C2-b no model** (0 calls) | **MET**: the module takes no model; `calls` 0 in every result; a test poisons `fetch` and it is never touched |
| **C2-c count** strict >= 2 voices for >= 6 of 12 | **MET: 10/12** (Q4 "Is suffering necessary?" and Q7 "Is it wrong to lie?" got 1 voice each). Loose arm: 12/12. Every question got >= 1 voice. |
| **C2-d on topic** (hand-judged; F >= 70%, X <= 10%) | **FAILED: strict F 11/31 = 35%, W 11 (35%), X 9 (29%).** |
| **C2-e controls** (<= 1 of 6 speak, strict) | **MET (barely): 1/6** — "boiling point of water" got Kanada/Scheherazade/Ramakrishna (W, X, W). Loose arm: 3/6 speak (7 quotes, all X or W). |
| **C2-f display contract** | **MET** (tests + verifyVoices on every real result): <= 3, short givers (no digit/paren, <= 30), alphabetical, line names nobody, frame/line = templates |
| **C2-g cost** | run 1 **FAILED** (warm max 44 s: counsel's 4-entry index cache thrashes on a 5-candidate question and the 8.3 MB Complete Works was re-indexed each time); after Amendment 2 (own 24-entry cache), run 2: **warm median 0.58 ms, max 9.7 ms; first-call (cold canon) median 126 ms, max 4.1 s** (Q1, which indexes Ramakrishna 2.9 MB + Vivekananda 8.3 MB + Aston + Grotius). Reading the 19 files from disk: 140 ms (not in the per-question figures). Run 2's voices are identical to run 1's (checked) |
| **C2-h mutation** | 40 mutants, **37 killed**; the 3 survivors are layered equivalents whose PAIR mutants are killed: `bearsOn` alone (verifyNumber re-checks it), `verifyNumber` alone, final `slice(0,max)` (the loop cap holds it). The all-stems rule, strict switch, 2/3 rule, hash refusal, slice check (needs a same-hash-same-length-same-head-and-tail canon), digit/question/lowercase/thin-sentence filters, frames, lines, name shortening, order, dedupe, and every `verifyVoices` check are each killed |

**Verdict (rule fixed in the pre-registration): safe, not on topic.** It never invents (34/34 + 43/43 verbatim, offsets right, hashes right) and needs no model, but only about a third of what it shows bears on the question, and ~30% would mislead
under the thinker's name. "Ship only behind a human-verifiable affordance, or not at all." I would not turn it on as the display of an `undetermined` contested question as it stands. It is wired default-OFF in the proposal.

## What the 31 strict quotes were (hand-judged, one reader, an LLM — `C2-judgements.json`, labelled from the printed listing with 170 chars of context each side, before tabulating)
* **F (on topic, the thinker's contribution): 11** — Vivekananda on a creator God (Q1), Xunzi on justice (Q2), Xunzi "treats enemies as friends" (Q3), Vivekananda "change even the most wicked persons into saints" (Q5), Mozi and Xunzi on the ruler (Q6),
  Ramakrishna "I cannot cure my own illness, and you ask me to tell you what happens after death!" (Q8), Vyasa on the Self (Q9), Grotius on obligation and law (Q10), Grotius "whether any war is just" (Q11), Xunzi on virtue (Q12).
  10 of 12 questions got at least one F; only Q6 got two. Q4 and Q7 got none.
* **W: 11** — the question's word without its topic, or somebody else's sentence (an editor, a commentator, a narrator, a quoted opponent).
* **X: 9** — wrong sense of the word: "lie" = rest (Middlemarch), "law of causation", "war ... ever" in a Yoruba chronicle, "treat them as enemies" of crocodiles (Herodotus, filed under Solon), "suffering" in an editor's biography of Grotius, an ox changed for a sheep (Q5), "after" death = inheritance (Q8).
* By canon type (a finding): the 8 canons that are the thinker's own writing gave 9 F of 19 (47%); Xunzi alone 4 of 4. The 16 "records" canons gave **2 F of 12 (17%)**. Narrative and chronicle files (Herodotus, Johnson's Yorubas, Middlemarch) contributed 0 F of 5.
* **The "their own sentence" claim is false for about a third.** At least 10 of the 31 sentences are not the giver's: Nikhilananda's introduction (filed under Ramakrishna), Legge's notes (Confucius, twice), Stcherbatsky's exposition (Nagarjuna), the editor's biography of Grotius (even under the "wrote" frame), Herodotus's narration and Gelon's speech (Solon, twice), Johnson (Arokin, twice), a warring lord quoted by Motse. The profile's source is a whole book, and a book holds editors, commentators and other speakers. The frame "X wrote" is then a false attribution (once, with the Grotius biography, even in the 8 canons I treated as own-words), and "X's canon records" is the most that is true. The module cannot tell; it would need typed speaker/section data (the khora reader) or the thinker's own section offsets, which the profile does not have (Solon is NOT restricted to Herodotus I; Grotius NOT to I.1.3).
* `section` is the nearest heading-like line above the quote: present for 31/31, and by my reading a real chapter or heading for about 24; 7 are running heads or OCR junk ("& 3E IS", "THE WOEKS OF MOTSE", "326 THE HISTORY OF THE YORUBAS"). It is an address aid, not a claim.

**LOOSE arm (comparison only; `bearsOn`'s half-the-stems rule alone):** 12/12 questions with >= 2 voices, 36 quotes: F 9 (25%), W 13, X 14 (39%); the 8 quotes it adds beyond the strict arm are F 0, W 2, X 6 (OCR garbage "Tlien lie will Lave to admit" as a lie, a book review). Controls: 3/6 speak, all X/W. The all-stems rule is what separates them and it is worth keeping: it cost 2 questions their second voice and removed 6 X.

## What falsified me (predictions written before the run)
* Predicted F 45–60%; it is **35%**, worse than the bar I predicted I would miss. Predicted strict >= 2 voices for 5–8 of 12; it is 10 (the two-stem questions did better than I feared: Grotius, Solon, Xunzi all carry "treat ... enemies").
* Predicted controls 1–2 speak; 1 (met), but that one was about water boiling in a cauldron and a joke about Dr Sarkar.
* Predicted loose 12/12: right. Predicted costs: not predicted for the cache defect; run 1 failed C2-g for a reason I had not looked at (counsel's 4-entry cache).
* B1's candidates do not need to be the problem: for 10 of 12 questions at least one candidate gave an on-topic sentence. The problem is that the module shows the first three that yield ANY sentence, in B1's order, with no way to know which of them bears on the question (lexical match only).

## Things that moved under me (disclosed)
* 15:46: another session changed the shared `bearsOn` in fold-chat-provenance.js (half the claim's content stems must be shared). My strict arm is almost always stricter than that; the loose arm is now "half the stems". Provenance sha256 at the run: `344defc3...cb92` (recorded in each results file with the other module hashes).
* While I ran, a background mutation run overlapped another one writing the same temp filename and produced a spurious "survived" table; I made the runner use a per-process filename and re-ran it clean (the table above is the clean run).

## Proposed wiring (`eval/ants/c2/wire.diff`, NOT applied; also needs the new files above in the tree)
* `server.mjs`: `GET /fold/api/voices?q=` behind the existing loopback Host wall; answers `voicesHost.ask(q)` as JSON. Smoke-tested by me on a patched COPY with symlinks: Q1 returned 3 voices in 4.4 s cold, Q2 3 voices 0.4 s, a nonsense ask 0 voices in 2 ms; the page-side check accepted all of them.
* `fold-chat.js`: import the page helpers; after the provenance step, if `voicesEnabled()` (localStorage `fold-chat:voices` = `on`, default OFF) and the turn is research/chat/advice and the answer was not app-authored, ask the server (silence on any failure), store `voices` on the assistant message beside `provenance` (3 sites), draw it with `renderVoices` under the answer line. The page cannot re-check the quote against the canon (it cannot read it); the stored record carries path/sha256/offsets for that.
* `index.html`: five CSS rules next to `.prov`.
* Caveats the boss must weigh: (1) the canon files live in the sibling eo-teachings checkout, so this works only where that exists (the profile's paths are relative to the directory above the checkout); (2) the bank in `voice/voice-bank.json` has only 13 archons and no question-targeted sentences, so a no-server page version is not possible without a build-time per-question index; (3) the line numbers in fold-chat.js shifted by ~25 during my work — re-anchor on the strings, not the numbers.

## What I did NOT do
Apply any wiring; test in the real browser page; restrict any thinker to a section (no offsets exist); choose among candidates by topical quality (the obvious next step: score each candidate's sentence by sense, prefer own-words canons, drop sentences by editors/commentators — needs typed speakers); use a second judge (the labels are one LLM reader's); run a model anywhere; measure recall of thinkers B1 does not list; stem-sense disambiguation ("lie", "just", "self"); repeat the run on other questions (a second set would tell whether 35% generalises; 12 questions, one reader).
