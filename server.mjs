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
//   - the access token is never read, logged or served here; heimdall's /status says token:false and that is all this file ever shows.
// What would prove it wrong: a request for /.git/config, /%2e%2e/x, /node_modules/x or /eval/.app/x that is answered 200; a non-/heimdall
// path that reaches the mount; a thrown mount that crashes the process or leaves a response hanging; a token in any response or log line.

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
    if (s === "." || s === ".." || s.startsWith(".") || s === "node_modules") return { status: 403, why: "refused" };
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
      const q = req.url.indexOf("?");
      return send(res, 301, "", { location: `${req.url.slice(0, q < 0 ? undefined : q).replace(/\/+$/, "")}/${q < 0 ? "" : req.url.slice(q)}` });
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
function ownFloor(env, port) {
  const raw = String(env.OLLAMA_HOST || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`);
    return ["127.0.0.1", "localhost", "[::1]", "0.0.0.0"].includes(u.hostname) && Number(u.port || 80) === port;
  } catch { return false; } // not parseable: leave it to heimdall
}
const withoutOllamaHost = (env) => { const { OLLAMA_HOST, ...rest } = env; return rest; };

/**
 * Start the Fold's server. Resolves { server, port, url, heimdall, close } once listening; rejects (never exits) on a listen error
 * (err.code EADDRINUSE etc.). `heimdall` is a mount function (opts) => { handle, close }, or { mountHeimdall }, or false for none;
 * omitted = the real one from the sibling checkout. `heimdallOptions` are merged over the defaults (tests: autoTick, fetch, stateDir).
 */
export async function createFoldServer({ port = DEFAULT_PORT, host = DEFAULT_HOST, root = HERE, heimdall, heimdallOptions = {}, env = process.env, log = () => {} } = {}) {
  const rootDir = path.resolve(root);
  const realRoot = fs.realpathSync(rootDir);
  let hm = null;
  let mountError = null;

  const server = http.createServer(async (req, res) => {
    try {
      // 1. the heimdall hook, first. Only /heimdall paths are handed over; handle() never throws, but a double might.
      if (underPrefix(req.url)) {
        if (!hm) return sendJson(res, 503, { error: "heimdall-unavailable", message: String(mountError?.message || "heimdall is not mounted").slice(0, 200) });
        try { if (await hm.handle(req, res)) return; } catch (e) {
          log(`heimdall hook: ${e?.message || e}`);
          return sendJson(res, 500, { error: "heimdall-internal" });
        }
      }
      // 2. the app itself
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

  if (heimdall !== false) {
    try {
      const mount = heimdall === undefined ? await loadMountHeimdall(env)
        : typeof heimdall === "function" ? heimdall : heimdall.mountHeimdall;
      if (typeof mount !== "function") throw new Error("no mountHeimdall function");
      const origins = [`http://127.0.0.1:${actual}`, `http://localhost:${actual}`];
      const mine = heimdallOptions.bridgeOptions || {};
      hm = await mount({
        name: "the-fold", prefix: PREFIX,
        selfUrl: `http://127.0.0.1:${actual}${PREFIX}/peers`,
        ...(ownFloor(env, actual) ? { env: withoutOllamaHost(env) } : {}),
        log: (m) => log(String(m)),
        ...heimdallOptions,
        bridgeOptions: { ...mine, allowedOrigins: [...new Set([...(mine.allowedOrigins || []), ...origins])] },
      });
    } catch (e) {
      mountError = e; hm = null;
      log(`heimdall mount failed: ${e?.message || e}`);
    }
  }
  server.on("close", () => { try { Promise.resolve(hm?.close?.()).catch(() => {}); } catch { /* closing */ } });

  const close = () => new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections?.(); });
  return { server, port: actual, url, heimdall: hm, mountError, close };
}

/* ------------------------------------------------------------------ CLI */
const isMain = (() => { try { return process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (isMain) {
  const port = Number(process.env.FOLD_PORT ?? DEFAULT_PORT);
  const host = process.env.FOLD_HOST || DEFAULT_HOST;
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error(`the-fold: FOLD_PORT "${process.env.FOLD_PORT}" is not a port`); process.exit(2); }
  try {
    const s = await createFoldServer({ port, host, log: (m) => console.error(`the-fold: ${m}`) });
    console.log(`the-fold: ${s.url}/ (heimdall ${s.heimdall ? `at ${s.url}${PREFIX}/status` : "NOT mounted"}, state ${path.join(os.homedir(), ".heimdall", "the-fold")})`);
    const stop = () => { s.close().finally(() => process.exit(0)); };
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
  } catch (e) {
    console.error(e?.code === "EADDRINUSE" ? `the-fold: port ${port} is already in use (EADDRINUSE); set FOLD_PORT to another port` : `the-fold: could not start on ${host}:${port}: ${e?.message || e}`);
    process.exit(1);
  }
}
