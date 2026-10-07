# ANT C2 — "voices on this question", quotes only: pre-registration (2026-10-06, written BEFORE any run of the module on the 12 questions)

Before this file I read: eval/ants/README.md, B1-PREREG.md (+ B1-run2-test-output.txt, the 12 questions and B1's candidate lists), B3-PREREG.md + B3-judgements.json, fold-chat-counsel.js, fold-chat-thinkers.js,
fold-chat-provenance.js (bearsOn / verifyNumber / looksLikeSentence), voice/thinkers-profile.json (givers, works, sources, sha256), voice/voice-index.json. I have run NOTHING of the new module on any question.
I have not looked at what sentences the canons hold for the 12 questions (B1 printed only 5-word fragments).

## The product rule (the user's, relayed by the boss)
For a contested ask ("Is there a God?") the chat finds the thinkers who thought about it and shows each one's OWN verbatim sentence from their real canon, with an app-written frame
("Here is what <giver> wrote that bears on this:") and provenance (canon, work, section, offsets). NO model paraphrase (B3: only 72% of tied assertions faithful, 4 X, the lexical gate accepts 7/9 one-word meaning
flips). The question is `undetermined` on B1's calibrated bar for all 12, so the display says "several voices bear on this", never one winner. At most 3 voices; short giver names; only B1's candidates;
nothing if no passage bears on the question; never invent.

## What is built (declared, not measured)
`fold-chat-voices.js`, pure, no model, no DOM, no IO (the canon is injected as text or as bank rows):
* `voicesFor({ question, candidates, canonOf, fw })` -> `{ voices:[{ handle, giver, quote, source:{ path, sha256, work, section, start, end }, frame }], line, why, considered:[...] }`.
* candidates = B1's `classify().candidates` (top-5 speaking thinkers by posterior), in B1's order; the module walks them and keeps the first three that yield a passage.
* **Passage rule (STRICT, the shipped default)**: a sentence of the thinker's canon (counsel's `indexCanon`: whole sentences, 25-320 chars, scan debris refused) that carries ALL of the question's content stems when the question has
  <= 2 of them (>= ceil(2n/3) when it has more); that passes the SHARED `bearsOn(question, sentence)`; and that passes the SHARED `verifyNumber` driven by a MECHANICAL number (the app, not a model, picks the number; the quote is then
  the canon's slice by construction). Ranked: more of the question's stems, then nearest 12 content stems (a lone four-word line says little), then earliest. The extra sentence filters are listed below (declared).
* **LOOSE arm (comparison only, never shipped as default)**: `bearsOn` alone (>= 1 shared stem), same ranking.
* Order of the displayed voices: ALPHABETICAL by short giver name, not B1's posterior order (an order by posterior would read as a ranking, and B1 says no thinker stands out).
* Frame: `Here is what <giver> wrote that bears on this:` for a thinker whose canon is their own writing; for a canon that RECORDS or REPORTS the thinker (Gospel of Ramakrishna by M, Solon in Herodotus, Johnson's Yorubas,
  Sima Qian on Laozi, Candrakirti on Nagarjuna, the Nights, the Prose Edda, Dignaga as quoted) the frame is `Here is what <giver>'s canon records that bears on this:` — "wrote" would be false there. Declared handle table in the module.
* Line (>= 2 voices): `Several voices bear on this. These are their own sentences, quoted exactly; I have not paraphrased any of them and I am not saying which is right.` One voice: `One voice bears on this ...`. None: `""` and `voices: []`.
* Short giver: a declared table of the 24 speaking handles (e.g. "Sri Ramakrishna", "Confucius", "Mozi"); any other handle falls back to the profile giver with every parenthesis and everything after a comma removed.
* "Section" = the nearest heading-like line above the quote (a short line, bounded by blank lines, ALL CAPS or starting Book/Chapter/Part/Section/Canto/Sutra/Fragment/Lecture/Letter), or `null` when none. DECLARED
  heuristic, reported with its hit rate; the `work` label from the profile is always given. The thinker's "own section" is the source file the profile hashed (sha256 verified before use; a differing file is refused). I do NOT
  restrict Solon to Herodotus Book I or Grotius to Book I Ch. I (no offsets for those exist in the profile) — a stated limit; a person judging will see it.
* Extra sentence filters (declared before the run, from reading counsel's `okSentence` and B3's X cases only): >= 4 content stems; no digit run longer than 3; not a question; not opening with a lowercase letter. Nothing else.
* verifyVoices({ result, canonOf }): an independent check (every quote is canon.slice(start,end); sha256 of the file equals the profile's; frame and line are the app's templates, re-rendered; <= 3; sorted; no model text).

## The 12 test questions (B1's, frozen) and 6 CONTROLS (frozen now)
1 Is there a God? · 2 What is justice? · 3 How should I treat my enemies? · 4 Is suffering necessary? · 5 Can a person change? · 6 What is a good ruler? · 7 Is it wrong to lie? · 8 What happens after death? ·
9 What is the self? · 10 Why obey the law? · 11 Is war ever just? · 12 What is virtue?
Controls (not contested, a lookup or nonsense; nothing should be said in a thinker's name): "What is the capital of France?" · "How do I reset my router password?" · "Who won the 1998 World Cup?" ·
"What is the boiling point of water?" · "How many ounces are in a pound?" · "asdf qwerty zxcv".
Candidates for every question come from the REAL `classify()` with the REAL `voice/thinkers-profile.json` (B1's shipped calibration); canons are the REAL files, read from disk, sha256 checked against the profile.

## Claims (each can be refuted; a failure is reported as a failure)
* **C2-a NO FABRICATION (hard).** An oracle independent of the module (re-reads each canon file, re-hashes it, finds the quote by `indexOf`, checks the offsets slice back to the quote) passes 100% of shown quotes (both arms).
  One quote that is not a substring of its canon, or whose offsets do not slice back, fails the atom.
* **C2-b NO MODEL (hard).** `voicesFor` takes no model, no network and no clock; calls to a model = 0, asserted by a test that passes a throwing global fetch/Proxy for any such argument, and by inspection of the signature.
* **C2-c COUNT.** STRICT arm: >= 2 voices for at least 6 of the 12 questions (prediction: 5 to 8; the strict all-stems rule will starve the two-stem questions 3, 4, 5, 8, 11). LOOSE arm: >= 2 voices for >= 11 of 12 (prediction 12).
* **C2-d ON-TOPIC (hard, human).** Every shown quote of the STRICT arm is read by me (an LLM; there is no independent judge) and labelled, BEFORE tabulation, in the listing: **F** = the sentence itself speaks to the topic of the question in the sense asked
  (a person reading it as that thinker's contribution would say "yes, that bears on it"); **W** = on the question's WORD but not on its topic or sense, or a narrator's/editor's/another speaker's sentence rather than the thinker's;
  **X** = misleading in the thinker's name (wrong sense of the word, garbled scan, a reversal, an obviously unrelated sentence). **BAR: F >= 70% and X <= 10% of shown quotes.** Prediction: F about 45-60% — the bar FAILS — because "lie" (recline),
  "just" (merely), "self" (compounds), "change" (coins) and the huge narrative canons (Herodotus, Yorubas, Nights) supply word hits, not answers. The LOOSE arm's extra quotes are judged the same way and reported next to it (prediction: lower F than strict).
* **C2-e CONTROLS.** <= 1 of the 6 controls shows any voice (STRICT arm). Prediction: 1 to 2 show something (water/pound/capital are common canon words); a hit is listed and judged, not hidden.
* **C2-f DISPLAY CONTRACT (hard, tests).** <= 3 voices; every voice's giver is short (<= 30 chars, no digit, no parenthesis); the line never contains a candidate's name or the words "best", "most", "winner"; voices are alphabetical; an
  undetermined question's line says "Several" (or "One" for a lone voice), never a name; zero voices -> empty line. The renderer output equals the module's templates (verifyVoices).
* **C2-g COST.** Per question with the canons already read (warm index): median <= 50 ms, max <= 250 ms; with a COLD index (first question after the process starts, whole Complete Works of Vivekananda is 8.3 MB): reported, bar <= 8 s for the
  worst question. Model calls: 0. (Reading each canon from disk is the host's cost, reported separately.)
* **C2-h MUTATION.** Each gate of the module (all-stems rule, bearsOn, verifyNumber, substring/offset check inside the module, max-3 cap, alphabetical order, the "records" frame for non-own canons, the "Several" line, sha refusal) is deleted in turn; the unit tests must fail for each.

## Verdict rule (fixed)
"Ship as the display of an undetermined contested question" iff C2-a, C2-b, C2-f, C2-h hold AND C2-d (F >= 70%, X <= 10%) holds. If C2-a/b/f/h hold but C2-d fails: "safe (never invents) but not reliably on topic: ship only behind a human-verifiable
affordance, or not at all". C2-c and C2-e are reported either way.

## What will NOT be measured (declared now)
Whether a quote is the BEST sentence a thinker has on the question; whether a thinker would have agreed with the framing; any other candidate source than B1's top-5 speaking thinkers (so a thinker B1 does not list, even if
the canon is full of the topic, is never heard: recall of the whole canon set is not measured); translations; a second human judge; any model, since none is called.

---
## Amendment 1 (written 15:50 local, BEFORE any run on the 12 questions; nothing of the real data has been seen)
While building the unit tests, the SHARED `bearsOn` in fold-chat-provenance.js changed under me (file mtime 15:46, not by me; I may not edit it): it now also requires the sentence to share at least HALF (rounded up) of the
claim's content stems (fw-based, so it counts "how", "ever", "just" that B1 treats as closed class). Provenance file sha256 at the time of the run: 344defc3d3ab157a2ab0030429c5a8a32110de1e8476cef55e803dacb6d6cb92.
Consequences, declared now: (1) the STRICT arm (all of B1's content stems) is almost always stricter than the new bearsOn, so its numbers should not move; (2) the LOOSE arm is no longer "one shared stem" but "bearsOn's half rule";
it stays a comparison arm only; (3) the claim "bearsOn removed alone / verifyNumber removed alone survive" (layered equivalents) is expected, the PAIR mutant must be killed. The run records the provenance file's hash.
Nothing else in this document changes.

---
## Amendment 2 (written AFTER run 1 of the 12 questions; run 1's files stay untouched as the registered result)
Run 1 (eval/ants/c2/C2-results-2026-10-06T20-51-32.json) failed the COST claim C2-g: counsel's `indexCanon` cache holds 4 canons and a question asks up to 5, so the 8 MB Complete Works of Vivekananda was re-indexed on almost every
question (warm max 44 s). That is a defect in what I used, not a measurement of the rule. Change: fold-chat-voices.js keeps its own cache of 24 indexes (key: hash|length|head|tail; a hit is only a speed-up, because `findVoice` still
demands the canon's own slice for every sentence, so a stale hit yields nothing, never a wrong quote; a test hands it a same-hash same-length same-head-and-tail canon). The sentence choice is unchanged: run 2 must reproduce run 1's
voices exactly (I check equality of the quotes), and only the timing differs. Both runs are reported. No bar was moved.
