// scripts/build-extension.mjs — package The Fold as a browser extension.
//
//   node scripts/build-extension.mjs                  → dist/extension/        (load this folder unpacked)
//   node scripts/build-extension.mjs --test-all-hosts → dist/extension-test/   (also grants https://*/*; for the e2e,
//                                                       because an optional permission can only be granted by a click)
//
// The repo root is not shipped: only the files reachable from the manifest's entry points are
// copied (the HTML pages, their scripts, and every static import under them). That keeps tests,
// eval output and node_modules out of the package, and means a file nothing imports is not in it.
// The build FAILS — rather than producing an extension that loads and then does nothing — on
// anything an extension page's CSP would refuse: inline <script>, on*= handlers, javascript: URLs,
// remote script/stylesheet URLs, and imports that cannot be resolved or are not relative.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Files shipped although no entry point imports them yet. fold-chat-sandframe.js is the seam the artifact
 *  frames use to run inside the extension (fold-chat-sandbox.js and fold-chat.js adopt it with a one-word change
 *  at each srcdoc site); it ships now so the e2e can drive it, and drops out of this list once they import it. */
export const EXTRA_ENTRIES = Object.freeze(["fold-chat-sandframe.js"]);

/** Relative specifiers a JS module imports/re-exports (static and literal dynamic). */
export function importsOf(src) {
  const code = String(src);
  const out = new Set();
  const add = (s) => out.add(s);
  for (const m of code.matchAll(/\b(?:import|export)\b[^'"`;()]*?\bfrom\s*(["'])([^"']+)\1/g)) add(m[2]);
  for (const m of code.matchAll(/(?:^|[;{}\s])import\s*(["'])([^"']+)\1/g)) add(m[2]);
  for (const m of code.matchAll(/\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g)) add(m[2]);
  return [...out];
}

/** What an HTML page loads, and what its CSP would refuse. */
export function inspectHtml(html) {
  const h = String(html);
  const scripts = [], links = [], problems = [];
  for (const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = /\bsrc\s*=\s*"([^"]*)"|\bsrc\s*=\s*'([^']*)'/i.exec(m[1]);
    if (src) scripts.push(src[1] ?? src[2]);
    else if (m[2].trim()) problems.push("inline <script> (" + m[2].trim().slice(0, 40).replace(/\s+/g, " ") + "…)");
  }
  for (const m of h.matchAll(/<link\b([^>]*)>/gi)) {
    const rel = /\brel\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]);
    const href = /\bhref\s*=\s*"([^"]*)"|\bhref\s*=\s*'([^']*)'/i.exec(m[1]);
    if (href && rel && /stylesheet|icon|modulepreload/i.test(rel[1])) links.push(href[1] ?? href[2]);
  }
  for (const m of h.matchAll(/<[a-z][^>]*\s(on[a-z]+)\s*=/gi)) problems.push("inline event handler " + m[1] + "=");
  if (/\b(?:href|src)\s*=\s*["']\s*javascript:/i.test(h)) problems.push("a javascript: URL");
  for (const s of [...scripts, ...links]) if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(s)) problems.push("remote resource " + s);
  return { scripts, links, problems };
}

/** The set of files an extension needs, and everything wrong with it. */
export function collect(root = ROOT, manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"))) {
  const files = new Set(["manifest.json"]);
  const problems = [], warnings = [];
  const queue = [];
  const entry = (p) => { if (p) queue.push(String(p).replace(/^\//, "")); };

  entry(manifest.background && manifest.background.service_worker);
  entry(manifest.side_panel && manifest.side_panel.default_path);
  entry(manifest.options_ui && manifest.options_ui.page);
  entry(manifest.action && manifest.action.default_popup);
  for (const p of (manifest.sandbox && manifest.sandbox.pages) || []) entry(p);
  for (const p of EXTRA_ENTRIES) entry(p);
  for (const v of Object.values(manifest.icons || {})) entry(v);
  for (const v of Object.values((manifest.action && manifest.action.default_icon) || {})) entry(v);

  const seen = new Set();
  while (queue.length) {
    const rel = path.posix.normalize(queue.pop());
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = path.join(root, rel);
    if (rel.startsWith("..") || !abs.startsWith(root + path.sep)) { problems.push(rel + ": outside the project"); continue; }
    if (!fs.existsSync(abs)) { problems.push(rel + ": referenced but missing"); continue; }
    files.add(rel);
    const dir = path.posix.dirname(rel);
    const here = (s) => path.posix.normalize(path.posix.join(dir, s));
    if (/\.html?$/i.test(rel)) {
      const r = inspectHtml(fs.readFileSync(abs, "utf8"));
      for (const p of r.problems) problems.push(rel + ": " + p);
      for (const s of [...r.scripts, ...r.links]) if (!/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(s)) queue.push(here(s.split(/[?#]/)[0]));
    } else if (/\.(?:m?js)$/i.test(rel)) {
      const src = fs.readFileSync(abs, "utf8");
      for (const spec of importsOf(src)) {
        if (!/^\.{1,2}\//.test(spec)) { problems.push(rel + ": imports " + JSON.stringify(spec) + " (only relative imports can ship)"); continue; }
        queue.push(here(spec));
      }
      const bare = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
      if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(bare)) warnings.push(rel + ": eval / new Function (an extension page's CSP refuses it)");
    }
  }
  return { files: [...files].sort(), problems, warnings };
}

export function build({ root = ROOT, outDir = path.join(root, "dist", "extension"), allHosts = false } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const { files, problems, warnings } = collect(root, manifest);
  if (problems.length) throw new Error("the extension would not load cleanly:\n  - " + problems.join("\n  - "));
  fs.rmSync(outDir, { recursive: true, force: true });
  let bytes = 0;
  for (const rel of files) {
    const to = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (rel === "manifest.json" && allHosts) {
      const m = { ...manifest, name: manifest.name + " (test build)", host_permissions: [...new Set([...manifest.host_permissions, "https://*/*"])] };
      fs.writeFileSync(to, JSON.stringify(m, null, 2) + "\n");
    } else fs.copyFileSync(path.join(root, rel), to);
    bytes += fs.statSync(to).size;
  }
  return { outDir, files, bytes, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const allHosts = process.argv.includes("--test-all-hosts");
  try {
    const r = build({ outDir: path.join(ROOT, "dist", allHosts ? "extension-test" : "extension"), allHosts });
    console.log(`built ${r.files.length} files, ${(r.bytes / 1024).toFixed(0)} KB → ${path.relative(process.cwd(), r.outDir) || r.outDir}`);
    for (const w of r.warnings) console.warn("warning: " + w);
    console.log(allHosts ? "TEST BUILD: also grants https://*/* — do not publish." : "Load it: chrome://extensions → Developer mode → Load unpacked → pick that folder.");
  } catch (e) { console.error(String(e.message || e)); process.exit(1); }
}
