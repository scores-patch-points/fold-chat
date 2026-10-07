# A2 — fold-chat-primary.js (pointer-guided primary search)

"I checked this on Wikipedia, but I consider Wikipedia more like an index for primary sources. So I went and verified it on XYZ and it also said it on here." (user, 2026-10-06)
When provenance's only verifying page is an encyclopedia the line says "unconfirmed". `findPrimary` is the step that goes and looks. Pure module; the web search, the page read and the model are injected.

Files: `fold-chat-primary.js`, `fold-chat-primary.test.mjs` (33 tests), `eval/ants/A2-PREREG.md` (written before any run), `eval/ants/A2-mutate.mjs` (35 mutants), `eval/ants/A2-primary-wire.diff` (the patch for fold-chat.js, NOT applied; `patch --dry-run -p1` is clean against the tree as of 2026-10-06 14:13).

## Contract (as agreed with the other ants; extras are additive)
```
findPrimary({ claim, sentence, indexHost, search, readPage, point, fw, limits,
              indexText?, indexUrl?, english? })       // indexText/indexUrl/english are OPTIONAL additions
 → { passages:[{ ref, title, url, text, origin:true, foundVia:{host:indexHost} }],
     trail:[{ query, url, host, verdict:"read"|"mirror"|"tertiary"|"unreadable"|"unsupported"|"origin", why? }],
     pointers, calls, queries }                         // extras: provenance-shaped pointers (tier "origin", index into passages), model calls made, queries used
search(query) → [{ title, url, snippet }]   readPage(url) → string|null  (the chat's { ok, text, title } shape is accepted too)   point(messages) → string
```
Verdicts: `origin` = a page verified (it is also in `passages`); `read` = read fine but no sentence on it bears on the claim (nothing to point at); `unsupported` = there were candidate sentences and the pick was `none`/made-up/did not bear/failed the strict gate (`why` is the verifier's reason); `unreadable` = empty / <200 chars / read threw / search threw / no results (typed, never fatal); `mirror` = a copy of the encyclopedia; `tertiary` = a pointer-host (Wikipedia, other encyclopedias) or a content farm / Q&A / social host. An AbortError (name or /abort|stopped/) from search, readPage or point rejects.

## What it does
1. `queriesFor` (no model): (a) a quoted distinctive phrase, a verbatim contiguous slice of the encyclopedia sentence (6-word window inside one clause, most figures/names/long words); (b) the claim's content terms; (c) the sentence's names and figures not already used. 1-3 queries, the encyclopedia's own name left out.
2. Search each (stops early when it has 2x maxPages candidates). Drop: Wikipedia (isTertiary), the index host itself, other encyclopedias, content farms / Q&A / social (declared `HOST_KINDS`), mirror hosts (`MIRROR_HOSTS`: wikiwand, dbpedia, alchetron, kiddle, wikimili, fandom, wikia, miraheze, grokipedia, wikitia, any `wik*` / `*pedia` host). Rank the rest by host kind: government/.gov/.mil/.int/.edu/.ac 5; news agency/public broadcaster/journal publisher 4; .org 3; other 2. One page per host (the same site twice is not a second witness).
3. Read at most `limits.maxPages` (3) pages; stop at `limits.maxVerified` (2) verified hosts. A page that is a copy of the encyclopedia by TEXT (>= 80% of its sentences, on a page of >= 3 sentences, are sentences of `indexText`, or it carries "From Wikipedia, the free encyclopedia" style attribution) is a `mirror`, whatever its host.
4. Provenance's own numbered pointing (`candidatesFor`, `numberedMessages`, `verifyNumber`, imported read-only; a rejected real number is withdrawn and the model asked once more) plus a STRICTER gate (`assertsClaim`): every content stem of the claim (minus the encyclopedia's own name and an "according to X" clause), every figure (verifyNumber does that), and the same assertion profile as the claim: no question, no denial cue (myth, false, debunked, ...), no hedge cue (some say, allegedly, claims that, whether, ...), same negation. English cues only: another language keeps the stem + figure gates and the assertion gate is off (`english:false` turns it off explicitly).
5. Returns the verified pages as origin passages, the pointers, and the whole trail.

`mergeProvenance(pr, found, { indexHost })` joins the provenanceFor result with `found`: `narr` is provenance's own `narrate()` of the primary pointers, i.e. "I checked this on Wikipedia, but I treat that as an index to primary sources, so I followed it to <host> and verified it there. It says: “…”" (the app's template, the page's verbatim sentence; `verifyNarration` passes). `ps` = primary passages then provenance's own, `stored` = Provenance@1 plus `via:{index, trail}` so the path there is tracked. Nothing found: `pr` is returned unchanged ("unconfirmed" stays).

## How the boss wires it (fold-chat.js is vetoed; NOT applied)
In the provenance block of the turn (around line 2344, right after `provenanceFor` and before `provenance = pr.stored`), when the lead pointer's tier is "index". The patch is in `eval/ants/A2-primary-wire.diff` (`cd the-fold && patch -p1 < eval/ants/A2-primary-wire.diff`). The sources of the three injected functions are the chat's own: `web.search("web", q, 0, { fetchImpl })` (→ `.results`), `web.readText(url, { memo: pageMemo, fetchImpl })` (→ `{ ok, text, title }`, accepted as is), and the same `callModel` pointing call (temperature 0, 220 tokens, sealed-external). Essentials of the diff:
```js
import { findPrimary, mergeProvenance } from "./fold-chat-primary.js";
...
let pr = await provenanceFor({ answer: text, passages: webPassages, fw: fwP, preferRefs: ..., point: pointModel });
const lead = pr.pointers.find((p) => p && p.ok);
if (lead && lead.tier === "index") {
  const fetchImpl = withSignal(outbound.auditedFetch("web search", runId), ac.signal);
  const idxPassage = pr.ps[lead.index];
  const found = await findPrimary({ claim: pr.claim, sentence: String(idxPassage.text).slice(lead.start, lead.end), indexHost: lead.host, indexText: idxPassage.text, fw: fwP,
    search: async (q) => (await web.search("web", q, 0, { fetchImpl })).results,
    readPage: (u) => web.readText(u, { memo: pageMemo, fetchImpl }),
    point: pointModel });
  pr = mergeProvenance(pr, found, { indexHost: lead.host });
}
provenance = pr.stored;
```
Notes for the boss: (1) the module has no clock; a turn box belongs to the injected functions (the `withSignal(..., ac.signal)` fetch already carries the turn's abort; wrap the whole `findPrimary` in `raceAbort`/a time box if a turn must not wait more than ~20 s: up to 3 searches + 3 reads + 3-6 model calls). (2) `lead.tier === "index"` is false when originatePassages already found an origin, so the extra search only runs in the "unconfirmed" case. (3) Queries carry the sentence's words to the search engine, the same exposure as the turn's own web search; use the same audited fetch. (4) The model calls are `provenance-pointer` calls: at most 2 per page read (3 pages), so up to 6 extra calls in the worst case, typically 1-3.

## Results
Unit tests: 33 pass (`node --test fold-chat-primary.test.mjs`). Mutation check (`node eval/ants/A2-mutate.mjs`): 35/35 mutants killed (mirror by overlap / by host / by attribution marker; tertiary, encyclopedia, farm and index-host drops; denial / hedge / question / polarity / every-stem gates; the strict gate not applied; "according to" strip; index-host-name stem drop; verifier call; abort rethrow at the four I/O sites; unreadable typing x4; call_failed typing; maxPages, maxVerified, maxQueries caps; rank order; one page per host; origin flag; foundVia; quoted phrase; withdraw-and-retry; mergeProvenance no-op). One mutant survived the first round (maxQueries cap, a test that stopped after the first query); a test was added and it died. The figure gate I first wrote inside `assertsClaim` was an EQUIVALENT mutant (provenance's `bearsOn` already requires every figure) so it was removed rather than left as an untestable duplicate.
Real-data check (hand run, not the A3 corpus): real Wikipedia text via Node fetch, real gemma2:2b pointing, search stubbed to real URLs. Eiffel Tower (330 m): wikipedia/wikiwand/britannica dropped; a .gov page the model pointed at was rejected ("none"); history.com's page rejected "figure_missing:330" (it says a different figure); toureiffel.paris 403 (typed unreadable). Mount Everest: nationalgeographic.org rejected "missing_stem:mount,everest,highest" (it paraphrases), nationalgeographic.com "none", history.com / worldatlas 404/403 typed unreadable, nps 404. No page verified in either run: the gate is strict and every rejection was typed with a real reason. The recall number on a real corpus is A3's measurement (`eval/ants/primary-eval.mjs`), not claimed here.

## What it does not do / caveats
- No live-engine recall claim; the strict all-stems gate rejects honest paraphrases ("highest" vs "tallest"). Loosening it is a policy decision (the user asked for "it also says it here"), not made here.
- Without `indexText` the mirror test is host list + attribution line only (A3's harness passes only the claim as `sentence`: pass the encyclopedia page text to get the overlap test). A paraphrasing scraper that rewrites its sentences is not caught.
- Assertion cues are English; HOST_KINDS / MIRROR_HOSTS / ENCYCLOPEDIAS are declared tables (giver: the user's brief for shape, the author for names; II.11). Content farm / Q&A / social verdict is `tertiary` with `why` content_farm|qa|social (never read), a deliberate reading of "rank over content farms".
- Search operators (-site:) are not used: the injected engines differ. Wikipedia results use up result slots; a 3-query budget lets later queries recover.
- Pages are only ever the page's own text (nothing is summarised); PDF / JS-shell reading is the injected readPage's job.
