# fold · chat — The Fold's chat version

A browser chat surface for The Fold. It runs like the fold does — a static
page, no build step, deployable to GitHub Pages — and it is the chat the
Fold has always implied: **models are organs, the chat is the mouth, and
nothing raw leaves the trust domain.** The model runs *in the tab*
(WebLLM on WebGPU); Heimdall is embedded in the same server as the page.

## What this is

LibreChat-style chat (artifacts, memory, search, agents) is the long game. But
LibreChat itself is a Next.js server that needs MongoDB + Redis — it cannot run
as a static GitHub Pages site. So this repo is the Fold-native chat surface
that speaks the **same OpenAI-compatible wire LibreChat speaks**. There is **no
standalone bridge**: the Fold's own server carries heimdall in-process, and the
model itself runs in the page.

```
  fold-chat (the browser tab)
        │  the model: WebLLM on WebGPU, in a Worker — weights cached by the browser,
        │  every token produced on this device. Nothing leaves the tab.
        │
        │  same origin (the doors, and any model heimdall serves besides):
        │    GET /heimdall/api/tags            → every model heimdall can serve
        │    POST /heimdall/v1/chat/completions (SSE, heimdall_privacy:"sealed-external")
        │    POST /heimdall/api/code · /api/read · /api/reason · /api/weave
        ▼
  node server.mjs  (http://127.0.0.1:8814) — ONE process
        │  static app  +  heimdall embedded at /heimdall (heimdall/docs/EMBED.md)
        │  fleet · linked native hosts · remote providers
        │  sealed-external gate + dispatch ledger + savings meter
        │  the machine door: khora read → janus derive → execute → penelope retain
        ▼
  local organs (Ollama, phones)  ·  outside models (sealed projection only)
```

## One thread, one project, two engagements

Chat and Agent are **sibling engagements over a shared session**, not one app
embedded inside another (the Claude / Claude-Code shape). The **mode** row of the composer's
"this turn" chip switches what a turn *does*; it never changes the thread, the store, or the
project:

- **Chat** answers from the routed models (`/v1/chat/completions`).
- **Agent** dispatches the same turn through the same bridge to the **machine
  door** (`/api/code`) — the khora conductor, which reads the project, derives
  over it with janus, executes for real, and retains the trace with penelope.
  Its tool activity and answer render inline in the one conversation, in the
  agent's own register: a teal rail, a mode tag, a terminal composer, and a
  labelled seam where the thread hands off between the two engagements.

The two engagements convert freely: any chat answer can be **built** (the same
ask re-run through the machine door) and any agent artifact can be **explained**
(the same ask re-run through the grounded chat lane), and every message carries
a per-message **run as** affordance. A conversion only adds a lane to the same
thread — the original turn and its record are never overwritten.

A **project** is the shared container: a name, an optional **folder** (the
working directory an agent turn is bound to), and a preset its sessions inherit.
A chat turn and an agent turn hang off the same project, so both start from the
same place. Projects support create / settings / delete.

Every agent turn carries an **agent record** (the same collapsed disclosure a
chat turn carries): the folder, the lane, the tool steps, the time — so the
agent is as inspectable as chat, and always says it ran through the bridge.

**Run it: `npm run serve`** — one process, `node server.mjs`, on
`http://127.0.0.1:8814` (`FOLD_PORT` / `FOLD_HOST` override). It serves the static
app and mounts heimdall in-process at `/heimdall`; the page finds it on its own
origin, so there is nothing to start first and nothing to configure. The sibling
`../heimdall` checkout supplies the embedded mount (`FOLD_HEIMDALL_SRC` points
elsewhere); without it the app still serves and `/heimdall` answers 503.

- **The model runs in the tab.** The first time you use an in-tab model the page
  tells you the download (`~1.9 GB` for the default Gemma 2 2B), asks once, shows
  progress (percent + text, in the footer and the turn's own feed), and caches it
  in the browser; after that it loads from the cache. Picking a model downloads
  nothing — only an approved first send does. Models are the WebLLM builds listed in
  `fold-chat-webllm.js` (the f32 build on a GPU without `shader-f16`).
  A device with no WebGPU is told so, plainly, and pointed at a WebGPU browser or the Fold's own server.
- **With no bridge** the app still boots, lists the in-tab models, and answers from
  them; the sealed outside models, the fleet and the code lane (`/api/code`) need
  the embedded heimdall (the server). For code, run the conductor door
  (`khora/native/conductor/server.mjs`) and start the server with
  `HEIMDALL_OPENCODE=http://127.0.0.1:4098`.
- **The old standalone bridge on `:8790` is no longer needed.** It is only a *later*
  fallback the page still tries (after the same-origin `/heimdall`), so a copy of the
  page somewhere else — and the extension — can still find one on this machine.
- **GitHub Pages** is the same page with in-tab WebLLM only: no server, so no
  `/heimdall`, no sealed models, no fleet; the model still runs on the visitor's GPU.
- An in-tab turn is labelled **in this tab**, never *sealed-external*: nothing is
  sent anywhere, so there is no gate to claim.

## Secure chat with outside models

This is the part wired into heimdall's secure-outside-model work:

- **The chat never carries raw workspace material to an outside model.** Only the
  caller's own messages ride the chat wire. The code lane reads the project
  folder *on this machine* through the conductor — the raw bytes never leave the
  trust domain.
- **Sealed by default.** Every request sends `heimdall_privacy:"sealed-external"`.
  Models heimdall marks frontier/sealed-only (from the per-model heimdall
  metadata in `/api/tags`) show a green **sealed-external** badge; if the gate
  refuses, the bridge's own message surfaces in the thread.
- **The evidence drawer** reports the dispatch ledger (who did the work, which
  model, predicted vs actual, tokens) and the savings meter (exact external
  tokens + the marked frontier/raw-context estimates). The invariant line —
  RAW WORKSPACE TOKENS SENT TO EXTERNAL MODELS — is derived from heimdall's
  own ledger, never asserted here.

## Files

- `index.html` — the page (no build step).
- `fold-chat.js` — the app: sessions, projects (folder + preset), the chat/agent
  engagement selector (the agent register, the seam, per-message conversion),
  streaming chat, the agent lane, sealed badge, evidence drawer. localStorage
  holds sessions, projects, and the bridge override (`fold-chat:bridge`); the
  engagement is `fold-chat:engagement`.
- `server.mjs` — the Fold's own server: static files (no dotfiles, no `node_modules`,
  no traversal, `no-store`) + heimdall mounted at `/heimdall`. `node --test server.test.mjs`.
- `fold-chat-webllm.js` (+ `fold-webllm-worker.js`) — the model in the page: WebGPU
  status, the model table, `createPageEngine` (lazy CDN load, Worker, abort, f32/f16),
  `pageModels`. Nothing downloads on import.
- `fold-chat-client.js` — the heimdall wire: `listModels`, `chat`, `code`
  (carries the project `cwd`), `read`, `meter`, `ledger`, `frontier`. Browser + node.
  `bridgeCandidates` / `detectBridge` look at the same-origin `/heimdall` first;
  `listAllModels` merges the tab's models in even with the bridge down; `autoPick`
  prefers a loaded in-tab model, then a downloaded one, then a bridge model that is up,
  then the default in-tab model (selected, never auto-downloaded); `chat` serves a
  `webllm:` model from the page's engine with the bridge's own stream/abort/error contract.
- `fold-chat-topic.js` — what a chat becomes about: `titleOf` draws a name from
  the salient terms of the whole exchange (the surface swaps it in at the fourth
  turn), and `iconOf` picks the Phosphor icon most similar to it by cosine over
  a shared lexicon. Pure and node-testable.
- `fold-chat-icons.js` — a curated subset of Phosphor (MIT), GENERATED from the
  SVGs under `vendor/phosphor/regular` by `scripts/gen-phosphor-icons.mjs`, so
  the surface ships its icons locally and reaches no CDN.
- `fold-chat-channels.js` — one message, separate channels: `content` is only what
  the model wrote; the gap is `record.void` (structured — `voidReport`, drawn as its
  own block, `voidText` only for the process panel); system notes ride
  `message.notices`. Also the one-time migration of old sessions and `modelHistory`,
  the only path from the transcript back to the model. Pure and node-testable.
- `fold-chat-client.test.mjs` — fake-bridge tests (sealed gate, SSE streaming,
  code lane carries the folder, meter). Run: `node --test`.
- `fold-chat-pageengine.test.mjs` — the bridge-less Fold: same-origin first, in-tab
  models listed with the bridge down, the pick order, chat dispatch to a fake engine
  (abort, never-silent download), and a check that no app file names the old port.

## The turn chip: mode and effort, per message

One chip in the composer (a lock, then `Chat · Balanced` or `Agent`) says what the
*next* message will be. Its menu has a **mode** row (Chat / Agent) and, in Chat, an
**effort** row (Fast / Balanced / Deep). The effort value is read once, when the
message is sent,
and stamped on that turn (the ask's `effort`, the record's `effort`, and an
`effort · …` step in the turn's process line) — moving the chip never changes a
turn already sent, or one still running. The chip remembers its last value
(`fold-chat:effort`). Edit / continue / run-as / build-this re-runs reuse the
effort the original turn had, unless the chip was moved since the last send. The
menu has no effort row in the Agent engagement (effort only shapes a grounded
turn). There is no web-search switch: every turn except a greeting searches the
web. The lock is the sealed-external state — every request carries it.

## The model never speaks alone

A turn with no sources produces **no model-written answer** — only an app-authored, typed gap built from the
real search trace (`fold-chat-gaps.js`: what was searched, which engines failed and why, with a retry). A
live-data ask (weather, a price, a score, today's news) with nothing reachable is the typed gap *live data —
nothing reachable*. A blank or failed turn is never blank: a typed `empty` / `error` note with a retry.
The kinds that search nothing (a greeting, arithmetic, your own text to translate, a programming how-to,
personal writing) are answered by the app alone — a fixed line, a mechanical result card (`fold-chat-compute.js`),
or "there are no sources for this kind of ask" — unless `ALONE_KINDS` (one constant, `fold-chat-gaps.js`) lists the kind.
The model may not name a source the page did not give it, and never shows the source-block labels
(`fold-chat-attribution.js`); the reply is checked against the asker's language (`fold-chat-lang.js`).

**Two answer modes**, chosen per turn in the composer chip's *Answer* row (remembered as `fold-chat:answerMode`,
stamped on the ask as `answerMode`, kept by a re-run unless the chip was moved):
*Facing page* — the model writes from snipped sources; *Sources only* — **no model call at all**: the answer is
the sources' own passages, verbatim, strung together in source order with the S# chip, credit and link
(`fold-chat-strand.js`; a recipe / HowTo / FAQ / QA block the page declares, a Wikipedia lead, else the sentences
that differ the ask). Every stored snip is checked to occur in the page text it came from; such a message is
`authored: "sources"`, is never scored, and reaches later turns marked as the sources' words, not the model's.

## The REC loop: going back

After the answer is written, every sentence is tried against everything read (`fold-chat-falsify.js`: per-source
states / contradicts / silent, syndicated copies counted once, and a swap test, where a competing figure or name from the same
source is put in its place and the wrong version must stop matching). A sentence no source states, one a source
contradicts, or one the swap shows loose sends the turn back. First to INS: every page the turn read is kept whole in
memory for the turn (never stored or sent), and the failing claim is recalled against each page's shadow Field
(`relative.js`, via `impressionOf`) for a new impression of that page for the claim. Only what the pages do not hold
goes on to SIG, a new search with the claim as the query. The
cross-reference re-runs on the wider ground, and SYN restates only the sentences still failing. A restatement
replaces a sentence only if it then holds; otherwise the sentence stays and is marked. Two laps at most, 25 s (45 s
on Deep); Fast skips it. The laps are on the record (`record.loop`), in the Checks tab, and on the replay's tape.
In the reading panel this is the only motion: an arc from ∗ back to ○ and the levels lighting in reverse. Everything
else there is still.

## What an answer shows at rest

Under a presented answer, one summary line: **`3 sources · 2 of 3 sentences backed · held 9 checks ·
Answered in 22 s · gemma2:2b`**. Each part opens the turn's one inspector at its tab — **Sources** (the
passages, in their sites' type), **Checks** (the attempts to break it), **Process** (the replay, the steps,
web reads, route and the JSON log). The sentences carry the evidence: an unbacked sentence is dotted
(click → Checks); hovering a backed one lights its passage (click → Sources). Only a failed turn shows a banner. Message actions (copy, retry, ⋯) appear on hover or
focus, and on touch for the last message (tap any message to reveal its own).

## Develop and test

```
node --test                                   # unit tests, no install needed
npm i && npx playwright install chromium      # once, for the live e2e
node fold-e2e-falsify.mjs                     # drives the live page (see its header)
```

The e2e scripts predate the single-server build and still point at a standalone bridge on
`:8790`; for now they need the live stack (this page on :8814 via `npm run serve`, plus a bridge
on :8790). The unit tests need neither.
It tries `import("playwright")` first and falls back to a scratch install at
`/private/tmp/fold-e2e/node_modules/playwright`.

## As a browser extension

The same page, packaged as a Manifest V3 extension. A static page cannot read most of the web (CORS); an
extension page with host permissions can, so web search and page reads go **straight from the person's own
computer** — no relay, no public CORS proxy, no account, nothing of ours in the path and nothing to store.

```
node scripts/build-extension.mjs      # → dist/extension/   chrome://extensions → Developer mode → Load unpacked
node --test                           # the gate, the manifest and the package are tested
node fold-ext-e2e.mjs                 # loads the build in a real Chromium (needs network; FOLD_E2E_QUICK=1 for a short run)
```

- **What ships** is only what the entry points import (`scripts/build-extension.mjs`); the build fails on anything an
  extension page's CSP refuses (inline script, `on*=` handlers, remote scripts, unresolved imports). The two inline
  scripts that used to be in `index.html` are `fold-theme-boot.js` and `fold-boot.js`.
- **Permissions** (`manifest.json`): `sidePanel`; fixed hosts for the five research sources, Brave, DuckDuckGo and the
  loopback bridge. Reading *any other* site is an optional permission the person grants on the options page
  (`fold-options.html`) and can revoke; it is off until they do. No `tabs`, `cookies`, `history`, content scripts or
  `externally_connectable`.
- **The exit gate** (`fold-chat-exit.js`, installed first by `fold-exit-install.js` on the page's global `fetch`):
  https only; no IP literals, single-label or private names (`localhost`, `*.local`, `*.internal`, …); GET/HEAD only,
  no body, no `Authorization`; **credentials always omitted** (a read never rides the person's logged-in sessions);
  no `Referer`; the final URL after redirects is checked again. The loopback bridge and the extension's own files pass.
  Said plainly: a public *name* that resolves to a private address, and a redirect hop before it is followed, cannot be
  seen from a page — the name list is best-effort and a bad redirect is caught after one credential-less GET.
- **Artifacts** run in `fold-sandbox.html`, a manifest `sandbox` page (opaque origin, no extension API, no access to the
  chats in storage), reached through `sandboxDoc()` in `fold-chat-sandframe.js` — on the web that is still `srcdoc`.
- **The model in the extension** comes from a bridge, not the tab: an extension page's CSP (`script-src 'self'`) cannot load
  WebLLM from its CDN, so the extension page never starts the in-tab engine (`fold-chat.js` checks `isExtension()`) and keeps the
  loopback bridge for its models.
- **Not done:** Firefox/Safari (Chrome-family MV3 only), icons, store listing, moving chat storage from `localStorage`
  to IndexedDB (the 5 MB cap), and the heimdall bridge on a non-loopback address (the gate refuses it).

## Roadmap (the LibreChat features, Fold-native)

- **Artifacts** — generative UI blocks in the thread (React/HTML/Mermaid) rendered as sealed, provenance-attached artifacts.
- **Memory** — sessions already persist; fold the record (khora reading) into the thread the way holodeck-ask does, as notes, never raw.
- **Search** — route search through khora's retrieval so the chat can cite ground without exposing spans.
- **Agents/MCP** — the opencode-fold fork exposes opencode's session API, and the conductor speaks that same wire, so chat drives real coding work through the same sealed door.

## The Fold context

fold-chat is a surface. It is not the epistemic architecture: khora perceives,
penelope keeps, heimdall routes, and this page is one more way to talk to the
whole organism — with the same invariant every surface holds: *no executor
receives more of the world than is necessary for its act.*