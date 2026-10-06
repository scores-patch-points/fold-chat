# The answer pipeline — one vertical slice (contract, 2026-10-05)

Status: **contract for a build in progress.** It narrows `docs/NEXT-ARCHITECTURE.md` and the 2026-10-05 triad design
(ethos · logos · pathos; workflow wf_7d4ee812-b50) to the smallest slice that gives a person *an answer to their question, with a
citation, whose reasoning visibly tried to falsify itself*. Every shape below is binding for the parallel builders; a change needs the
integrator's say-so.

## What the user asked for (verbatim, the acceptance reading)

* "I need just an answer to my question with a citation, with the reasoning actually following good reasoning."
* "We are too much trying to only answer by snippage." — a wall of passage blocks is NOT an answer.
* "The search ITSELF must falsify its answers." — retrieval is not only support-gathering: after a candidate answer exists the fold
  searches for what would refute it ("what could I find that, if true, would make me doubt what I had said?").
* "I want to see what the model is thinking … it appears the user is asking a factual question / I can't trust my memory, let me
  research it / it says King Charles, but let me falsify it / what could I find that would make me doubt it." — a first-person,
  app-authored, step-by-step trace, shown behind a disclosure, **stacking the void recursively** (a void for the ask; sub-voids for what
  filling it needs; a void for "is it still true / is there a rival").
* "Read things, detect language, parse the grammar, put into EOT, reason over it, back to grammar, then NL."
* Popper: a claim stands only as *"survived these named attempts to refute it"*, never "true".
* Product rules still hold: the model is never alone; find/snip/cite never rewrite; omnilingual with NO case logic; a gap is drawn,
  not said; edit by subtraction.

## The slice: SLOT ASKS

A **slot ask** is a factual question whose answer is one filler of a typed slot: *who* (person) · *when/what year* (time) ·
*how many* (quantity) · *where* (place) · *what is the capital/author/…* (thing). The slice covers slot asks only. Every other ask keeps
today's path (facing/snips, existing gate) untouched.

For a slot ask the **model is not called at all** (it is the piece that hallucinated; the answer is read, reasoned over and realised
mechanically). The existing two answer modes stay for everything else.

```
ask ─► language ─► frame/void ─► read ─► bind (T1 rows) ─► candidate filler ─► FALSIFY (search for the refutation) ─► reason ─► realise ─► card
```

### Stages and owners (module → exported API; all PURE, injectable `fetchImpl`/`resolveTitles`/`searchTitles`, no DOM, no clock reads)

| stage (user's words) | module | API |
|---|---|---|
| detect language | `fold-chat-lang.js` (exists; working tree) | `detectLang(q)` → `{lang, confident, script, hits}` — slot asks proceed only when a function-word prior exists for the language (`functionWordsOf(lang)`); else typed gap `no_grammar_for_language`, floor = today's path. |
| parse the grammar of the ASK | `fold-chat-frame.js` (EXISTS with `stripFrame` — **extend, never clobber**) | `askFrame(question, { fw, lang, resolveTitles }) → Frame` |
| parse the grammar of the PASSAGE | `fold-chat-witness.js` (new) | `sentencesOf(text) → [{text, start, end}]`, `bindSentence(sentence, frame, { fw }) → Row \| null` |
| EOT / the void stack | `fold-chat-void.js` (new) | `openVoid(frame) → Void`, `fill(void, event)`, `traceOf(void) → TraceLine[]` — the void stack IS the turn's event record (append-only `events[]`; state is a projection). |
| reason: falsify | `fold-chat-falsify.js` (new) | `probesFor(candidate, frame, now) → Probe[]`, `judge(candidate, probeResults) → {standing, refuters[]}` |
| reason: choose / contest | `fold-chat-witness.js` | `reasonOver(rows, falsification) → { answer \| contest \| gap }` |
| back to grammar → NL | `fold-chat-answercard.js` (new) | `answerCardModel(turn) → CardModel`, `renderAnswerCard(turn, { el }) → HTMLElement` |

### Shapes

```js
Frame = {                         // the grammar of the ask, read with the language's own closed classes (no case logic)
  ok: boolean, lang: "en", said: "Who is the king of the UK?",
  slot: "person" | "time" | "quantity" | "place" | "thing" | null,   // from the interrogative; null => not a slot ask
  referents: [{ surface: "UK", title: "United Kingdom", aliases: ["UK","United Kingdom"] }],  // longest sub-runs that RESOLVE BY TITLE
  predicate: [{ surface: "king", stem: "king" }],                    // the leftover content words
  gap: null | { kind: "no_grammar_for_language" | "frame_unread" | "referents_unresolved" }
}
Row = {                           // one bound source sentence = the only thing that can witness an answer
  tier: "T1" | "T2",              // T1: every referent group AND >=1 predicate stem in ONE sentence; T2: referents only (never a witness)
  sentence: "Charles III is the king of the United Kingdom and the other Commonwealth realms, having acceded … 2022.",
  source: { ref: "S1", title: "Monarchy of the United Kingdom", url, host: "en.wikipedia.org", lang: "en" },
  span: [start, end],             // UTF-16 offsets of the sentence inside the passage text (so it can be re-verified: verifySnip)
  polarity: "+" | "-",            // read from the sentence's own negation words (closed class per language), never guessed
  tense: "present" | "past" | "future" | "unknown",   // from the copula/aux (closed class per language)
  filler: { text: "Charles III", span: [a, b] } | null,              // the slot filler inside the sentence, by slot type
  emphasis: [[a, b]]              // spans to draw bold: the filler and the matched referent/predicate words
}
Probe = { id, kind: "life-dates" | "succession" | "rival-holder" | "negation" | "later-date",
          why: "a person who died cannot be the CURRENT holder", query: "Charles III", expects: "…" }   // query names the claim
Void = { id, kind: "ask" | "referents" | "filler" | "currency" | "rival" | "falsify",
         text: "who holds the role 'king' of 'United Kingdom'", status: "open" | "satisfied" | "refused" | "contested" | "unmeasured",
         basis: "read" | "asked" | "declared" | "unmeasured", children: [Void], events: [Event] }
TraceLine = { n, who: "app", say: "It looks like a question of fact: who is the king of the UK.", detail?, probe?: Probe, result?: "found …" | "found nothing" }
AnswerTurn@1 = {
  schema: "AnswerTurn@1", said, searched: [string], lang: { code, by },
  void: Void,                     // the stack; every child carries its evidence
  answer: null | { text: "Charles III is the king of the United Kingdom.",   // REALISED from the row, English template per slot; or the row's own sentence
                   filler, row: Row, standing: "survived", survived: [ "no later holder found in 3 sources", "Charles III (b. 1948) — no death date" ], by: "mechanical" },
  contest: [Row],                 // rows that give DIFFERENT fillers for the same slot: drawn side by side, never averaged
  gap: null | { kind: "unwitnessed" | "frame_unread" | "no_present_holder" | "refuted" | "unreached" | "no_grammar_for_language", closest?: Row, tried: [...], closeBy: [...] },
  trace: [TraceLine], sources: [...]
}
```

### The release rule (what may ship as THE answer)

1. **No T1 row → typed gap `unwitnessed`**, drawn whole-turn. The model is not asked. (Closes: "Queen Elizabeth II" from a US/France pool.)
2. **Tense**: for a *present-tense* ask ("who IS …"), a row whose tense is `past` ("was the last king") cannot witness a present holder → gap `no_present_holder`, with the verbatim past-tense sentence drawn as the closest source. (Closes: "the king of France is Louis XVI".)
3. **Polarity**: a `-` row against a `+` row for the same frame is a contest, never a silent pick.
4. **FALSIFY before release.** The candidate filler gets probes (below). The answer ships only as *survived*; the card lists the probes run and what each found. A refuter (death date ≤ now for a "current" ask; a later/different holder in a more recent or more authoritative source; an explicit negation) converts the answer into a **contest** or **refuted** gap — the refuting passage drawn next to the claim.
5. **Realise**: answer text = the English template for the slot over the row's own words (`<filler> is the <predicate> of <referent>.`) when the sentence matches the copular pattern, else the row's sentence verbatim; ALWAYS with the verbatim row sentence and the citation beneath. Other languages: the row's sentence verbatim (typed gap for template).

### Probes (mechanical, language-neutral where possible)

* **life-dates** — query = the filler's name; read the top Wikipedia lead; a parenthesised range `(YYYY–YYYY)`/`(… – … YYYY)` or a `died`-class date before *now* refutes "current holder". (Language-neutral by shape; the dead-word lists are NOT used.)
* **succession** — the filler's page names a successor/predecessor row for the same role (rival-holder).
* **rival-holder** — any other T1 row in the pool whose filler differs for the same frame (cheap: no extra search).
* **negation** — any T1 row with polarity `-` for the same frame.
* **later-date** — rows carrying a date after the candidate row's date for the same slot.
Each probe that needs the network is ONE query that **names the candidate** (the C9 falsifier: a query containing the claim's name). Probe results are events in the void stack.

### Trace (the "thinking" the user wants to see) — APP-AUTHORED templates, not model text

First-person, present tense, plain words (user rule: plain words on screen, no apparatus nouns, no archon names). Example for the king ask:

1. It looks like a question of fact: who holds the role of king of the United Kingdom.
2. I can't answer that from memory, so I'm reading sources.
3. I read *Monarchy of the United Kingdom* (Wikipedia). One sentence states it: “Charles III is the king of the United Kingdom…”.
4. That says **Charles III**. What would make me doubt it? A later holder, a death, or a source saying otherwise.
5. I searched “Charles III” and read his page: born 1948, no death date. I found no later holder in the other 2 sources.
6. So I'm answering Charles III, and saying what I checked.

The trace is built from the void stack's events by `traceOf` (templates keyed by event kind; translatable later; never model-written).

## Acceptance (pre-registered in `eval/falsify/PREREG.md`, Amendment 2; the driver is `fold-e2e-popper.mjs`)

Model stub THROWS for the slot-ask cases (proves the model is not needed): A1 king of the UK → answer contains "Charles III", has a citation to the Monarchy page, a trace line whose query names "Charles III"; A2 UK president from a US/France pool → typed gap, no "Elizabeth"; A3 king of France → no "Louis XVI is the king", gap `no_present_holder` with the past-tense sentence; A4 PM of the UK → "Andy Burnham", never "Sunak"; A5 the stale-holder world (first search returns only a page saying "Elizabeth II is the queen"; the refutation is reachable ONLY by a query naming her) → not shipped as current, refuting passage shown; A6 capital of Australia (control) → "Canberra"; A7 spider legs → "eight"; A8 WW2 end → an answer or an honest "closest sentence" (no prediction). Existing controls K1/K2 must keep standing.

## Hard constraints for builders

* New files + their tests only, except where a task names an anchored edit. `fold-chat-frame.js`, `fold-chat-web.js`, `fold-chat-thread.js` are in the pushed commit: extend with small anchored edits. `fold-chat.js` and `fold-chat-ground.js` are another session's dirty files — **only the integrator touches `fold-chat.js`, with anchored edits**; nobody touches `fold-chat-ground.js`.
* No case logic (`[A-Z]`, `\p{Lu}`, capital-initial heuristics); closed classes come from `functionWordsOf(lang)` / declared per-language tables with a named giver; a language without them yields the typed gap, never an English guess.
* Declared (not measured) constants say so and name their giver (II.11).
* Tests include FALSIFIERS (fail if the claim is wrong) and the controls (a true witnessed answer must still ship).
