# Folds and the block kit: integration notes

This package is the agent's artifact lane for fold · chat. In the **Agent** engagement, a request to make something (a site, a widget, a document) opens a **fold**. A fold is a thread whose subject is one artifact. The artifact is built from tested blocks, one small piece at a time, and every step is kept in the fold's EOT record.

All JavaScript here is static ES modules, with no build step, same as the rest of fold · chat.

## Files

New files. Drop these in at the repo root, next to the other `fold-chat-*.js` modules:

| file | what it owns |
|---|---|
| `fold-blocks.js` | The block catalog laid on EO's 27 coherent terrain × stance cells: 19 cells hold blocks, 7 are open gaps, 1 is the desert. Also the theme tokens, the formula catalog, the expression evaluator (the app computes; the model never does) and `render()`, which turns a model into one HTML document. |
| `fold-blocks-kernel.js` | The deterministic EOT ingester and checkpoint. `createKernel().submit(assembly)` checks one assembly on its own and either commits all of it or none of it. Errors are typed: unknown-surface, dependency, terrain-mismatch, narrowing, desert-cell, grain-mixed, contrast, unsourced, closure, unassembled, repeated. |
| `fold-blocks-weave.js` | Penelope's spine, applied unit by unit (details below). |
| `fold-blocks-make.js` | The plans for each kind (website, widget, document), as skeletons the app writes. Also `make()`, `followUp()` (literal replace, change, add) and the app-composed frame. |
| `fold-blocks-edit.js` | Editing by hand. An edit is an EOT assembly written for the person, and undo is its inverse, appended. |
| `fold-chat-folds.js` | The Folds workspace: a session log on the left, the canvas on the right, the sidebar list, persistence, point-to-edit, undo and export. |
| `fold-blocks-tests.js`, `fold-blocks.test.mjs` | 37 tests, as plain data. Run them with `node --test fold-blocks.test.mjs`; the Block Kit page runs the same set. |

Changed files:

| file | change |
|---|---|
| `fold-chat.js` | Imports `mountFolds` and `isMakeAsk`, and mounts Folds after the Chats handlers. In `E.composer.onsubmit`, an Agent-engagement make-ask goes to `folds.create(text)`. Clicking Chats, Projects or New chat closes the fold view. Separately, the turn menu's top position is clamped to at least 8px (it was overflowing on short screens). |
| `index.html` | Adds a Folds rail button (`#railFolds`) and a Folds sidebar section (`#foldsNew`, `#folds`). Separately, `.epop` gets max-height and scrolling, and `.seam span` gets `white-space: nowrap`. |
| `fold-chat-foldview.css.js` | `nowrap` on the chips and tabs, which were breaking mid-word, and wrapping tabs. |
| `fold-chat-presentview.js` | The replay shows only keyframes. Steps that only write to the ledger ride along with their keyframe, and playback jumps over idle stretches. Step, back and the clock (`k / N · t`) move between keyframes. The CON/SYN graph places nodes by the edges they take part in, so no column is left empty. The SYN "writing" panel says what it is waiting for. |
| `fold-chat-present.js` | Every one of the nine falsifiers now returns a verdict instead of "not run". DEF tests each term against the definition the material gives. EVA reads a comparison against a baseline a source states. CON falls back to the cross-reference. A polarity flip now counts only when the negation governs words the claim shares. |
| `fold-chat.js` (follow-ups) | A turn keeps the passages it read (`record.passages`, clipped). A thread follow-up such as "why?" now uses those sources and can cite them (`[W#]`); it is checked against them, and its note says so. Older turns fall back to the spans their answer was grounded in. |

Tools and docs, which are not loaded by the app:

| file | what it is |
|---|---|
| `tools/Block Kit.dc.html` (+ `tools/support.js`) | The development bench: Make, Playground (raw EOT), Catalog (the 27 cells) and Tests. It imports the modules from `../`. It is a Design Component and needs its `support.js` runtime alongside it. |
| `docs/Agent Mode Mocks.dc.html` | The interface mockups the agent work started from. |

## How a fold is made (the weave)

1. **The app writes the structure.** Each kind has a plan of assemblies: look, content, page (website); look, inputs, results (widget); look, body (document). Each assembly is a skeleton the app writes: names, types, and every binding it can decide itself. The model writes only values.
2. **Each slot is one unit**, and a record row splits further: each cell is its own unit. Units are filled in law order:
   1. **library**: a value that held before, matched by frame (the same shape, at least 2 content words in common).
   2. **box**: a derived value. For example: form fields from the form's purpose, nav items from the page's own sections, input names from their labels, a result's formula, arguments and label from the formula catalog.
   3. **hunt**: snipped from the person's own words, by character range. For example: a brand after "called", a place after "in", a widget's title, an input's value ("over 25 years").
   4. **mouth**: last. One line, drawn as a completion of an anchor line.
3. **Every fill is probed** by several framings: shape, echo (placeholder text or identifiers), invented referent (a figure that isn't in the material), repetition, and length bounds. A failure **sharpens** the atom into a positive instruction (never "do not") and only that unit is redrawn; every unit that passed is kept. An invented figure inside a record cell is **cut** to `—` (a named gap), not redrawn.
4. **The assembly is set down by the kernel.** A kernel error is routed back to the unit on its line. A part that still can't be built is dropped, and the drop is disclosed; the rest stands (Hora).
5. **The system learns; the mouth doesn't.** Values that held go into the library. The person's edits go in with more weight, and anything they replaced is never recalled again. The scoreboard counts who filled each shape. A shape the mouth walls on three times becomes a **standing rule**: it is never asked again, and is either box-owned or left as a named gap. Memory is stored in localStorage under `fold-blocks:memory@1`.
6. **Follow-ups.** "change "x" to "y"" is box-owned, so no model is asked. "add …" adds a block, then re-frames the app with `!REC`. Any other change takes the named properties of one part (the part you pointed at, the part the request names, or one the model picks from a list) and puts them through the same probe and check.

A fold is stored under `fold-chat:folds@1` as `{ id, title, kind, created, updated, log[] }`. The **log is the fold**: reopening one replays its set-down assemblies into a fresh kernel, deterministically.

## Placement against SYSTEM-MAP

This was built where the browser runs, so these files sit at the root as fold surface modules. Under the house rule (a capability is defined exactly once), consider these moves:

- **`fold-blocks-weave.js` re-derives Penelope's `fillUnits` and spiral in the browser.** The order, sharpen, scars and probe framings mirror `organs/generation/engine.mjs`. It should either become a browser adapter of Penelope's engine (`autofill` = library, `hunt`, `mouthFragment`, `probeUnit`, `sharpen`), or be vendored from Penelope by script, not kept as a second copy.
- **The kernel's EOT ingestion and contracts overlap the khora's kernel** (`kernel/eot-*`, `cube.js`). `TERRAINS`, `STANCES` and `DESERT` should be imported from `cube.js`.
- **The three-strike promotion is a hand-set count**, the same open finding as GL-LD-07. It is declared in `DECLARED.promoteAfter`, as are the frame overlap and the word bounds.

## Known gaps

- **Truth isn't checked.** The checks verify form, not truth. Invented figures are cut, but plausible invented prose isn't caught. A document's facts should come from the chat lane's sources (the `sources` block and the `unsourced` check exist; nothing wires sources into a fold yet).
- **The catalog has 7 open cells**, among them Link × Making, Network × Composing and Paradigm × Tracing (version history, which the fold log already holds).
- **No escalation.** A walled unit doesn't escalate to a sealed frontier model the way Penelope's code pipeline does. The wall is disclosed instead.
- **What was measured.** The in-tab Gemma 2B produced a website (all assemblies passed on the second run, with library recall), a widget with the correct formula (box-owned), and a document. Run times were roughly 1–2 minutes. Tests: 37/37 in the browser. `node --test` has not been run in this environment.

## Penelope's house round

`GLAUCA-ENTRIES.draft.md` holds draft entries for the generation-process changes, to append (never rewrite) after review.
