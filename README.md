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
embedded inside another (the Claude / Claude-Code shape). The topbar selector
switches what a turn *does*; it never changes the thread, the store, or the
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
- `fold-chat-client.test.mjs` — fake-bridge tests (sealed gate, SSE streaming,
  code lane carries the folder, meter). Run: `node --test`.

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