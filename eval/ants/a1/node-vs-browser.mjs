// A1: APPLES TO APPLES. The exact passages (texts) the browser handed originatePassages in browser3-run.json, run through the same function in NODE with real fetches (direct, no CORS).
// Compare claim by claim with the status the browser got.
import fs from "node:fs"; import { createHash } from "node:crypto";
import * as web from "../../../fold-chat-web.js";
import { originatePassages } from "../../../fold-chat-originwire.js";
const CACHE = new URL("./cache/", import.meta.url); fs.mkdirSync(CACHE, { recursive: true });
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => { const s = String(u); if (!/wikipedia\.org\/w\/api\.php/.test(s)) return realFetch(u, o); const f = new URL(createHash("sha1").update(s).digest("hex") + ".json", CACHE); if (fs.existsSync(f)) return new Response(fs.readFileSync(f, "utf8"), { status: 200 });
  for (let i = 0; i < 6; i++) { const r = await realFetch(u, o); if (r.status !== 429) { const b = await r.text(); if (r.ok) fs.writeFileSync(f, b); return new Response(b, { status: r.status }); } await new Promise((z) => setTimeout(z, (Number(r.headers.get("retry-after")) || 10) * 1000 + 500)); } return realFetch(u, o); };
const R = JSON.parse(fs.readFileSync(new URL("./browser3-run.json", import.meta.url)));
const rows = [];
for (const r of R) {
  const c = r.a1.calls[0];
  const passages = c.passages.map((p) => ({ ref: p.ref, title: p.title, url: p.url, source: p.url, text: p.text }));
  const t0 = Date.now(); const { trails } = await originatePassages(passages, c.question, { fetchImpl: fetch, memo: web.makeMemo() });
  const key = (t) => t.claim.slice(0, 70);
  for (const t of trails) { const b = c.trails.find((x) => key(x) === key(t)); rows.push({ ask: r.ask, claim: key(t), browser: b ? b.trail.status : "?", node: t.trail.status, nodeTried: (t.trail.tried || []).map((x) => (x.url || "-").replace(/^https?:\/\/(www\.)?/, "").split("/")[0] + ":" + (x.read === false ? "UNREAD" : x.verdict || "?")).join(";"), browserTried: b ? (b.trail.tried || []).map((x) => (x.url || "-").replace(/^https?:\/\/(www\.)?/, "").split("/")[0] + ":" + (x.read === false ? "UNREAD" : x.verdict || "?")).join(";") : "" }); }
  console.log(r.ask, "node ms", Date.now() - t0, "browser ms", c.ms, "origins appended (node):", passages.filter((p) => p.origin).length);
}
const same = rows.filter((x) => x.browser === x.node).length;
console.log("claims", rows.length, "same status", same, "diff", rows.length - same);
for (const x of rows.filter((x) => x.browser !== x.node)) console.log("  DIFF", x.ask, "|", x.claim, "| browser", x.browser, "(", x.browserTried, ") node", x.node, "(", x.nodeTried, ")");
fs.writeFileSync(new URL("./node-vs-browser.json", import.meta.url), JSON.stringify(rows, null, 1));
