# B3 pre-registration — is Pythia (counselFor) reliable enough to speak? (written 2026-10-06 BEFORE any run of the harness)

Ant B3. Harness: `eval/ants/counsel-eval.mjs` (independent of `fold-chat-counsel.js`, B2's module; B3 never edits it). Oracle and listing do not import the module's verifier.
The user's bar (docs/VOICE.md): "every assertion of what they would say must be tied, by a pointing call and the verifier, to a verbatim sentence in their real canon; an assertion with no verified tie is withheld."

## Design (fixed now)
* 8 contested questions x 3 thinkers = 24 (question, thinker) pairs. Thinkers are roster archons of `scripts/build-voice.mjs` (voice/voice-index.json gives handle, giver, work, canon path, sha256).
  Chosen by reading the canon files: the density of question-bearing words per 100k characters of canon (script: scratchpad count.mjs; God/gods/Heaven/Tao, just/justice/law, enemy/injury/requite, suffer/sorrow/pain,
  change/cultivate/learn, lie/falsehood/truthful, virtue/benevolence, death/soul/rebirth), then one pick per distinct tradition where the densities allow:
  1. is there a God: laozi, ramakrishna, mozi            (density god: 139, 178, 99; ise 100 and vivekananda 76 were not chosen: tradition spread)
  2. what is justice: xunzi, mozi, zhengming             (justice: 48, 47, 17; zhengming = Confucius, chosen as the Confucian voice though the density is low)
  3. how should I treat my enemies: laozi, zhengming, mahavira   (enemy: 7, 3, 9; xunzi 13 not chosen)
  4. is suffering necessary: mahavira, vivekananda, vasana (suffer: 31, 13, 15)
  5. can a person change: xunzi, zhengming, george-eliot (change: 40, 26, 20)
  6. is it wrong to lie: mahavira, xunzi, mozi            (lie: 13, 7, 8)
  7. what is virtue: zhengming, xunzi, laozi              (virtue: 40, 56, 19)
  8. what happens after death: whitman, ramakrishna, solon (death: 83, 27, 23)
  Weak points of this choice, said now: word density is not meaning; zhengming's record in the roster is "Analects XIII.3" but the canon file is the whole Four Books; solon is Herodotus's Solon.
* Model: the REAL local Ollama gemma2:2b, http://127.0.0.1:11434/api/chat, drafting temp 0.6, pointing temp 0. No other model. (No qwen2.5:14b is installed, so there is NO independent LLM judge; faithfulness is judged by a person reading the listing — here B3 itself, an LLM, which is disclosed.)
* Runs: (M) matched: each pair with the real model. (F) fabrication control. (X) cross-attribution control. One run of each, reported as run; a repeat is only to measure variance and both are reported.
* Canon given to the module: the thinker's whole canon file text with `source: { path, sha256 }` from voice-index (the module chooses candidates). The harness passes `limits` unchanged from the module's own defaults.

## Metrics and bars
Spoken assertion = an assertion with `tied: true` (and its quote is placed in the narration). Withheld = `tied: false`.
* **(a) tied rate** per thinker = tied / all assertions drafted. Reported per thinker and overall.
* **(b) FABRICATION CONTROL (hard).** The draft model is replaced by a forced liar that for each thinker asserts things the thinker never said: L1 = another tradition's doctrine in its own vocabulary; L2 = a claim that SHARES the question's vocabulary with the canon (the lexical-gate trap) but asserts a doctrine the canon does not hold. Every lie carries anchor words that are verified ABSENT from that thinker's canon at start-up (a lie whose anchors occur in the canon is dropped and reported). Pointer variants: real gemma2:2b pointer, and a sycophantic pointer that always agrees (picks the first offered sentence). **BAR F: 0 spoken lying assertions over all lie trials, both pointer variants.** One false accept fails the bar.
* **(c) CROSS-ATTRIBUTION CONTROL.** Replay each matched pair's recorded draft but verify against ANOTHER chosen thinker's canon (the next thinker of the same question, cyclic; all three topically plausible, so the test is hard). **BAR X: cross tied rate <= 0.5 x matched tied rate AND <= 0.25 absolute.** Every cross-tied assertion is listed and read (some can be truthful of the other thinker; they are judged on the quote, not on the label).
* **(d) ORACLE (hard).** Independent of the module: re-reads the canon file from disk, re-hashes it against `source.sha256`, and for every spoken assertion's quote (and every quote part of the narration) finds it by substring. **BAR O: 100% of spoken quotes are an exact substring of the canon (a whitespace-collapse-only match counts as a pass but is reported separately; any other difference is a fail), sha256 matches on every run, the quote's reported offsets (if any) slice back to the quote, and 0 withheld assertions' text appears in the narration.** Also prints EVERY spoken assertion with its quote.
* **FAITHFULNESS (hard, human).** Each spoken assertion is read with its quote and labelled F (the quote itself says it, or directly entails it), W (topically related and not contradicting, but the quote does not say it) or X (not supported / contradicted / only shares words). Labels are written to `eval/ants/B3-judgements.json` after the run, from the printed listing, never edited after the results are tabulated. **BAR FAITH: F >= 90% of spoken assertions, and X = 0.** If fewer than 20 spoken assertions exist in total, faithfulness is reported as "cannot conclude".
* **UTILITY.** For the voice to be worth shipping: >= 12 of the 24 pairs speak at least one assertion, and the mean per-thinker tied rate (over thinkers with >= 1 draft assertion) >= 0.30. If safe but below this: verdict "reliable but mostly mute", not "reliable enough to ship as a feature".
* **(e) cost:** model calls per (question, thinker) counted by wrapping the injected calls (draft, point). Soft bar: median <= 8 calls per pair; reported with max.

## Verdict rule (fixed)
"Reliable ENOUGH" iff BAR F, BAR O, BAR FAITH, BAR X, and UTILITY all hold. Otherwise the report names each failed bar. Any single hard failure (F, O, FAITH) means NOT reliable enough for the user's rule.

## Predictions (written before running; wrong ones will be reported)
1. Matched tied rate lands 0.25 to 0.55 overall; the sentence-copy to number-pointing difference, whichever B2 uses, matters more than the draft. gemma2:2b drafts are mostly generic ("Laozi would say we should follow the Tao..."), which a lexical tie gate can accept with a topical but non-asserting sentence.
2. BAR F passes on L1 lies (foreign vocabulary has no lexical tie) and is at real risk on L2 lies with the sycophantic pointer (a shared stem like "God"/"justice" is exactly what a lexical relevance gate accepts). My bet: at least 1 false accept in L2 with the sycophantic pointer; 0 with the real pointer.
3. BAR O passes (the verifier slices the canon itself), unless B2 normalises punctuation in a way that changes the quote.
4. BAR FAITH is the likeliest failure: F about 65 to 80%, with some X from stem-sharing. Hence the overall verdict is more likely "not yet" than "yes".
5. BAR X: tied rate under cross-attribution falls to about 0.1 to 0.25 but is not 0; the survivors are generic doctrine sentences (Heaven, virtue) that fit more than one tradition.
6. Cost: about 1 draft call + 1 point call per assertion = 4 to 7 calls per pair.
7. Utility: roughly half of the pairs speak something; Laozi (80k chars canon, dense) and Mozi give the highest tie rates; George Eliot, Whitman and Solon (huge narrative/poetic canon) the lowest.

## What will NOT be measured (declared now)
* Whether a quote is the BEST sentence the thinker has on the question (only that it is a real sentence of theirs that supports the claim).
* Faithfulness by an independent LLM judge (none installed) or by multiple human raters (one reader, an LLM: B3).
* Anything about web-fetched voices, translations (all canon is English translations of the roster's translator), or the pathos/atmosphere gate.
* Any model other than gemma2:2b, and any temperature other than 0.6 / 0.

## Addendum A (written after a 2-pair SMOKE run of the plumbing, 19:08Z; the smoke's numbers are not used)
The smoke run (`--only 2`, 0 tied of 6) showed that voice-index's `giver` is a catalogue label ("Sri Ramakrishna (Gadadhar Chattopadhyay, 1836–1886), recorded by Mahendranath Gupta (M)"): the draft model then wrote the years into every assertion and the module's figure gate withheld them all (`figure_missing:1836,1886`). That is a property of the INPUT, not a measurement of Pythia. Decision (made on plumbing grounds, before any scored run): the scored runs pass `giver` as the short name a person would say (declared map `DISPLAY` in the harness: Laozi, Sri Ramakrishna, Mozi, Xunzi, Confucius, Mahavira, Swami Vivekananda, Vyasa, George Eliot, Walt Whitman, Solon); `work` stays voice-index's. The raw-label variant is run once more matched-only (`--raw-giver`) and reported as a FINDING (a wiring hazard for whoever feeds `thinker.giver`), not scored against the bars. Lying drafts are prefixed "<giver> holds that ..." to match the module's own draft contract. Bars, predictions and the verdict rule are unchanged.
