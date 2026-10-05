# fold · chat — The Fold's chat version

A browser chat surface for The Fold. It runs like the fold does — a static
page, no build step, deployable to GitHub Pages — and it is the chat the
Fold has always implied: **models are organs behind Heimdall, the chat is the
mouth, and nothing raw leaves the trust domain.**

## What this is

LibreChat-style chat (artifacts, memory, search, agents) is the long game. But
LibreChat itself is a Next.js server that needs MongoDB + Redis — it cannot run
as a static GitHub Pages site. So this repo is the Fold-native chat surface
that speaks the **same OpenAI-compatible wire LibreChat speaks**, pointed
straight at the one process that already routes the whole Fold's models:

```
  fold-chat (browser, static)
        │  GET /api/tags            → every model heimdall can serve
        │  POST /v1/chat/completions (SSE, heimdall_privacy:"sealed-external")
        │  POST /api/code             (the code lane — same bridge, same project)
        ▼
  heimdall bridge  (localhost:8790)
        │  fleet · linked native hosts · remote providers
        │  sealed-external gate + dispatch ledger + savings meter
        │  the machine door: khora read → janus derive → execute → penelope retain
        ▼
  local organs (WebLLM, Ollama, phones)  ·  outside models (sealed projection only)
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

Serve `index.html` from localhost (`python3 -m http.server 8814`) and run
`heimdall up` — the page finds the bridge on `localhost:8790` and lists every
model heimdall can serve. For code, run the conductor door
(`khora/native/conductor/server.mjs`) and start heimdall with
`HEIMDALL_OPENCODE=http://127.0.0.1:4098`. The GitHub Pages deployment is the
same page; full model access needs the local bridge, exactly like the fold's own
local serving.

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
- `fold-chat-client.js` — the heimdall wire: `listModels`, `chat`, `code`
  (carries the project `cwd`), `read`, `meter`, `ledger`, `frontier`. Browser + node.
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

## What an answer shows at rest

Under an answer, at most two quiet lines: **`3 passages from 1 source · ✱ 3 of 6
sentences have no source`** (opens to the documents read, their numbered passages,
and the gap's detail) and **`how this was answered · effort deep · gemma2:2b`**
(opens to the process steps). Message actions (copy, retry, ⋯) appear on hover or
focus, and on touch for the last message (tap any message to reveal its own).

## Develop and test

```
node --test                                   # unit tests, no install needed
npm i && npx playwright install chromium      # once, for the live e2e
node fold-e2e-falsify.mjs                     # drives the live page (see its header)
```

The e2e needs the live stack (this page on :8814, the heimdall bridge on :8790).
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