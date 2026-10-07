# B2 — `fold-chat-counsel.js`: how a thinker would answer, said only where it is tied to their own words

Files: `fold-chat-counsel.js` (pure), `fold-chat-counsel.test.mjs` (31 tests), `eval/ants/b2-mutate.mjs` (mutation runner), `eval/ants/b2-real.mjs` (real run), `eval/ants/B2-PREREG.md`, `eval/ants/B2-real-run-{1,2,3,4}.log`.

## Contract (as built; additive fields only beyond the brief)
```
counselFor({ question, thinker:{ handle, giver, work, source:{path,sha256}, text | candidates:[{start,end,text}] }, draft, point, fw, limits })
  → Promise<{ thinker, assertions:[{ text, tied, pointer?:{start,end,quote,tier:"canon"}, why? }], narration:{ text, parts:[{kind:"app"|"quote", text, rule?, model?, start?, end?}] }, calls:{draft,point}, refused?, why? }>
verifyCounsel({ result, canon }) → { ok, bad[] }     canon = the thinker's text as the caller holds it (hash it against thinker.source.sha256 FIRST; the module does no hashing)
```
* `text` mode: the whole canon in hand (server, scripts). `candidates` mode: the page cannot read the ethos files, so it passes the static `voice/voice-bank.json` sentences (verbatim, with offsets); the module ranks them by the question's stems itself. In that mode `pointer.quote` is the candidate's text; the caller must `verifyCounsel` against the real canon (server-side) or trust the bank's build-time `--check`.
* `limits.signal` (AbortSignal) is honoured; an AbortError from either call propagates.
* A reading part is `{kind:"app", rule:"reading", model:true}`: it is the ONLY model-authored text in the narration; it has no double-quote characters and sits under the fixed prefix "My reading of that, not <giver>'s words:". An assertion that merely copies its quote shows no reading line.
* quote template: `From <work>, in <giver>'s canon: “<verbatim>”` (not "wrote": the Gospel is M's record; Solon is Herodotus's). Pass a SHORT `work` and `giver` (the b2-real.mjs `shortGiver/shortWork` do it from voice-index).

## The gate (B2-PREREG.md)
Tied iff: the quote carries >= 1 content stem beyond the question's own words; AND every content stem of the assertion, OR (>= 2 stems and >= 60%); AND every figure; AND negation parity. Lexical. See the real-run reading below for what that cannot see.

## Wiring patch for fold-chat.js — NOT APPLIED (vetoed). Proposal for the boss
Where: the contested-question path (after the thinkers are chosen — B1's roster/selection atom — and before the answer card renders). The model calls go through the existing `callModel`; drafting is a normal call (temperature 0.6), pointing is temperature 0 like the provenance pointer. The page loads `voice/voice-bank.json` + `voice/voice-index.json` once (static) and passes `candidates`.

```diff
--- a/fold-chat.js
+++ b/fold-chat.js
@@ imports (near line 46)
 import { provenanceFor, provenanceEnabled } from "./fold-chat-provenance.js";
+import { counselFor, COUNSEL } from "./fold-chat-counsel.js";
+
+const COUNSEL_KEY = "fold-chat:counsel";                       // switch, like provenance: "off" disables
+const counselEnabled = () => { try { return localStorage.getItem(COUNSEL_KEY) !== "off"; } catch { return true; } };
+let VOICE_STATIC = null;                                       // { index, bank } loaded once from the static files
+async function voiceStatic() {
+  if (VOICE_STATIC) return VOICE_STATIC;
+  try {
+    const [index, bank] = await Promise.all(["voice/voice-index.json", "voice/voice-bank.json"].map((u) => fetch(u).then((r) => (r.ok ? r.json() : null))));
+    VOICE_STATIC = index && bank ? { index, bank } : null;
+  } catch { VOICE_STATIC = null; }
+  return VOICE_STATIC;
+}
@@ inside the turn, after `provenance` is computed (near line 2352), for a contested question with thinkers chosen
+      // HOW EACH THINKER WOULD ANSWER (fold-chat-counsel.js): Pythia drafts from the thinker's own sentences; every assertion must be TIED by a pointing call + the gate to a verbatim canon
+      // sentence or it is WITHHELD. The narration is the app's words around the canon's words; the model's reading appears only under its tie.
+      let counsel = null;
+      if (counselEnabled() && contested && thinkers.length && !modelBarred && kind !== "generate" && kind !== "compose") {
+        const vs = await voiceStatic();
+        if (vs) {
+          counsel = [];
+          for (const h of thinkers.slice(0, 3)) {                              // thinkers: handles chosen elsewhere (B1)
+            const rec = vs.index.archons.find((a) => a.handle === h);
+            const cands = vs.bank[h];
+            if (!rec || !cands?.length) { counsel.push({ handle: h, refused: true }); continue; }     // named and refused, never ventriloquized
+            say(`turn · ${kindWord} · asking how ${rec.giver.replace(/\s*\(.*$/, "")} would answer…`);
+            try {
+              const r = await counselFor({
+                question: lastUser.content,
+                thinker: { handle: h, giver: rec.giver.replace(/\s*\(.*$/, "").trim(), work: rec.work.split(/[,(—]/)[0].trim(), source: rec.source, candidates: cands },
+                fw: functionWordsOf(lang0 === "unknown" ? "en" : lang0),
+                limits: { signal: ac.signal },
+                draft: async (msgs) => (await callModel(msgs, { base: bridge, privacy: "sealed-external", audit: { run: runId, purpose: "counsel-draft" }, signal: ac.signal, temperature: 0.6, maxTokens: 260 })).text,
+                point: async (msgs) => (await callModel(msgs, { base: bridge, privacy: "sealed-external", audit: { run: runId, purpose: "counsel-pointer" }, signal: ac.signal, temperature: 0, maxTokens: 20 })).text,
+              });
+              counsel.push({ schema: "Counsel@1", handle: h, source: rec.source, assertions: r.assertions.map((a) => ({ text: a.text, tied: a.tied, why: a.why, pointer: a.pointer || null })), parts: r.narration.parts, calls: r.calls });
+            } catch (e) { if (ac.signal.aborted) throw e; counsel.push({ handle: h, failed: String(e?.message || e).slice(0, 80) }); }
+          }
+        }
+      }
@@ the stored message (near line 2534): add  ...(counsel ? { counsel } : {})
@@ renderMessage: after renderProvenance(body, meta.provenance) (near line 1463)
+      renderCounsel(body, meta.counsel);
@@ new function next to renderProvenance (near line 1290)
+  // one block per thinker: the app's words, the thinker's verbatim sentence (quote), the model's reading ONLY under its tie, and what was withheld
+  function renderCounsel(body, list) {
+    if (!Array.isArray(list) || !list.length) return;
+    for (const c of list) {
+      const box = el("div", "prov counsel"); box.setAttribute("role", "note");
+      if (c.refused || c.failed || !Array.isArray(c.parts)) { box.append(el("span", "prov-app", c.refused ? "I have no verified words of " + c.handle + " on this, so I will not speak for them." : "I could not check what " + c.handle + " would say."));  body.append(box); continue; }
+      for (const part of c.parts) {
+        if (part.kind === "quote") box.append(" ", el("q", "prov-q", part.text));
+        else box.append(box.childNodes.length ? " " : "", el("span", part.model ? "prov-app prov-reading" : "prov-app", part.text));
+      }
+      body.append(box);
+    }
+  }
```
Server-side re-verification (recommended, tiny): the server holds the canon, so it can run `verifyCounsel({ result, canon })` on every stored `counsel` and drop the block on failure; the page alone can only trust the bank.

Still needed for this to be a feature (not B2's atom): which thinkers address a question (roster selection), `contested`, `thinkers`, the `.prov-reading` style, an off switch in settings, and the A/B per-turn call budget (3 thinkers x (1 draft + ~4 pointing) = ~15 small-model calls: too many for a chat turn without caching or fewer assertions; `limits.maxAssertions` 2 would be ~9).
