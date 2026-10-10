// serve.mjs — the browser surface: feed it something to think about, watch it
// mull the concept universe over into one passage.
//
//   node experiments/mind-wandering/serve.mjs --open        # http://127.0.0.1:8871
//
// The material is the whole universe of concept priors (Concepticon: 4,165
// concept sets with glosses, definitions and semantic fields; 854 typed
// relations). khora walks concepts; Janus keeps the topic continuous (a concept
// is admitted only if a real relation or a shared field ties it to the present
// one); Penelope routes an archon and lays its verified sentences as refrains.
// The page shows the ONE passage as it is written. No model.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { makeConceptMuller, loadConceptUniverse } from "./concepts.mjs";

const arg = (name, d = null) => { const i = process.argv.indexOf("--" + name); return i >= 0 ? (process.argv[i + 1] ?? true) : d; };
const PORT = Number(arg("port", 8871));
const OPEN = process.argv.includes("--open");

console.error("[mind-wandering] loading the concept universe (Concepticon)…");
const t0 = Date.now();
const U = loadConceptUniverse();
if (!U.ok) { console.error(`[mind-wandering] ${U.reason}`); process.exit(1); }
console.error(`[mind-wandering] universe ready: ${U.stats.concepts.toLocaleString()} concepts, ${U.stats.relations} relations, ${U.stats.fields} fields in ${Date.now() - t0}ms`);

const SUGGEST = [...U.byGloss.keys()].filter((g) => g.length > 3).sort().filter((_, i) => i % 37 === 0).slice(0, 60);
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  if (path === "/health") return json(res, 200, { ok: true, schema: "EOMindWanderConcepts@1", ...U.stats });
  if (path === "/suggest") return json(res, 200, { words: SUGGEST });

  if (path === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(readFileSync(new URL("./page.html", import.meta.url), "utf8"));
  }

  if (path === "/stream") {
    const think = (url.searchParams.get("think") ?? "homecoming and the guest at the door").trim();
    const steps = Math.max(1, Math.min(500, Number(url.searchParams.get("steps") ?? 60)));
    const register = url.searchParams.get("register") ?? "attentive";
    const seed = Number(url.searchParams.get("seed") ?? 1);

    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    let closed = false;
    req.on("close", () => { closed = true; });

    const m = await makeConceptMuller({ think, register, seed, universe: U });
    if (!m.ok) { send("error", { reason: m.reason }); return res.end(); }
    const started = Date.now();
    send("hello", { think, steps, register, seeds: m.record().seeds, archon: m.record().archon, universe: U.stats });

    const out = [];
    for (let i = 0; i < steps; i += 1) {
      if (closed) break;
      const rec = m.step();
      if (rec.sentence) out.push(rec.sentence);
      if (rec.refrain) out.push(`“${rec.refrain}”`);
      rec.out = out.join(" ");
      send("step", rec);
      if (i % 5 === 4) await new Promise((r) => setTimeout(r, 90));
    }
    if (!closed) send("pathos", { ...m.record(), passage: out.join(" ") });
    send("done", { steps: out.length, ms: Date.now() - started });
    return res.end();
  }

  return json(res, 404, { error: "no such route" });
});

server.listen(PORT, "127.0.0.1", () => {
  const u = `http://127.0.0.1:${PORT}/`;
  console.error(`[mind-wandering] serving ${u}`);
  if (OPEN) spawn("open", [u], { stdio: "ignore", detached: true }).unref();
});
