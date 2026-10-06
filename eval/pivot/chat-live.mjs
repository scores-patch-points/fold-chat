// eval/pivot/chat-live.mjs — a REAL back and forth: the real page, heimdall, gemma2:2b, real web reads. NO stub of the model or the web.
//   node eval/pivot/chat-live.mjs [scenario]     scenarios: basic | continue | thread   (default: all, in order)
// Output: a readable transcript (what the model WROTE vs what was SPOKEN, per turn) + eval/pivot/chat-live-<scenario>.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_ = process.env.FOLD_URL || "http://127.0.0.1:8815/";
const MODEL = process.env.PIVOT_MODEL || "gemma2:2b";
let chromium;
try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }

export async function openChat(browser, { model = MODEL, clampFirst = null, pivot = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  // record every model request body (what the model was HANDED) and its raw reply, without altering either
  const calls = [];
  page.on("request", (r) => { if (/\/v1\/chat\/completions/.test(r.url())) { try { calls.push({ body: JSON.parse(r.postData() || "{}") }); } catch { calls.push({ body: null }); } } });
  if (pivot) await page.addInitScript((v) => { try { localStorage.setItem("fold-chat:pivot", v); } catch {} }, pivot);
  await page.addInitScript(() => { window.__raw = []; const f = window.fetch; window.fetch = async function (...a) { const r = await f.apply(this, a); try { const u = String(a[0]?.url || a[0]); if (/\/v1\/chat\/completions/.test(u)) { const c = r.clone(); c.text().then((t) => { let s = ""; let fin = null; for (const line of t.split("\n")) { if (!line.startsWith("data:") || line.includes("[DONE]")) continue; try { const j = JSON.parse(line.slice(5)); s += j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? ""; fin = j.choices?.[0]?.finish_reason ?? fin; } catch {} } window.__raw.push({ text: s, finish: fin }); }).catch(() => {}); } } catch {} return r; }; });
  // OPTIONAL: give the model a SMALL token budget on every fresh ask (never on a reprompt), so its real reply is cut off for real and the
  // continuation has to fire. The model, its words and the web are all real; only the budget is lowered.
  if (clampFirst) await page.route("**/v1/chat/completions", async (route) => {
    let body; try { body = JSON.parse(route.request().postData() || "{}"); } catch { return route.continue(); }
    const last = (body.messages || [])[(body.messages || []).length - 1];
    if (!/^Continue exactly where you stopped/.test(String(last?.content || ""))) body.max_tokens = clampFirst;
    return route.continue({ postData: JSON.stringify(body) });
  });
  await page.goto(URL_, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
  // choose the model: write it onto the stored session(s), then reload so the page picks it up
  await page.evaluate((model) => { const S = JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}"); for (const s of Object.values(S)) s.model = model; localStorage.setItem("fold-chat:sessions", JSON.stringify(S)); }, model);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled; }, undefined, { timeout: 90000 });
  return { ctx, page, calls };
}

export async function say(page, text, timeout = 240000) {
  const before = await page.evaluate(() => (window.__raw || []).length);
  await page.fill("#input", text); await page.click("#send");
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => { const i = document.getElementById("input"); return i && !i.disabled && !i.readOnly && i.getAttribute("aria-busy") !== "true" && !/stop/i.test(document.getElementById("send")?.getAttribute("aria-label") || ""); }, undefined, { timeout }).catch(() => {});
  await page.waitForTimeout(800);
  return page.evaluate((before) => {
    const s = Object.values(JSON.parse(localStorage.getItem("fold-chat:sessions") || "{}")).sort((a, b) => new Date(b.updated) - new Date(a.updated))[0] || {};
    const ms = s.messages || []; const m = [...ms].reverse().find((x) => x.role === "assistant");
    const shown = (() => { const el = [...document.querySelectorAll(".msg.assistant")].slice(-1)[0]; return el ? (el.querySelector(".body")?.innerText || "").trim() : null; })();
    return { spoken: m?.content ?? null, shown, pivot: m?.pivot ?? null, notices: (m?.notices || []).map((n) => ({ kind: n.kind, text: String(n.text || "").slice(0, 220) })), reads: (m?.grounding?.web || []).filter((w) => w.read).map((w) => String(w.read).replace(/^https?:\/\/(www\.)?/, "").slice(0, 70)), read: (m?.grounding?.web || []).filter((w) => w.read).length, kind: m?.grounding?.kind ?? null, raws: (window.__raw || []).slice(before), nMessages: ms.length, authored: m?.authored ?? null };
  }, before);
}

export function show(i, ask, r) {
  console.log(`\n${"─".repeat(96)}\nTURN ${i}  YOU: ${ask}`);
  const raw = r.raws.map((x) => x.text).join("\n⟨next call⟩\n");
  console.log(`  model calls this turn: ${r.raws.length}${r.raws.length ? "  finish: " + r.raws.map((x) => x.finish).join(",") : ""}${r.pivot?.continued ? "  CONTINUED x" + r.pivot.continued : ""}   sources read: ${r.read}${r.reads?.length ? "  [" + r.reads.join(", ") + "]" : ""}`);
  if (raw) console.log("  ── MODEL WROTE ──\n" + raw.split("\n").map((l) => "  │ " + l).join("\n"));
  console.log("  ── SPOKEN ──\n" + String(r.spoken ?? "(nothing)").split("\n").map((l) => "  ▸ " + l).join("\n"));
  if (r.pivot) console.log(`  ── PIVOT ── ${r.pivot.skipped ? "skipped " + r.pivot.skipped : `${r.pivot.stats.kept}/${r.pivot.stats.in} spoken; withheld: ${r.pivot.dropped.map((d) => d.why).join(", ") || "none"}`}${r.pivot.gap ? "  GAP " + r.pivot.gap.kind : ""}`);
  if (r.notices.length) console.log("  ── NOTICES ── " + r.notices.map((n) => `[${n.kind}] ${n.text}`).join(" | "));
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const which = process.argv[2] || "basic";
  const CLAMP = { continue: 40 };
  const SCEN = { basic: ["How tall is the Eiffel Tower?", "Who was Marie Curie?", "What is photosynthesis?", "When was the Great Wall of China built?"],
    thread: ["Who was Marie Curie?", "What did she discover?", "Tell me more about her husband.", "go on"],
    continue: ["What is photosynthesis?", "Tell me about the Great Wall of China.", "keep going"] };
  const browser = await chromium.launch();
  const { ctx, page, calls } = await openChat(browser, { clampFirst: CLAMP[which] || null });
  const out = [];
  let i = 0;
  for (const ask of SCEN[which] || []) { i++; const r = await say(page, ask); show(i, ask, r); out.push({ ask, ...r }); }
  fs.writeFileSync(path.join(HERE, `chat-live-${which}.json`), JSON.stringify({ model: MODEL, at: new Date().toISOString(), turns: out }, null, 1));
  await ctx.close(); await browser.close();
}
