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
        ▼
  heimdall bridge  (localhost:8790)
        │  fleet · linked native hosts · remote providers
        │  sealed-external gate + dispatch ledger + savings meter
        ▼
  local organs (WebLLM, Ollama, phones)  ·  outside models (sealed projection only)
```

Serve `index.html` from localhost (`python3 -m http.server 8814`) and run
`heimdall up` — the page finds the bridge on `localhost:8790` and lists every
model heimdall can serve. The GitHub Pages deployment is the same page; full
model access needs the local bridge, exactly like the fold's own local serving.

## Secure chat with outside models

This is the part wired into heimdall's secure-outside-model work:

- **The chat never carries raw workspace material.** Only the caller's own
  messages ride the wire; there is no file/span/address access in this surface.
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
- `fold-chat.js` — the app: sessions, model picker, streaming chat, sealed
  badge, evidence drawer. localStorage holds sessions and the bridge override
  (`fold-chat:bridge`).
- `fold-chat-client.js` — the heimdall wire: `listModels`, `chat`, `meter`,
  `ledger`, `frontier`. Browser + node.
- `fold-chat-client.test.mjs` — fake-bridge tests (sealed gate, SSE streaming,
  meter). Run: `node --test`.

## Roadmap (the LibreChat features, Fold-native)

- **Artifacts** — generative UI blocks in the thread (React/HTML/Mermaid) rendered as sealed, provenance-attached artifacts.
- **Memory** — sessions already persist; fold the record (khora reading) into the thread the way holodeck-ask does, as notes, never raw.
- **Search** — route search through khora's retrieval so the chat can cite ground without exposing spans.
- **Agents/MCP** — the opencode-fold adapter surfaces opencode's session API as an OpenAI-compatible endpoint, so chat can drive real coding work through the same sealed door.

## The Fold context

fold-chat is a surface. It is not the epistemic architecture: khora perceives,
penelope keeps, heimdall routes, and this page is one more way to talk to the
whole organism — with the same invariant every surface holds: *no executor
receives more of the world than is necessary for its act.*