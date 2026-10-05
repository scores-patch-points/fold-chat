# Searching the web efficiently — what was tested, what was falsified

Everything here was run on 2026-10-05, on one machine (load average ~340 for much of it, so absolute
times are pessimistic and noisy). Each claim was written down with its falsifiers **before** the run.
n is small everywhere. These are measurements of this afternoon, not of the web.

## Scoreboard

| # | Claim | Falsifiers (pre-registered) | Verdict |
|---|---|---|---|
| H0 | Routing the question to the sources it needs beats asking every source | — (offline, labels written by the same author: a sanity check, not a test) | 82% fewer specialist calls; 27/29 needed sources |
| H1 | Read each pulled page through the khora, pool the beings into one index, surf with Duke (activation + `dmdWindow`) beats the impression | F1 recall ≤ impression ∧ no 30% saving · F2 padding on no-answer controls · F3 corpus precision/recall · F4 read cost > 8 s/page | **FALSIFIED on F1–F4.** 3/7 answers vs 6/7; mean read 19.6 s/page. Surf precision was high (91%) and it handed 24k chars vs 67k — it is precise but misses sentences that name their subject only by pronoun, because `/api/read` returns beings but no mention addresses |
| H2 | Searching DuckDuckGo directly (from this machine) beats the Cloudflare relay | G1 success ≤ relay · G2 median ≥ relay · G3 > 25% challenged · G4 < 5 results | **Falsified — but about Node, not about an extension** (see below) |
| H3 | Direct page reads (no proxy chain) succeed ≥ 80% | G5 | 7/9, n=9 (only 3 queries had results); both failures were 403s from two recipe sites |
| H4 | Brave + DuckDuckGo asked at once, direct, paced 4 s apart, beats the relay | K1 < 10/12 with ≥ 5 results · K2 median ≥ 1.5 s · K3 < 9/12 relevant · K4 any Brave refusal · K5 ≤ relay's 5/12 | **Falsified in Node (0/12, Brave HTTP 429). Survives in real Chromium: 12/12, median 656 ms, 11/12 relevant, 0 refusals** |

## The finding that reorders the rest: Node is not an extension

Node's `fetch` was answered with a bot challenge by DuckDuckGo and HTTP 429 by Brave — on the same IP, in the
same hour, where the built-in Chromium got **200 OK with full results for 12/12 Brave queries and 6/6
DuckDuckGo queries** (8–12 results, 0.3–1.1 s). `curl` also got Brave's full page. The block is the transport's
fingerprint, not request volume (the first Node request to Brave was already a 429). Anything about search
must be measured on the browser's network stack, which is what an extension uses. H2 and H4 above were
re-run there; the Node verdicts are kept because they are what the script printed, and the scripts carry a banner saying so.

Still untested: a *service-worker / extension-page* fetch with host permissions (cross-origin, no page
Origin) rather than a same-origin page fetch in Chromium. The numbers say it should work; the only way to
know is to run `experiments/source-routing/` equivalents inside the loaded extension.

## Where a real turn's time goes (one 28 s turn, relay transport)

| time | what |
|---|---|
| 17.7 s (62%) | one call to the relay's web search; its DuckDuckGo/Brave upstreams answer 408/429 → 502 on ~2 of 3 calls (15–18 s to fail), ~2.3 s when healthy |
| ~8 s | page reads waiting out two public proxies' 8 s timeouts after the fold's relay had already been refused (403) |
| 0.1–2 s | the pages that did read |
| (not on this list) | the khora reader: 2–48 s per 24k-char page |

The answer was available quickly; the time went on waiting for sources that could not help.

## What changed in the code because of it

- **Everything asked at once** (`searchWeb`): the relay no longer holds Wikipedia's 300 ms answer behind it.
  A 6 s budget releases the web search *only if another source answered*; if nothing else did, it is waited for
  (an earlier version abandoned it and returned nothing — a slow success traded for a fast empty answer).
- **A pool, not batches, for reads** (3 at a time; a slot that frees starts the next candidate).
- **Gateway budget 3.5 s** (was 8 s), a **per-tab memo** of pages read, and a **dead-host memory** (a host that
  turned us away on every door is not retried for 5 min).
- **Wikipedia via its plain-text extract** (45 KB, ~200 ms) instead of 880 KB of HTML walked by a DOMParser.
- **`direct: true` transport** (`fold-chat-engines.js`): Brave + DuckDuckGo asked at once, first to return ≥ 5
  results wins, a challenge costs ~200 ms; page reads are direct only — **no relay, no public proxy, no text reader,
  so no third party learns an address**. For the extension; the static site keeps the relay path.
- The **reader is off the hot path** (H1).
- An **impression** (`fold-chat-impression.js`, on the khora's keyless `Field` + `nullBand`) replaces
  "first 4,000 characters": 6/7 answers present vs 5/7, at ~15k vs 28k characters.

## Open, and what would falsify it next

1. **Extension fetch ≠ page fetch.** Load the unpacked extension; run 12 queries through `searchWeb({direct:true})`
   from the extension page. Falsified if Brave or DuckDuckGo refuse any of 12 paced requests, or median ≥ 1.5 s.
2. **Direct page reads** (H3) can only be tested with host permissions — a page-origin fetch is CORS-blocked.
   Falsified if fewer than 80% of 36 top-3 results read (≥ 40 readable chars, not a shell).
3. **Engine scraping is fragile.** Brave's class names are build-hashed; the parser keys on stable markers and
   says "the markup may have changed" instead of "nothing found". Falsified the first time it silently returns 0.
4. **Read-once catalog.** A librarian does not re-read a book: persist the impression + shadow per URL (IndexedDB,
   keyed by URL + fingerprint). Falsified if a follow-up about the same pages still fetches.
5. **A mention-book door** (khora `reading-log.js::mentionBookFromLog`, served by the heimdall bridge) is what the
   surf needs to work as THE-HOLOGRAPH §6 describes. Not built; belongs to whoever owns heimdall.
