// snapshot.mjs — freeze the app under test so other people editing the working
// tree cannot change the measurement mid-run, and serve the frozen copy.
//
// The snapshot is the repo's WORKING TREE at the moment of the call (not HEAD):
// "the current app". Every file's sha256 plus `git rev-parse HEAD` and a dirty
// flag are recorded in eval/raw/_app.json so a result can be tied to a build.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".css": "text/css" };

export function takeSnapshot(repo, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const files = [];
  for (const f of fs.readdirSync(repo)) {
    // Everything the page can load from the repo root: scripts, html, css, json manifests, images (never tests / e2e / eval).
    if (fs.statSync(path.join(repo, f)).isFile() && /\.(js|html|css|json|svg|png|webp|ico|woff2?)$/.test(f) && !/(\.test\.|e2e|package)/.test(f)) files.push(f);
  }
  const out = {};
  for (const f of files) { fs.copyFileSync(path.join(repo, f), path.join(dest, f)); }
  // vendor/ (except the big Phosphor SVG set: icons are generated into fold-chat-icons.js) and dist/ if present
  const copyDir = (rel, skip = /phosphor/) => {
    const src = path.join(repo, rel); if (!fs.existsSync(src)) return;
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const r = path.join(rel, e.name); if (skip.test(r)) continue;
      if (e.isDirectory()) copyDir(r, skip); else { fs.mkdirSync(path.join(dest, rel), { recursive: true }); fs.copyFileSync(path.join(repo, r), path.join(dest, r)); }
    }
  };
  copyDir("vendor");
  const walk = (d, rel = "") => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = path.join(rel, e.name); if (e.isDirectory()) walk(path.join(d, e.name), r); else out[r] = crypto.createHash("sha256").update(fs.readFileSync(path.join(d, e.name))).digest("hex").slice(0, 16); } };
  walk(dest);
  let head = null, dirty = null;
  try { head = execSync("git rev-parse HEAD", { cwd: repo }).toString().trim(); dirty = execSync("git status --porcelain", { cwd: repo }).toString().split("\n").filter(Boolean).length; } catch {}
  return { takenAt: new Date().toISOString(), head, dirtyFiles: dirty, files: out };
}

export function serve(dir, port = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
      const f = path.join(dir, p);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("nf"); }
      res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(port, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }));
  });
}
