# C6 results — fetched voices (VOICE.md stage 5), 2026-10-06

Built (new files only): `fold-chat-fetchedvoice.js` (pure module), `fold-chat-fetchedvoice.test.mjs` (34 tests), `eval/ants/c6/` (battery, holdout, reader with Node fetch + Playwright fallback, eval, adversarial probe, live demo, mutation runner, `wire.md`), `eval/ants/C6-PREREG.md`. No model is used anywhere in the decision. Nothing was edited that another lane owns; nothing was git-added.

## False accepts first

| battery | traps | false accepts (full classifier) | which |
|---|---|---|---|
| battery.json, run 1 (pre-registered rules, unmodified) | 10 | **0** | none |
| battery-holdout.json (fresh, labelled before it was fetched; final module) | 5 | **1** | **H6: history.com's article ABOUT the Gettysburg Address, read as Lincoln's own words** (tier `heading`, first-person 14.1/1000 from the quoted speech, surname rate 9.8/1000 but he/she 13/1000 < 2x first-person, so no rule fired) |
| adversarial probe (title cue and author meta removed from the 13 traps with HTML) | 13 valid | **2** | **T3, the AI-content hub ("The Wisdom of Marcus Aurelius ... for Modern Life")**, held out in run 1 ONLY by the title cue; and H6 again. (T10 also shows as a leak in the probe, but that is an artefact: the probe writes the person's name into the title of another person's page. Ignore it.) |

So: the classifier is not safe against (a) a page about a speech that quotes it, on an unremarkable host, and (b) an AI/SEO hub with a neutral title and an inclusive "we/our" voice. Both enter on the weak `heading` tier (the person's name in the title/opening). The module's own surname-rate and he/she rules do not separate them from genuine speeches on this data (genuine accepted pages have surname rates up to 3.6/1000; H6 has 9.8, a gap, but a threshold fitted to H6 would be fitted to the one trap I have; not applied). Proposed gate: heading-tier pages need a second independent host or an archive-class host (`wire.md` section 4).

## Pre-registered claims, run 1 (module snapshot `c6/fetchedvoice-run1-snapshot.js.txt`, output `c6/run1-output.txt`, `results-run1.json`)

Confusion matrix, full classifier (rows truth, columns verdict):

|  | own | unsure | refuse | unreadable |
|---|---|---|---|---|
| genuine (10) | 5 | 0 | 5 | 0 |
| trap (10) | **0** | 0 | 10 | 0 |

| claim | verdict | evidence |
|---|---|---|
| F1 false accepts <= 1 of 10 (target 0) | **held, 0/10** | all 10 refused, reasons: tertiary host (Wikipedia), quote-farm host, title cue (AI hub, SEO listicle), mirror host (fandom, wikiquote), `author_is_other` (SEP: Kamtekar; Boswell for Johnson), encyclopedia host (Britannica), `no_attribution` (cross-person Jefferson on Washington's text) |
| F2 true accepts >= 6 of 10 | **REFUTED, 5/10** | misses below |
| F3 features-only arm <= 2 false accepts | held nominally (0), **for the wrong reason** | the arm rejected Wikipedia/Wikiquote/fandom/Britannica/brainyquote because a JSON-LD author "Contributors to Wikimedia projects" (and "Cloudflare Privacy") looked like another person. That is luck, not text features; the corrected ablation below shows the true leak |
| F4 host-table-only arm >= 4 false accepts | held, 5/10 | T3 AI hub, T4 SEO listicle, T6 Stanford Encyclopedia (.edu), T8 Boswell (Gutenberg), T10 cross-person: host class alone admits all five. Host standing is not authorship |
| F5 provenance round-trip | held | sha256 of the stored text matches on 5/5 accepted pages (later runs: 9/9 and 6/6); every banked sentence slices back verbatim by its offsets (3323/3323 and 2205/2205 on the real accepted pages; plus unit test) |
| F6 integration with fold-chat-voice.js | held (one smoke case) | a fetched voice goes through `buildIndex` / `resonance` (ranked first, p-null path unchanged) / `quoteFromBank`, returns a verbatim quote whose offsets slice back to it |
| unreadable <= 4 of 20 | held, 0 unreadable | all 19 URLs read; 5 needed Playwright (JFK Library, brainyquote, fandom, Britannica, quotefancy). **brainyquote returned a Cloudflare shell** ("Just a moment..."): the read counts as ok, so that page's text features were never really tested (the host rule refuses it anyway) |

Run-1 misses (all five in the safe direction): G4 Washington and G6 King (title says "Washington's Farewell Address" / "[King, Jr.]": my heading rule required a given name, so no attribution); G7 Paul Graham (a "by Y Combinator" ad link in the page read as another author); G9 Orwell (the page's JSON-LD author is "Eric Blair", his real name: a pen name is another person to a mechanical check); **G8 Einstein/Monthly Review (a battery error: the page serves 89 words of chrome and no essay text; refusing it was right and my label was wrong. Kept as labelled; without it genuine recall is 5/9)**.

## Post-hoc revision (labelled; the evidence is the holdout, not this)

The addendum in `C6-PREREG.md` lists v2: line-anchored byline, `genre_heading` tier, `{ name, aliases }`, organisation/boilerplate authors are not "another person", a 4th ablation arm `features_blind`. Three more fixes came from writing tests (all disclosed): the byline regex was case-sensitive and spanned newlines; `tp >= 2*fp` fired when both were 0; Wikisource (which VOICE.md names as a source) was dropped by fold-chat-primary.js's "any wik* host is a mirror" rule (found live) so the module allow-lists `wikisource.org`. NOTE on fitting: the organisation-word list gained "contributors/privacy/cloudflare/wikimedia/combinator" after I saw run 1 (fitted names, small but real). The two I had also added (superlore, capcut) were removed again before the holdout as pure battery-fitting.

Same battery, v2 final (NOT evidence, refit): genuine 9 own + 1 unsure (G8) of 10; traps 0/10 false accepts. Ablations on it: hosts-only 5 false accepts; **features-only 2 (T5 fan wiki, T7 Wikiquote); features-blind 3 (adds T6, the Stanford Encyclopedia)**. So the corrected F3 reading: without the host tables the text features alone leak (a fan wiki and a quote compilation in prose, no quotation marks, read as first-person). The safety is the host tables and the author/title evidence TOGETHER with the pronoun/person statistics; neither half is enough alone.

## The held-out run (the one that counts; `holdout-output.txt`, final `final-holdout-output.txt`, `results-final-holdout.json`)

Battery-holdout (5 genuine, 5 traps) was labelled before it was fetched and classified once by v2; the later fixes changed none of its 10 verdicts.

|  | own | unsure | refuse |
|---|---|---|---|
| genuine (5: Darwin, Paine, Franklin on Gutenberg; Churchill on winstonchurchill.org; MLK speech on americanrhetoric.com) | **5** | 0 | 0 |
| trap (5) | **1 (H6)** | 0 | 4 (biography.com by `author_is_other`; IEP Nietzsche by `biography`; quotefancy by host; Darwin's Origin offered as Wallace's voice by `author_is_other: Charles Darwin`, even though the text names Wallace) |

H-F1 (<= 1 false accept) held at the limit, target 0 missed; H-F2 (>= 3 of 5) held 5/5; H10 cross-person refused; **H6 about-a-speech NOT refused (claimed it would be: refuted).** Hosts-only on the holdout: 4/5 false accepts.

Final module over everything pre-registered or held out: 14 of 15 genuine admitted (the 15th, G8, is a bad page), **1 of 15 traps admitted**. Wide error bars: 15 traps cannot bound the false-accept rate below about 20 percent; this is a falsification battery, not a rate estimate.

## Live, the whole path (`live-output.txt`; real search through the chat's own web search, Node fetch + Playwright, classify, bank; not hand-labelled, not pre-registered)

* Frederick Douglass: 1 admitted (Gutenberg 23, the Narrative, he wrote it); Wikisource and Wikipedia-class hits refused unread; two archive.org biographies refused (`third_person_about`, `biography`); a Gutenberg book by Charles Chesnutt about him refused (`author_is_other`).
* Rachel Carson: 0 admitted. Silent Spring on archive.org refused (`quote_farm:attribution_lines_7`: an OCR djvu text with `— Name` epigraph lines, a **false refusal**) and another copy `unsure` (impersonal expository prose: fp 1.8/1000). The mechanism is silent where an author's voice is third-person; that is the intended safe direction but it is mute for essayists like Carson.
* Seneca: 3 to 4 admitted per run (Gutenberg, Wikisource "Of Peace of Mind", two archive.org texts); one archive.org Loeb volume is bilingual and banks Latin sentences (no language filter yet); a "Stoic Philosophy of Seneca" secondary book refused by title cue; a Wikisource page-scan refused. I eyeballed the URLs only; I did not read every admitted text.

## Tests and mutations

`node --test fold-chat-fetchedvoice.test.mjs`: 34 pass. `node eval/ants/c6/mutate.mjs`: **36 of 36 mutants killed** (host drop, wikisource allow-list, quote-farm list x2, pre-read skip, title cues, author_is_other, org words, given-name requirement, line-anchored byline, quote share, attribution lines, biography, third-person and its zero guard, no_attribution, fp threshold, unsure tier, heading-only refusal, platform gate, host_is_person, genre_heading, heading given-name, too_short, sha256 of stored text, bank.admit x2, verify, sentenceBank x2, rankHits x2, maxPages, AbortError, Gutenberg strip, alias). Three mutants initially survived (pre-read host skip, byline anchor, letters ratio); the tests were weak, not the gates; fixed and re-run.

## What failed / is open

* **H6 and the neutral-title AI hub are false accepts waiting.** The only defence is the weak `heading` tier plus statistics. Proposed fix (second host or archive-class host for heading-tier pages) is NOT built or measured.
* Mechanical author evidence is brittle both ways: a pen name or ad link produces refusals (safe), an org byline is treated as non-person (a stance, not a measurement).
* The classifier is English-only in its cues; essayists without first-person voice (Carson) are refused.
* `terms` of a fetched voice are a term-frequency stand-in, not the canon's concern-field recipe, so resonance against fetched voices is not on the canon's scale ("same recipe, same null" is unmet).
* The page cannot use html author evidence unless the reader returns HTML; in the browser (relay text) author markup degrades to Gutenberg headers and `By X` lines.
* Not done: no wiring (fold-chat.js / fold-chat-voice.js untouched: `wire.md`); no check of licence beyond a host-based string; no persistence; no small-model pointing aid (not needed; none used); no second fresh holdout for the heading-tier fix.
* Accident to disclose: a malformed zsh redirect truncated `battery.json` and `battery-holdout.json` to 0 bytes after runs 1 and 2; I restored them from `results-run1.json` / `results-holdout.json` (id, label, person, url, kind are identical to what the runs read; the `written` provenance note was reworded and says so). The labels were written before any run and are unchanged in the saved result files.

Files: `/Users/mlacy/Documents/3.0/the-fold/fold-chat-fetchedvoice.js`, `/Users/mlacy/Documents/3.0/the-fold/fold-chat-fetchedvoice.test.mjs`, `/Users/mlacy/Documents/3.0/the-fold/eval/ants/C6-PREREG.md`, `/Users/mlacy/Documents/3.0/the-fold/eval/ants/c6/` (wire.md, battery*.json, results-*.json, *-output.txt, cache/).
