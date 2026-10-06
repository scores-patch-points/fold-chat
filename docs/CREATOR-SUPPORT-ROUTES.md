# Creator-support routes (the kind, its evidence, its falsifiers)

**Standing: nomination.** Every sub-kind below is declared by hand and measured only on ten real pages
(docs/CREATOR-SUPPORT-ROUTES-PREREG.md, Results). Nothing here has standing in the wild.

## What it is

A *creator-support route* is a way, **published by the creator's own page or site**, for a person to support the creator or
reach them. The Fold finds it by its typed definition, not by a string scan:

* the definition: `fold-chat-support-routes.json` (the only place it is edited; `fold-chat-support-routes-def.js` is its generated
  browser mirror, `node scripts/gen-support-routes.mjs`, and a test fails if they differ);
* the recognizers: `fold-chat-support.js` (compiles the definition; no platform, word or falsifier is written there);
* the sequencing (route order, budgets): `fold-chat-tip.js::findContact`; the hand: `fold-chat-tipview.js`.

Every `contact.js` word list (role mailboxes, service desks, free-mail, contact words) is read from the same file.

## Sub-kinds and the route order

| order | id | yields | what |
|---|---|---|---|
| 1 | `tip-link` | tip | a link on the page, or on the creator's own contact / about page, to a known platform (Ko-fi, Buy Me a Coffee, Patreon, PayPal.Me / donate, GitHub Sponsors, Liberapay, Open Collective, Stripe donation / payment links, Cash App, Venmo, Substack, Gumroad, Afdian, Boosty, FANBOX, Cafecito, Apoia.se, Tipeee, Steady, ... 35 declared) or to a page on the creator's own site whose own words say donate / support me / tip jar (multilingual: en es fr de pt it nl pl tr ru zh ja ko ar hi) |
| 2 | `structured-donate` | tip | JSON-LD `DonateAction` target / url, `sameAs` on a creator platform |
| 3 | `rel-payment` | tip | `rel=payment|donation|donate`, `rel=me` on a creator platform |
| 4 | `feed-author` | name | the advertised same-site RSS / Atom feed: managingEditor, author, dc:creator (a name for the greeting; an address only through the email rules) |
| 5 | `humans-txt` | name / tip | `/humans.txt`, read through the direct door only |
| 6 | `email` | email | unchanged rules: mailto / structured data / protected link / written on a contact page; own domain or free-mail; no machinery or service mailboxes; a commented-out address is not published |
| 7 | `form` | form | the site's own message form |
| 8 | `social-profile` | social | the creator's OWN profile / channel / page on Instagram, Facebook, X, YouTube, TikTok, Pinterest, Threads, Bluesky, Mastodon (rel=me), LinkedIn, Substack, Medium, GitHub, Twitch, Reddit, Telegram, Weibo, Bilibili, LINE, Kakao, VK, or one link hub the page itself links |
| 9 | `website` | website | the page's own origin (derived, never searched) |

Outcome order of the button: **tip -> email -> form -> their own pages (website, profiles)**.

## The button (one shared control)

* tip found: the creator's own tip page opens in a **new tab** (noopener, noreferrer) on the click; the control shows
  "Open Ko-fi (ko-fi.com)" as the primary link, further tip pages as "Also: ...", and, if the page also publishes an email,
  a quiet secondary **"Or email them"** that opens the draft only when pressed (never both at once). If the search took longer than 3.5 s
  the browser may block the popup, so the tab is not auto-opened and the primary link is focused instead.
* email only: unchanged (mail draft opens, "Open the email draft again").
* form only: unchanged (draft copied, contact page opens).
* none of those: the plain status "No way to tip them directly. Their own pages:" and chips "Open their website" and one per
  published profile, each a new-tab link showing its host. Nothing opens by itself. With a tip / email / form, the website and
  profiles are quiet secondary links under it.
* The status line says: tipping is in development; the Fold sends nothing and takes nothing (a direct tip page can really receive
  money, and the Fold is not in that exchange). Toasts say whose page, which host, and where it was found.
* >= 40 px targets on phones, keyboard operable, light / dark, no dead button (a retry is always possible).

## What it is NOT (the falsifiers; each has a test, and a test asserts the list is complete)

`tip-link`: comment-section / rel=ugc / rel=sponsored links; a donate link to another organisation; store checkout (Etsy, a product,
a payment link with no tip words); lookalike hosts (`ko-fi.com.evil.test`, `ko-fi.com@evil.test`); shorteners, link hubs and trackers;
a newsroom's *information* tip line (`/tips`, "Have a tip?"); customer / technical support; a platform's own marketing page
(`github.com/open-source/sponsors`); two different pages on one creator platform (ambiguous: none offered); a platform link in
running prose with no words, rel or structured signal; a constructed link (BMC widget `data-id`, payment pointer, bare handle,
urlTemplate); a prefilled amount (stripped: amount, email, currency, utm_*, fbclid).
`social-profile`: SHARE buttons by URL shape on any host (sharer.php, dialog/share, intent/tweet|post, pin/create, whatsapp send,
wa.me?text, mailto share, linkedin shareArticle / sharing/share-offsite, t.me/share, reddit submit) and by toolbar class
(AddToAny, ShareThis, sharedaddy ...); comment-section profiles; embedded posts / blockquotes; post, video, repository and
playlist URLs; lookalike hosts; a platform's own navigation when the page is on that platform; someone else's profile (needs rel=me,
sameAs, the chrome plus the site's or author's name, or the owner on a code forge; a second profile per platform and any
link hub / subreddit need a declaration or the owner's name); constructed profiles.
`website`: only the page's own origin, http(s) only.

## Address and privacy

A finding carries `at = { page, node, range:[start,end) in UTF-8 bytes, unit }`, held by the record (`expand(text, at)` re-expands it),
never handed to the model (a test asserts the sources prompt carries neither routes nor addresses). Stored routes on a card are
re-verified on use (`tipStillValid`, `socialStillValid`). The Fold never pays, prefills, collects payment details, posts, follows or
visits a profile; no registry / WHOIS / RDAP / IP / hosting lookup and no security.txt exist (tests grep the tip code). Budgets:
the page once; then <= 2 contact / about pages; then <= 2 more loads for routes 2-3 (feed, humans.txt through the direct door),
sequential, 1.2 s apart, same site only; a card that already holds what the page offered loads nothing. Marketplace pages
(allrecipes, reddit, youtube ...) get no tip, social or website route: the site's address is the platform's.

## How it plugs into the holograph

`routesInPage(html, url)` returns typed, addressed findings (plus `rejected`, each with the falsifier id that refused it: a gap shown,
never filled). `offeredKind(record)` and `sourcesOffering(records)` answer "which sources offer a way to support the creator?"
(tip, then email, then form) from a card's `contact` or a passage's `contacts`. The sub-kinds are listed in the registry
`SUPPORT_KINDS` / `kindOf(id)` with their standing. No existing registry (fold-chat-kinds.js is the shapes of *asks*) fits,
so the definition file is the registry.
