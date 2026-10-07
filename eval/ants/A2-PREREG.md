# A2 pre-registration — fold-chat-primary.js (pointer-guided primary search)
Written 2026-10-06 BEFORE any run of the module or its tests. Each claim names what refutes it; a failing test is reported, never edited away after the fact.

Atom: `findPrimary({ claim, sentence, indexHost, search, readPage, point, fw, limits })` — go find a PRIMARY page that says what a verified encyclopedia sentence says.
Search, page read and model are INJECTED. Declared (not measured, II.11), giver = the user's brief of 2026-10-06 for the shape; the author for the host table.

## Claims that a counterexample refutes
F1. MIRROR IS NOT A WITNESS. A page whose text shares >= 80% of its sentences with the encyclopedia page (any host) is never returned as a passage, and its trail verdict is "mirror".
    Refuted if: a page that is a (re-ordered, lightly padded) copy of the encyclopedia page appears in `passages`.
    Also: a host on the declared mirror list (wikiwand, dbpedia, alchetron, kiddle, wikimili, fandom...) is dropped before reading (verdict "mirror", page never read).
F2. MENTIONS IS NOT ASSERTS. A page whose sentence carries every content stem of the claim but denies it ("the myth that ... is false"), hedges it ("some people claim ..."), asks it as a question, or has opposite polarity is rejected (verdict "unsupported") even when the model points at it.
    Refuted if: such a page is returned as origin.
F3. A MADE-UP NUMBER IS REJECTED. When `point` replies with a number that names no candidate sentence, or "NONE", or prose, no passage is returned for that page and the verdict is "unsupported" with the verifier's why.
    Refuted if: any passage is returned from a reply the numbered verifier rejects.
F4. UNREADABLE IS TYPED, NEVER FATAL. readPage returning null / "" / a very short text / throwing a non-abort error, and search throwing a non-abort error, produce trail entries ("unreadable" with a why) and the call still resolves.
    Refuted if: findPrimary rejects, or the failure is absent from the trail.
F5. ABORT PROPAGATES. An AbortError (name "AbortError" or message /abort|stopped/) from search, readPage or point rejects findPrimary with that error. Never swallowed into a trail entry.
F6. TERTIARY HOSTS ARE NEVER RETURNED (wikipedia.org via isTertiary); content-farm / Q&A hosts are dropped as "tertiary" (declared table).
F7. RANKING: with 4 candidate pages and maxPages=3, a .gov/.edu/news-agency page is read before a generic page, and a content farm is never read before any of them.
F8. STRICT GATE: a page that carries only SOME content stems of the claim, or lacks a figure the claim states, is "unsupported".
F9. LIMITS: no more than limits.maxPages pages are read; no more than limits.maxQueries searches are made.
F10. PASSAGE SHAPE: every returned passage is { ref, title, url, text, origin:true, foundVia:{host:indexHost} } and text is the page's own text (the sentence of the pointer is a verbatim slice of it).
F11. The model is NEVER a source of words: nothing in the returned passages or the trail's `why` comes from a model reply except the typed verifier reasons.
F12. QUERIES need no model: the 1-3 queries are a pure function of (claim, sentence, fw); one is a quoted phrase taken verbatim from the sentence.
F13. SAME-HOST IS NOT A SECOND WITNESS: two pages on one host yield at most one passage.

## Mutation check (each gate deleted must make at least one test fail)
mirror-by-overlap; mirror-by-host; tertiary drop; assertion gate (denial/hedge/question/polarity); all-stems gate; figure gate; abort rethrow (search, readPage, point); unreadable typing; maxPages cap; rank order; same-host dedupe; verifier call (verifyNumber).

## Not claimed
That the search finds a primary page (it depends on the engine; a miss is a typed trail, not a failure). That English denial cues cover other languages (the table is English-only; other languages fall back to the stem + figure gate and say so in the README).
