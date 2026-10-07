# A1 pre-registration (written BEFORE any run of the origin lane in Node or the browser)

Question: why does the origin lane (fold-chat-origin.js `followFootnotes`, driven by fold-chat-originwire.js `originatePassages`) end with no primary page
in 3 of 5 live asks? Asks: king of the UK / Eiffel Tower height / capital of Australia / spider legs / Marie Curie death.

Chain stages where it can stop (each is a status in the Trail): wikiIndex (unindexed) -> noteMarksFor (unlocated) -> refs under the sentence (no-reference,
then bodyMarksFor fallback) -> read the footnote page (unread) -> supportOf (unsupported / contradicted) -> origin.

## Hypotheses (each is refuted by the counterexample named)
H1 (BROWSER vs NODE). The page runs in a browser; footnote hosts (royal.uk, toureiffel.paris, gov.au, britannica.com, nobelprize.org, ...) do not send CORS
   headers, so `readText`'s direct attempt fails in the browser and everything rides the relay chain (holodeck-proxy workers.dev, then public proxies, each
   with a 3.5 s budget). PREDICTION: in Node (no CORS) strictly more footnote pages read OK than in the browser for the same refs. REFUTED if the browser
   reads >= as many footnote pages as Node for the same asks, or if the browser's read failures are not CORS/proxy failures.
H2 (LEADS DON'T CITE). The sentence the strand quotes is the lead's first sentence. Wikipedia leads for short factual items (capital of Australia, spider legs)
   carry no footnote under the sentence, and the body fallback (`bodyMarksFor`, minShare 0.5) finds none. PREDICTION: at least 1 of 5 asks stops at
   `no-reference` or `unlocated`. REFUTED if every ask reaches stage "refs non-empty with a url".
H3 (EXTRACT vs HTML MISMATCH). The chat's passage text comes from the plain-text `extracts` API, the origin lane's blocks from the parse-API HTML; pronunciation,
   parentheses, dates, nbsp can make the sentence not locate (`unlocated`). PREDICTION: >= 1 claim among the 15 or so followed is `unlocated`.
   REFUTED if 0 claims are unlocated.
H4 (SUPPORT TOO STRICT). Where a footnote page IS read, `supportOf` (consequence: every figure/name/term of the claim must be in one page sentence; minAtoms 3)
   rejects it: Eiffel (figure 330 m / 1,083 ft in different units), Curie ("died on 4 July 1934"). PREDICTION: >= 1 ask has a page read OK but verdict
   undecidable/different/unsupported. REFUTED if every successfully read footnote page for those asks is `same`.
H5 (FOOTNOTES ARE NOT PRIMARY OR NOT PAGES). Many footnotes are books, news outlets behind bot walls, or Britannica/other encyclopedias (tertiary). PREDICTION:
   among the footnote URLs actually named, >= 30% are hosts that refuse a plain fetch (HTTP 403/429/captcha) from Node. REFUTED if < 30%.
H6 (maxAttempts=3). Only the first 3 distinct refs of the first-3 claims are tried; the supporting one can be footnote 4+. PREDICTION: weak; refuted if
   no ask has a supportive footnote beyond position 3 (I will test by raising maxAttempts offline, without editing the lane: pass option via followFootnotes? not
   exported — I will replicate by reading all refs myself with the lane's `supportOf`).

## Per-ask predictions
- king of the UK (Charles III): lead sentence has footnote(s) ([1] royal.uk / gov.uk) -> in Node OK; browser: royal.uk or gov.uk may fail -> unread or unsupported.
- Eiffel Tower height: infobox / lead height has footnotes to toureiffel.paris / Skyscraper Center; unit mismatch -> unsupported (H4). 
- capital of Australia: lead "Canberra is the capital" has no footnote -> no-reference (H2).
- spider legs: "Spiders ... eight legs" in lead, no footnote or footnote to a book -> no-reference / unread (H2/H5).
- Marie Curie death: the lead "died 4 July 1934" with footnotes to Nobel / Britannica / biographies -> mostly tertiary or bot wall -> unread / unsupported.

## Method (fixed in advance)
1. Node: import parseWikiHtml/wikiIndex/followClaim/supportOf from the lane; real fetch; same passages the chat read (derive the passage the way the chat does:
   readText on the wikipedia URL) and the same claims (`claimsOf` = snipsOf lead sentences; reuse originatePassages through its public interface with real
   fetch and also direct stage-by-stage probes).
2. Browser: drive the real page (eval/pivot/chat-live.mjs openChat/say) with the five asks; read message.grounding.web and the feed from the stored session.
3. Compare per footnote URL: Node direct fetch status vs browser-side (CORS) read status.
Nothing in the lane is edited. Results are not edited after the fact; where a hypothesis is refuted the report says so.
