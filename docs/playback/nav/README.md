# Navigating inside the holograph: popping in and out of sources

Experiment and prototype. No app code was touched; nothing here calls a model or the network.
Everything is under `docs/playback/nav/` (plus notes in `eval/ants/design/N1-*.md`).

| File | What it is |
|---|---|
| `a-sheets.html`, `b-push.html`, `c-zoom.html`, `d-split.html` | four self-contained interactive mocks, one per stacking model (light and dark follow the OS; the ◐ button flips) |
| `src/kernel.{css,js}` | what all four share: the chat, the five layer kinds, the stack, the History contract, focus/inert/announcements, the return pill |
| `src/{a,b,c,d}.{css,js}` | what differs: where a layer sits and how it arrives |
| `sitestyle.mjs`, `sitestyle.test.mjs` | WEAR THE SITE: a page's own css -> twelve safe tokens (23 tests, `node --test`) |
| `prep.mjs`, `build.mjs` | data and mock builders (`node prep.mjs && node build.mjs`) |
| `verify.mjs` -> `shots/verify.json` | drives every model with real taps/clicks/keys/History (Playwright, headless, own context) |
| `shots.mjs`, `compare.mjs`, `contact.mjs` | screenshots; `shots/compare-*.png` is the four models side by side; `contact-sheet.html` + `shots/sites-contact-*.png` is the real-site contact sheet |

Open a mock and try it: tap a small `◉ 2` after a sentence. Deep links work: `a-sheets.html#/c~nose~1/p~nose~0~7/g~nose~0~7/e~nose~blood%20vessels/p~nose~1~8` opens five layers deep.

## What is real, what is composed

* **Recorded turns** (from `docs/playback/fixtures/turns.json[0]` and `eval/ants/falsify-checks/f3/real-b.json[10]`, via the structure stage's trims): "who invented the telephone?" (3 sources) and "Is the Great Wall of China visible from space?" (6 sources). Kept lines, which sentence states which run of the answer, and the names that appear in more than one page are as recorded. The subject | verb | object atoms are cut by the app's own `deriveGraph` (run as shipped); they are heuristic and visibly rough ("truth | is | Great Wall of China cannot be seen"). That roughness is real and is shown, not cleaned.
* **Composed turns, labelled in the chat as `COMPOSED DEMO`**: "How do I stop a nosebleed?" (NHS + wikiHow) and "What did Marie Curie win the Nobel Prize for?" (Britannica + two NobelPrize.org pages). Not recorded: I built them from pages in `eval/snips/cache` because the recorded turns' sources are mostly not cached, and I wanted source layers on *different real sites*. The answer sentences are verbatim snips of the cached pages (never reworded; `prep.mjs` asserts every quoted string is a substring of a page line), and the page text is the `<p>/<li>/<h2>` text of the cached HTML, most relevant lines kept.
* **Site looks**: tokens read by `sitestyle.mjs` from the cached HTML of the same domain (the cached page of that domain that yields the most tokens). Where a domain has no cached page (5 of the 6 Great Wall sources, sciencefocus.com) the layer wears the SITE_TYPE entry or the neutral reading style, and the site layer says so ("Typeset after: no cached page"). One labelled stand-in: skyatnightmagazine.com borrows bbc.com's tokens.
* The **kept page is thin** and the mocks show it: Britannica's kept text for the telephone turn is two lines (101 characters); wikiHow 3,759 of 9,305; the Great Wall travel guide 263 of 6,313. Every page layer says "A partial reading".

## The layer grammar

Five kinds, same everywhere. A layer is a pop-up that opens from a specific thing and that you can only leave by going back to that thing.

| Kind | Opens from | Shows | Wears |
|---|---|---|---|
| **Evidence card** (`c`) | the small `◉ n` after an answer sentence (one target per sentence; no underlining of text) | the sentence; which source sentences state it (verbatim, the matched run in bold); subject / verb / object atoms; "partial reading" when no single sentence states it (the telephone answer) | app; each evidence row wears its own source |
| **Passage** (`p`) | an evidence row, or an "other place" row | the cited line with one line either side, the cited sentence marked by a bar in the site's accent; names that appear elsewhere as chips | the site |
| **Page as kept** (`g`) | "The whole page" or a source chip in the chat | every kept line, a meter ("kept 3,759 of 9,305 characters"), the same name chips; scrolls to the cited line | the site |
| **Elsewhere** (`e`) | a name chip | every sentence in every source that holds the name (plain string search), grouped by site, each row in its own site's look | app; rows wear |
| **Source site** (`s`) | "The site" | what the fold has of it, why it can't be framed, link out with a text-fragment URL, the tokens it was typeset with and where each came from | the site |

Text is never highlighted wholesale or underlined. Emphasis is: a left bar on the cited sentence, bold on the matched run, bold on the name when you came from a name.

## The breadcrumb grammar

Labels (short, always the same): `Claim 2`, `NHS` (passage), `NHS page`, `blood vessels`, `wikihow.com`. A crumb is a button that goes back **to that layer** (`history.go(-k)`), never forward. The last crumb is the current layer, not a button (`aria-current="location"`).

Collapse at 375 (verified in `shots/compare-375-*.png`):
* A: chat strip, then at most 3 ancestor strips (older ones narrower, as a receding stack); beyond that the oldest become one `N earlier layers` strip that opens a list.
* B: spine `Chat › +3 › blood vessels › ● wikiHow`: chat, a `+n` chip (opens a list), the previous layer, the current one. The dot is the layer's accent, so the spine tells you which site you are in without reading.
* C: no readable trail; a ring legend (top right, `▣ 5`) opens the list.
* D narrow = A. D wide: three kinds of column left to right: chat, 40px vertical spines for old layers, the previous layer still readable (280px, tap to go back to it), the current layer.

Always-visible way back, same corner every layer, every model: **the return pill**, fixed bottom-left, 44px, `‹ <previous layer>` and (from depth 2) `Chat n`. Measured at 375 and 1200, every depth, every model: x = 12, 12px from the bottom, never moves (in D wide it sits at the right edge of the chat pane, x = 352, constant across depths). Plus Escape, the browser/phone Back, and each model's own gesture.

## The four models, compared (375 and 1200, measured by `verify.mjs`)

"Lost" is the vertical space not given to the top layer's content (strips, spine, ring legend, the layer's own title row). It excludes the floating pill (44px tall, bottom-left, over content; every layer's body has 84px of bottom padding so nothing is permanently hidden).

| | A sheet stack | B push + spine | C spatial zoom | D split (wide) / A (narrow) |
|---|---|---|---|---|
| Lost at depth 1 / 3 / 5 / 6, 375 | 100 / 164 / 196 / 196 px (12 / 20 / 24 / 24 %) | 96 / 96 / 96 / 96 px (11.8 %) | 52 / 64 / 76 / 82 px (6 -> 10 %), plus 3 px a side per ring (30 px of width at depth 6) | = A at 375; at 1200: 52 px high, but the current pane is 819 / 539 / 459 / 439 px wide at depth 1 / 3 / 5 / 6 |
| Comprehensible 5 deep? | Mostly. Top two strips name the previous layers; from depth 5 on, middle layers fold into "N earlier layers". The stack metaphor reads instantly. | Yes for *where* (spine), no for *what is under* (`+3`). Cleanest on the page itself. | The weakest trail: rings and a count. You feel depth; you cannot read it. | Best on wide: chat, spines and the previous layer all at once. Phone: as A. |
| Way back | pill, Esc, History; tap any strip; swipe down on the header: full -> half -> back | pill, Esc, History; tap any crumb; swipe from the left edge (past ~38 % or a fast flick) | pill, Esc, History; pinch-in, ctrl+wheel; ring legend list | pill, Esc, History; tap a spine or the previous pane; tapping the live chat starts a **new** stack (one history entry; Back restores the old one) |
| Position kept | chat and every layer stay mounted: chat scrollTop 767 -> 767, page layer 120 -> 120 | same | same, and the zoom-out lands on the tapped thing's **current** rectangle (mark at 206,240 before; 206,240 after) | same; chat is visible the whole time |
| What the motion says | "this is on top of that" (sheet rises, strips stack) | "deeper is to the right, Back is to the left" | "this very thing became that" (the tapped element's rectangle grows into the layer; the parent zooms toward that point) | "everything is still here, side by side" |
| Chrome that is permanent | strips (chat 40 + 32 each, max 4) + 52 title row | spine 44 + 52 title row | ring legend 44 (overlaps title row) + 52 title row | as A narrow; wide: 52 title row, 40 px per spine |
| Weak point | eats a quarter of a phone at depth 5; header drag competes with scroll | page is full-bleed and wide at 1200 (a measure-wide column in a field of paper) | discoverability (pinch); rings are decoration; heaviest animation | wide only; at 900-1100 px the previous pane folds into a spine |

Focus and reading order, identical in all four (kernel): the top layer is `role="dialog" aria-modal="true"`, labelled by its `h2`; focus moves to that `h2` on open; everything under it, including the chat, is `inert` (`aria-hidden` too). The breadcrumb (`nav`) and return pill (`nav`) are *outside* the inert region, so they stay reachable: DOM order is chat, layers, return pill, live region. On back, focus returns to the element that opened the layer you left (verified: after Esc the `◉` mark has focus and pulses once, "you were here"). A polite live region says "Layer 3: NHS: the page, as the fold kept it. Escape goes back to NHS." Every action works by tap or Enter/Space; all targets >= 44px. `prefers-reduced-motion` sets all durations to 1ms. D wide is the exception to modality: the chat stays interactive, layers get `aria-modal="false"`.

## Recommendation: D (the split on wide, the A sheet stack on narrow)

1. One stack, one History contract, two geometries chosen by width (>= 900px): the same layers either way.
2. Phone: A's strips are the breadcrumbs, so you never read a trail, you see one; each strip wears its own site, which is where "pop-ups inside the real websites" actually shows.
3. Wide: chat stays live and in place (position preservation by never leaving), old layers fold into 40px spines, the previous layer stays readable.
4. One thumb: the pill, bottom-left, every layer. Escape, Back and swipe-down all agree with it.
5. Borrow from C: grow the sheet out of the tapped sentence marker (WAAPI clip-path, 400ms) and pulse that marker on return. It costs nothing in chrome and is the best continuity cue of the four.
6. Cap the phone at 4 comfortable layers; layers 5 and 6 work but the strips fold. If depth 5+ is common, B's constant 96px is the fallback for phones.

## The History API contract

* The chat is history entry 0: `replaceState({fold:1, stack:[]}, "", "#/")`.
* **Open a layer = `pushState`** with the whole stack serialised: `{fold:1, stack:[{k,turn,claim|src|line|name,id}...]}` and a readable hash `#/c~nose~1/p~nose~0~7`. Scroll and detent are not pushed (not navigation).
* **Back one layer = `history.back()`**. The Back button, the pill, Esc, swipe, pinch all call it: one path, so UI and phone Back cannot disagree. `popstate` is the only thing that mutates the stack (`sync(target)`: diff by layer id; pop what left, push what arrived).
* **Chat (close all) = `history.go(-depth)`**; a crumb at index i = `history.go(i - depth)`.
* Forward restores layers from the state snapshot; cached scroll positions are restored when the layer's DOM is rebuilt.
* **Cold deep link / reload**: parse the hash, `replaceState` the root, then `pushState` once per layer so Back walks them one by one (verified: depth 5, Back -> 4). Editing the hash in place (no reload) is a plain `popstate` with null state and also works, with one entry.
* **The phone's Back never leaves the app while a layer is open** (verified: depth 3, three Backs -> depth 0, same document, `#/`). At depth 0 Back leaves, as expected. Not implemented: a "press Back again to leave" guard.
* From a chat that is live beside the layers (D wide): a tap there pushes a *new* single-layer stack; Back restores the old stack. Depth is capped at 8 (history stays bounded).

## What each model does with gestures (all exercised by `verify.mjs`)

A: tap header full <-> half (detents), drag down 70-220px -> half, further -> back one. B: left-edge drag, past 38% commits, short drag cancels. C: two-pointer pinch below 72% of the starting distance, or ctrl+wheel (trackpad pinch), goes back one. D: spine tap, previous-pane tap, chat tap.

## WEAR THE SITE: `sitestyle.mjs`

`extractSiteTokens({html, css, domain, theme}, {typeOf})` -> exactly twelve tokens `{paper, ink, muted, link, rule, accent, bodyFont, titleFont, titleWeight, titleCase, measure, radius}` plus a `meta` (where each came from, contrast, scheme). Reads: inline `<style>`, the text of the first fetched stylesheet if you pass it (`firstStylesheetHref(html, base)` says which), inline `style`/`bgcolor`/`text`/`link` on `<html>`/`<body>`, `:root`/`html`/`body` custom properties (var() chains, `light-dark()`), `prefers-color-scheme: dark` blocks and `.dark`/`[data-theme=dark]` root selectors, `h1/h2` face/weight/case, body-link colour, `max-width` of `main/article/body`, button/card radii, `<meta name=theme-color>` (accent, or paper if a quiet neutral), `color-scheme`.

Hard rules, each a test:
* **Never injects site CSS.** Output values come from closed grammars: `#rrggbb`, four font stacks assembled from *our* constants (a site font maps to serif / sans / mono / system by name and by its stack's last generic keyword; an OS-installed lead like Georgia or Helvetica Neue may lead), integer weight, three case words, integer `ch` and `px`. `validateTokens` is the gate; `tokensToVars` throws on anything else. The mocks re-check the same grammar in the page before setting a property.
* **No url(), no @import, no @font-face, no external fonts or assets.** They are *counted* (`meta.ignored`) and never followed; a colour inside a `url(...) #fafafa` shorthand is still read.
* **Contrast: ink, muted and link >= 4.5:1 on paper; the ink moves, the paper does not.** Paper is only clamped for loudness (chroma <= 0.06; lightness band per theme). Fuzzed over 400 random paper/ink/link triples in both themes.
* **Nothing usable -> the SITE_TYPE entry** (passed in as `typeOf`), run through the same sanitiser, else a neutral reading style.
* **App theme decides**: dark app -> the site's own dark layer if it has one (found in 28 of 986 cached pages), else a dark paper *derived from the site's hue* (`meta.scheme: "derived-dark"`); the reverse for a dark-only site in a light app.
* Capped input (4 MB HTML, 700 KB css total), tolerant parser (hostile and random input does not throw or stall).

**How much identity is really in a fetched page?** Over all 986 cached HTML pages (414 domains): 0 invalid token sets, minimum ink/link contrast 4.6:1. But only inline `<style>`, root attributes and metas are in the cache (the linked stylesheets are not), and that is thin: 431 pages (44%) yielded **no** site-read token; 309 (31%) yielded three or more; `theme-color` appears in 251; a paper colour was read in 249; accent in 105; headings' face in 91. Most big sites keep their identity in a linked sheet, so what you see in the mocks and the contact sheet is the **floor** of what the relay would read if it fetched the first stylesheet too. The stylesheet path itself is covered by tests and shown in three clearly labelled **synthetic** tiles (hand-written fixtures, not fetched from any site). Cost note: parsing runs about 1 s per 500 KB of css cold, so it belongs in the relay (where the HTML already is), cached per domain, never in the page.

Contact sheet (`contact-sheet.html`, `shots/sites-contact-{1200,375}-{light,dark}.png`): 16 real cached sites (Wikipedia, BBC, USA Today, NHS, usa.gov, CDC, SSA, wikiHow, NobelPrize, two food/DIY blogs, python docs, MDN, W3Schools, GitHub, Britannica) + 3 synthetic tiles, each light and dark, with a 12-square strip showing which tokens were read from the site (green), from SITE_TYPE (amber) or defaulted (grey). Variability that is *meaningful* in this data: NHS (pale blue-grey paper, Arial), wikiHow (grey paper, 80ch, green rule), BBC (red accent, bold sans titles), USA Today and CDC (blue accents), Britannica (navy, 700 titles), GitHub dark (its own `#1e2327`), Python docs (blue accent). Variability that is not there: Wikipedia, MDN, NobelPrize, usa.gov, SSA read as neutral because their sheets are linked.

## Honest limits

* **We keep only clipped passages.** The "page" layer is the fold's kept lines, not the page; it says "A partial reading" with a meter, and the passage header shows `partial n%`. Where the cut is poor (two lines of Britannica navigation text) the layer is nearly empty; that is the truth.
* **Live pages cannot be framed** (X-Frame-Options / `frame-ancestors`; cross-origin reads blocked). So the deepest layer is a card, not the site. It links out with a text-fragment URL (`#:~:text=first five words,last five words` of the cited sentence) in a new tab, `rel="noopener noreferrer"`; browsers without text-fragment support open the top of the page. Neither the app nor this prototype loaded any live site.
* A layer is marked a **partial reading** whenever no single source sentence states the claim (the telephone answer: `grounded: false, why: "terms"`), whenever kept text is a fraction of the page, and in the site layer's "what the fold has".
* "Other places" is a plain case-sensitive string search over kept lines. It does not know that "Bell" and "Alexander Graham Bell" are one person, and it does not yet reach other chat turns (the fold's claim store could; not modelled).
* Atoms are the app's heuristic cut. Gestures were exercised with synthetic pointer events and `ctrl+wheel`, not on a phone; no screen reader was run (the focus/inert/live-region order is asserted from the DOM, not heard). The comprehension ratings are my judgement from screenshots, not user-tested.
* Forward navigation after a cold start restores layer content but not their scroll (scroll is cached only for layers popped in this session).

## Three riskiest open questions

1. **Is the identity there to read?** Most of it lives in linked stylesheets that the relay does not fetch today; without them 44% of pages give nothing. Fetching the first stylesheet (size cap, timeout, https only, per-domain cache, parse in the relay) is the whole bet behind "meaningful variability"; the alternative is to grow SITE_TYPE by hand.
2. **Do layers 3 to 6 earn their depth when the kept page is a few lines?** The page and site layers are honest but sometimes empty. Either keep more of the page, or fold page and passage into one layer and make depth 3 the "other places".
3. **Phone chrome and the gesture contract.** A costs 24% of the screen at depth 5; B costs 12% flat; the sheet's header drag and the body's scroll share a thumb. And Back at depth 0 leaves the app: decide whether the chat should guard it.
