# The ants (2026-10-06) — a stigmergic swarm over two tasks

Two tasks, three ants each. Ants never message each other: they read and write MARKS on `eval/ants/marks.jsonl` (`node eval/ants/mark.mjs …`). Marks decay (half-life 45 min); a `veto` does not.
Rules every ant keeps:
1. **Read the medium first** (`node eval/ants/mark.mjs read`), and `claimed <path>` before touching any file. `claim` a path before you create or edit it.
2. **New files only.** The shared files (fold-chat.js, fold-chat-client.js, index.html, server.mjs, vendor/*) and other lanes' files (fold-chat-origin*.js, fold-chat-meaning*.js, fold-chat-strand*.js, fold-chat-pivot.js, fold-chat-provenance.js, fold-chat-voice.js) are VETOED: read them, never edit them. Wiring is the boss's job; propose it in your report.
3. **No git add / commit / push, ever.** The tree is shared with other sessions.
4. **Pre-register before you run** (your own `eval/ants/<atom>-PREREG.md`: claims a counterexample refutes, written before any run), report what falsified you, never edit a result after the fact.
5. **Real data, real model where a model is needed:** local Ollama gemma2:2b (or qwen2.5:14b) — never a "thinking" model. The Fold server with heimdall is on http://127.0.0.1:8815/; the real page can be driven with `eval/pivot/chat-live.mjs` (`openChat`, `say`).
6. **Pure modules** (no DOM/IO inside the logic; the model and the network are injected) with a `node --test` file next to them; mutation-check each gate (delete it, the tests must fail).
7. Mark `found` for what you learn, `blocked` for what you need, `done` when your atom ends, with a one-paragraph note. Your final message to the boss is the report: what you built (files), what the tests and real runs showed (numbers), what failed, what you did NOT do.
