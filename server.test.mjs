// server.test.mjs — the Fold's own server (server.mjs). Port 0, a temp root, a heimdall double; plus one REAL smoke against the sibling
// heimdall (skipped when that import fails). Would be wrong if: a traversal / dotfile / node_modules path answers 200, a non-/heimdall path
// reaches the mount, a throwing mount takes the server down, or the Fold's own origin is missing from the allowed origins.

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFoldServer, resolveSegments, underPrefix, heimdallEmbedPath, loadMountHeimdall, hostAllowed } from "./server.mjs";

/** A raw request: node's http client sends the path exactly as given (fetch would normalise ../). */
function raw(port, p, { method = "GET", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port, path: p, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    r.on("error", reject);
    r.end();
  });
}

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fold-server-"));
  const w = (rel, body) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
  w("index.html", "<!doctype html><title>app</title>");
  w("app.js", "export const x = 1;");
  w("m.mjs", "export {};");
  w("style.css", "a{}");
  w("data.json", "{}");
  w("i.svg", "<svg/>");
  w("p.png", "png");
  w("favicon.ico", "ico");
  w("site.webmanifest", "{}");
  w("core.wasm", "wasm");
  w("notes.txt", "t");
  w("README.md", "# r");
  w("docs/index.html", "docs-index");
  w("docs/a.txt", "a");
  w(".env", "SECRET=1");
  w(".git/config", "[core]");
  w(".claude/launch.json", "{}");
  w("node_modules/x/index.js", "nm");
  w("eval/.app/index.html", "snapshot");
  w("eval/.app-cur/index.html", "snapshot");
  w("eval/run.mjs", "ok");
  return root;
}

/** A heimdall double: records what it was mounted with and what it was handed; answers /heimdall/* itself. */
function double({ throws = false, handled = true } = {}) {
  const d = { opts: null, seen: [], closed: 0 };
  d.mount = (opts) => {
    d.opts = opts;
    return {
      async handle(req, res) {
        d.seen.push(req.url);
        if (throws) throw new Error("boom");
        if (!handled) return false;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ via: "double" }));
        return true;
      },
      async close() { d.closed++; },
    };
  };
  return d;
}

async function withServer(opts, fn) {
  const root = makeRoot();
  const s = await createFoldServer({ port: 0, root, ...opts });
  try { await fn(s, root); } finally { await s.close(); fs.rmSync(root, { recursive: true, force: true }); }
}

test("static: MIME types, index for /, HEAD, no-store", async () => {
  await withServer({ heimdall: false }, async (s) => {
    const want = {
      "/": "text/html", "/index.html": "text/html", "/app.js": "text/javascript", "/m.mjs": "text/javascript", "/style.css": "text/css",
      "/data.json": "application/json", "/i.svg": "image/svg+xml", "/p.png": "image/png", "/favicon.ico": "image/x-icon",
      "/site.webmanifest": "application/manifest+json", "/core.wasm": "application/wasm", "/notes.txt": "text/plain", "/README.md": "text/markdown",
    };
    for (const [p, type] of Object.entries(want)) {
      const r = await raw(s.port, p);
      assert.equal(r.status, 200, p);
      assert.ok(r.headers["content-type"].startsWith(type), `${p}: ${r.headers["content-type"]}`);
      assert.equal(r.headers["cache-control"], "no-store", p);
    }
    assert.equal((await raw(s.port, "/")).body, "<!doctype html><title>app</title>");
    assert.equal((await raw(s.port, "/app.js?v=3")).status, 200); // query ignored
    const head = await raw(s.port, "/app.js", { method: "HEAD" });
    assert.equal(head.status, 200); assert.equal(head.body, ""); assert.equal(head.headers["content-length"], "19");
    assert.equal((await raw(s.port, "/docs/")).body, "docs-index");
    const redir = await raw(s.port, "/docs");
    assert.equal(redir.status, 301); assert.equal(redir.headers.location, "/docs/");
    assert.equal((await raw(s.port, "/missing.js")).status, 404);
    assert.equal((await raw(s.port, "/app.js", { method: "POST" })).status, 405);
  });
});

test("traversal is refused: ../, %2e%2e, encoded slashes, backslashes, NUL", async () => {
  await withServer({ heimdall: false }, async (s, root) => {
    const secret = path.join(path.dirname(root), "fold-secret.txt");
    fs.writeFileSync(secret, "outside");
    try {
      for (const p of ["/../fold-secret.txt", "/%2e%2e/fold-secret.txt", "/%2E%2E/fold-secret.txt", "/docs/../../fold-secret.txt",
        "/..%2ffold-secret.txt", "/%2e%2e%2ffold-secret.txt", "/docs/..%2F..%2Ffold-secret.txt", "/docs%2f..%2f..%2ffold-secret.txt",
        "/..%5cfold-secret.txt", "/app.js%00.png", "/%2e%2e", "/docs/%2e%2e/"]) {
        const r = await raw(s.port, p);
        assert.ok([400, 403, 404].includes(r.status), `${p} -> ${r.status}`);
        assert.ok(!r.body.includes("outside"), `${p} leaked`);
      }
      assert.equal((await raw(s.port, "/%2e%2e/fold-secret.txt")).status, 403);
      assert.equal((await raw(s.port, "/%zz")).status, 400);
    } finally { fs.rmSync(secret, { force: true }); }
  });
});

test("dotfiles, dot-directories, node_modules and eval/.app* snapshots are refused", async () => {
  await withServer({ heimdall: false }, async (s) => {
    for (const p of ["/.env", "/.git/config", "/.git/", "/.claude/launch.json", "/node_modules/x/index.js", "/node_modules/",
      "/eval/.app/index.html", "/eval/.app-cur/index.html", "/eval/.app/", "/%2egit/config", "/.env?x=1", "/docs/./a.txt"]) {
      const r = await raw(s.port, p);
      assert.equal(r.status, 403, p);
      assert.ok(!/SECRET|\[core\]|snapshot|nm/.test(r.body), p);
    }
    assert.equal((await raw(s.port, "/eval/run.mjs")).status, 200); // its sibling dir is fine
  });
});

test("a symlink that leads out of the root is refused", async () => {
  await withServer({ heimdall: false }, async (s, root) => {
    const out = path.join(path.dirname(root), "fold-out.txt");
    fs.writeFileSync(out, "outside");
    try {
      fs.symlinkSync(out, path.join(root, "link.txt"));
      const r = await raw(s.port, "/link.txt");
      assert.equal(r.status, 403); assert.ok(!r.body.includes("outside"));
    } finally { fs.rmSync(out, { force: true }); }
  });
});

test("pure helpers: resolveSegments and underPrefix", () => {
  assert.deepEqual(resolveSegments("/a/b.js?x=1").segs, ["a", "b.js"]);
  assert.equal(resolveSegments("/").segs.length, 0);
  assert.equal(resolveSegments("/a/%2e%2e/b").status, 403);
  assert.equal(resolveSegments("/a%2fb").status, 403);
  assert.equal(resolveSegments("relative").status, 400);
  assert.ok(underPrefix("/heimdall")); assert.ok(underPrefix("/heimdall/status?x")); assert.ok(underPrefix("/heimdall/../x"));
  assert.ok(!underPrefix("/heimdallx")); assert.ok(!underPrefix("/x/heimdall/")); assert.ok(!underPrefix("/")); assert.ok(!underPrefix(undefined));
});

test("/heimdall/* goes to the mount first; a non-/heimdall path never reaches it", async () => {
  const d = double();
  await withServer({ heimdall: d.mount }, async (s) => {
    const a = await raw(s.port, "/heimdall/status");
    assert.equal(a.status, 200); assert.equal(JSON.parse(a.body).via, "double");
    assert.equal((await raw(s.port, "/heimdall")).status, 200);
    assert.equal((await raw(s.port, "/heimdall/api/chat?x=1", { method: "POST" })).status, 200);
    const before = d.seen.length;
    for (const p of ["/", "/index.html", "/app.js", "/heimdallx", "/x/heimdall/status", "/.git/config", "/missing"]) await raw(s.port, p);
    assert.equal(d.seen.length, before, "no non-/heimdall path may reach the mount");
    assert.deepEqual(d.seen, ["/heimdall/status", "/heimdall", "/heimdall/api/chat?x=1"]);
    assert.equal(d.opts.name, "the-fold", "no per-port suffix: a port-suffixed name litters ~/.heimdall and splits provider keys");
    assert.equal(d.opts.prefix, "/heimdall");
    assert.equal(d.opts.selfUrl, `http://127.0.0.1:${s.port}/heimdall/peers`);
  });
});

test("a mount that returns false for a /heimdall path falls through to static (404 here), without throwing", async () => {
  const d = double({ handled: false });
  await withServer({ heimdall: d.mount }, async (s) => {
    assert.equal((await raw(s.port, "/heimdall/nothing")).status, 404);
  });
});

test("the handler never throws on a mount that throws; the server keeps serving", async () => {
  const d = double({ throws: true });
  await withServer({ heimdall: d.mount }, async (s) => {
    const r = await raw(s.port, "/heimdall/status");
    assert.equal(r.status, 500); assert.equal(JSON.parse(r.body).error, "heimdall-internal");
    assert.ok(!r.body.includes("boom"));
    assert.equal((await raw(s.port, "/index.html")).status, 200);
  });
});

test("a mount that fails to construct leaves the app up and /heimdall at 503", async () => {
  const logs = [];
  await withServer({ heimdall: () => { throw new Error("no embed"); }, log: (m) => logs.push(m) }, async (s) => {
    assert.ok(s.mountError); assert.equal(s.heimdall, null);
    const r = await raw(s.port, "/heimdall/status");
    assert.equal(r.status, 503); assert.equal(JSON.parse(r.body).error, "heimdall-unavailable");
    assert.equal((await raw(s.port, "/")).status, 200);
  });
  assert.ok(logs.some((l) => /mount failed/.test(l)));
});

test("FOLD_NAME names the mount", async () => {
  const d = double();
  await withServer({ heimdall: d.mount, env: { FOLD_NAME: "the-fold-lab" } }, async () => { assert.equal(d.opts.name, "the-fold-lab"); });
});

test("allowed origins include the Fold's own origin, both spellings, merged with any given", async () => {
  const d = double();
  await withServer({ heimdall: d.mount, heimdallOptions: { bridgeOptions: { allowedOrigins: ["https://example.test"], upstreamFirstByteMs: 5 } } }, async (s) => {
    const o = d.opts.bridgeOptions.allowedOrigins;
    assert.ok(o.includes(`http://127.0.0.1:${s.port}`)); assert.ok(o.includes(`http://localhost:${s.port}`));
    assert.ok(o.includes("https://example.test"));
    assert.equal(d.opts.bridgeOptions.upstreamFirstByteMs, 5);
    assert.equal(d.opts.stateDir, undefined, "stateDir defaults inside heimdall (~/.heimdall/the-fold)");
    assert.equal(d.opts.token, undefined); assert.ok(!JSON.stringify(d.opts).toLowerCase().includes("token"));
  });
});

test("a floor that is the Fold's own port is dropped from env; others are kept", async () => {
  const d = double();
  const probe = await createFoldServer({ port: 0, root: makeRoot(), heimdall: false });
  const own = probe.port; await probe.close();
  // the guard is applied against the REAL listening port, so exercise it by starting on a known free port
  const s = await createFoldServer({ port: own, root: makeRoot(), heimdall: d.mount, env: { OLLAMA_HOST: `127.0.0.1:${own}`, X: "1" } });
  try { assert.equal(d.opts.env.OLLAMA_HOST, undefined); assert.equal(d.opts.env.X, "1"); } finally { await s.close(); }
  const d2 = double();
  const s2 = await createFoldServer({ port: 0, root: makeRoot(), heimdall: d2.mount, env: { OLLAMA_HOST: "127.0.0.1:11434" } });
  try { assert.equal(d2.opts.env, undefined, "no env passed: heimdall reads OLLAMA_HOST itself"); } finally { await s2.close(); }
});

test("heimdallOptions.floors: a floor that is this server's own port is dropped (any loopback spelling); the others are kept", async () => {
  const probe = await createFoldServer({ port: 0, root: makeRoot(), heimdall: false });
  const own = probe.port; await probe.close();
  const d = double();
  const s = await createFoldServer({ port: own, root: makeRoot(), heimdall: d.mount,
    heimdallOptions: { floors: [`http://127.0.0.1:${own}`, "http://127.0.0.1:11999", `http://localhost:${own}/`] } });
  try { assert.deepEqual(d.opts.floors, ["http://127.0.0.1:11999"]); } finally { await s.close(); }
  const d2 = double();
  const s2 = await createFoldServer({ port: own, root: makeRoot(), heimdall: d2.mount, heimdallOptions: { floors: [`http://127.0.0.1:${own}`] } });
  try { assert.deepEqual(d2.opts.floors, [], "only floor was this server: empty, so heimdall falls back to its own default"); } finally { await s2.close(); }
  const d3 = double();
  const s3 = await createFoldServer({ port: 0, root: makeRoot(), heimdall: d3.mount });
  try { assert.equal(d3.opts.floors, undefined, "no floors given: nothing passed"); } finally { await s3.close(); }
});

test("FOLD_ALLOW_HOSTS opens heimdall's own host walls: embed allowHosts (host[:port]) and bridgeOptions.allowedHosts (bare names)", async () => {
  const d = double();
  await withServer({ heimdall: d.mount, env: { FOLD_ALLOW_HOSTS: "my-lan.box:8814, Other.test ,[::1]:9" },
    heimdallOptions: { allowHosts: ["pre.test:1"], bridgeOptions: { allowedHosts: ["pre.test"] } } }, async () => {
    assert.deepEqual(d.opts.allowHosts, ["pre.test:1", "my-lan.box:8814", "other.test", "[::1]:9"]);
    assert.deepEqual(d.opts.bridgeOptions.allowedHosts, ["pre.test", "my-lan.box", "other.test", "[::1]"]);
  });
  const d2 = double();
  await withServer({ heimdall: d2.mount, env: {} }, async () => {
    assert.equal(d2.opts.allowHosts, undefined); assert.equal(d2.opts.bridgeOptions.allowedHosts, undefined);
  });
});

test("createFoldServer hands importers { handle, status, close }, never the raw mount (it carries bridge.token)", async () => {
  const secret = "TOKEN-DO-NOT-LEAK";
  const raw = { handle: async () => false, status: () => ({ ok: 1 }), close() {}, bridge: { token: secret }, stateDir: "/x" };
  await withServer({ heimdall: () => raw }, async (s) => {
    assert.deepEqual(Object.keys(s.heimdall).sort(), ["close", "handle", "status"]);
    assert.notEqual(s.heimdall, raw); assert.equal(s.heimdall.bridge, undefined);
    assert.deepEqual(s.heimdall.status(), { ok: 1 });
    assert.ok(!Object.values(s).some((v) => v === raw));
  });
  await withServer({ heimdall: false }, async (s) => { assert.equal(s.heimdall, null); });
});

test("closing the server closes the mount", async () => {
  const d = double();
  const s = await createFoldServer({ port: 0, root: makeRoot(), heimdall: d.mount });
  await s.close();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(d.closed, 1);
});

test("EADDRINUSE rejects with the code (the function never exits the process)", async () => {
  const blocker = net.createServer();
  await new Promise((r) => blocker.listen(0, "127.0.0.1", r));
  const port = blocker.address().port;
  const d = double();
  try {
    await assert.rejects(createFoldServer({ port, root: makeRoot(), heimdall: d.mount }), (e) => e.code === "EADDRINUSE");
    assert.equal(d.opts, null, "heimdall is not mounted when the port is taken");
  } finally { await new Promise((r) => blocker.close(r)); }
});

test("the CLI: EADDRINUSE prints one line naming the port and exits non-zero", async () => {
  const { spawnSync } = await import("node:child_process");
  const blocker = net.createServer();
  await new Promise((r) => blocker.listen(0, "127.0.0.1", r));
  const port = blocker.address().port;
  try {
    const r = await new Promise((resolve) => {
      import("node:child_process").then(({ spawn }) => {
        const c = spawn(process.execPath, [new URL("./server.mjs", import.meta.url).pathname], { env: { ...process.env, FOLD_PORT: String(port), FOLD_HEIMDALL_SRC: "/nonexistent" } });
        let err = ""; c.stderr.on("data", (x) => { err += x; });
        c.on("close", (code) => resolve({ code, err }));
      });
    });
    assert.notEqual(r.code, 0);
    assert.match(r.err, new RegExp(`port ${port} is already in use`));
    assert.equal(r.err.trim().split("\n").length, 1);
    void spawnSync;
  } finally { await new Promise((r) => blocker.close(r)); }
});

test("FOLD_HEIMDALL_SRC overrides the import path (dir or file)", () => {
  assert.ok(heimdallEmbedPath({}).endsWith(path.join("heimdall", "src", "embed.js")));
  assert.equal(heimdallEmbedPath({ FOLD_HEIMDALL_SRC: "/x/src" }), "/x/src/embed.js");
  assert.equal(heimdallEmbedPath({ FOLD_HEIMDALL_SRC: "/x/y/embed.mjs" }), "/x/y/embed.mjs");
});

// REAL smoke: the sibling heimdall, in-process. Skipped when that checkout is not importable. Always a temp stateDir and floors: [] (plus a
// throwing fetch), so nothing is probed and nothing is written under the home directory.
let realMount = null;
try { realMount = await loadMountHeimdall(); } catch { /* skipped below */ }
const realOpts = (state) => ({ stateDir: state, floors: [], autoTick: false, fetch: async () => { throw new Error("no probing in tests"); } });
const getJson = async (url, headers = {}) => { const r = await fetch(url, { headers }); return { r, text: await r.text() }; };

test("REAL heimdall: /heimdall/status is HeimdallEmbed@1 with token:false, and /index.html is the app", { skip: realMount ? false : "sibling heimdall not importable" }, async () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "fold-hm-"));
  const appRoot = path.dirname(new URL(import.meta.url).pathname);
  const s = await createFoldServer({ port: 0, root: appRoot, heimdallOptions: realOpts(state) });
  try {
    assert.ok(s.heimdall, `mount failed: ${s.mountError?.message}`);
    const st = await fetch(`${s.url}/heimdall/status`);
    assert.equal(st.status, 200);
    const j = await st.json();
    assert.equal(j.schema, "HeimdallEmbed@1"); assert.equal(j.token, false); assert.equal(j.name, "the-fold");
    assert.ok(!JSON.stringify(j).includes(fs.readFileSync(path.join(state, "bridge.token"), "utf8").trim()), "the bridge token is never served");
    const idx = await fetch(`${s.url}/index.html`);
    assert.equal(idx.status, 200); assert.match(idx.headers.get("content-type"), /text\/html/);
    assert.equal(await idx.text(), fs.readFileSync(path.join(appRoot, "index.html"), "utf8"));
    assert.equal((await fetch(`${s.url}/.git/config`)).status, 403);
  } finally { await s.close(); fs.rmSync(state, { recursive: true, force: true }); }
});

test("REAL heimdall: a token route 401s without the token and passes with x-heimdall-token; the token is never in /status, and importers do not get it", { skip: realMount ? false : "sibling heimdall not importable" }, async () => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "fold-hm-"));
  const s = await createFoldServer({ port: 0, root: makeRoot(), heimdallOptions: realOpts(state) });
  try {
    assert.ok(s.heimdall, `mount failed: ${s.mountError?.message}`);
    const token = fs.readFileSync(path.join(state, "bridge.token"), "utf8").trim();   // a local-tool path: 0600 file, never printed
    assert.ok(token.length >= 16);
    const keys = `${s.url}/heimdall/api/providers/keys`;
    assert.equal((await getJson(keys)).r.status, 401, "no token: refused");
    const withTok = await getJson(keys, { "x-heimdall-token": token });
    assert.ok(withTok.r.status >= 200 && withTok.r.status < 300, `with the token header the route is reachable (2xx), not just "not 401": got ${withTok.r.status}`);
    for (const p of ["/heimdall/status", "/heimdall/bridge-status"]) {
      const { r, text } = await getJson(`${s.url}${p}`);
      assert.ok(!text.includes(token), `${p} body`);
      assert.ok(![...r.headers.entries()].some(([k, v]) => `${k}${v}`.includes(token)), `${p} headers`);
    }
    assert.ok(!JSON.stringify(s.heimdall).includes(token) && s.heimdall.bridge === undefined);
    // Origin handling is the bridge's own wall: the other loopback spelling passes, a foreign page does not
    const other = `http://localhost:${s.port}`;
    assert.equal((await getJson(`${s.url}/heimdall/status`, { origin: other, "sec-fetch-site": "same-site" })).r.status, 200);
    assert.notEqual((await getJson(`${s.url}/heimdall/status`, { origin: "http://evil.test", "sec-fetch-site": "cross-site" })).r.status, 200);
  } finally { await s.close(); fs.rmSync(state, { recursive: true, force: true }); }
});


// ── the review's findings (2026-10-05): same-origin embedding, rebinding, case, redirect, startup window ─────────────────────
const spy = () => { const seen = []; return { seen, mount: () => ({ handle: async (req, res) => { seen.push({ url: req.url, cookie: req.headers.cookie, token: req.headers["x-heimdall-token"] }); res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return true; }, close() {} }) }; };

test("FALSIFIER: same-origin is the trust boundary — cookie and x-heimdall-token reach heimdall untouched (a strip would 401 every token route)", async () => {
  const d = spy();
  await withServer({ heimdall: d.mount }, async (s) => {
    await raw(s.port, "/heimdall/link/", { headers: { cookie: "heimdall_token=SECRET; other=1", "x-heimdall-token": "SECRET" } });
    assert.equal(d.seen.length, 1);
    assert.equal(d.seen[0].cookie, "heimdall_token=SECRET; other=1"); assert.equal(d.seen[0].token, "SECRET");
  });
});

test("FALSIFIER: sec-fetch-site judges ONLY requests with no Origin; an Origin is left to the bridge's own wall; header-less clients pass", async () => {
  const d = spy();
  await withServer({ heimdall: d.mount }, async (s) => {
    const h = (o) => ({ headers: o });
    assert.equal((await raw(s.port, "/heimdall/api/search?q=x", h({ "sec-fetch-site": "cross-site" }))).status, 403, "no Origin + cross-site (<img> on a hostile page)");
    assert.equal((await raw(s.port, "/heimdall/api/search?q=x", h({ "sec-fetch-site": "same-site" }))).status, 403, "no Origin + same-site");
    assert.equal(JSON.parse((await raw(s.port, "/heimdall/api/x", h({ "sec-fetch-site": "cross-site" }))).body).error, "cross-site");
    assert.equal(d.seen.length, 0, "none of those reached the mount");
    assert.equal((await raw(s.port, "/heimdall/api/tags", h({ "sec-fetch-site": "same-origin" }))).status, 200);
    assert.equal((await raw(s.port, "/heimdall/api/tags", h({ "sec-fetch-site": "none" }))).status, 200, "typed into the address bar");
    assert.equal((await raw(s.port, "/heimdall/api/tags")).status, 200, "curl and node clients send no fetch-metadata");
    // an allowlisted origin (the other loopback spelling) is NOT refused here, even when the browser says cross-site/same-site
    assert.equal((await raw(s.port, "/heimdall/api/tags", h({ origin: `http://localhost:${s.port}`, "sec-fetch-site": "cross-site" }))).status, 200);
    assert.equal((await raw(s.port, "/heimdall/api/tags", h({ origin: "https://example.test", "sec-fetch-site": "same-site" }))).status, 200, "left to the bridge's origin wall");
    assert.equal(d.seen.length, 5);
  });
});

test("FALSIFIER: static responses may be framed only by this origin; /heimdall responses are not touched", async () => {
  const d = spy();
  await withServer({ heimdall: d.mount }, async (s) => {
    for (const p of ["/index.html", "/", "/missing.js", "/.env"]) {
      const r = await raw(s.port, p);
      assert.equal(r.headers["content-security-policy"], "frame-ancestors 'self'", p);
      assert.equal(r.headers["x-frame-options"], "SAMEORIGIN", p);
      assert.ok(!/script-src/.test(r.headers["content-security-policy"]), "no script-src: the CDN import must keep working");
    }
    assert.equal((await raw(s.port, "/index.html", { headers: { host: "attacker.test" } })).headers["x-frame-options"], "SAMEORIGIN");
    const h = await raw(s.port, "/heimdall/status");
    assert.equal(h.headers["content-security-policy"], undefined); assert.equal(h.headers["x-frame-options"], undefined);
  });
});

test("FALSIFIER: DNS rebinding — static files are refused for a non-loopback Host or the wrong port; the app's own Host passes", async () => {
  await withServer({ heimdall: false }, async (s) => {
    assert.equal((await raw(s.port, "/index.html", { headers: { host: `attacker.test:${s.port}` } })).status, 421);
    assert.equal((await raw(s.port, "/index.html", { headers: { host: "127.0.0.1:1" } })).status, 421);
    assert.equal((await raw(s.port, "/index.html", { headers: { host: `localhost:${s.port}` } })).status, 200);
    assert.equal((await raw(s.port, "/index.html", { headers: { host: `127.0.0.1:${s.port}` } })).status, 200);
  });
  assert.equal(hostAllowed("my-lan.box:8814", 8814, { FOLD_ALLOW_HOSTS: "my-lan.box:8814" }), true, "an explicit allowlist opens a deliberate LAN run");
  assert.equal(hostAllowed("my-lan.box:8814", 8814, {}), false);
  assert.equal(hostAllowed("", 8814, {}), false);
});

test("FALSIFIER: node_modules is refused in any letter case (the default macOS filesystem ignores case)", async () => {
  await withServer({ heimdall: false }, async (s, root) => {
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true }); fs.writeFileSync(path.join(root, "node_modules", "x.js"), "x");
    for (const p of ["/node_modules/x.js", "/Node_Modules/x.js", "/NODE_MODULES/x.js"]) assert.equal((await raw(s.port, p)).status, 403, p);
    assert.equal(resolveSegments("/Node_Modules/x.js").status, 403);
  });
});

test("FALSIFIER: the directory redirect never leaves this origin — '//docs' is a 301 to '/docs/', never a protocol-relative Location", async () => {
  await withServer({ heimdall: false }, async (s, root) => {
    fs.mkdirSync(path.join(root, "docs"), { recursive: true }); fs.writeFileSync(path.join(root, "docs", "index.html"), "d");
    const plain = await raw(s.port, "/docs");
    assert.equal(plain.status, 301); assert.equal(plain.headers.location, "/docs/");
    const a = await raw(s.port, "//docs");
    assert.equal(a.status, 301, "unconditional: the docs directory exists");
    assert.equal(a.headers.location, "/docs/"); assert.ok(!a.headers.location.startsWith("//"));
    const e = await raw(s.port, "//evil.test/docs");
    assert.ok(!(e.headers.location || "").startsWith("//"), String(e.headers.location));
    const b = await raw(s.port, "/docs?x=1");
    assert.equal(b.status, 301); assert.equal(b.headers.location, "/docs/?x=1");
  });
});

test("FALSIFIER: a /heimdall request that arrives BEFORE the mount settles waits for it and completes 200 (no immediate 503)", async () => {
  let release; const gate = new Promise((r) => { release = r; });
  let started; const mountStarted = new Promise((r) => { started = r; });
  let port; const listening = new Promise((r) => { port = r; });
  const root = makeRoot();
  const pending = createFoldServer({
    port: 0, root, onListening: (l) => port(l.port),
    heimdall: async () => { started(); await gate; return { handle: async (req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.end('{"via":"late"}'); return true; }, close() {} }; },
  });
  try {
    const p = await listening; await mountStarted;
    let done = false;
    const early = raw(p, "/heimdall/status").then((r) => { done = true; return r; });
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(done, false, "the request is held while the mount is settling, not answered 503");
    release();
    const r = await early;
    assert.equal(r.status, 200); assert.equal(JSON.parse(r.body).via, "late");
    const s = await pending;
    assert.equal((await raw(s.port, "/heimdall/status")).status, 200);
    await s.close();
  } finally { release(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("a mount that never settles: the held request is bounded (503 + retry-after), a mount that fails afterwards stays 503 'unavailable'", async () => {
  let release; const gate = new Promise((r) => { release = r; });
  let started; const mountStarted = new Promise((r) => { started = r; });
  let port; const listening = new Promise((r) => { port = r; });
  const root = makeRoot();
  const pending = createFoldServer({ port: 0, root, mountWaitMs: 60, onListening: (l) => port(l.port), heimdall: async () => { started(); await gate; throw new Error("late failure"); } });
  try {
    const p = await listening; await mountStarted;
    const r = await raw(p, "/heimdall/status");
    assert.equal(r.status, 503); assert.equal(r.headers["retry-after"], "1");
    release();
    const s = await pending;
    const after = await raw(s.port, "/heimdall/status");
    assert.equal(after.status, 503); assert.equal(JSON.parse(after.body).error, "heimdall-unavailable");
    assert.equal((await raw(s.port, "/index.html")).status, 200);
    await s.close();
  } finally { release(); fs.rmSync(root, { recursive: true, force: true }); }
});
