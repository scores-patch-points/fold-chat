// The extension package: the manifest asks for no more than it needs, every page is clean under
// an extension page's CSP, and the build ships exactly what the entry points import.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect, build, importsOf, inspectHtml } from "./scripts/build-extension.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

test("manifest: Manifest V3, with the entry points the build starts from", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.name && manifest.version && manifest.description);
  assert.equal(manifest.background.service_worker, "fold-background.js");
  assert.equal(manifest.side_panel.default_path, "index.html");
  assert.equal(manifest.options_ui.page, "fold-options.html");
});

test("manifest: no blanket access — fixed hosts only, https except the person's own machine, arbitrary sites optional and https-only", () => {
  const hosts = manifest.host_permissions;
  assert.ok(hosts.length > 0);
  for (const h of hosts) {
    assert.ok(!/<all_urls>|^\*:\/\/|^https?:\/\/\*\/|^https:\/\/\*\/\*$/.test(h), "blanket pattern: " + h);
    assert.ok(/^https:\/\//.test(h) || /^http:\/\/(127\.0\.0\.1|localhost)\//.test(h), "plain http is only for the local bridge: " + h);
  }
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*"]);
  assert.ok(!manifest.host_permissions.includes("https://*/*"), "reading any site is the person's opt-in, not an install-time grant");
});

test("manifest: asks for the least — one API permission, nothing that reads the person's tabs, history or cookies", () => {
  assert.deepEqual(manifest.permissions, ["sidePanel"]);
  for (const p of ["tabs", "history", "cookies", "webRequest", "webNavigation", "scripting", "activeTab", "storage", "declarativeNetRequest", "nativeMessaging", "downloads", "clipboardRead", "management"]) assert.ok(!(manifest.permissions || []).includes(p), p);
});

test("manifest: nothing lets a web page or another extension drive the fetcher, and no code runs inside web pages", () => {
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
});

test("manifest: the extension-page CSP allows no inline script, no eval, no remote code", () => {
  const csp = manifest.content_security_policy.extension_pages;
  assert.match(csp, /script-src 'self'/);
  assert.ok(!/unsafe-inline|unsafe-eval|https?:|\*/.test(csp), csp);
});

test("manifest: the artifact sandbox page gets a relaxed CSP of its own, with no remote code and no wildcard", () => {
  assert.deepEqual(manifest.sandbox.pages, ["fold-sandbox.html"]);
  const csp = manifest.content_security_policy.sandbox;
  assert.match(csp, /^sandbox allow-scripts;/);
  assert.match(csp, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
  assert.ok(!/https?:|\*|data:|blob:/.test(csp), csp);
  assert.match(manifest.content_security_policy.extension_pages, /^script-src 'self'/, "the sandbox's looseness never reaches the pages that hold the person's chats");
});

test("package: every page is clean under that CSP and every import resolves — no problems", () => {
  const { problems, files } = collect(ROOT, manifest);
  assert.deepEqual(problems, []);
  for (const f of ["manifest.json", "index.html", "fold-boot.js", "fold-exit-install.js", "fold-theme-boot.js", "fold-chat.js", "fold-chat-exit.js", "fold-chat-web.js", "fold-chat-engines.js", "fold-background.js", "fold-options.html", "fold-options.js", "fold-sandbox.html", "fold-sandbox.js", "fold-chat-sandframe.js"]) assert.ok(files.includes(f), f + " ships");
});

test("package: tests, eval output, experiments and dependencies are not shipped", () => {
  const { files } = collect(ROOT, manifest);
  for (const f of files) {
    assert.ok(!/\.test\.m?js$/.test(f), f);
    assert.ok(!/^(eval|experiments|node_modules|dist|test-support|docs|\.claude|\.git)\//.test(f), f);
  }
});

test("the page loads its two boot scripts from files, and the exit gate is installed before anything else runs", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const r = inspectHtml(html);
  assert.deepEqual(r.problems, []);
  assert.ok(r.scripts.includes("fold-theme-boot.js") && r.scripts.includes("fold-boot.js"));
  const boot = fs.readFileSync(path.join(ROOT, "fold-boot.js"), "utf8");
  const imports = [...boot.matchAll(/^import\s+(?:[^"']*from\s+)?["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.equal(imports[0], "./fold-exit-install.js", "the gate is the FIRST import — ES modules run in import order");
});

test("inspectHtml: names what a CSP would refuse, and only that", () => {
  assert.deepEqual(inspectHtml('<script src="a.js"></script><script type="module" src="b.js"></script>').problems, []);
  assert.deepEqual(inspectHtml('<button aria-controls="nav" data-onx="1" class="x">ok</button>').problems, [], "aria-controls= is not an on*= handler");
  assert.match(inspectHtml("<script>alert(1)</script>").problems[0], /inline <script>/);
  assert.match(inspectHtml('<button onclick="go()">x</button>').problems[0], /onclick/);
  assert.match(inspectHtml('<a href="javascript:void(0)">x</a>').problems[0], /javascript:/);
  assert.match(inspectHtml('<script src="https://cdn.example.com/x.js"></script>').problems[0], /remote/);
  assert.match(inspectHtml('<link rel="stylesheet" href="//fonts.example.com/x.css">').problems[0], /remote/);
  assert.deepEqual(inspectHtml("<script>   \n  </script>").problems, [], "an empty script block is harmless");
});

test("importsOf: static, re-exported and literal dynamic imports; not look-alikes", () => {
  const src = `import a from "./a.js"; import { b } from './b.js'; import * as c from "../c.js"; import "./side.js";
    export { d } from "./d.js"; export * from "./e.js"; const x = await import("./f.js"); const y = "from './not.js'";`;
  assert.deepEqual(importsOf(src).sort(), ["../c.js", "./a.js", "./b.js", "./d.js", "./e.js", "./f.js", "./side.js"]);
});

test("build: copies exactly the collected files; the test build adds https://*/* and says so", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fold-ext-"));
  try {
    const out = path.join(tmp, "ext");
    const r = build({ root: ROOT, outDir: out });
    assert.deepEqual(r.files, collect(ROOT, manifest).files);
    for (const f of r.files) assert.ok(fs.existsSync(path.join(out, f)), f);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8")), manifest, "the real build ships the manifest untouched");
    const out2 = path.join(tmp, "ext-test");
    build({ root: ROOT, outDir: out2, allHosts: true });
    const m2 = JSON.parse(fs.readFileSync(path.join(out2, "manifest.json"), "utf8"));
    assert.ok(m2.host_permissions.includes("https://*/*"));
    assert.match(m2.name, /test build/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("build: refuses to produce an extension that would load and then do nothing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fold-ext-bad-"));
  try {
    fs.writeFileSync(path.join(tmp, "manifest.json"), JSON.stringify({ manifest_version: 3, name: "x", version: "1", side_panel: { default_path: "p.html" }, background: { service_worker: "missing.js" } }));
    fs.writeFileSync(path.join(tmp, "p.html"), '<script>boom()</script><script type="module" src="m.js"></script>');
    fs.writeFileSync(path.join(tmp, "m.js"), 'import x from "lodash"; import y from "./gone.js";');
    const { problems } = collect(tmp, JSON.parse(fs.readFileSync(path.join(tmp, "manifest.json"), "utf8")));
    const all = problems.join("\n");
    assert.match(all, /inline <script>/);
    assert.match(all, /missing\.js: referenced but missing/);
    assert.match(all, /"lodash".*only relative/);
    assert.match(all, /gone\.js: referenced but missing/);
    assert.throws(() => build({ root: tmp, outDir: path.join(tmp, "out") }), /would not load cleanly/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
