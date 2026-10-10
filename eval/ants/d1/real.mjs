// real.mjs — D1's confirmation on the REAL page (heimdall, gemma2:2b, real web). Counts what each turn really sends and what the model really is handed.
//   node eval/ants/d1/real.mjs <script> [model]       scripts: R1 | R2     writes out/real-<script>.json
// Per turn: spoken text, path (the feed rows), wire requests classified by fold-chat-budget.js classifyUrl (web = a search, pages = a page read, models), the model
// request bodies (chars handed, and whether the turn-3 needle / the anchor's name was in them), and the byte size of the stored session after the turn.
import fs from "node:fs";
import { classifyUrl } from "../../../fold-chat-budget.js";
import { openChat, say } from "../../pivot/chat-live.mjs";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const SCRIPT = process.argv[2] || "R1", MODEL = process.argv[3] || "gemma2:2b";
const OUT = new URL(`./out/real-${SCRIPT}.json`, import.meta.url);
const SCRIPTS = {
  // anchor (turn 1), detours, then probes at distance 3, 5, 8 and the same ask again
  R1: [
    ["anchor", "How tall is the Eiffel Tower?"], ["detour", "Who invented the telephone?"], ["detour", "How long is the Great Wall of China?"], ["chit", "thanks"],
    ["explicit", "What did you tell me about the Eiffel Tower earlier?"],
    ["explicitPartial", "What did you say about that tower in Paris earlier?"],
    ["detour", "When did the Berlin Wall fall?"], ["detour", "What is photosynthesis?"],
    ["pron", "How tall is it?"],
    ["repeat", "How tall is the Eiffel Tower?"],
    ["wrong", "What did you tell me about the Leaning Tower of Pisa earlier?"],
    ["correction", "Actually, it was 341 metres."],
    ["explicit", "What did you tell me about the Eiffel Tower earlier?"],
  ],
  R5: [["anchor", "How tall is the Eiffel Tower?"], ["detour", "Who invented the telephone?"], ["detour", "Who was Marie Curie?"]],
  R4: [["anchor", "How tall is the Eiffel Tower?"], ["detour", "Who invented the telephone?"], ["detour", "Who was Marie Curie?"], ["detour", "When did the Berlin Wall fall?"]],   // prompt-composition check: what exactly does the model get on turn 4
  R2: [   // sibling words
    ["anchor", "How long is the Great Wall of China?"], ["detour", "When did the Berlin Wall fall?"], ["detour", "Who was Marie Curie?"],
    ["explicit", "What did you tell me about the Great Wall of China earlier?"],
    ["explicit", "What did you tell me about the wall earlier?"],
    ["none", "What did you tell me earlier?"],
    ["para", "Which dynasty built the best-known sections of the Great Wall of China?"],
  ],
};
// R3: a LONG real conversation (30 turns): anchor, then detours and chit-chat, with the explicit probe at 10 / 20 / 29 turns — prompt size and storage per turn on the real page
SCRIPTS.R3 = (() => { const A = JSON.parse(fs.readFileSync(new URL("./corpus/asks.json", import.meta.url), "utf8")).en; const ids = ["telephone", "curie", "greatwall", "berlinwall", "penicillin", "panama", "suez", "titanic", "canberra", "pluto", "everest", "photo"]; const out = [["anchor", A.eiffel.qa[0]]]; let k = 0;
  while (out.length < 30) { const n = out.length; if (n === 10 || n === 20 || n === 29) out.push(["explicit", "What did you tell me about the Eiffel Tower earlier?"]); else if (n % 5 === 4) out.push(["chit", ["thanks", "ok cool", "interesting", "nice"][k++ % 4]]); else { const t = A[ids[k++ % ids.length]]; out.push(["detour", t.qa[(k % 2)]]); } } return out; })();
const turns = SCRIPTS[SCRIPT];
const browser = await chromium.launch();
const { ctx, page, calls } = await openChat(browser, { model: MODEL });
let reqs = [], t0 = null;
ctx.on("request", (r) => { if (t0 === null) return; const c = classifyUrl(r.url(), r.method()); if (c) reqs.push({ ...c, url: r.url().slice(0, 140) }); });
const out = [];
let i = 0;
for (const [kind, ask] of turns) {
  i++; reqs = []; const c0 = calls.length; t0 = Date.now();
  const r = await say(page, ask, 420000);
  const bodies = calls.slice(c0).map((c) => c.body).filter(Boolean);
  const sys = bodies.map((b) => (b.messages || []).map((m) => String(m.content || "")));
  const stored = await page.evaluate(() => { const raw = localStorage.getItem("fold-chat:sessions") || "{}"; const S = Object.values(JSON.parse(raw)).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {}; return { totalBytes: raw.length, sessionBytes: JSON.stringify(S).length, claims: (S.claims || []).length, claimsBytes: JSON.stringify(S.claims || []).length, msgs: (S.messages || []).length, summaryBytes: JSON.stringify(S.summary || {}).length, lastMsgBytes: JSON.stringify((S.messages || []).slice(-1)[0] || {}).length, passagesBytes: JSON.stringify(((S.messages || []).slice(-1)[0] || {}).grounding?.passages || []).length, msgKeys: (() => { const m = (S.messages || []).slice(-1)[0] || {}; const sz = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, JSON.stringify(v ?? null).length]).sort((a, b) => b[1] - a[1]).slice(0, 8)); return { top: sz(m), grounding: sz(m.grounding), claimsKeep: (S.claims || []).length, gary: (m.grounding && m.grounding.gary) || null, summaryKeys: Object.keys(S.summary || {}), records: ((S.summary || {}).records || []).length, topic: (S.summary || {}).topic || null, flow: ((S.summary || {}).flow || "").slice(0, 300) }; })() }; });
  const row = { turn: i, kind, ask, ms: Date.now() - t0, spoken: String(r.spoken ?? "").slice(0, 400), notices: r.notices.map((n) => `[${n.kind}] ${n.text}`.slice(0, 200)), reads: r.reads, searches: new Set(reqs.filter((x) => x.kind === "web").map((x) => x.key)).size, pagesRead: new Set(reqs.filter((x) => x.kind === "pages").map((x) => x.key)).size, wireWeb: reqs.filter((x) => x.kind === "web").length, wirePages: reqs.filter((x) => x.kind === "pages").length, modelCalls: bodies.length, modelChars: sys.map((m) => m.reduce((n, x) => n + x.length, 0)), modelMsgs: sys.map((m) => m.length), systemChars: sys.map((m) => (m[0] || "").length), historyMsgs: sys.map((m) => Math.max(0, m.length - 2)), eiffelInPrompt: sys.map((m) => /eiffel/i.test(m.join("\n"))), n330InPrompt: sys.map((m) => /330 m|330 metres/i.test(m.join("\n"))), ...stored };
  row.firstBody = bodies[0] ? (bodies[0].messages || []).map((m) => ({ role: m.role, chars: String(m.content || "").length, head: String(m.content || "").slice(0, 3000), tail: String(m.content || "").slice(-600) })) : null;
  out.push(row);
  console.log(`T${i} [${kind}] ${ask}\n   searches ${row.searches} pages ${row.pagesRead} modelCalls ${row.modelCalls} modelChars ${row.modelChars} storedSession ${row.sessionBytes}B (claims ${row.claimsBytes}B, last msg ${row.lastMsgBytes}B)\n   → ${row.spoken.slice(0, 160).replace(/\n/g, " ")} ${row.notices.length ? "· " + row.notices[0].slice(0, 120) : ""}`);
  fs.writeFileSync(OUT, JSON.stringify({ script: SCRIPT, model: MODEL, at: new Date().toISOString(), turns: out }, null, 1));
}
await ctx.close(); await browser.close();
