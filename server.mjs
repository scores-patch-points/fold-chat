// server.mjs — the Fold's OWN server (2026-10-05). It replaces `python3 -m http.server 8814`: it serves this checkout as static files
// AND mounts heimdall in-process under /heimdall (heimdall/docs/EMBED.md). There is no standalone bridge any more: models, web reads
// and the rest of the doors live in this same server, and the model itself runs in the page (WebLLM). No build step, no dependencies
// other than the sibling heimdall import.
//
//   node server.mjs                       -> http://127.0.0.1:8814/          (FOLD_PORT, FOLD_HOST override)
//   import { createFoldServer } from "./server.mjs"
//   const s = await createFoldServer({ port: 0, root, heimdall: (opts) => mount })   // tests: port 0, a temp root, a mount double
//
// Rules this file keeps:
//   - the heimdall hook runs FIRST, and only for /heimdall and /heimdall/* (a path outside it never reaches the mount);
//   - static serving refuses path traversal, dotfiles and dot-directories (.git .claude .env eval/.app*), node_modules;
//   - every response is `cache-control: no-store`, so the in-app browser always reloads an edited module;
//   - the heimdall floor default is the mount's own (OLLAMA_HOST, else 127.0.0.1:11435); a floor that is THIS server's own port is dropped;
//   - the access token is never read, logged or served here; heimdall's /status says token:false and that is all this file ever shows,
//     and createFoldServer returns a NARROWED { handle, status, close } for the mount, never the raw object (it carries bridge.token);
//   - TRUST BOUNDARY (EMBED.md): the page and the bridge share ONE origin, so same-origin is the boundary for the embedded bridge. Requests
//     reach heimdall with their cookie and x-heimdall-token headers INTACT (the Settings key panel, /link/* buttons and /bridge/* need the
//     cookie; local tools present the token from ~/.heimdall/<name>/bridge.token). HONEST CAVEAT: any script running in the Fold page can use
//     the heimdall_token cookie (HttpOnly hides it from reading, not from fetch)
//     once the user has opened /heimdall/link/ in that browser session. What costs nothing and is done here: every STATIC response carries `frame-ancestors 'self'` + X-Frame-Options SAMEORIGIN (the page frames its own
//     fold-sandbox.html, so 'self', not 'none'), so a hostile page cannot frame the app. No script-src: the page imports web-llm from a CDN;
//   - a request with NO Origin header is judged by sec-fetch-site (present and not same-origin/none -> 403 cross-site: an <img>/<script> on a
//     hostile page carries no Origin); a request WITH an Origin is left to the bridge's own origin wall (allowedOrigins, both loopback spellings);
//   - startup window: the server listens before the mount settles, so a /heimdall request in that window WAITS for the mount (bounded, ~15 s,
//     then 503 + retry-after) instead of answering 503 at once, because the page's bridge detection reads any non-ok as "no bridge";
//   - FOLD_NAME names the mount (default "the-fold", no port suffix: a per-port name would litter ~/.heimdall and split provider keys);
//     FOLD_ALLOW_HOSTS also opens heimdall's own host walls (embed allowHosts, bridgeOptions.allowedHosts).
// What would prove it wrong: a request for /.git/config, /%2e%2e/x, /node_modules/x or /eval/.app/x that is answered 200; a non-/heimdall
// path that reaches the mount; a thrown mount that crashes the process or leaves a response hanging; a token in any response or log line; a token route (/heimdall/api/providers/keys) that 401s WITH the token header; a request that
// arrives during startup and gets 503 although the mount then settles fine; a static response
// without the frame headers.

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_PORT = 8814;
export const DEFAULT_HOST = "127.0.0.1";
export const PREFIX = "/heimdall";
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const MIME = Object.freeze({
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json; charset=utf-8", ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".woff2": "font/woff2", ".woff": "font/woff",
  ".map": "application/json; charset=utf-8",
});

const send = (res, code, text, headers = {}) => {
  if (res.headersSent) { try { res.end(); } catch { /* gone */ } return; }
  const body = Buffer.from(text);
  res.writeHead(code, { "content-type": "text/plain; charset=utf-8", "content-length": body.length, "cache-control": "no-store", ...headers });
  res.end(body);
};
const sendJson = (res, code, obj) => send(res, code, JSON.stringify(obj), { "content-type": "application/json" });

/** True for /heimdall and /heimdall/..., the only paths the mount ever sees. The query and fragment do not count. */
export function underPrefix(url, prefix = PREFIX) {
  if (typeof url !== "string") return false;
  const i = url.search(/[?#]/);
  const p = i < 0 ? url : url.slice(0, i);
  return p === prefix || p.startsWith(`${prefix}/`);
}

/**
 * Map a request URL to path segments under the root, or a refusal. Pure. Segments are split BEFORE decoding, so an encoded slash
 * (%2f) or backslash can never smuggle a separator; a decoded segment that is `..`, starts with `.`, is node_modules, or holds a NUL is refused.
 * Returns { segs } or { status, why }.
 */
export function resolveSegments(rawUrl) {
  const i = String(rawUrl).search(/[?#]/);
  const p = i < 0 ? String(rawUrl) : String(rawUrl).slice(0, i);
  if (!p.startsWith("/")) return { status: 400, why: "bad path" };
  const segs = [];
  for (const raw of p.slice(1).split("/")) {
    let s;
    try { s = decodeURIComponent(raw); } catch { return { status: 400, why: "bad encoding" }; }
    if (s.includes("/") || s.includes("\\") || s.includes("\0")) return { status: 403, why: "refused" };
    if (s === "") continue; // "//" and the trailing slash
    if (s === "." || s === ".." || s.startsWith(".") || s.toLowerCase() === "node_modules") return { status: 403, why: "refused" };   // case-folded: the default macOS filesystem ignores case
    segs.push(s);
  }
  return { segs, dir: p.endsWith("/") || segs.length === 0 };
}

async function serveStatic(req, res, root, realRoot) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed", { allow: "GET, HEAD" });
  const r = resolveSegments(req.url);
  if (!r.segs) return send(res, r.status, r.why);
  let file = path.join(root, ...r.segs);
  let st;
  try { st = await fs.promises.stat(file); } catch { return send(res, 404, "not found"); }
  if (st.isDirectory()) {
    if (!r.dir) { // like python's http.server: /docs -> /docs/
      // built from the RESOLVED segments, never from req.url: "//host/dir" must not become a protocol-relative redirect off this origin
      const q = req.url.indexOf("?");
      return send(res, 301, "", { location: `/${r.segs.map(encodeURIComponent).join("/")}/${q < 0 ? "" : req.url.slice(q)}` });
    }
    file = path.join(file, "index.html");
    try { st = await fs.promises.stat(file); } catch { return send(res, 404, "not found"); }
  }
  if (!st.isFile()) return send(res, 404, "not found");
  try { // a symlink inside the tree must not lead out of it
    const real = await fs.promises.realpath(file);
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return send(res, 403, "refused");
  } catch { return send(res, 404, "not found"); }
  const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "content-length": st.size, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  if (req.method === "HEAD") return void res.end();
  const rs = fs.createReadStream(file);
  rs.on("error", () => { try { res.destroy(); } catch { /* gone */ } });
  res.on("close", () => rs.destroy());
  rs.pipe(res);
}

/** DNS-rebinding wall for the static files, the same rule heimdall applies to its own routes: the Host header must name a loopback host on THIS
 *  socket's port. FOLD_ALLOW_HOSTS (comma list of host[:port]) opens it for a deliberate LAN/0.0.0.0 run. */
export function hostAllowed(hostHeader, localPort, env = process.env) {
  const h = String(hostHeader ?? "").trim().toLowerCase();
  if (!h) return false;
  const extra = allowList(env);
  if (extra.includes(h)) return true;
  const m = h.match(/^(\[[^\]]*\]|[^:]+)(?::(\d+))?$/);
  if (!m) return false;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(m[1])) return false;
  return m[2] === undefined ? localPort === 80 : Number(m[2]) === localPort;
}

/** Where heimdall's embed.js lives: FOLD_HEIMDALL_SRC (the src dir, or the file itself), else ../heimdall/src/embed.js next to this checkout. */
export function heimdallEmbedPath(env = process.env) {
  const o = env.FOLD_HEIMDALL_SRC;
  if (!o) return path.resolve(HERE, "..", "heimdall", "src", "embed.js");
  const abs = path.resolve(o);
  return /\.(m?js)$/.test(abs) ? abs : path.join(abs, "embed.js");
}

/** The default mount: heimdall's own mountHeimdall, imported lazily so a missing sibling checkout degrades to static-only instead of a crash. */
export async function loadMountHeimdall(env = process.env) {
  const mod = await import(pathToFileURL(heimdallEmbedPath(env)).href);
  if (typeof mod.mountHeimdall !== "function") throw new Error("embed.js has no mountHeimdall export");
  return mod.mountHeimdall;
}

/** True when OLLAMA_HOST names this very server: heimdall would talk to itself, so it must fall back to its own default floor. */
function isOwnUrl(rawUrl, port) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`);
    return ["127.0.0.1", "localhost", "[::1]", "0.0.0.0"].includes(u.hostname) && Number(u.port || 80) === port;
  } catch { return false; } // not parseable: leave it to heimdall
}
const ownFloor = (env, port) => isOwnUrl(env.OLLAMA_HOST, port);
/** FOLD_ALLOW_HOSTS as a lower-cased list of host[:port]. */
const allowList = (env) => String(env.FOLD_ALLOW_HOSTS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
/** host[:port] -> host (the bridge's own host wall takes bare names and checks the port itself). */
const bareHost = (h) => { const m = String(h).match(/^(\[[^\]]*\]|[^:]+)(?::\d+)?$/); return m ? m[1] : String(h); };
const withoutOllamaHost = (env) => { const { OLLAMA_HOST, ...rest } = env; return rest; };

/**
 * Start the Fold's server. Resolves { server, port, url, heimdall, mountError, close } once the mount has settled; rejects (never exits) on
 * a listen error (err.code EADDRINUSE etc.). `heimdall` is a mount function (opts) => { handle, close }, or { mountHeimdall }, or false for
 * none; omitted = the real one from the sibling checkout. `heimdallOptions` are merged over the defaults (tests: autoTick, fetch, stateDir,
 * floors). The returned `heimdall` is { handle, status, close } or null: never the raw mount (it carries bridge.token).
 * `onListening({ port, url })` fires as soon as the socket listens, BEFORE the mount settles (tests: fire a request into the startup window);
 * `mountWaitMs` bounds how long a /heimdall request waits for the mount (default 15 s).
 */
export async function createFoldServer({ port = DEFAULT_PORT, host = DEFAULT_HOST, root = HERE, heimdall, heimdallOptions = {}, env = process.env, log = () => {}, onListening, mountWaitMs = 15000 } = {}) {
  const rootDir = path.resolve(root);
  const realRoot = fs.realpathSync(rootDir);
  let hm = null;
  let mountError = null;
  let settled = heimdall === false;   // false from listen until the mount settles (either way)
  let markReady; const mountReady = new Promise((r) => { markReady = r; });
  if (settled) markReady();

  /** Wait for the mount, bounded: resolves true when it settled, false on the bound. */
  const waitMount = () => {
    if (settled) return Promise.resolve(true);
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), mountWaitMs);
      t.unref?.();
      mountReady.then(() => { clearTimeout(t); resolve(true); });
    });
  };

  const server = http.createServer(async (req, res) => {
    try {
      // 1. the heimdall hook, first. Only /heimdall paths are handed over; handle() never throws, but a double might.
      if (underPrefix(req.url)) {
        // A request with NO Origin is not judged by the bridge's origin wall, so judge it here by fetch metadata: an <img>/<script> on a hostile
        // page carries no Origin but does carry sec-fetch-site: cross-site/same-site. A request WITH an Origin (an allowlisted page, the other
        // loopback spelling) is left entirely to the bridge's own origin wall. Header-less clients (curl, node, local tools) pass.
        if (!req.headers.origin) {
          const site = String(req.headers["sec-fetch-site"] || "").toLowerCase();
          if (site && site !== "same-origin" && site !== "none") return sendJson(res, 403, { error: "cross-site" });
        }
        if (!hm && !(await waitMount())) return send(res, 503, "heimdall is starting", { "retry-after": "1" });
        if (!hm) return sendJson(res, 503, { error: "heimdall-unavailable", message: String(mountError?.message || "heimdall is not mounted").slice(0, 200) });
        // cookie and x-heimdall-token are passed through untouched: same-origin is the trust boundary (see the header comment)
        try { if (await hm.handle(req, res)) return; } catch (e) {
          log(`heimdall hook: ${e?.message || e}`);
          return sendJson(res, 500, { error: "heimdall-internal" });
        }
      }
      // 2. the app itself (behind the same loopback Host wall heimdall applies to its own routes). Every static response, errors included,
      //    may be framed only by this origin (the page frames its own fold-sandbox.html). No script-src: the page imports web-llm from a CDN.
      res.setHeader("content-security-policy", "frame-ancestors 'self'");
      res.setHeader("x-frame-options", "SAMEORIGIN");
      if (!hostAllowed(req.headers.host, server.address()?.port, env)) return send(res, 421, "misdirected request");
      await serveStatic(req, res, rootDir, realRoot);
    } catch (e) {
      log(`request: ${e?.message || e}`);
      try { if (!res.headersSent) send(res, 500, "internal error"); else res.end(); } catch { /* gone */ }
    }
  });
  server.on("clientError", (_e, socket) => { try { socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"); } catch { /* gone */ } });

  await new Promise((resolve, reject) => {
    const onErr = (e) => reject(e);
    server.once("error", onErr);
    server.listen(port, host, () => { server.off("error", onErr); resolve(); });
  });
  const actual = server.address().port;
  const url = `http://${host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host}:${actual}`;
  try { onListening?.({ port: actual, url }); } catch { /* a test hook must not stop the server */ }

  if (heimdall !== false) {
    try {
      const mount = heimdall === undefined ? await loadMountHeimdall(env)
        : typeof heimdall === "function" ? heimdall : heimdall.mountHeimdall;
      if (typeof mount !== "function") throw new Error("no mountHeimdall function");
      const origins = [`http://127.0.0.1:${actual}`, `http://localhost:${actual}`];
      const mine = heimdallOptions.bridgeOptions || {};
      // FOLD_ALLOW_HOSTS opens heimdall's own host walls too: the peer wall takes host[:port], the bridge's wall takes bare names
      const extraHosts = allowList(env);
      const allowHosts = [...new Set([...(heimdallOptions.allowHosts || []), ...extraHosts])];
      const allowedHosts = [...new Set([...(mine.allowedHosts || []), ...extraHosts.map(bareHost)])];
      // a floor that is this very server would make heimdall talk to itself: drop it (an empty list falls back to heimdall's own default)
      const floors = Array.isArray(heimdallOptions.floors) ? heimdallOptions.floors.filter((f) => !isOwnUrl(f, actual)) : null;
      hm = await mount({
        name: env.FOLD_NAME || "the-fold", prefix: PREFIX,   // no port suffix: a per-port name litters ~/.heimdall and splits provider keys
        selfUrl: `http://127.0.0.1:${actual}${PREFIX}/peers`,
        ...(ownFloor(env, actual) ? { env: withoutOllamaHost(env) } : {}),
        log: (m) => log(String(m)),
        ...heimdallOptions,
        ...(floors ? { floors } : {}),
        ...(allowHosts.length ? { allowHosts } : {}),
        bridgeOptions: { ...mine, ...(allowedHosts.length ? { allowedHosts } : {}), allowedOrigins: [...new Set([...(mine.allowedOrigins || []), ...origins])] },
      });
    } catch (e) {
      mountError = e; hm = null;
      log(`heimdall mount failed: ${e?.message || e}`);
    }
  }
  settled = true; markReady();
  server.on("close", () => { try { Promise.resolve(hm?.close?.()).catch(() => {}); } catch { /* closing */ } });

  // the importer gets the three verbs, never the mount object (hm.bridge.token lives there)
  const narrowed = hm ? { handle: (req, res) => hm.handle(req, res), status: (...a) => hm.status?.(...a), close: () => hm.close?.() } : null;
  const close = () => new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections?.(); });
  return { server, port: actual, url, heimdall: narrowed, mountError, close };
}

/* ------------------------------------------------------------------ CLI */
const isMain = (() => { try { return process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const port = Number(process.env.FOLD_PORT ?? DEFAULT_PORT);
  const host = process.env.FOLD_HOST || DEFAULT_HOST;
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error(`the-fold: FOLD_PORT "${process.env.FOLD_PORT}" is not a port`); process.exit(2); }
  try {
    const s = await createFoldServer({ port, host, log: (m) => console.error(`the-fold: ${m}`) });
    console.log(`the-fold: ${s.url}/ (heimdall ${s.heimdall ? `at ${s.url}${PREFIX}/status` : "NOT mounted"}, state ${path.join(os.homedir(), ".heimdall", process.env.FOLD_NAME || "the-fold")})`);
    const stop = () => { s.close().finally(() => process.exit(0)); };
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
  } catch (e) {
    console.error(e?.code === "EADDRINUSE" ? `the-fold: port ${port} is already in use (EADDRINUSE); set FOLD_PORT to another port` : `the-fold: could not start on ${host}:${port}: ${e?.message || e}`);
    process.exit(1);
  }
}
