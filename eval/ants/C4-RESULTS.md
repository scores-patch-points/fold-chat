# C4 results — one ask, one request budget (fold-chat-budget.js)
2026-10-06. Pre-registration: `eval/ants/C4-PREREG.md` (written before any measured run; one Eiffel probe preceded it, disclosed there). Real page (`http://127.0.0.1:8815/`), real heimdall, real gemma2:2b, real web. Raw data: `eval/ants/c4/*.json`, tables: `eval/ants/c4/analysis.md`, harness: `eval/ants/c4/measure.mjs` + `analyze.mjs` + `reach.mjs`.

## 1. Where the fan-out is (exactly)
The user's "~10 requests / 5 page reads" is the LOGICAL count (median 11 unique searches+pages per factual ask). On the wire it is **median 41 requests per factual ask (range 9 to 124)** over two baseline passes. Four sites, none of them the model:

| site | code | what it does | share of the baseline wire |
|---|---|---|---|
| page-read hedging | fold-chat-web.js `readText` → `firstOf(CORS_PROXIES…)` | every page read = 1 direct fetch, and when that is refused (CORS: always, in a browser) the relay + 5 public proxies are raced in parallel; the losers are aborted but already sent | 30% (15.5 per ask) + 5% direct |
| origin-following | fold-chat-originwire.js `originatePassages` (MAX_CLAIMS 3 × maxAttempts 3 footnotes), each footnote again 1 + 6 | the encyclopedia article is fetched once PER CLAIM (3 identical `action=parse` URLs, measured), then up to 9 footnote pages | 42% footnote pages (21.8 per ask) + 14% article fetches (7.1) |
| searchWeb | fold-chat-web.js `searchWeb` | web + wikipedia (+ routed scopes) at once, per entity; a relay 502 is retried | 6% (3.0 per ask) |
| models | fold-chat-provenance.js `provenanceFor` (+ the answer call) | answer + a "point at your source" call + a corroboration call | 4% (2.3 per ask) |

The Berlin Wall ask is the extreme: 118-124 wire requests (18 logical pages, 15 footnote pages asked of which 5 returned text). Wall time per ask that searched and read: median 37.5-44.9 s.

### BEFORE (no gate; fresh browser context per ask; wire = every request, `kind` by `classifyUrl`)
| ask | kind | pass 1 wall s | pass 1 wire (web/pages/models = total) | pass 2 wall s | pass 2 wire | logical web+pages (p1) | answer ok |
|---|---|---|---|---|---|---|---|
| eiffel | factual | 28.1 | 2/26/3 = **31** | 38.2 | **31** | 2+5 | yes, yes |
| canberra | factual | 42.8 | 4/36/2 = **42** | 30.0 | **44** | 4+7 | yes, yes |
| wall | factual | 65.6 | 3/116/3 = **122** | 47.3 | **124** | 3+18 | yes, yes |
| austen | factual | 35.2 | 4/35/1 = **40** | 11.6 | **9** | 4+8 | yes, yes |
| telephone | contested | 47.0 | 4/34/3 = **41** | 37.5 | **44** | 4+5 | yes, yes |
| pluto | contested | 53.5 | 1/43/3 = **47** | 5.9 | **2** (relay 502: a typed gap, no answer) | 1+6 | yes, NO |
| hello | chit-chat | 2.9 | **0** | 2.9 | **0** | | |
| thanks | chit-chat | 2.6 | **0** | 2.7 | **0** | | |

Factual asks (8 runs): median wire 41, median logical 11, median wall 36.7 s, median model calls 2.5. Chit-chat already sends nothing: the app answers it with its own fixed line ("Ask me something and I'll show you what the sources say"), no model call (this is the `lookupWarranted`/alone path, not the budget's doing).

## 2. The budget (declared in the prereg; one knob added post-hoc, labelled)
`makeBudget({preset|config, now})` in `fold-chat-budget.js`. Kinds `web`, `pages`, `models`; tiers `answer > corroborate > origin`; plus `ms` and `hedge` (proxies raced with one page read).

| preset | web (a/c/o) | pages (a/c/o) | models (a/c/o) | ms | hedge |
|---|---|---|---|---|---|
| balanced (default) | 2/1/0 = 3 | 2/1/1 = 4 | 1/1/0 = 2 | 20000 | 2 |
| fast | 1 | 2 | 1 | 8000 | 1 |
| deep | 3/2/1 = 6 | 4/2/2 = 8 | 1/1/1 = 3 | 45000 | 3 |
| chat (no lookup) | 0 | 0 | 1 | 15000 | 0 |

Rules (all unit-tested): a lower tier cannot spend what a not-yet-done higher tier still holds; a higher tier may borrow unspent lower allowance; `done(tier)` releases downward; the same key charges once (a page's proxy hedges, the article once per claim); the answer tier alone survives `ms` (to 2 x). `guardFetch(budget, fetchImpl, {tier})` wraps any fetchImpl: a refusal REJECTS with a typed `BudgetRefused` and nothing is sent; proxies beyond `hedge` never leave; identical GETs are single-flighted (each caller gets a clone). `classifyUrl` turns a wire URL into `{kind,key}` (a proxy-wrapped page is its target). Post-hoc addition: `timeModels:false` (see 4).

Tests: `node --test fold-chat-budget.test.mjs` = **23 pass**; `node eval/ants/c4/mutate.mjs` = **45/45 mutants killed** (a first run of the mutation list found one equivalent mutant — the allorigins unwrap regex duplicated the generic `/raw?url=` one — which I deleted from the module rather than keep).

## 3. Verdict on the pre-registered claims
**P1 fan-out is real: stands.** Refutation needed median logical <= 10 AND wire <= 15; measured 11 and 41.

**P2 the answer survives: PASSES.**
- REPLAY (budget applied to the recorded wire): an answer-bearing request is kept in 11/11 asks that read pages (6/6 pass 1, 5/5 usable pass 2; the pass-2 pluto had no response at all). Kept / total answer-bearing requests, e.g. eiffel 8/10, canberra 14/16, wall 10/13, telephone 8/8.
- LIVE-GATED (the budget module drives a Playwright `route()` gate on the real page; denied requests fail before they are sent): factual answers correct **4/4 in all four live runs**; web asks correct 6/6 (live-2, live-h1, live-p), 5/6 in `live` (pluto: relay 502 in the baseline pass at the same minute — the miss is not the budget's).

**P3 the cut: NOT MET as registered (borderline).** Registered bar: live wire per web ask <= 40% of the baseline median (41.5 → 16.6). Measured sent (allowed by the gate): `live` median **16.5 = 40%** (pass by 0.1 pt), `live-2` **17.5 = 42%** (fail). Logical web+pages <= 7 held (max 7); model calls <= 2 held (max 2). The gate does not dedupe, the wired `guardFetch` does: counting only unique URLs among the requests the gate allowed, the same runs project to **31% and 34%** of baseline (a projection, not a measured live run).

**P4 chit-chat: PASSES trivially.** Baseline already sends 0 requests and 0 model calls for both; the budget changes nothing; the fixed reply is kept.

**P5 primary-source reach: reported below (section 5).**

### LIVE-GATED runs (sent = what the gate allowed; the page ATTEMPTED 42-173 per ask and was refused instantly, which costs no wire and no wall time)
| run | config | median sent (web asks) | % of baseline 41.5 | unique-URL projection | max logical web+pages | max models | factual ok | web ok | median wall s |
|---|---|---|---|---|---|---|---|---|---|
| live | pre-registered | 16.5 | 40% | 13 (31%) | 7 | 2 | 4/4 | 5/6 (pluto 502) | 26.0 |
| live-2 | pre-registered | 17.5 | 42% | 14 (34%) | 7 | 2 | 4/4 | 6/6 | 25.4 |
| live-h1 | POST-HOC hedge 1 | 17 | 41% | 11.5 (28%) | 7 | 2 | 4/4 | 6/6 | 27.3 |
| live-p | POST-HOC hedge 1 + timeModels:false | 14.5 | 35% | 11.5 (28%) | 7 | 2 | 4/4 | 6/6 | 22.9 |
baseline median wall (same kind of ask) 37.5-44.9 s.

Per-ask for `live-2` (the clean pre-registered run): eiffel 14, canberra 20, wall **18 (was 122-124)**, austen 20, telephone 14, pluto 17; chit-chat 0, 0. Replay over the baselines gives the same shape (e.g. wall 3/14/1).

## 4. What falsified me (and the one post-hoc change)
1. **`ms` cost the sources line.** The registered clock (`ms` 20 s for corroborate) also stopped the MODEL's second call: on gemma2:2b the answer itself takes 10-17 s, so the provenance "point at your source" call arrived after the clock and was refused. The verified sources line (provenance) was kept in 3/6 (`live`) and 2/6 (`live-2`, `live-h1`) web asks vs 5/6 and 3/6 in the two baseline passes. Fix, labelled POST-HOC: `timeModels:false` (the clock governs web and pages only; the model has its own cap). `live-p` kept it in 6/6. Presets keep the registered default (`timeModels:true`) so the registered runs stay reproducible; the wiring diff passes `config:{timeModels:false}` and I recommend that as the default.
2. **Hedge 2 alone does not reach the 40% bar** (above). Hedge 1 is post-hoc, not claimed.
3. **The registered ladder is not enough on its own:** refused reads fail instantly, so `searchWeb`'s worker loop walks the whole candidate list (wall: 108 refusals). No wire cost, but the wiring should `break` on `BudgetRefused`.

## 5. What the cut costs in primary-source reach
- **Where the origin step's wire goes: 56% (footnote pages 42% + article refetches 14%).** Baseline, REPLAY over 11 web asks: footnote pages (non-encyclopedia, after the article parse) asked **51**; **28** returned text; the budget keeps **23** (of which 19 returned text). So the budget keeps 23 of the 51 footnote pages asked (45%) and 19 of the 28 that returned text (68%).
- **But those 240 footnote-page requests produced no original in the four factual asks I checked** (`reach.mjs`, real message + feed): baseline and gated alike, feed rows "Followed the encyclopedia to its source" = **0 of 4** and "The encyclopedia only points" in 4/4; the stored provenance is the encyclopedia at tier `index` in 4/4 both ways, answer correct 4/4 both ways. The ~5 logical footnote pages (~22 wire requests) each ask spent bought a pointer, not an origin. (Across the 12 baseline asks the sources line was verified on a non-Wikipedia host in 1: the NASA page for Pluto, which came from the search, not from a footnote.)
- So today the budget trades **no measured primary-source reach** for the fan-out, because today's origin-following reaches none on these asks. The risk is the other direction: when A1/A2's repairs (fold-chat-primary.js `findPrimary`) make origin-following actually land, the `origin` tier's allowance (pages 1 + whatever is unspent, hedge 2) is the binding limit. `findPrimary`'s `limits.maxPages/maxQueries` map straight onto `budget.spend("pages","origin")` / `("web","origin")`; deep effort gives it 2 pages + 1 search.
- Not measured: the slot pipeline's falsifier searches (the pipeline is OFF by default: `fold-chat:answerPipeline`), `deep` effort, agent mode, follow-up turns that carry a referent, asks the relay cannot search.

## 6. The wiring (proposed, NOT applied): `eval/ants/c4/wire.diff` (113 lines, `patch --dry-run -p1` clean on the current tree)
fold-chat.js: one `makeBudget` per ask after `noSources`; `budgeted(tier)` = `guardFetch` over the existing audited, abortable fetch, used at the senses probe (corroborate), `searchWeb` (tier function: first 2 pages answer, 3rd corroborate, 4th not asked), the slot turn (corroborate) and `originatePassages` (origin); `readFor` capped by the budget; `budget.done("answer")` after the search step and `done("corroborate")` before the origin step; `callModel` spends `models` (answer first, then corroborate; a refusal throws and `provenanceFor` already reports a typed `call_failed`). fold-chat-web.js: `readText` marks a host dead for 5 minutes on "unreachable" — a read the budget refused would poison the tab's memo, so `attempt()` records `refused` and `readText` skips the dead-host mark for it (a one-site hunk).
Open wiring hazards: (a) a refused SEARCH reads as "web did not answer" in the trace (getJson wraps the error), the typed why is lost there; (b) `runSlotTurn` takes one fetchImpl, so its inner origin step is charged to `corroborate`, not `origin`; (c) dedupe shares the first caller's abort signal; (d) `budget.snapshot()` is not yet written into the grounding record (one line: `record.budget = budget.snapshot()`), so "what was not asked" is not yet shown to the person.

## 7. Files
- `fold-chat-budget.js`, `fold-chat-budget.test.mjs` (23 tests)
- `eval/ants/C4-PREREG.md`, `C4-RESULTS.md`, `c4/wire.diff` (not applied)
- `eval/ants/c4/measure.mjs` (harness + the gate, shared by live and replay), `analyze.mjs`, `reach.mjs`, `mutate.mjs`, `probe.mjs` (the one pre-prereg exploration), `before-1|2.json`, `live.json|live-2|live-h1|live-p.json`, `reach.json`, `analysis.md`, logs.

## 8. What I did NOT do
Apply the wiring or touch any shared/vetoed file; measure the slot pipeline, deep effort, agent mode or multi-turn threads; run the real wired code (the live gate is a network-level stand-in for it: the page's own refusal paths ran, but not the proposed `guardFetch`/`done()` call sites, and the gate has no dedupe); establish noise bars (two baseline passes, one to three gated passes; the web changed between them: pluto's relay went 502 mid-session); show the budget's refusals in the UI; touch the Cloudflare relay or the proxy list itself (the cheapest cut of all is probably dropping 4 of the 6 public proxies, which the hedge knob does at the call site).
