#!/usr/bin/env python3
# Builds eval/ants/g2/wire.diff: the edits to fold-chat.js that wire fold-chat-genvoid.js, made in a SCRATCH COPY (the shared file is never edited).
import subprocess, sys, os, shutil
MODE = sys.argv[1] if len(sys.argv) > 1 else "standalone"      # "standalone": against the current fold-chat.js; "on-g1": against fold-chat.js WITH eval/ants/g1/wire.diff applied (G1's output-type reading wired first)
SP = "/private/tmp/claude-501/-Users-mlacy-Documents-3-0-the-fold/0c804cde-75c0-4276-bf91-3cc3a46d1c35/scratchpad"
if MODE == "on-g1":
    os.makedirs(SP + "/wireg1", exist_ok=True); shutil.copy("fold-chat.js", SP + "/wireg1/fold-chat.js")
    subprocess.check_call(["patch", "-p1", "-s"], stdin=open("eval/ants/g1/wire.diff"), cwd=SP + "/wireg1")
    SRC = SP + "/wireg1/fold-chat.js"; SCR = SP + "/wireg1/fold-chat.out.js"
else:
    SRC = "fold-chat.js"; SCR = SP + "/wire/fold-chat.js"
G1 = MODE == "on-g1"
s = open(SRC).read()
def rep(old, new, count=1):
    global s
    assert s.count(old) == count, f"pattern count {s.count(old)} != {count}: {old[:80]!r}"
    s = s.replace(old, new)

# 1. import
rep('import { UNSOURCED_ANSWERS, unsourcedPlan, sourcesPrompt, liveAsk, unreachedGap, liveGap, emptyNotice, errorNotice, declinedFallbackNotice, noModelFallbackNotice, gapAnswerLine, modelSpeaksAlone, aloneTurn } from "./fold-chat-gaps.js";',
    'import { UNSOURCED_ANSWERS, unsourcedPlan, sourcesPrompt, liveAsk, unreachedGap, liveGap, emptyNotice, errorNotice, declinedFallbackNotice, noModelFallbackNotice, gapAnswerLine, modelSpeaksAlone, aloneTurn } from "./fold-chat-gaps.js";\n'
    '// THE VOID FOR A WRITTEN OUTPUT (fold-chat-genvoid.js): a failed generate/compose turn draws a typed gap that names the thing asked for, never the sources as the piece.\n'
    + ('// G1\'s describeOutput() (fold-chat-outputtype.js, wired by eval/ants/g1/wire.diff) supplies the output type; genVoidShape(outType, KNOWN_FORMS) maps it. outputTypeFromAsk() is only the fallback.\n' if G1 else '// When ant G1\'s fold-chat-outputtype.js is wired (eval/ants/g1/wire.diff), use its describeOutput() through genVoidShape(outType, KNOWN_FORMS) instead of outputTypeFromAsk().\n')
    + ('import { genVoid, outputTypeFromAsk, strandFallbackAllowed, genVoidText, KNOWN_FORMS } from "./fold-chat-genvoid.js";' if G1 else 'import { genVoid, outputTypeFromAsk, topicQuery, topicIsMissing, strandFallbackAllowed, genVoidText } from "./fold-chat-genvoid.js";'))

# 2. searchQ becomes let: a written output searches its TOPIC (set after kind is known)   [standalone only: G1's wire already searches outType.searchQuery]
if not G1: rep('    const searchQ = follow.search || question;                       // what is SEARCHED (and what picks the quoted sentences)',
    '    let searchQ = follow.search || question;                         // what is SEARCHED (and what picks the quoted sentences); a written output narrows it to its topic below')

# 3. after kind: the output type, the topic-only query, the no-topic short-circuit
if G1:
    rep('    const kind = classifyTurn(question, { hasMaterial: materialOf(s).length > 0 });\n',
        '    const kind = classifyTurn(question, { hasMaterial: materialOf(s).length > 0 });\n'
        '    // THE VOID FOR A WRITTEN OUTPUT (fold-chat-genvoid.js): what a generate/compose turn could not write, and why, is a typed gap that names the thing; the sources are never drawn as the piece.\n'
        '    const genOt = kind === "generate" || kind === "compose" ? (outType?.wants ? genVoidShape(outType, KNOWN_FORMS) : outputTypeFromAsk(question, { hasMaterial: materialOf(s).length > 0 })) : null;\n'
        '    let genGate = null;   // { ok:false, void, notice, fallbackAllowed }\n')
else:
    rep('    const kind = classifyTurn(question, { hasMaterial: materialOf(s).length > 0 });\n',
    '    const kind = classifyTurn(question, { hasMaterial: materialOf(s).length > 0 });\n'
    '    // THE OUTPUT TYPE of a written ask. Measured 2026-10-06 ("write me an essay on this" after "who invented the telephone?"): the search was "write essay invented\n'
    '    // telephone", so what came back was essay samples and essay-writing tutorials, and when the model call failed the strand quoted one of them as if it were the essay.\n'
    '    // A written output searches its TOPIC only; with no topic nothing is searched; and a failure is the typed gap (genGate), never the strand.\n'
    '    const genOt = kind === "generate" || kind === "compose" ? outputTypeFromAsk(question, { topic: follow.topic || (follow.carried || []).map((c) => (typeof c === "string" ? c : c?.surface || c?.name || "")).filter(Boolean).join(" and "), searchQ: follow.search || "", hasMaterial: materialOf(s).length > 0 }) : null;\n'
    '    let genGate = null;   // { ok:false, void, notice, fallbackAllowed } — what the turn could not write, and why (fold-chat-genvoid.js)\n'
    '    if (genOt && kind === "generate") { const tq = topicQuery(genOt, searchQ); if (tq) searchQ = tq; }\n'
    '    const genNoTopic = !!(genOt && kind === "generate" && genOt.needsSources && topicIsMissing(genOt.topic));\n')

# 4. wantWeb: no topic, no search   [standalone only: G1's activeGap already stops the search]
if not G1: rep('const wantWeb = !skipsSearch(kind) && !!question && follow.mode === "web" && !noLookup && !recall && !srcRecall && !primaryAsk;',
    'const wantWeb = !skipsSearch(kind) && !!question && follow.mode === "web" && !noLookup && !recall && !srcRecall && !primaryAsk && !genNoTopic;')

# 5. after the search: set aside the pages about WRITING it; a gate that leaves nothing usable draws the void
G1_OLD = '          // a page that teaches HOW TO WRITE the piece ("Essay on Telephone in 100, 200, 300 Words … first start with an introduction") is not a source on its topic: set aside; if nothing else is left the turn draws the gap below\n          if (producing && outType.needsSources) webPassages = voidsAfterSearch(outType, webPassages).usable;\n'
BLOCK5 = (
    '          if (genOt) {\n'
    '            // pages ABOUT writing the output (tutorials, samples, templates, writing services, bot walls, pages that never mention the topic) are not material for it\n'
    '            const g0 = genVoid({ outputType: genOt, webPassages, question });\n'
    '            if (g0.setAside.length) {\n'
    '              asideUrls = [...asideUrls, ...g0.setAside.map((x) => String(x.url || "")).filter(Boolean)];\n'
    '              feedPush(lineEvent(tt, `Set aside ${g0.setAside.length} page${g0.setAside.length === 1 ? "" : "s"} about writing, not about the topic`, { tone: "info", note: [...new Set(g0.setAside.map((x) => x.why.replace(/^meta-/, "")))].join(", ") + " \\u00b7 " + g0.setAside.slice(0, 3).map((x) => x.domain || x.title).join(", ") }));\n'
    '              webPassages = g0.passages;\n'
    '            }\n'
    '            if (!g0.ok && !webPassages.length && g0.setAside.length) genGate = g0;   // pages were read and every one was set aside; no pages at all is drawn below, with the search that was tried\n'
    '          }\n')
if G1: rep(G1_OLD, BLOCK5)    # one filter, not two: genVoid's set-aside (writing guides, samples, services, walls, off-topic) supersedes voidsAfterSearch's
else: rep('          webPassages = w.passages || [];\n', '          webPassages = w.passages || [];\n' + BLOCK5)

# 6. the "no source" line says what was wrong; the unsourced plan names the output
rep('''      feedPush(lineEvent(tt, "No source could be read", { tone: "bad", note: "drawing the gap \\u2014 I won't answer from memory" }));
    }''',
    '''      // a written output with nothing to write from: the gap names the output (no topic / no usable source / the lane may not speak alone), with the search that was tried
      if (genOt && !genGate) { genGate = genVoid({ outputType: genOt, webPassages, hasMaterial: materialOf(s).length > 0, barred: "alone", question }); if (!genGate.ok) genGate.void.attempts = unreachedGap(webTrace, question).attempts; }
      feedPush(genGate && !genGate.ok ? lineEvent(tt, `No usable source for the ${genOt.type}`, { tone: "bad", note: genGate.void.note }) : lineEvent(tt, "No source could be read", { tone: "bad", note: "drawing the gap \\u2014 I won't answer from memory" }));
    }''')

# 7. the model is barred while a gate stands
rep('const modelBarred = !!(plan || strand || aloneBarred);', 'const modelBarred = !!(plan || strand || aloneBarred || (genGate && !genGate.ok));')

# 8. no model reachable: a written output draws the void, not the strand
rep('      if (!skipModel && m.none) {\n        const why = noModelWhy(',
    '      if (!skipModel && m.none && genOt) {\n'
    '        const why = noModelWhy({ bridgeUp: modelsUp, models, selectedId: s.model || null, page: pageState() });\n'
    '        genGate = genVoid({ outputType: genOt, webPassages, failure: { kind: "no-model", message: why.text || "no model" }, question }); skipModel = true;\n'
    '        feedPush(lineEvent(tt, "No model is reachable", { tone: "bad", note: "so nothing was written \\u2014 the sources are not shown as the " + genOt.type }));\n'
    '      } else if (!skipModel && m.none) {\n        const why = noModelWhy(')

# 9. the model call failed or was refused: a written output draws the void, not the strand
CL = '        if (ac.signal.aborted || !wantWeb || !webPassages.length' + (' || producing) throw modelErr;   // a failed WRITING turn is a failed turn (failTurn: a typed note + retry), never "from the sources, unchanged"' if G1 else ') throw modelErr;') + '\n'
rep(CL + '        const fb = snipsOf(webPassages, searchQ);\n        if (!fb.snips.length) throw modelErr;\n        fellBack = declinedFallbackNotice(modelErr, { from: answerMode });\n        strand = fb; skipModel = true; out = { text: "", tokens: 0 };\n',
    '        if (genOt && !ac.signal.aborted) {\n'
    '          // a WRITTEN OUTPUT is never answered by quoting pages: the typed gap names it, says what the turn had, and what would unblock it\n'
    '          genGate = genVoid({ outputType: genOt, webPassages, failure: modelErr, question }); skipModel = true; out = { text: "", tokens: 0 };\n'
    '          for (const n of [...body.childNodes]) if (n.nodeType === 3) n.remove();\n'
    '          delete body.dataset.streaming;\n'
    '          feedPush(endStep(tt, "write", { title: `${m.id} did not answer`, tone: "bad", note: modelErr?.status === 403 ? "the safety gate said no" : String(modelErr?.message || modelErr).slice(0, 80) }));\n'
    '          say(`turn \\u00b7 ${kindWord} \\u00b7 the model did not answer \\u00b7 nothing was written`);\n'
    '        } else {\n'
    + CL + '        const fb = snipsOf(webPassages, searchQ);\n        if (!fb.snips.length) throw modelErr;\n        fellBack = declinedFallbackNotice(modelErr, { from: answerMode });\n        strand = fb; skipModel = true; out = { text: "", tokens: 0 };\n')
rep('        say(`turn \\u00b7 ${kindWord} \\u00b7 the model declined \\u00b7 showing the sources instead (${strand.snips.length} passage(s), no model)\\u2026`);\n      }\n',
    '        say(`turn \\u00b7 ${kindWord} \\u00b7 the model declined \\u00b7 showing the sources instead (${strand.snips.length} passage(s), no model)\\u2026`);\n        }\n      }\n')

# 10. the model's own refusal is the void's job for a written output
rep('      if (!strand && isRefusal(text)) {', '      if (!strand && !genOt && isRefusal(text)) {')

# 11. the draft is judged AS the thing: empty / refused / stub / a question back / a tutorial / off topic
rep('      const bad = text && !strand ? memory.ungroundedIdentity(',
    '      // A WRITTEN OUTPUT is judged as the thing it was asked for before anything is shown: a stub, a refusal, a question back, a how-to-write guide or a draft that never mentions the topic is a void.\n'
    '      if (genOt && !genGate && !strand && !skipModel) { const gj = genVoid({ outputType: genOt, webPassages, modelResult: { text, finish: out.finish }, hasMaterial: materialOf(s).length > 0, question }); if (!gj.ok) { genGate = gj; text = ""; } }\n'
    '      const bad = text && !strand ? memory.ungroundedIdentity(')

# 12. the Pivot withheld the whole draft: never the strand, for a written output
rep('          if (pivotRes.gap) {\n',
    '          if (pivotRes.gap && genOt) {\n'
    '            genGate = genVoid({ outputType: genOt, webPassages, failure: { kind: "withheld" }, question }); text = "";\n'
    '            feedPush(lineEvent(tt, "Nothing the model wrote could be spoken", { tone: "bad", note: "drawing the gap, not the sources as the " + genOt.type }));\n'
    '          } else if (pivotRes.gap) {\n')

# 13. the barred lane's note names the output too (and is not said twice)
OLD13 = 'aloneTurn(noLookup ? "nolookup" : kind, { outputType: producing ? genVoidShape(outType) : null, hasMaterial: materialOf(s).length > 0, question }); if (at.notice) notices.push(at.notice); }' if G1 else 'aloneTurn(noLookup ? "nolookup" : kind); if (at.notice) notices.push(at.notice); }'
rep(OLD13,
    'aloneTurn(noLookup ? "nolookup" : kind, genOt && !noLookup ? { outputType: genOt, hasMaterial: materialOf(s).length > 0, question } : undefined); if (at.void && !genGate) genGate = { ok: false, void: at.void, notice: { kind: "gen-void", text: at.notice?.text || at.void.note }, fallbackAllowed: false }; if (at.notice && !at.void) notices.push(at.notice); }')

# 14. no blank-turn note on top of a typed void
rep('if (!text.trim() && !notices.length && !skipModel && !liveDrop) notices.push(emptyNotice(',
    'if (!text.trim() && !notices.length && !skipModel && !liveDrop && !genGate) notices.push(emptyNotice(')

# 15. the record: the void IS the turn (first in the chain)
rep('      if (record && (plan || liveDrop)) {\n        delete record.creative; delete record.noClaims;      // a gap is not "no claims to check"\n',
    '      if (record && genGate && !genGate.ok) {\n'
    '        delete record.creative; delete record.noClaims;      // a gap is not "no claims to check"\n'
    '        gapReport = genGate.void; text = "";\n'
    '        feedPush(lineEvent(tt, `Could not ${genGate.void.outputType && ["image", "video", "slides"].includes(genGate.void.outputType) ? "make" : "write"} the ${genGate.void.outputType || "piece"}`, { tone: "bad", note: genGate.void.missing.join("; ") }));\n'
    '      } else if (record && (plan || liveDrop)) {\n        delete record.creative; delete record.noClaims;      // a gap is not "no claims to check"\n')

# 16. the closing line of the feed counts a typed void as a gap
rep('feedPush(doneEvents(tt, { ok: !(plan || liveDrop || (slotTurn && !slotTurn.answer)),', 'feedPush(doneEvents(tt, { ok: !(plan || liveDrop || (genGate && !genGate.ok) || (slotTurn && !slotTurn.answer)),')
rep('gap: !!(plan || liveDrop || (slotTurn && !slotTurn.answer)) }) }));', 'gap: !!(plan || liveDrop || (genGate && !genGate.ok) || (slotTurn && !slotTurn.answer)) }) }));')

# 17. the gap block draws the generate void: what is missing, what the turn had, what was set aside, the offer, and a retry
rep('    if ((v.closeBy || []).length) box.append(el("div", "gap-text gap-close", "to close it: " + v.closeBy.join(" \\u00b7 ")));\n    if (retry && (v.kind === "unreached" || v.kind === "live")) {',
    '    if (v.kind === "generate") {\n'
    '      // what a written output is missing, what the turn did have, and the pages it set aside (about writing it, not about the topic) — all data from record.void\n'
    '      if ((v.missing || []).length) box.append(el("div", "gap-text", "missing: " + v.missing.join("; ")));\n'
    '      if ((v.attempts || []).length) { const ul = el("ul", "gap-list gap-attempts"); for (const a of v.attempts) ul.append(el("li", a.ok ? "" : "gap-failed", `${a.name}${a.engine && a.engine !== a.name ? " (" + a.engine + ")" : ""} \\u2014 ${a.ok ? (a.n ?? 0) + " result" + (a.n === 1 ? "" : "s") : "failed: " + a.why}`)); box.append(ul); }\n'
    '      if ((v.had || []).length) { box.append(el("div", "gap-sub", "what the turn had")); const ul = el("ul", "gap-list"); for (const h of v.had) ul.append(el("li", "", h.kind === "page" ? `${h.title}${h.domain ? " \\u00b7 " + h.domain : ""} \\u2014 ${h.note || "usable"}` : h.note || "")); box.append(ul); }\n'
    '      if ((v.setAside || []).length) { box.append(el("div", "gap-sub", "set aside \\u2014 not material for it")); const ul = el("ul", "gap-list"); for (const x of v.setAside) { const li = el("li"); if (x.url && /^https?:\\/\\//i.test(x.url)) { const a = el("a", "", x.title || x.url); a.href = x.url; a.target = "_blank"; a.rel = "noopener"; li.append(a); } else li.append(el("span", "", x.title || "page")); li.append(el("span", "gap-dom", " \\u00b7 " + (x.domain ? x.domain + " \\u00b7 " : "") + String(x.why).replace(/^meta-/, "about writing: ").replace(/-/g, " "))); ul.append(li); } box.append(ul); }\n'
    '      if (v.offer) { const b = el("button", "note-retry", v.offer.label); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); setAnswerMode("snips"); retry?.(); }; box.append(b); }   // the person CHOOSES the sources-only turn; it is never drawn in place of the piece\n'
    '    }\n'
    '    if ((v.closeBy || []).length) box.append(el("div", "gap-text gap-close", "to close it: " + v.closeBy.join(" \\u00b7 ")));\n    if (retry && (v.kind === "unreached" || v.kind === "live" || (v.kind === "generate" && v.retry !== false))) {')
open(SCR, "w").write(s)
print("scratch written", len(s))
