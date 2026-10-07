# C6 — wiring proposal for fetched voices (NOT applied; every file named here is the boss's / another lane's)

`fold-chat-fetchedvoice.js` is pure (search, read, clock, hash injected). The path it implements: person → `voicesFor` (2 name-only queries, rank, read <= 4 pages) → `fetchVoice` → `classifyPage` → entry → `createFetchedBank` → `archons()` / `bank()` in the shapes `fold-chat-voice.js` already takes.

## 1. When a fetch happens (policy, to be decided by the user)
* Never on the chat's hot path. Trigger only from the counsel / "thinkers on a contested question" lane (B2's `fold-chat-counsel.js`) when the canon index has no verified archon for a person the question names, or when the user asks "what did X say". The aside lane (`asideOf`) only ever READS the session bank; it never fetches.
* One person at a time, `maxPages: 4`, budgeted like `findPrimary`'s (3 pages). The fetch is cancellable with the same AbortSignal discipline (an AbortError rejects).
* The person string must come from the user's words or a found name, not from a model. Aliases (pen names: Orwell/Blair) arrive as `{ name, aliases }` from the encyclopedia pointer's lead (`born Eric Arthur Blair`), never from a model.

## 2. Server / page glue (fold-chat.js, fold-chat-client.js — veto'd for ants)
```js
import { voicesFor, createFetchedBank } from "./fold-chat-fetchedvoice.js";
const fetched = createFetchedBank({ fw });                       // one per session (not persisted)
// readPage must return { ok, html, text, title, url, via } — the HTML matters (author markup). A's wrapper around readText returns text only:
//   either extend the reader door to return html, or accept that author evidence is then only Gutenberg headers / "By X" lines.
const { entries, trail } = await voicesFor({ person, search: webSearch, read: readPageHtml, now: () => new Date().toISOString(), fw });
for (const e of entries) fetched.admit(e);
const index = buildIndex([...canonArchons, ...fetched.archons()], fw);   // same index, same null, same resonance
const bank  = { ...canonBank, ...fetched.bank() };                       // quoteFromBank input
```
Browser constraint: the page can only fetch cross-origin through the relay/CORS proxies (see A1's finding), and the relay returns text, so in the page `read` = relay readText and the `html` features degrade to the text-only ones (typed in `standing.attribution.evidence`, not hidden). A server-side (Node) reader, as in `eval/ants/c6/reader.mjs`, keeps the HTML.

## 3. Two small patches to fold-chat-voice.js (not mine to make)
* `asideOf` hardcodes `grade: "canon"` in the aside it builds: change to `grade: a.grade || "canon"`, and carry `standing: a.standing` and the whole `a.source` (it already does for `source`), so the audit line can say fetched.
* `frameOf`: for `grade === "fetched"` use a different fixed sentence that does not claim canon: *"This reminds me of something <holder> is quoted as writing, from the web (<host>), about <topic>: “<quote>” I'm not sure it fits, but it came to mind."* and the "how this was answered" control shows `source.url`, `fetchedAt`, `sha256`, byte span, `license`, and the classifier's `reasons` + `attribution.tier`. Rate limit, kinds-off and repeat-handle rules apply unchanged (fetched voices count as handles).
* Tier order in a conversation that has both: canon first; a fetched voice is offered only when no canon archon clears the null (VOICE.md: "the canon's verified-quote manifests are the higher tier").

## 4. Gate on top of the classifier (what the measurements say to add)
* Admit only `verdict: "own"`. `unsure` (attributed but impersonal) and `refuse` are listed in the trail, never banked.
* **Heading-only attribution (`heading`, `genre_heading`) is the weak tier.** The one false accept in the measured runs (history.com's article about the Gettysburg Address) came in on it. Proposal, untested on fresh data: a heading-tier page is banked only when a SECOND independent host yields a verbatim sentence of it (`fold-chat-provenance.js` corroboration, the mechanism the chat already runs for answers), or the host kind is archive (Gutenberg / Wikisource / Internet Archive / government / .edu). Strong tiers (author field names the person; host is the person's own name) need no second witness.
* Re-verify on use: `bank.verify(handle, freshText)` (span-drift's sibling: sha256 of the stored text) before an aside is shown from a page fetched earlier in the session; a changed page is dropped.
* Licence: `entry.source.license` is "public domain in the US (Project Gutenberg); verify per work" for Gutenberg and "unverified: short quote with its source only, never stored in bulk" elsewhere. The session bank is memory-only; nothing is written to disk by the module. The 400 000-char store cap is the "never a bulk scrape" bound.
* Language: the pronoun and title cues are English; in another language `fp` is 0 and the gate never says `own` (silent, typed), it does not guess. Bilingual texts (a Loeb Seneca on archive.org) can bank Latin sentences; filter by language at the sentence bank when a language detector is wired.

## 5. Known gaps to say in the UI, not hide
* The `terms` of a fetched voice are a TF stand-in (`termsRecipe: "tf-standin"`), not the canon's concern-field recipe (seeded null, two-seed intersection), which lives in the ethos repo. Until the real recipe is run on the stored text, `resonance` against fetched voices is NOT on the canon's scale; VOICE.md's "same recipe, same null" is unmet for them. (Fetched text is stored in the session bank so the real recipe could be run on it.)
* Pen names and alias handling are caller-supplied; a pen-named genuine page is refused (safe error).
* An org-published page with a heading-tier attribution is the dangerous region (an editorial team writing about a figure and quoting them). See results: 1/5 held-out traps, plus the AI-hub page when its title cue is removed.
