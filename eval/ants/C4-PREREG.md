# C4 pre-registration — fold-chat-budget.js (a per-ask request budget)
Written 2026-10-06 BEFORE the measured runs and BEFORE the module or its tests exist. A counterexample refutes a claim; a refuted claim is reported, never edited away.
Giver of the shape: the user's complaint ("it never should have fanned out to all that"); the numbers below are DECLARED, not measured (Constitution II.11) and are exactly what the measurement is asked to test.

## What I read first (read-only), and the one probe I ran before this file (exploration, not the measurement)
One probe ask ("How tall is the Eiffel Tower?", real page, real gemma2:2b) showed the wire has FOUR fan-out sites, none of them a model:
 1. fold-chat-web.js searchWeb: scopes web+wikipedia(+routed extras) run at once, one query per entity.
 2. fold-chat-web.js readText: every page read = 1 direct fetch + up to 6 CORS-proxy requests raced in parallel (CORS_PROXIES). One logical page = ~7 wire requests.
 3. fold-chat-originwire.js originatePassages: the Wikipedia article is fetched once PER CLAIM (MAX_CLAIMS=3) via action=parse, then footnote pages (maxAttempts 3 per claim), each of which is again 1 + 6.
 4. fold-chat-provenance.js provenanceFor: a second and third MODEL call (pointer + corroboration).
So "10 requests / 5 page reads" understates the wire; I measure BOTH wire requests and logical requests (unique target URL / unique API call).

## The budget (declared)
budget = { web, pages, models, ms, hedge }, each of web/pages/models split over three priority tiers: answer > corroborate > origin.
 - web  = search calls and encyclopedia API calls (a logical call; a retry of the identical key is free)
 - pages = logical page reads (the key is the target URL; a direct fetch and its proxy hedges are ONE read)
 - models = model calls  - ms = wall-clock for the ask  - hedge = proxies raced per read (wire fan-out of one logical read)
Default ("balanced"):  web {answer 2, corroborate 1, origin 0}=3 · pages {answer 2, corroborate 1, origin 1}=4 · models {answer 1, corroborate 1, origin 0}=2 · ms 20000 (answer tier may run to 2x) · hedge 2
"fast": web 1, pages 2, models 1, ms 8000, hedge 1.  "deep": web 6, pages 8, models 3, ms 45000, hedge 3.  "chat" (no lookup): everything 0 except models {answer 1}.
Rules: a lower tier can never spend what a higher tier that is not yet `done()` still holds in reserve; a higher tier may borrow any unspent lower-tier allowance; when a tier is declared done() its unspent allowance is released downward. The answer tier is the only one that survives `ms` (until 2x ms).

## Claims a counterexample refutes
Module (node --test, each gate mutation-checked):
 M1 spend(kind, tier, key?) returns { ok, ... } and NEVER lets total spent of a kind exceed its cap.
 M2 an answer spend is never refused because a corroborate/origin spend came first, provided the answer allowance remained (priority holds under any interleaving).
 M3 a lower tier cannot take the reserve of a higher tier that is not done; after done(higher) it can.
 M4 the same key charges once (a proxy hedge or a per-claim duplicate is free); a different key charges again.
 M5 exhausted(kind[, tier]) is exactly "the next spend of that kind/tier would be refused" (no off-by-one).
 M6 ms: after ms, corroborate/origin refuse with why "time"; answer refuses only after 2x ms. The clock is injected.
 M7 hedge(): at most budget.hedge proxies per read; never < 0; a refused page read yields 0.
 M8 unknown kind/tier is a typed refusal, never a throw; the budget is a plain-JSON snapshot()able; typed `why` on every refusal.
 M9 purity: no DOM, no fetch, no timers inside the module.
Measurement (real chat, real gemma2:2b, real web; 8 asks: 4 factual, 2 contested, 2 chit-chat):
 P1 FAN-OUT IS REAL: refuted if the median logical (deduped) web+page requests of a factual ask is <= 10 AND the median wire requests is <= 15 (i.e. the user's own count would already be the right scale and the problem is only the proxy hedge).
 P2 THE ANSWER SURVIVES. Ground truth per ask (declared now, before any run; regex on the page/answer text):
      Eiffel "How tall is the Eiffel Tower?"          /\b(330|324|1,?0[68]\d)\b/
      Canberra "What is the capital of Australia?"    /Canberra/
      Wall "When did the Berlin Wall fall?"           /1989/
      Austen "Who wrote Pride and Prejudice?"         /Austen/
      contested "Who invented the telephone?"         /Bell/        (a hit on Bell, Meucci or Gray pages counts as answer-bearing for the replay; the spoken line must contain /Bell|Meucci|Gray/)
      contested "Is Pluto a planet?"                  /dwarf planet/
    An ANSWER-BEARING request = a successful search or page response whose text matches the truth regex.
    REPLAY: with the pre-registered budget applied to the recorded request sequence (tier assigned by phase, below), at least one answer-bearing request is KEPT. Refuted if any factual ask loses all of them, or fewer than 5 of 6 web asks keep one.
    LIVE-GATED: the budget module drives a Playwright route() gate on the real page (denied requests fail at the network; the page's own failure paths run). Refuted if the spoken answer of a factual ask whose BASELINE answer matched the truth regex no longer matches it (4/4 required), or fewer than 5 of 6 web asks match.
 P3 THE CUT: live-gated wire requests per web ask <= 40% of the baseline median wire requests; logical web+pages <= 7; model calls <= 2. Refuted otherwise.
 P4 CHIT-CHAT: baseline may or may not search; under the budget web+pages = 0 and the ask still gets a spoken reply (the model call is kept). Refuted if a reply is lost.
 P5 WHAT THE CUT COSTS IN PRIMARY-SOURCE REACH: reported, not claimed good. Counted per ask in the baseline: footnote pages (non-encyclopedia, read after the article parse) requested, how many returned text, and how many the budget keeps. No pass/fail: the number is the finding. Honest bar: if the answer survives but every baseline origin read is cut, the report says the budget trades primary-source reach for fan-out, and by how much.

## Tier assignment used by the replay and the live gate (declared)
 search + encyclopedia API call (list=search, prop=extracts) ........ web/answer ; the second and later distinct search/API calls before any page read ...... web/answer until 2, then web/corroborate
 page reads issued by searchWeb (before the first action=parse or the first model call): first 2 distinct URLs pages/answer, 3rd pages/corroborate, rest refused
 action=parse (the encyclopedia article for origin-following) and every page read after it, before the first model call .......... pages/origin
 model calls: 1st models/answer; 2nd and later models/corroborate. /heimdall/api/* housekeeping and the page's own assets are not counted.
Unit of a read = decoded target URL (a proxy-wrapped URL decodes to its target). Wire = every request.

## Not claimed
That these numbers are the right ones (that is what the measurement tests), that the wiring is applied (it is only proposed in c4/wire.diff), or that a replay equals a live run (the live-gated run exists because it does not).

## Addendum (written before any measured run; the only exploration so far was the one Eiffel probe above)
 - `prop=extracts` (the encyclopedia article read that searchWeb does through readText) is a PAGE read, not a search: keyed by title, tier pages/answer. (The tier table above listed it with the searches; the wire shows it is the read of the wiki page.)
 - In the read phase the gate asks the budget for at most 3 distinct pages (2 answer, 1 corroborate). A 4th page is denied by the ladder without being asked: otherwise corroborate would eat the origin tier's page. This is also how the wiring caps searchWeb's `want`.
 - Each ask runs in a FRESH browser context (no carried referents). Baseline is run twice (before-1, before-2) to see the noise of the live web; replay is applied to both; the live-gated run is once. Wall clock = send click to the input being enabled again.
 - The gate's clock starts at the send click, uses the real clock, and `ms` = 20000.
