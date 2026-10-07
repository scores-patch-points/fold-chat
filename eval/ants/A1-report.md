# A1 report — why the origin lane finds no primary page (2026-10-06)

Method and pre-registration: `eval/ants/A1-PREREG.md` (written before any run). Every number below comes from a file in `eval/ants/a1/`. No vetoed file was edited; the
one counterfactual copy of fold-chat-origin.js is `a1/origin-min2.mjs` (minAtoms 3 -> 2).

## Headline

**CORS / the browser is NOT the cause for these five asks.** The same function (`originatePassages`) on the *same passages*, run in the real page (relay chain) and in Node
(direct fetch), gave an identical status for **36 of 39 claims**, and **0 origins on either side** (`a1/node-vs-browser.json`; the 3 differences are 12 s turn-box timeouts that fall either way).

The chain stops, in order of frequency, at:

| stage the chain stopped at | claims (browser runs 2+3, n = 63) |
|---|---|
| `no-reference` — the sentence has no footnote under it, and the body fallback found no cited sentence | **42** (67 %) |
| `unsupported` — footnote page(s) read, none "carries the claim" per `supportOf` | 12 |
| `unread` — a note with no page (book), a dead/blocked page, or the 12 s box | 6 |
| `unlocated` — sentence not found in the article's HTML prose | 3 |
| `origin` | **0** |

Footnote reads actually attempted in the browser: 28; 14 read OK (50 %), 8 were notes with no URL (books), 6 failed. Reads that won through a *public proxy* or a *text reader*: **0 of ~100** (every win in
all my runs was `direct` or `the fold's relay`).

## Per ask (live page, browser run 3 = `a1/browser3-run.json`; runs 1 and 2 show the same stage)

| ask | root cause (evidence) | stage | what would fix it |
|---|---|---|---|
| **Who is the king of the UK?** | The Wikipedia sentence the answer quotes, "The monarch since 8 September 2022 is King Charles III…", is in the lead and **cites nothing** (`marks: []`; Monarchy_of_the_United_Kingdom parse HTML: 132 notes, **0 cited sentences** state the fact; Charles_III article: the "is King of the United Kingdom" sentence carries only an explanatory note, no page). All 9 claims followed were `no-reference` (3 of them for *The Kid Who Would Be King* and *Paul King (VJ)*, passages the search read — wrong pages). CORS irrelevant: no footnote was ever fetched. | no-reference | Not footnote-following (nothing to follow). Search the answer's atomic claim and read non-encyclopedia pages: in `a1/search-fix-sim.json` BBC (bbc.com/news/articles/c867plj4vgqo) is `same`; royal.uk is unreachable (relay 403/bot wall, `a1/primary-candidates.json`). |
| **How tall is the Eiffel Tower?** | Four separate failures. (1) The followed claims are *not* the quoted sentence: they are the lead (`unlocated`), "named after…" (`no-reference`), "5,889,000 visitors" (`unread`: note is a book). The height sentence is never followed. (2) The lead is **unlocated** because the chat's passage is the plain-text *extract* and the lane's blocks are parse HTML: the HTML has `(/ˈaɪfəl/ ⓘ EYE-fəl; French: Tour Eiffel [tuʁ ɛfɛl] ⓘ)`, the extract does not (`a1/unlocated.mjs`). (3) When the height sentence is followed by hand it **is** cited — footnote 9, reuters.com "Eiffel Tower grows six metres…" — but reuters answers 401 ("Please enable JS") to Node **and** to the relay, no archived copy in the article (`a1/reuters.mjs`, `reach.json`). (4) Even pages that say it verbatim ("The Eiffel Tower is 330 metres (1,083 feet) tall, antennas included", place-du-trocadero.fr; eiffeltowertravel.com) are rejected by `supportOf` as **`undecidable/idle`** — the claim has 2 atoms and `ORIGIN.minAtoms` is 3. With the whole Wikipedia sentence as claim, the same pages fail on `figure` ("81-storey" etc. are not on the page). | unlocated / no-reference / unread, then idle gate | `minAtoms` 3 -> 2 (copy test: 330 m pages flip to `same`, wrong-figure and other-tower decoys stay `undecidable/figure`, `a1/min2.mjs`); follow the *answer's* sentence; fold the IPA/ⓘ away in `folded()`. |
| **What is the capital of Australia?** | The quoted sentence "One of these, Canberra, is also the national capital." is on *List of Australian capital cities*, a page with **3 notes in total**; the sentence has none (`no-reference`). 8 of 9 claims are `no-reference`; the 9th (a capital-punishment sentence, wrong page) is the **12 s box timing out** (ms 12134 / 12191 / ~12 000 in all three runs): smh.com.au via relay -> read fails (bot wall) -> five dead public proxies + two dead text readers burn ~7 s -> the archive.org copy starts at t = 11.9 s and is cut off. The article that would help, *Canberra*, has a cited sentence (footnote 71, aso.gov.au "Lady Denman … announces the name of Australia's capital city as Canberra", reads OK direct and via relay, `supportOf(spoken) = same`) but the chat never read that article. | no-reference (+ timeout) | Read the main article, not the list page; or search-corroboration (4 pages `same`: mappr, britannica.com/place/Canberra, worldatlas, mapsofworld — tertiary aggregators, not primary). |
| **How many legs does a spider have?** | Three runs, three different Wikipedia pages (*Spider anatomy*, *Spider fighting*, *Spider*). *Spider anatomy*: 167 blocks, 17 notes; the leg sentences ("Spiders typically have eight walking legs (insects have six).") are **uncited** -> `no-reference`. On *Spider* (run 3) the quoted lead sentence IS cited: footnote 2 = doi.org/10.1007/978-1-4020-6359-6_4320 (an encyclopedia entry; read OK, `undecidable/terms`: it says "limbs"/different words) and footnote 3 = PMC2634869 (relay returned a reCAPTCHA page / `unread`). | no-reference or unsupported | search-corroboration: animalmedia.org and spideridentifications.com `same`; Britannica says it ("Insects have six legs, while spiders have eight") but `supportOf` flips between `same` / `different` on wording ("Spiders have eight legs" same, "A spider has eight legs" different: rung-2 frame sees "six" as a rival filler). |
| **When did Marie Curie die?** | The lead sentence is cited, but the footnotes under it do not state the death date in a readable English page: [1] = NYT "On this day, 7 Nov" (birthday page: no 1934); [2],[3] books (no URL). The death-sentence in the article body cites ipsb.nina.gov.pl (a **Polish** biography: says "4 VII 1934", gate says `cross-language`) and nationalstemcellfoundation.org (aplastic anaemia, no date). The lane splits the lead at the footnote, so the claim it checks is the fragment "(née Skłodowska; 7 November 1867 – 4 July 1934)," whose language reads as `unknown`, and the English NYT page is typed `cross-language`. In Node a different claim ("1911 Nobel Prize in Chemistry") did reach an origin (nobelprize.org/…/1911, `same`) — but that is not the question's claim. nobelprize curie-edu.html (footnote) is a 404; its archive.org copy read fine and was `undecidable`. | unsupported | Honest ceiling of footnote-following here ≈ 0. Already solved by the primary lane (nobelprize.org Q&A `same`: "Marie Curie died on 4 July 1934, in Savoy, France"). |

## Hypothesis scorecard (against A1-PREREG.md)

| | prediction | result |
|---|---|---|
| H1 browser/CORS is the story | browser reads fewer footnote pages than Node | **Refuted for the five asks** (36/39 identical; 0 origins both). True in general for URLs: of 36 footnote URLs, Node reads 20, the browser 13 (9 Node-only: the relay is a datacenter IP and gets Cloudflare/captcha walls — wildlifetrusts 403, hockeyone captcha, abc.net.au; 2 browser-only: apnews). The browser's direct attempt always dies on CORS (`ERR_FAILED`, instantly) and costs ~0. |
| H2 leads don't cite | >= 1 ask at no-reference | **Confirmed**, 3 of 5 asks (king, Australia, spider-anatomy) and 67 % of all claims. |
| H3 extract vs HTML | >= 1 unlocated | **Confirmed**, 3 claims (Eiffel lead, Gustave Eiffel lead): IPA / ⓘ present in HTML only. |
| H4 `supportOf` too strict | >= 1 ask has a read page rejected | **Partly**: idle gate (Eiffel) and wording-brittle `different` (spider/Britannica) are real; most other "unsupported" are correct (footnote does not say it). Reads judged `same` in the browser: 0 of 14. |
| H5 footnotes not usable | >= 30 % refuse a plain fetch | **Confirmed**: of 36 footnote URLs, 16 (44 %) fail a plain Node fetch (7 x 403/401 bot wall, 5 x 404/ENOTFOUND link rot, 4 x timeout). |
| H6 maxAttempts = 3 | supportive footnote beyond #3 | **Refuted**: max refs per claim in the live runs = 3. |

## Ranked fixes (by how many of the five each would fix)

| rank | fix | asks fixed | evidence |
|---|---|---|---|
| 1 | **Stop depending on the article's own footnotes for the answer sentence; corroborate the answer's atomic claim against non-encyclopedia pages found by search** (`followClaim` already has the `alongside` route, but it is fed only pages the turn happened to read — 0 non-encyclopedia pages in 4 of 5 browser-3 turns — and it is run before the answer on the first 3 snips, not on the answer). Read the top ~8 non-encyclopedia hits and keep the first `supportOf = same`. | **4 of 5** now (king: BBC; Australia: 4 pages; spider: 2; Curie: nobelprize), 5 of 5 with fix 2 | `a1/search-fix-sim.json` (browser relay reads, atomic spoken claims) |
| 2 | **`ORIGIN.minAtoms` 3 -> 2** (when the claim has a figure and a name) so a short slot claim is not `idle` | Eiffel (and every short numeric answer) | `a1/min2.mjs`: 2 correct pages flip to `same`, 2 decoys stay rejected |
| 3 | Make the origin step follow **the sentence the answer rests on** (the one `provenance` points at), not `MAX_CLAIMS = 3` first snips; keep the first-3 only as a fallback | 0 alone (the quoted sentences are uncited), but it makes the report about the right sentence and stops 60 % of the work being spent on off-question sentences (e.g. "5,889,000 visitors", capital punishment) | `browser3-run.json`: the quoted sentence was among the followed claims in 3 of 5 (king, Australia, spider), not in Eiffel or Curie |
| 4 | Read the **main article** (Canberra, Spider), not the list/anatomy page the search put first | Australia (aso.gov.au `same`) | `a1/ceiling.json` |
| 5 | Prune the dead public proxies / readers from `CORS_PROXIES` / `TEXT_READERS`; stop retrying a host that answered 401/429 | 0 directly, but removes ~7 s from every failed read, which is what keeps the archive.org copy from being reached inside the 12 s box (Australia timeout in 3/3 runs) | `browser3-run.json` net: thingproxy ENOTFOUND 21/21, corsproxy.io 401 21/21, cors.eu.org ERR_FAILED 21/21, allorigins/codetabs never won, jina 401, microlink 429; 0 wins in ~100 reads |
| 6 | `folded()` in `locate` should drop pronunciation brackets (`/…/`, `[…]`, ⓘ) | 0 of 5 answers (only the Eiffel *lead*) | `a1/unlocated.mjs` |
| 7 | A local/residential read path in the browser (extension `direct`, or the local bridge) | 0 of 5 | 9 of 36 URLs Node-only, none on the answer path of these asks |

## Proposed patches (diffs; NOT applied — all files are vetoed)

```diff
--- fold-chat-origin.js
 export const ORIGIN = Object.freeze({
   maxAttempts: 3,
   maxHtmlChars: 4_000_000,
-  minAtoms: 3,             // EARNED: ...
+  minAtoms: 2,             // EARNED: a figure + a name is enough for a slot claim (A1: "The Eiffel Tower is 330 meters tall" = 2 atoms; 300 m / Tokyo Tower decoys still `figure`)
```

```diff
--- fold-chat-origin.js  folded()  (so the extract and the parse HTML agree on the Eiffel lead)
 function folded(s) {
+  s = String(s).replace(/\([^()]*[\/\[][^()]*[\/\]][^()]*\)/g, " ").replace(/\s*ⓘ\s*/g, " ");   // pronunciation/IPA parentheticals exist in the HTML, not in the extract
   const out = [], map = [];
```
(the map must index the original string, so in practice strip on both sides before `folded`, in `locate`: apply the same replace to `block.text` and to `sentence`; sketch only.)

```diff
--- fold-chat-originwire.js  (a second entry point; the passages list is the same)
+/** The sentence the answer rests on (the pointer's sentence), followed first; then, if no footnote leads anywhere, the search's non-encyclopedia pages are the `alongside`. */
+export async function originateSentence(passages, sentence, question, { fetchImpl, memo, signal, read = readText, extra = [] } = {}) {
+  const p = passages.find((x) => isTertiary(urlOf(x)) && String(x.text).includes(sentence)); if (!p) return null;
+  return followClaim({ sentence, passage: { url: urlOf(p), title: p.title, ref: p.ref, text: p.text }, fetchImpl, memo, read, signal,
+    alongside: [...passages.filter((x) => !isTertiary(urlOf(x))), ...extra], forWhom: question });
+}
```
and in fold-chat.js after the pointer is verified and `host` is encyclopedic: `extra = await readTopNonEncyclopedia(searchQ, { n: 8 })` (the reads `searchWeb` already did, kept past the 3 shown), then `originateSentence(...)`; the narration then uses the existing "I checked this on Wikipedia, but I consider it an index … so I went and verified it on <host>, which also says it" template when `trail.status === "origin"`.

```diff
--- fold-chat-web.js  CORS_PROXIES / TEXT_READERS  (0 wins in ~100 reads; each costs the 3.5 s budget)
 export const CORS_PROXIES = [
   (u) => `${FOLD_RELAY}/raw?url=${encodeURIComponent(u)}`,
-  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
-  (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
-  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
-  (u) => "https://cors.eu.org/" + u,
-  (u) => "https://thingproxy.freeboard.io/fetch/" + u,
 ];
 export const TEXT_READERS = [
-  (u) => "https://r.jina.ai/" + u,
-  (u) => "https://api.microlink.io/?meta=false&text=true&url=" + encodeURIComponent(u),
 ];
```
(or keep allorigins/codetabs but stop the whole chain early when the relay answered 401/403/429 — a bot wall is the page's answer, not a proxy fault.)

## What I could not determine

- **Run-to-run variance.** The pages the chat reads differ between runs (the relay's web search was empty for king and spider on some calls — the "429 -> empty 200" bug in memory; Wikipedia's own search order varies), so the live passages are a sample of 3 runs (browser, browser2, browser3), not a distribution. The stage per ask was stable (no origin in any of the 15 ask-runs); which Wikipedia page was read was not.
- **The relay's reach from a real user's network.** The relay is a Cloudflare Worker; my Node IP is residential. Hosts that wall datacenter IPs (reuters 401, wildlifetrusts 403, hockeyone captcha, toureiffel.paris 403 on a later call although it was read once) are unreachable from the page regardless of the user, but I could not test a user's own browser IP or the extension's `direct` mode.
- **Whether "XYZ" may be a tertiary aggregator.** The search-corroboration route returns `same` pages that are mostly aggregators (mappr, worldatlas, mapsofworld, britannica); only BBC, nobelprize.org and aso.gov.au are primary. Whether that satisfies "verified on XYZ" is a product call; `supportOf` also gave at least one weak `same` (mapsofworld: "Australia used to have different places as its capital before Canberra became the main one").
- **`supportOf` correctness beyond these pages.** I found one wording-brittle flip (Britannica spider) and the idle gate; I did not audit its false-positive rate.
- **Wikipedia's parse API was 429-ing my Node runs** (shared IP, retry-after 11 s). It never 429'd in the browser runs (all `action=parse` were 200), so `unindexed` is not a cause in the live asks; I cached API answers on disk to avoid confounding.
