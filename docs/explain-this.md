# "Explain this" — findings and the call-site change

Module: `fold-chat-explain.js` (pure, DOM-free). Tests: `fold-chat-explain.test.mjs`.
Line numbers are fold-chat.js as of 2026-10-05, after the `buildMsg(s, …)` / ⋯ menu refactor.

## 1. What it did before

The only code behind "explain this" is one menu item (fold-chat.js:1223):

    else if (mode === "agent" && ask) more.push({ label: "Explain this (grounded chat answer)",
        onClick: () => rerunAs(s.id, ask, "chat", effortFor(s, meta.index)) });

`ask` is `askBefore(s, index)` (:1435), the nearest preceding user turn. `rerunAs` (:1389) pushes that
ask again as a NEW user turn (`converted:true`, the flag is never read anywhere), switches the composer
to chat, and calls `run(id, false)`. `run` (:1557) takes `question = lastUserText(s)` (:1582), which is
the ORIGINAL ASK. Nothing about the artifact is the question.

What that does, measured with the real helpers (classifyTurn, modelHistory, FOLD.buildTurnMessages):

* classifyTurn("make a pomodoro timer page with Start, Pause and Reset buttons") = `generate`;
  "Build a timer…" = `chat`. So the ask is either WRITTEN AGAIN from web sources (the GENERATE_NUDGE
  persona, "Write it now, in full") or answered as ordinary chat.
* `web.searchWeb(question, …)` (:1683) runs: the ask text goes to the web/Wikipedia/etc. through
  `outbound.auditedFetch` (direct from the page).
* The messages array (:1717) is `[system(nudge+sources), user(ask), assistant(THE ARTIFACT, full
  text), user(ask again)]`. So the artifact's code is sent to the chat model as history (RECENCY_WINDOW=4,
  vendor/the-fold/fold.js:77) but never as the thing to explain. The model is `s.model ||
  selectedModel()` (:1564): a pinned SEALED model gets the code. `client.chat` is called with
  privacy "sealed-external" and does go through the audit hook, but the user never asked for the code to
  go anywhere.
* Result: a second, web-grounded build of the same task, appended as a new "chat" turn. An explanation
  is not produced. **Hypothesis: TRUE.**

Per case:

| case | before |
|---|---|
| (a) chat answer with sources | NO "explain this" at all; the menu offers "Build this" instead (:1222). The turn's record (sources, grounded vs own prose, void) is only reachable by reading the disclosure/facing page yourself. |
| (b) agent artifact (html/js) | The re-run described above. The stored `grounding.events` (sandbox checks, janus ruling, escalation, audit rows) are never read. |
| (c) message with no preceding user turn | `ask` is null, so the item is simply absent. No message, no reason. A forked/trimmed or edited thread loses the action silently. |
| (d) stopped / failed agent, no code | `mode === "agent" && ask` is true, so "Explain this" IS offered, and it re-runs the task through web research. A failed build becomes a research answer. |

Other defects found on the way:

1. `askBefore` returns the nearest user turn, whatever it is. After an iterate ("make the buttons blue",
   `s.iterate`) or "Continue." that is not the task that produced the artifact; explain would re-ask the
   follow-up. The run's own `start` event carries the true task (`grounding.events[0].task`).
2. `rerunAs` flips the composer engagement (`setEngagement("chat")`) as a side effect of a "read-only"
   action, and adds a duplicate-looking user bubble (only a seam marks it).
3. The README (line 46) promises "the same ask re-run through the grounded chat lane"; that matches the
   code but is not an explanation.
4. The explain label says "grounded chat answer", which is exactly the misleading part.
5. The stored trace does NOT keep the sandbox's measured `facts` (labels, control counts), only the check
   strings, so a faithful "what was verified" must be built from the check rows (the module does).
6. `done` is emitted BEFORE the `audit` event is appended (fold-chat.js:1964); a replay/reader must not
   assume `done` is last. The module does not.
7. `result.artifact` is the last html/js answer, which can come from an EARLIER round than the last
   checks (a later round that returned nothing). The module reports the checks of the round that produced
   the kept artifact only.

## 2. What it does now (all from the stored record; nothing re-run)

`planExplain({ messages, index, models })` returns a plan; `toHtml(plan)` renders it with the existing
`.disclosure/.disc-*` classes (no new CSS; everything escaped); `toText(plan)` for copying.

* `artifact-outline` (agent artifact): mechanical outline (`outlineOf`: title, headings, controls,
  labelled inputs, ids, functions, event handlers with targets, features such as timers/storage/network,
  external references split into network vs files it does not carry, sizes) + `verificationOf(events)`
  (what the sandbox, the gate, janus measured; escalation; what left the machine) + an explicit list of
  what was NOT verified (behavior vs intent, only 12 clicks, layout, etc.). No model, nothing sent.
  Comments are blanked so a commented-out call is not counted; input is capped at 300 KB with a note.
* Optional "go deeper": `deeperRequest()` builds (never sends) a request for a LOCAL GENERAL model
  (`isChatModel`, tier `local`, not sealed). Coder/embedder/sealed/open-remote/fleet/unknown-tier models are
  refused unless the caller passes `allowFleet`/`allowSealed`; then it is labelled "NOT on this device".
  The code is marked provenance `generated`, so `client.chat`'s audit hook grades it as raw content, and
  it is truncated to 12 KB. The reading is labelled "a model's reading, not a verified fact".
* `answer-record` (chat answer): sources used, N of M sentences traced vs the mouth's own wording, falsify
  counts, unsupported figures/names, the void and how to close it, the process steps, web reads/failures,
  and what "grounded" does not mean (word overlap, not truth). A chat answer that carries code also
  outlines the code and says grounding does not cover it.
* `generation-record`: penelope's units/stages/verdict.
* `agent-no-artifact`: a stopped/failed run: what happened, error, last findings. Says nothing was re-run.
* `nothing`: user turns, bad index, empty/refused answers, record-less messages: says why. Never silent.

## 3. Call-site change in fold-chat.js (exact, minimal)

(1) import, next to the other imports (anchor: line 31):

```diff
 import * as life from "./fold-chat-sessions.js";
+import * as explain from "./fold-chat-explain.js";
```

(2) the menu, in `buildMsg`'s assistant branch (anchor: :1222-1223). Explain becomes available on EVERY
assistant message (the plan itself says "nothing to explain" when that is true), and no longer depends on
`ask`:

```diff
-        if (mode === "chat" && ask) more.push({ label: "Build this (run through the Agent)", onClick: () => rerunAs(s.id, ask, "agent", effortFor(s, meta.index)) });
-        else if (mode === "agent" && ask) more.push({ label: "Explain this (grounded chat answer)", onClick: () => rerunAs(s.id, ask, "chat", effortFor(s, meta.index)) });
+        more.push({ label: "Explain this", onClick: () => explainTurn(s, meta.index, body) });
+        if (mode === "chat" && ask) more.push({ label: "Build this (run through the Agent)", onClick: () => rerunAs(s.id, ask, "agent", effortFor(s, meta.index)) });
```

(also update the comment at :1215-1217 and README line 46: "explain this" reads the turn's own record; it
never re-runs the ask.)

(3) the handler, next to `askBefore` (anchor: just after `function askBefore(s, index) {…}`, :1435-1441).
It stores nothing (so the explanation never enters `modelHistory`, never costs a turn), takes the session
explicitly (keeps the `fold-chat-sessions` static test about `activeId` happy), and a second click closes it:

```diff
+  // EXPLAIN THIS — from the turn's own record, on this device. It never re-runs the ask
+  // (fold-chat-explain.js). The optional "go deeper" is a LOCAL general model through client.chat.
+  function explainTurn(s, index, body) {
+    const prior = body.querySelector(":scope > .explain-wrap");
+    if (prior) { prior.remove(); return; }
+    const plan = explain.planExplain({ messages: s.messages, index, models });
+    const wrap = el("div", "explain-wrap");
+    wrap.innerHTML = explain.toHtml(plan);            // every value is escaped in toHtml
+    const panel = wrap.querySelector(".disc-panel");
+    if (plan.deeper) {
+      const go = actBtn(plan.deeper.label, plan.deeper.available ? plan.deeper.sends : plan.deeper.reason, async () => {
+        const req = explain.deeperRequest({ models, code: plan.code, plan });
+        const note = el("div", "disc-text"), out = el("div", "disc-text");
+        out.style.whiteSpace = "pre-wrap";
+        panel.append(note, out);
+        if (!req.ok) { note.textContent = req.reason; return; }
+        go.disabled = true; note.textContent = req.label;
+        try {
+          await client.chat(req.model, req.messages, { base: bridge, privacy: req.privacy, audit: req.audit, temperature: req.temperature, maxTokens: req.maxTokens, onToken: (t) => { out.textContent += t; } });
+        } catch (e) { note.textContent = "could not reach " + req.model + ": " + (e?.message || e); }
+      });
+      go.disabled = !plan.deeper.available;
+      panel.append(go);
+    }
+    body.append(wrap);
+  }
```

Notes for applying: `models`, `bridge`, `client`, `el`, `actBtn` are already in scope there. `rerunAs` and
`askBefore` stay (retry and Build this still use them). No CSS is needed: the card is a `.disclosure.open`
and the glue reuses `.disc-*`. If the person asks again after the model answered, a re-click closes and
reopens the card (a fresh explanation; the model reading is not stored by design).

## 4. Not verified

* The patch was syntax-checked and the card was rendered headless against the served app (reuses the
  disclosure CSS correctly), but the menu click, `explainTurn`, and the streaming "go deeper" were not run
  end-to-end in the real app (no model was called; the browser pane belongs to another agent).
* Full suite: 363 tests, all pass (41 are new). Mid-session two static tests in `fold-chat-sessions.test.mjs` failed from the main session's in-flight fold-chat.js refactor and then passed again; any edit to fold-chat.js should be re-run against them.
* The outline is lexical, not a parse: a regex literal containing a quote, template-string interpolation
  that builds code, minified one-liners with many `//` inside regexes, or code assembled at run time can be
  mis-read or missed (the outline says so when it sees `eval`/`new Function`/`document.write`).
* Verification facts come only from the stored check rows; runs recorded before `grounding.events` existed
  say "no run record is stored".
