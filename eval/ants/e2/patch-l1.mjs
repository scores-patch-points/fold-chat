// eval/ants/e2/patch-l1.mjs — builds patched/fold-chat.js from the tracked fold-chat.js (never edits it): L1 "answer first".
// One flag in the page, localStorage "fold-chat:e2defer" = "off" turns the patch's behaviour off (same code, A/B on the SAME file).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "../../../fold-chat.js");
let s = fs.readFileSync(SRC, "utf8");
const PARTS = (process.env.E2_PARTS || "l1,l2a").split(",");   // l1 = answer-first (sections 1-3), l2a = skip a futile REC lap (section 4)
const OUTFILE = process.env.E2_OUT || path.join(HERE, "patched/fold-chat.js");
const must = (re, label) => { if (!re.test(s)) { console.error("ANCHOR MISSING:", label); process.exit(1); } };
const rep = (from, to, label) => { if (!s.includes(from)) { console.error("ANCHOR MISSING:", label); process.exit(1); } s = s.replace(from, to); };

if (PARTS.includes("l1")) {
// 1. the provenance step becomes a function; it runs inline (as today) or AFTER the answer is on the page
rep(`      let provenance = null;
      if (provenanceEnabled() && wantWeb && webPassages.length && !strand && !slotTurn && !modelBarred && text.trim() && kind !== "generate" && kind !== "compose") {`,
`      let provenance = null;
      const provWanted = provenanceEnabled() && wantWeb && webPassages.length && !strand && !slotTurn && !modelBarred && text.trim() && kind !== "generate" && kind !== "compose";
      const deferProv = provWanted && (() => { try { return localStorage.getItem("fold-chat:e2defer") !== "off"; } catch { return true; } })();
      const provenanceWork = async () => {
      if (provWanted) {`, "provenance head");
rep(`        } catch (e) { if (ac.signal.aborted) throw e; feedPush(lineEvent(tt, "The source check failed", { tone: "warn", note: String(e?.message || e).slice(0, 90) })); }
      }
      // The app-authored words of a turn the model may not answer alone`,
`        } catch (e) { if (ac.signal.aborted) throw e; feedPush(lineEvent(tt, "The source check failed", { tone: "warn", note: String(e?.message || e).slice(0, 90) })); }
      }
      };
      if (!deferProv) await provenanceWork();   // E2 L1: with the flag on, this runs AFTER the checked answer is on the page (below)
      // The app-authored words of a turn the model may not answer alone`, "provenance tail");

// 2. the append returns the node so it can be redrawn when provenance arrives; then the deferred work
rep(`      if (isLive()) appendMsg(s, "assistant", text, { sealed: m.sealed, index: idx, grounding: record, notices, model: m.id, mode: "chat", authored: strand ? "sources" : null, snips: storedSnips, answerTurn: slotStored, provenance });`,
`      const drawMeta = (prov) => ({ sealed: m.sealed, index: idx, grounding: record, notices, model: m.id, mode: "chat", authored: strand ? "sources" : null, snips: storedSnips, answerTurn: slotStored, provenance: prov });
      let drawn = null;
      if (isLive()) { drawn = buildMsg(s, "assistant", text, drawMeta(provenance)); if (drawn.seam) E.threadCol.append(drawn.seam); E.threadCol.append(drawn.wrap); E.thread.scrollTop = E.thread.scrollHeight; try { window.__e2answerAt = performance.now(); window.__e2pending = false; } catch {} }
      if (deferProv) {
        // E2 L1: the answer is visible. NOW point at the source (same code, same checks), then redraw the same message with the source line under it.
        const msgObj = s.messages[idx];
        if (!Object.prototype.hasOwnProperty.call(s, "_after")) Object.defineProperty(s, "_after", { value: null, writable: true, enumerable: false, configurable: true });   // never persisted
        try { window.__e2pending = true; window.__e2provAt = null; } catch {}
        s._after = (async () => {
          try {
            await provenanceWork();
            if (provenance) msgObj.provenance = provenance;
            try {
              const tiers = (provenance?.pointers || []).map((p) => p.tier);
              const best = tiers.includes("primary") ? "primary" : tiers.includes("origin") ? "origin" : tiers[0] || null;
              const aw = watchPost({ ask: said, prior: askAt > 0 ? s.messages.slice(0, askAt) : [], pre: watcherPre, reads: surfedUrls.length ? surfedUrls : webPassages.map((p) => String(p.url || p.source || "")).filter(Boolean), setAside: asideUrls, events: turnEvents, passages: webPassages, spoken: text, reached: !!(provenance && provenance.verified), tier: best });
              msgObj.watch = { relation: aw.relation, want: aw.want, flags: aw.flags.map((f) => f.flag), baton: aw.baton, ...(aw.detail ? { detail: aw.detail } : {}), ...(aw.appAnswered ? { appAnswered: true } : {}) };
            } catch (e) { /* an aid */ }
            if (record) record.feed = storeEvents(turnEvents, { max: 60 });
            s.updated = now(); save("fold-chat:sessions", sessions);
            if (isLive() && drawn && drawn.wrap.isConnected) { const again = buildMsg(s, "assistant", text, drawMeta(provenance)); drawn.wrap.replaceWith(again.wrap); drawn = again; }
          } catch (e) { try { console.error("[fold-chat] deferred source check:", e); } catch {} }
          finally { try { window.__e2provAt = performance.now(); window.__e2pending = false; } catch {} if (isLive()) E.stage.textContent = ""; s._after = null; }
        })();
      }`, "append");

// 3. the next turn waits for the previous turn's deferred checks (so its baton and "where did you get that?" read the finished record)
rep(`    const runId = newRun("chat");
    const s = sessions[id]; if (!s) return;
    if (busy(id)) return;`, `    const runId = newRun("chat");
    const s = sessions[id]; if (!s) return;
    if (busy(id)) return;
    if (s._after) { try { await s._after; } catch {} }   // E2 L1`, "run head");

}
// 4. L2a: a REC lap that provably repeats the last one is not run. Lap n+1 reads the same sentences (text unchanged), the same pages (lap n's own wider cross-reference already included what it added) and
//    asks the same query of the same search; measured 2026-10-06: in 3 of 3 two-lap turns lap 2 added 0 sources and restated 0 sentences. Flag "fold-chat:e2rec"="off" restores the old behaviour.
if (PARTS.includes("l2a")) rep(`          if (lap === 3) break;   // two laps back, then the third check is the verdict`,
`          if (lap === 3) break;   // two laps back, then the third check is the verdict
          if (lap >= 2 && text === textBefore && (() => { try { return localStorage.getItem("fold-chat:e2rec") !== "off"; } catch { return true; } })()) { feedPush(lineEvent(tt, "Stopped going back", { tone: "info", note: "the last lap changed no sentence, and another would ask the same of the same pages \u2014 the sentences still failing are marked" })); break; }`, "rec lap guard");

// 5. L2b: the REC loop's LAPS (search again, read more, re-check) run after the answer is on the page. The first mechanical check (falsifyAnswer, ms) stays inline: a sentence it breaks is MARKED at once
//    ("still checking"), the laps then run beside the provenance step, add what they read to the record, and the marks are redrawn when they end. In this mode the laps do NOT restate sentences with the model
//    (measured 2026-10-06: 13 restatement calls, 163 s, 0 sentences replaced): the spoken text is the Pivot's reading of the draft, exactly what the person saw, and is never changed behind their back.
if (PARTS.includes("l2b")) {
rep(`      let recLoop = null;
      if (!strand && wantWeb`, `      let recLoop = null, recPending = false, recRunLaps = null;
      if (!strand && wantWeb`, "rec decl");
rep(`        const textBefore = text;
        for (let lap = 1; lap <= 3; lap++) {
          const sents = claimSentences(text);`, `        const textBefore = text;
        const deferRec = (() => { try { return localStorage.getItem("fold-chat:e2recdefer") !== "off"; } catch { return true; } })();
        const runLaps = async (deferred) => {
        for (let lap = 1; lap <= 3; lap++) {
          const sents = claimSentences(text);`, "rec loop head");
rep(`          if (lap === 3) break;   // two laps back, then the third check is the verdict`, `          if (lap === 3) break;   // two laps back, then the third check is the verdict
          if (deferred === true) { recPending = true; recLoop.pending = true; feedPush(lineEvent(tt, \`\\u2217 \${failing.length} sentence\${failing.length === 1 ? "" : "s"} broke on the first check\`, { tone: "warn", note: failing.map((c) => \`s\${c.i + 1} \${c.verdict}\`).join(" \\u00b7 ") + " \\u2014 marked now; I'll go back to search after the answer is shown" })); return; }`, "rec defer");
rep("if (lap >= 2 && text === textBefore &&", "if (lap >= 2 && (text === textBefore || deferred === \"after\") &&", "l2a guard (needs l2a)");
rep(`          if (!still.length || skipModel || m.none) continue;`, `          if (!still.length || skipModel || m.none || deferred === "after") continue;   // E2 L2b: after the answer is shown, laps only search and re-check; they never restate`, "rec norestate");
rep(`        if (text !== textBefore && pvStream) pvStream = text;
        if (!recLoop.passes.length && recLoop.cleared) recLoop.firstTry = true;
      }`, `        if (text !== textBefore && pvStream) pvStream = text;
        if (!recLoop.passes.length && recLoop.cleared) recLoop.firstTry = true;
        };
        if (deferRec) { await runLaps(true); if (recPending) recRunLaps = async () => { recPending = false; recLoop.pending = false; await runLaps("after"); }; }
        else await runLaps(false);
      }`, "rec loop tail");
rep("        recLoop.processLine = lp ? `reframed", "        recLoop.processLine = recLoop.pending ? `reframe \\u00b7 the first check broke ${(S.unsupported || 0) + (S.contested || 0) + (S.weak || 0)} sentence(s), marked; going back for more sources after the answer is shown` : lp ? `reframed", "processLine");
// the continuation: the REC laps and the provenance run together after the answer is drawn
rep(`      if (deferProv) {
        // E2 L1:`, `      if (deferProv || recRunLaps) {
        // E2 L1:`, "cont cond");
rep(`          try {
            await provenanceWork();
            if (provenance) msgObj.provenance = provenance;`, `          try {
            await Promise.all([provenanceWork(), recRunLaps ? recRunLaps().catch((e) => { if (ac.signal.aborted) return; try { console.error("[fold-chat] deferred reframe:", e); } catch {} }) : null]);
            if (recLoop && record) {
              const lp2 = recLoop.passes.length, S2 = recLoop.after || {};
              recLoop.processLine = lp2 ? \`reframed \\u00b7 went back \${lp2} lap\${lp2 === 1 ? "" : "s"} (after the answer was shown) \\u00b7 \${recLoop.passes.reduce((n, p) => n + p.added, 0)} more source(s) read \\u00b7 0 sentence(s) restated \\u00b7 \${recLoop.cleared ? "every sentence holds" : \`\${(S2.unsupported || 0) + (S2.contested || 0) + (S2.weak || 0)} still failing, marked\`}\` : "reframe \\u00b7 nothing more found";
              record.loop = recLoop; record.process = (record.process || []).filter((x) => !/^reframe/.test(x)); record.process.push(recLoop.processLine);
              record.passages = webPassages.slice(0, 8).map((p) => ({ ref: p.ref, source: p.source, url: p.url, title: p.title, domain: p.domain, text: String(p.text || "").slice(0, 2400) }));
              record.nSources = webPassages.length + materialOf(s).length + (threadTurn ? 1 : 0);
              if (webTrace) record.web = webTrace;
            }
            if (provenance) msgObj.provenance = provenance;`, "cont body");
rep(`          finally { try { window.__e2provAt`, `          finally { try { delete recLoop.pending; } catch {} try { window.__e2provAt`, "cont finally");
}

// 6. L9: the encyclopedia-origin following (up to its 12 s box) no longer holds the model's write. It gets 2 s; if it is not done it carries on BESIDE the write and is joined before the Pivot reads the draft
//    (the Pivot, the REC loop and provenance all see the originals exactly as before). Measured 2026-10-06: 0 successes in 74 trails; read-end -> write-start gap median 2.9 s, 8 of 21 turns >= 7 s, 2 at the 12 s box.
if (PARTS.includes("origin")) {
rep(`      try {
        const { trails } = await raceAbort(originatePassages(webPassages, searchQ, { fetchImpl: withSignal(outbound.auditedFetch("web search", runId), ac.signal), memo: pageMemo, signal: ac.signal }), ac.signal);
        const seenTrail = new Set();`, `      const originRun = (async () => { try {
        const { trails } = await raceAbort(originatePassages(webPassages, searchQ, { fetchImpl: withSignal(outbound.auditedFetch("web search", runId), ac.signal), memo: pageMemo, signal: ac.signal }), ac.signal);
        const seenTrail = new Set();`, "origin head");
rep(`      } catch (e) { if (ac.signal.aborted) throw e; feedPush(lineEvent(tt, "Could not follow the encyclopedia's references", { tone: "warn", note: String(e?.message || e).slice(0, 90) })); }
    }
    let plan = null;`, `      } catch (e) { if (ac.signal.aborted) throw e; feedPush(lineEvent(tt, "Could not follow the encyclopedia's references", { tone: "warn", note: String(e?.message || e).slice(0, 90) })); } })();
      const originWait = (() => { try { return localStorage.getItem("fold-chat:e2origin") === "off" ? 0 : 2000; } catch { return 2000; } })();
      if (!originWait) await originRun;
      else { const early = await Promise.race([originRun.then(() => true), new Promise((r) => setTimeout(() => r(false), originWait))]); if (!early) { originLate = originRun; originLate.catch(() => {}); feedPush(lineEvent(tt, "Writing while the encyclopedia's references are still being followed", { tone: "info", note: "they are joined before the draft is read" })); } }
    }
    let plan = null;`, "origin tail");
rep(`    // AN ENCYCLOPEDIA IS A POINTER, NEVER A CITATION (fold-chat-origin.js, user 2026-10-06)`, `    let originLate = null;
    // AN ENCYCLOPEDIA IS A POINTER, NEVER A CITATION (fold-chat-origin.js, user 2026-10-06)`, "origin decl");
rep(`      // THE REC LOOP (reframe). Every sentence is tried`, `      if (originLate) { try { await raceAbort(originLate, ac.signal); } catch (e) { if (ac.signal.aborted) throw e; } }   // E2 L9: joined before anything reads the draft
      // THE REC LOOP (reframe). Every sentence is tried`, "origin join");
}
fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
fs.writeFileSync(OUTFILE, s);
console.log(OUTFILE, "written", s.length, "bytes");
