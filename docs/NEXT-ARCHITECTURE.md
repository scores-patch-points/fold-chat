# The chat's mind — target architecture (working doc, 2026-10-05)

Status: **proposal grounded in measurements.** Everything under "Measured" was run
against the live stack on 2026-10-05; everything else is design.

`the-fold` is a *surface*. It presents; it does not perceive, relate, or keep.
The triad it stands on (`khora/KHORA.md`, `FOLD-CONSTITUTION.md`):

| body | act | what it gives the chat |
|---|---|---|
| **khora** | perceive · produce ground | referents, addressed passages, grounding (`EORead@1`, `Ground@1`) |
| **janus** | relate · derive | what follows from the record: contradictions, equations, orderings — model-free |
| **penelope** | generate · keep · seal | the mouth, the artifact, the record, the facing page |

The chat's job: route a turn through those three, then **draw** what came back so a
person can see what stands on what. The model is the *mouth*: it phrases, orders,
translates; it never originates a fact (Constitution II.9) and never retrieves (IV.1).

## The turn, in six steps

1. **Classify** — smalltalk / creative / code / factual / follow-up. Creative, code and
   smalltalk carry *no claims*: no void note, no ✱, no sources (a poem has nothing to check).
2. **Perceive in context** — activation, not string search (`khora/native/docs/THE-HOLOGRAPH.md` §6):
   *a question activates its own referents, or the last answer's when it names none.* The
   chat keeps a per-chat referent record; "what happened to **him**" resolves to the last
   answer's referent **before** retrieval. Output: a *resolved question* shown to the person
   ("Read 'him' as Judge Richard Henderson"), never silently rewritten.
3. **Retrieve** — queries built from resolved referents, in the asker's script and, where
   different, the source language (Wikidata Q-ids link names across languages). Sources are
   read through the khora so passages carry addresses (byte ranges), not just snippets.
4. **Derive** — claims taken from the passages go to janus (`POST /api/reason` →
   `khora /v1/reason`): one-valued relations that two sources disagree on, equations
   (mathjs), orderings. Janus findings are *insights with premises*: each finding carries
   claim ids, each claim id carries its source span. Two grounds that disagree **are the
   finding** and are never averaged (III.4).
5. **Voice** — the mouth drafts from the material and the derived findings only, in the
   asker's language. Numbers, names, dates in the draft must resolve to a claim or a source
   span (II.9); anything else is typed `model` and drawn as such.
6. **Ground and draw** — every proposition gets a standing and links; the surface renders it.

## The proposition record (the one contract the surface renders)

```json
{
  "schema": "FoldTurn@1",
  "question": { "said": "what happened to him later in life?",
                "resolved": "what happened to Judge Richard Henderson later in life?",
                "referents": [{ "surface": "him", "resolvedTo": "Judge Richard Henderson", "by": "activation:last-answer" }],
                "lang": "en" },
  "propositions": [{
    "id": "p1", "text": "…", "span": [0, 71],
    "standing": "sourced | derived | model | gap",
    "support": [{ "source": "S1", "quote": "…", "bytes": [1832, 1941],
                  "match": "verbatim | paraphrase | numeric | cross-lingual" }],
    "derivation": { "rule": "date-difference", "premises": ["p1", "clock:2026-10-05"], "by": "janus" }
  }],
  "sources": [{ "id": "S1", "title": "…", "url": "…", "lang": "en", "readVia": "khora" }],
  "gaps": [{ "kind": "not-present | not-computed | computed-and-empty | refused | censored-above | censored-below",
             "about": "…", "tried": ["…"], "closeBy": ["…"] }],
  "contradictions": [{ "claims": ["s1:c1", "s2:c1"], "relation": "founded-in", "values": ["1779", "1784"] }],
  "process": ["…"]
}
```

Rules the renderer obeys:

- **Text is never merged across channels.** Model prose lives in `propositions[].text`; system
  diagnostics live in `gaps`/`process`. A gap is *drawn* (III.3) as a typed mark, never as a
  sentence the assistant said, and never re-sent to the model as history.
- `sourced` and `derived` are drawn differently from `model` (IV.4: *measured and shown never
  render alike*). Hovering/focusing/tapping a proposition opens a card: the verbatim span with
  the matched words highlighted, the source, how the link was made (`match`), or the derivation
  chain with each premise linked.
- Contradictions are drawn side by side with both grounds and their spans.
- Standings map to the constitution: `sourced`/`derived` ≈ grounded-to-bytes; `model` = shown;
  `gap` = typed silence; a refusal cites its article.

## Omnilingual and omnimodal — rules, not aspirations

- **No case logic.** `[A-Z]`/`\p{Lu}` entity finders read zh/ja/ar/hi/th/he as having no
  beings, *silently* (THE-HOLOGRAPH.md: "Reading is omnilingual and omnimodal by construction,
  or it is not the reader"). Entity logic comes from the khora read and from Wikidata labels,
  never from capitalisation. `fold-chat-web.js::properNouns` is a standing violation.
- **Answer in the asker's language.** Retrieval may cross languages; the mouth voices in the
  asker's. Grounding must work across them (`run-dmca`: the omnilingual paraphrase organ,
  Rosetta projection) — a Spanish sentence is grounded by an English span or it is not.
- **The mouth never sees the medium, only the reading.** An image, audio, score, video or file
  goes through a khora adapter (S16) and becomes the same referents/passages; the chat shows
  the reading beside the original. (Attach is "coming soon" in the UI today.)

## Measured (2026-10-05, live stack)

| probe | result |
|---|---|
| chat unit tests | the-fold 84/84, heimdall 114/114, penelope 11/11 (before the day's agent edits) |
| chat e2e (`fold-e2e-falsify.mjs`) | 13/15; the 2 failures were a stale test (facing page moved into the answer body) |
| follow-up "what happened to him…" (chat) | search ran on the raw text; read O.J. Simpson / Gypsy Rose pages; no referent carried |
| "How tall is the Eiffel Tower?" (chat) | answered "about 1,082.68 feet"; gate said "none established". **Corrected diagnosis:** 330 m × 3.28084 = 1082.68 ft — the *mouth did the unit conversion itself* (a model-originated number, II.9), so the gate was right to refuse it as sourced; but the number is derivable, so it should arrive as a `derived` proposition (janus equation, premises: the source's "330 metres" + the unit factor), not as a void |
| **mechanical paraphrase (`run-dmca.js`, khora's "YadaYadaYada") — 13 true + 11 false claims vs one English passage, vendored organs, browser-like harness; n is small, one passage, preliminary** | the *shadow* (`paraphraseCandidatesFor`) is a model-free **nominator**, not a verdict: it nominated the correct source sentence for all 3 reworded English claims and for es/fr/de (they share Latin-script names), nominated nothing for unrelated text (en + es), and nominated the same sentence for false claims (wrong city/number/year/person) — as designed; it found **nothing for ru/zh/ar**. `grounding.checkGrounding` alone passes vacuous sentences (no names/numbers → nothing to check: "Photosynthesis converts light energy…" counted as sourced against an Eiffel passage). **Combining them — shadow says a source sentence carries the claim's vocabulary, grounding checks names/numbers against the passage — gave 7/13 true claims sourced and 0/11 false accepted, versus grounding alone 7/13 and 2/11 false accepted (both the unrelated sentences).** Misses: es/de (translated names), ru/zh/ar (unreached), one 'meters/firm/Eiffel's' variant. Checking atoms against the single nominated sentence is too narrow ("It is 330 metres…" lacks the name "Eiffel Tower"; 4/13) — validate names against the passage window, use the nominated sentence for linking/highlighting. **The verbatim instrument `runDMCA` is blind to non-Latin text** (`norm` strips everything outside `a-z0-9'`: identical Russian/Chinese text reads "too short to measure") — the "omnilingual paraphrase system" is not omnilingual in the shipped organ (proposal for the khora owner: Unicode-aware normalisation, `\p{L}\p{N}`). The record tier (`chaseParaphrase`, equating against the fold's claim rows) needs claim rows from a text-face reading and was not exercised |
| *correction to the row below:* the chat's lean fork marks a sentence "grounded" at the coverage level even when it names an unsupported place ("…in Lyon"), but it lists that name separately as unsupported; scored with both checks together, the fork accepted 0/13 true and 0/11 false claims in the run above (too strict, not too loose) | |
| real `grounding.checkGrounding` vs the chat's lean `fold-chat-ground.js`, 9 probe sentences vs one English passage (vendored organs, browser-like harness) | both accept the true verbatim and the 1,083 ft sentences and reject a wrong number; **the lean fork marks "…stands on the Champ de Mars in Lyon" grounded (false positive — dangerous under II.9); the real organ flags it**; neither grounds a true Spanish/Russian/Chinese sentence against the English passage (REAL: 2-3 atoms unsupported; LEAN: 0/1) — cross-lingual grounding is unsolved by both |
| poem request (chat) | web-searched; "⟂ void" paragraph appended into the assistant's text |
| khora `/api/read`, one 6-sentence paragraph per language | en 8 referents (incl. false "December", "April"), es 6, ru 5 (inflected surfaces, not lemmatised), **zh 0, ar 0** — silent |
| khora `/api/read`, 1–2 sentence snippets | 0 referents (reader needs recurrence) |
| khora `/v1/ask` two-turn session (`sessionId`) | 90 s + 126 s, no retrieval, `referentBindings: 0`, second answer meaningless |
| janus `/v1/reason` | detects the two-source contradiction (`standing_contradiction` with claim ids `s1:c1`/`s2:c1`) and refutes a false equation, model-free |
| heimdall `:8790` running build | no `/api/reason` route (source has it; process predates it — restart) |

## Gaps by repo (we own all of them; each is a task, none is a reason to fake it in the chat)

- **khora**: zh/ar (caseless, unspaced) read as empty; recurrence-only admission makes short
  passages unreadable (a chat turn needs a *session* fold); `/v1/read` priors file for `en` absent;
  months admitted as referents; inflected surfaces not lemmatised; no door that returns GFP *claims*
  from text (needed to feed janus); `/v1/ask` slow and unretrieving.
- **janus**: needs a claim-extraction door (text → `{rel, roles, polarity, said}`) so derive can
  run on retrieved passages; otherwise the chat has to extract claims itself.
- **penelope**: `/api/weave` hangs (>100 s); `POST /api/generation` (Weaving@1, prose adapter) is
  the intended door for sealed prose with per-element provenance.
- **heimdall**: restart to pick up `/api/reason`; add `/api/ground` (paraphrase check) if khora exposes it.
- **the-fold**: clean channels; proposition record + hover cards; referent activation;
  language-aware retrieval; effort per turn; attach for omnimodal input.

## Waves

1. *(running)* UI modernisation + per-turn effort; per-chat icons + no purple; chat close/delete;
   comingling fix (separate channels); accuracy eval harness (`eval/`).
2. `fold-chat-mind.js` — pure, tested: referent activation + resolved question, script-aware
   entity handling, language detection, proposition-record builder; then wire into `run()`.
3. Grounding v2: numeric/unit/paraphrase/cross-lingual matching feeding `support[].match`;
   hover cards; contradictions side by side.
4. Derive: janus findings as `derived` propositions with premise links.
5. Omnimodal intake; coding lane (Agent/Code) brought to the same record.
6. Re-run `eval/`; the numbers decide what's next.
