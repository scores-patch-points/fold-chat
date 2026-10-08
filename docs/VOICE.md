# The voice of content — design brief (2026-10-06, draft for the user to correct)

Status: **a brief, not a build.** Nothing here is wired. It records what the user asked for, which organs each part of it stands on, what is measured to
exist today and what does not, and a staged plan with the claims written down before anything is built.

## What the user asked for (verbatim, in order)

1. "get the system to speak in the voice of content. It's ingested and this would be auditable as provenance."
2. "It should have ramifications on the ethos, logos and pathos of what's in it."
3. "I think it should be without being annoying. Something that says, like, organically: *This reminds me of what so-and-so talked about, and they
   would have thought about it like this, I think.*"
4. "That needs to actually be using the atmosphere lens in paradigms relevant from the ethos."
5. "There's a lot more in pathos than just Murch."

Earlier, same direction: not impersonation ("shaping the ethos, logos and pathos"); the model is not the final thing before speaking (the Pivot).

## The rules that follow

* **Their words, never ours.** "They would have thought about it like this" is a *selection of their own verbatim words with an address*, framed by a fixed,
  app-authored sentence. No model writes what an archon thought; no paraphrase is spoken as theirs. The only inference is the *choice* of which passage, and
  that choice is the audited part (below).
* **Organic and rare.** An aside, not a feature: at most one per N exchanges (declared), never on a plain lookup, never twice for the same archon in a
  thread, always dismissible and mutable. If resonance does not clear its null, nothing is said — silence is the default.
* **Driven by the real organs.** When: the conversation's Atmosphere/Lens/Paradigm (`vendor/khora/native/the-fold/resolutions.js`). What: paradigms
  from the ethos corpus. Whether it lands: the conversation's *pathos condition*, read with all four inputs, not rhythm alone.
* **Auditable.** Every aside carries: the archon (a handle with verified canon, else named and refused: "never ventriloquized"), the byte address of the
  passage (`ethos` file + span, `sha256` of the source), the paradigm that matched, the conversation referents it matched, and the pathos reading that
  allowed it. A person can open all of it from the same "how this was answered" control.

## What each leg contributes (the ramifications)

| leg | organ (real, in the khora) | what it changes in the voice |
|---|---|---|
| **ethos** — the ground | `kernel/perspective.js` (Mahavira: standpoints kept apart, "Victor calling it a fiend is not the book saying so"); `kernel/corroboration.js` (Bukhari: independent chains, floor 2); `kernel/ingestion.js` (unread / partial / read); archon manifests (verified quote or refused) | WHO is speaking and how sure: the aside names the holder ("Laozi wrote…") and never merges holders; a single witness is "wrote", a corroborated line can be plain; a passage only partly ingested says so |
| **logos** — the argument | `organs/logos.js` (Kelsen's `findClaimCycle`); `kernel/contest.js`; the content's own connectives and operators | the aside keeps the passage's own negation/qualification/condition (it is verbatim) and brings its governing neighbour when it opens with a back-reference; a conversation claim that CONTRADICTS the passage is said as a contrast, never smoothed |
| **pathos** — what is undergone | `organs/pathos.js` composing FOUR inputs by a priority ladder (`strain` → `rhythm` → `curve` → holds): **experiencer** (Panini; who undergoes it, reading what, at which revision), **rhythm** (Murch), **strain** (logos's claim-cycle), **curve** (`kernel/dynamics.js`, Bharata's rasa: expectation opens → lands; surprise/tension/release). Around it: `pathos/loop.js` (pathos changes attention and continuation from grounded response and consequence, never explanatory prose afterwards), `theory-of-mind.js` (fold the universe at a for-whom), `hindsight.js` (Kierkegaard: later events re-address earlier ones), `narrative-arc.js` (the being an arc follows), `aposiopesis.js` (what trails off), `surprise-segments.js` (Rubin: the boundary sits where the ground was most wrong) | WHEN it speaks and what it offers: the aside is an *offer to the experiencer's ground*, not decoration. The conversation's condition (`contested` / `stale` / `collapse` / `ground_holds`) gates it; a passage is chosen for how its OWN curve lands (an opened tension it releases, a contested claim it holds both sides of), not for sharing words |

Pathos can say nothing but one of its four verdicts — "no rating, no score, no 'how good'" (THE-THEORY-OF-PATHOS). So the aside never claims to know how
the person feels: it reads the CONVERSATION's record (experiencer declared by the caller) and offers.

## Measured today (2026-10-06, read-only)

* The chat calls Atmosphere and Lens with **`notes: []`** (fold-chat-carry.js): there is no ledger of ethos material for the **Paradigm** block to run over.
  `paradigmBlock` needs `notes` = `{ subject, verb, object, witnesses/spans }` and finds an act recurring between the same two referents at the floor of 2.
* The khora reader door the page can reach (`/heimdall/api/read`, stages 1–5a) returns **phrase-level relations with unresolved participants** and
  **no referents for a single sentence**: e.g. `designed("Tower was", "by Leonardo da Vinci")`. It cannot build resolved ledger notes today.
* The chat's pathos read has an **unmeasured curve** (no recursive reader on this pipeline), so `collapse` cannot fire; `stale` and `contested` are the live
  registers. `strain` is "report" (the chat holds no claim edges).
* Ethos-side material that DOES exist, byte-addressed and deterministic: `Zenodotus/derived-priors/concern-priors` (60 archons, term *dwellings* with spans, a
  seeded null; 22 silent archons named as gaps), `socrates-priors` (every Socratic utterance typed by elenctic move), the archon manifests' verified quotes,
  `act-priors` (VerbNet → the nine acts). These are Pattern-grain terrain, not yet ledger notes.

## Staged plan (each stage gated by claims written BEFORE it is built; `eval/voice/PREREG.md`)

1. **Gate, no content (uses what exists).** Run the real `pathosTurn` + Atmosphere over the conversation, declare the experiencer, and decide only *whether an aside
   is permitted this turn* (rate limit, kind, condition). Claim: it permits an aside on ≤ 1 in N turns, never on a lookup turn, never twice for one archon.
2. **Resonance from the concern fields.** Match the conversation's active referents and Lens figures against an archon's dwellings *beyond the null*; offer ONE
   verbatim passage (address, sha256) with the fixed frame. Falsifier set: 20 asks that should get no aside (lookups, greetings) and 10 that should; reported
   misses are listed, not hidden. This is honest first-slice resonance (terms/dwellings), labelled as such until stage 3.
3. **Paradigms from the ethos as ledger notes.** Needs a reader that returns resolved referents and acts at sentence grain (khora stages 5b–8). That is
   khora work (ask the user before editing khora); the-fold would then run `paradigmBlock` over ethos notes and match by recurring ACT between referent classes.
4. **Curve.** Read how the passage's own tension lands (a recursive reader producing `EORelevantFold@1`), and offer it where the conversation's curve is open.
   Until this exists the curve stays a typed gap in every reading and the aside never claims it was chosen for it.

## One ethos, every lane (user, 2026-10-06: "this should be wired into what we call chat, not just querying the pipeline"; "the agentic thing doesn't have this type of pathos"; "they all have the same grounding in ethos")

Chat, agent and the pipeline stand on ONE ethos, so there is ONE voice core and ONE index; each lane is a thin adapter that turns *its own record* into the core's inputs.

```
                 ethos canon (+ fetched voices, stage 5)
                              │  build step: verified canon → voice-index.json (terms, provenance)
                              │                            → voice-bank.json  (verbatim quotable sentences + byte spans + sha256)
                              ▼
        fold-chat-voice.js  (pure core: conversationTerms · resonance · quoteFrom · permitted · asideOf · frameOf)
            ▲                          ▲                                   ▲
   chat adapter                 agent adapter                       pipeline adapter
   exchanges = asks + SPOKEN    "exchanges" = the task + each       the draft's referents/claims
   answers; pathos = readFelt   round's OBSERVED outcome (error,    (when a pipeline answer is the
   over the thread              failed test, blank page); pathos    thing being offered a voice)
                                 = the same four-input read over
                                 the rounds (stale = the same
                                 failure repeating; contested =
                                 repairs undoing each other;
                                 collapse = failures surge with no
                                 release)
```

Today only the chat has any pathos read (`fold-chat-pathos.js readFelt`, wired at `fold-chat.js` ~2094); `fold-chat-agent.js` has none. The agent's pathos is where it matters most: the
real pathos loop ("pathos changes the loop's attention and continuation from grounded response and consequence events") is what stops a repair loop re-drawing the same failing atom. The
aside appears in the agent lane only at a natural break (the loop is `stale`/`collapse`, or a run just finished), never while it works.

## Beyond the canon: fetched voices (user, 2026-10-06: "we have our archon canon to start with, but it can always go fetch other people and do the same from web search")

The roster is OPEN. The ingested canon is where it starts; the same mechanism may fetch another person's words from the web, read them, and treat them identically. The rule that
makes this safe is the canon's own: **an archon with no verified words is named and refused, never ventriloquized.** For a fetched voice that means:

* **Only primary, attributable text.** The text must be the person's own words in a source that attributes it to them (a full text on Project Gutenberg / Wikisource / the Internet Archive / the
  author's own site). Quote-aggregator pages, social posts and unsourced "famous quotes" are refused (misattribution is the norm there). A secondary page that merely *talks about* them is a pointer
  (fold-chat-origin.js: an encyclopedia is a pointer, never a citation), not their voice.
* **Same recipe, same null.** The fetched text goes through the identical deterministic concern-field recipe (seeded null, two-seed intersection), so a fetched voice and a canon voice are
  compared on one scale; nothing about the fold's wording changes.
* **Provenance of the fetch.** Each fetched aside carries the URL, the fetch time, the sha256 of exactly what was read and the byte span, so it is re-verifiable and a changed page is detected
  (the span-drift check, vendored 2026-10-06).
* **Licence.** Public-domain or openly licensed text only for anything stored; a short quote with its source for anything else; never a bulk scrape. Recorded, not hidden (code-lane-weaves).
* **Standing is shown.** A fetched voice is marked as fetched, not canon: the aside says "from the web, <host>" in the audit; the canon's verified-quote manifests are the higher tier.

This is stage 5 and is NOT part of the first test (canon only).

## What it will not do

* Speak *as* an archon, in first person, or put words in their mouth. (Their own words, framed by the fold.)
* Cite an archon with no verified canon (22 are silent by design; the line is "named and refused").
* Interrupt: no aside on the first turn, on a factual lookup, on a grief or crisis ask, or when the person has muted it.
* Say that a passage was chosen for a reason the code did not measure.

## Open decisions for the user

1. Which archons are in the first roster (the speakable cast has ~38 with verified canon; many are technical — Brahmagupta's algebra, a salmon monograph)?
2. How rare is "organic" (every 5th exchange? only when the pathos condition is `contested`/`stale`?).
3. Stage 3 means editing the khora's reader: go-ahead, and coordinate with the sessions working on `relative.js` / holon recall.

## Stage-2 baseline, REAL data (2026-10-06) — FALSIFIED, and what it taught
`eval/voice/run.mjs` over the 8 real threads (real page, heimdall, gemma2:2b, real web) and the real concern fields: **0 asides on all 5 reflective threads** (V3 bar: >= 3), 0 on the 3 lookup threads
(V2 holds trivially), scrambled-conversation control 1/100 (the null is calibrated). The top matches are junk ("mozi[keep, brother, common]", "solon[real]"), and Laozi/Nagarjuna have 0–1 quotable
sentences under their dwellings because those dwellings are mostly closed-class words (the field's own README: "a truthful distributional fact, not a mattering"). The real pathos gate stayed
closed on 8 of 10 readings (`too_few_answers`: the chat needs >= 3 model-authored answers). So **term-overlap against concern-field dwellings cannot carry resonance**. Two corrections follow.
1. Resonance must be a **profile classifier like the language detection** (user, 2026-10-06): static per-archon profiles, calibrated on held-out canon AND on non-canon conversation text, a session
   prior from the previous turn, a typed `undetermined`, precision before coverage — pre-registered bars, not a hand-set overlap.
2. The real product is bigger than an aside (next section), and it needs one shared mechanism.

## The three product behaviours (user, 2026-10-06) and the ONE mechanism under them
1. **Chat always says, mechanically, where it got its information, and the grounding never happens through the talking part of the model.** At least TWO model calls per output: (A) the answer;
   (B) a POINTING call — "copy, character for character, the sentence from the sources that says this". The app VERIFIES that sentence exists in the sources (the claimed source is only a hint),
   snips it, inserts it verbatim, and writes the narration around it itself, in plain words: *"That's King Charles III. I checked this on Wikipedia, but I treat Wikipedia as an index to primary
   sources, so I went and verified it on <host>, which says: “…”, and it says the same on <host2>."* No sentence about provenance is ever model-written.
2. **"Is there a God?" — contested questions.** Find the thinkers who addressed it (canon first; web for others, stage 5), read each into notes (Atmosphere/Lens/Paradigm), and say how each would answer
   — using Pythia (eo-teachings/pythia.mjs: speaks as an archon through a model, from a window of that archon's verified text) ONLY IF it is made reliable: **every assertion of what they would say must be
   tied, by a pointing call and the verifier, to a verbatim sentence in their real canon; an assertion with no verified tie is withheld.** The mechanical fold is what makes the paraphrase auditable.
3. **The organic aside** — a special case of (2): one tied, verbatim passage, offered rarely.
**The mechanism (`fold-chat-provenance.js`, pure):** `pointerMessages` → (call B) → `parsePointers` (verbatim-or-rejected, with offsets) → `narrate` (app-authored templates by source tier: primary / encyclopedic
index / not found) → the result carries the quote and its address. Used by chat answers now; by counsel and the aside next. Reliability of Pythia is then MEASURABLE: the rate at which its
assertions find a verified tie, against forced-fabrication controls.


## Built and tested live (2026-10-06): the source line (`fold-chat-provenance.js`, wired into chat)
Every sourced model answer now makes **2–3 model calls** and draws a mechanical source line under the answer (stored on `message.provenance`, drawn by `renderProvenance`; switch `fold-chat:provenance` = "off").
* **Call A** answers (read by the Pivot). **Call B** is a POINTING call over NUMBERED candidate sentences (verbatim slices of the pages that bear on the claim): the model replies with a NUMBER, never a copy
  (a first version asked it to copy the sentence: 1 of 3 live answers verified, because a 2B model cannot copy character for character; by number it is 5 of 5). The app looks up the page's own sentence, checks it
  bears on the claim (a shared content stem and every figure the claim states), and narrates in its own words around the verbatim quote. One bounded retry withdraws a rejected pick. A **corroborating call** over the
  other hosts adds "It also says it on <host>" ONLY if that sentence carries every content stem of the claim (a heading that shares words is not a witness).
* Tiers: a primary page ("I got this from <title> (<host>)"), an encyclopedia ("I found this on Wikipedia, which I treat as a pointer rather than a source, and I could not reach a primary page that says it, so treat it
  as unconfirmed"), and a primary page reached THROUGH an encyclopedia (the origin lane: "I checked this on Wikipedia, but I treat that as an index to primary sources, so I followed it to <host> and verified it there").
* Live, real gemma2:2b and real web, 5 asks: 5/5 verified; 3 of the 5 end in the Wikipedia "unconfirmed" line because the origin lane (another session's, uncommitted) did not reach a primary page for them;
  Marie Curie's death date cites NobelPrize.org in the app's own words. Tests: 24 in `fold-chat-provenance.test.mjs`, every gate mutation-checked.
* LIMITS (said, not hidden): the relevance check is lexical (a shared stem and figures) — it cannot tell a sentence that merely mentions the claim's words from one that asserts it; meaning-level grounding needs
  the khora reader (docs above). A sentence the model points to is checked, not understood. The claim is the answer's FIRST sentence only.
