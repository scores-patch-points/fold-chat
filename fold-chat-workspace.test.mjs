// fold-chat-workspace.test.mjs — the agent's project: edits, diffs, previews, zip.
import test from "node:test";
import assert from "node:assert/strict";
import { parseDiffHunks, safePath, createWorkspace, applyEdit, applyEdits, parseEdits, diffLines, diffStat, hunksOf, changesBetween, treeOf, bundleForPreview, entryOf, zipOf, checkpoint, restore, outline, paths } from "./fold-chat-workspace.js";

test("safePath refuses traversal, absolute paths, .git and node_modules — and normalizes the rest", () => {
  assert.equal(safePath("src/app.js"), "src/app.js");
  assert.equal(safePath("./src//app.js"), "src/app.js");
  assert.equal(safePath("/etc/passwd"), "etc/passwd", "a leading slash is relative to the project, never the disk");
  for (const bad of ["../x", "a/../../x", "", "   ", ".git/config", "node_modules/x/y.js", "a/./b", "a\u0000b", "x".repeat(300)]) assert.equal(safePath(bad), null, JSON.stringify(bad));
  assert.equal(safePath("a\\b.js"), "a/b.js");
});

test("write creates and replaces; the result says which", () => {
  const ws = createWorkspace();
  const a = applyEdit(ws, { op: "write", path: "index.html", content: "<p>1</p>" });
  assert.deepEqual([a.ok, a.created], [true, true]);
  const b = applyEdit(ws, { op: "write", path: "index.html", content: "<p>2</p>" });
  assert.deepEqual([b.ok, b.created, b.before], [true, false, "<p>1</p>"]);
  assert.equal(ws.files["index.html"], "<p>2</p>");
});

test("falsifier: an unsafe path is refused and nothing is written", () => {
  const ws = createWorkspace();
  const r = applyEdit(ws, { op: "write", path: "../../etc/x", content: "x" });
  assert.equal(r.ok, false); assert.match(r.error, /not a safe project path/);
  assert.deepEqual(paths(ws), []);
});

test("edit replaces one exact, unique occurrence", () => {
  const ws = createWorkspace({ "a.js": "let a = 1;\nlet b = 2;\n" });
  const r = applyEdit(ws, { op: "edit", path: "a.js", find: "let b = 2;", replace: "let b = 3;" });
  assert.equal(r.ok, true);
  assert.equal(ws.files["a.js"], "let a = 1;\nlet b = 3;\n");
});

test("falsifier: a SEARCH that is missing, or ambiguous, is REPORTED — never guessed at", () => {
  const ws = createWorkspace({ "a.js": "x();\nx();\ny();\n" });
  const missing = applyEdit(ws, { op: "edit", path: "a.js", find: "zzz()", replace: "q" });
  assert.equal(missing.ok, false); assert.match(missing.error, /not found/);
  const dup = applyEdit(ws, { op: "edit", path: "a.js", find: "x();", replace: "q" });
  assert.equal(dup.ok, false); assert.match(dup.error, /more than once/);
  assert.equal(ws.files["a.js"], "x();\nx();\ny();\n", "a failed edit changes nothing");
  assert.equal(applyEdit(ws, { op: "edit", path: "nope.js", find: "a", replace: "b" }).ok, false);
  assert.equal(applyEdit(ws, { op: "edit", path: "a.js", find: "", replace: "b" }).ok, false);
});

test("edit tolerates indentation drift when the match is still unique", () => {
  const ws = createWorkspace({ "a.js": "function f() {\n    return 1;\n}\n" });
  const r = applyEdit(ws, { op: "edit", path: "a.js", find: "function f() {\n  return 1;\n}", replace: "function f() {\n  return 2;\n}" });
  assert.equal(r.ok, true); assert.equal(r.fuzzy, true);
  assert.equal(ws.files["a.js"], "function f() {\n  return 2;\n}\n");
});

test("delete and rename; rename refuses to overwrite", () => {
  const ws = createWorkspace({ "a.js": "1", "b.js": "2" });
  assert.equal(applyEdit(ws, { op: "rename", path: "a.js", to: "c.js" }).ok, true);
  assert.deepEqual(paths(ws), ["b.js", "c.js"]);
  assert.equal(applyEdit(ws, { op: "rename", path: "b.js", to: "c.js" }).ok, false);
  assert.equal(applyEdit(ws, { op: "delete", path: "b.js" }).ok, true);
  assert.equal(applyEdit(ws, { op: "delete", path: "b.js" }).ok, false);
});

test("applyEdits applies what it can and reports what it could not — one failure never blocks the rest", () => {
  const ws = createWorkspace({ "a.js": "a" });
  const r = applyEdits(ws, [{ op: "write", path: "b.js", content: "b" }, { op: "edit", path: "a.js", find: "zz", replace: "y" }, { op: "write", path: "c.js", content: "c" }]);
  assert.equal(r.applied.length, 2); assert.equal(r.failed.length, 1);
  assert.deepEqual(r.changed.sort(), ["b.js", "c.js"]);
});

test("checkpoints restore the files exactly, and later checkpoints are dropped", () => {
  const ws = createWorkspace({ "a.js": "1" });
  const c0 = checkpoint(ws, "start");
  applyEdit(ws, { op: "write", path: "a.js", content: "2" }); applyEdit(ws, { op: "write", path: "b.js", content: "x" });
  checkpoint(ws, "later");
  assert.equal(restore(ws, c0), true);
  assert.deepEqual(ws.files, { "a.js": "1" });
  assert.equal(ws.checkpoints.length, 1);
  assert.equal(restore(ws, 9), false);
});

// ───────────────────────── reading a model's answer ─────────────────────────

test("parseEdits: SEARCH/REPLACE blocks under a path line", () => {
  const ans = "Here are the fixes.\n\nsrc/app.js\n<<<<<<< SEARCH\nlet x = 1;\n=======\nlet x = 2;\n>>>>>>> REPLACE\n\nstyle.css\n<<<<<<< SEARCH\ncolor: red;\n=======\ncolor: blue;\n>>>>>>> REPLACE\n";
  const { edits } = parseEdits(ans);
  assert.deepEqual(edits, [{ op: "edit", path: "src/app.js", find: "let x = 1;", replace: "let x = 2;" }, { op: "edit", path: "style.css", find: "color: red;", replace: "color: blue;" }]);
});

test("parseEdits: a SEARCH/REPLACE inside a fence, with the path on the line above the fence content", () => {
  const ans = "```\napp.js\n<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE\n```";
  assert.deepEqual(parseEdits(ans).edits, [{ op: "edit", path: "app.js", find: "a", replace: "b" }]);
});

test("parseEdits: a block with no path uses the previous path, else is named as a problem", () => {
  const ans = "a.js\n<<<<<<< SEARCH\n1\n=======\n2\n>>>>>>> REPLACE\n<<<<<<< SEARCH\n3\n=======\n4\n>>>>>>> REPLACE";
  assert.equal(parseEdits(ans).edits[1].path, "a.js");
  const none = parseEdits("<<<<<<< SEARCH\n1\n=======\n2\n>>>>>>> REPLACE");
  assert.equal(none.edits.length, 0); assert.match(none.notes[0], /no file path/);
});

test("parseEdits: whole files from fences — path in the info string, a file: comment, or the line above", () => {
  const ans = [
    "```html path=index.html", "<h1>hi</h1>", "```",
    "", "```js", "// file: src/app.js", "console.log(1)", "```",
    "", "style.css", "```css", "body{margin:0}", "```",
    "", "```static/data.json", "{}", "```",
  ].join("\n");
  const { edits } = parseEdits(ans);
  assert.deepEqual(edits.map((e) => [e.op, e.path]), [["write", "index.html"], ["write", "src/app.js"], ["write", "style.css"], ["write", "static/data.json"]]);
  assert.equal(edits[1].content, "console.log(1)\n", "the file: hint line is not part of the file");
});

test("parseEdits: one unlabeled block goes to the default path; several unlabeled blocks go nowhere", () => {
  assert.deepEqual(parseEdits("```js\nlet a;\n```", { defaultPath: "main.js" }).edits.map((e) => e.path), ["main.js"]);
  const two = parseEdits("```js\na\n```\n```js\nb\n```");
  assert.equal(two.edits.length, 0); assert.match(two.notes[0], /no file path/);
  assert.deepEqual(parseEdits("```js\nlet a;\n```", { existing: ["only.js"] }).edits.map((e) => e.path), ["only.js"]);
});

test("parseEdits: a path that escapes the project is dropped with a note, not written", () => {
  const { edits, notes } = parseEdits("```js path=../../evil.js\nx\n```");
  assert.equal(edits.length, 0);
  assert.ok(notes.length >= 1);
});

test("parseEdits: prose with no code yields no edits and says so", () => {
  const r = parseEdits("Sure! I would add a button.");
  assert.equal(r.edits.length, 0); assert.match(r.notes[0], /no edits found/);
});

test("parseEdits: a bare file with a default path is accepted, a chatty reply is not", () => {
  assert.equal(parseEdits("<div>hi</div>", { defaultPath: "index.html" }).edits.length, 1);
  assert.equal(parseEdits("Sure, here is the thing: a = 1;", { defaultPath: "x.js" }).edits.length, 0);
});

// ───────────────────────── diffs and tree ─────────────────────────

test("diffLines marks adds, deletes and unchanged lines; diffStat counts them", () => {
  const d = diffLines("a\nb\nc", "a\nB\nc\nd");
  assert.deepEqual(d.map((h) => h.op + ":" + h.line), ["eq:a", "del:b", "add:B", "eq:c", "add:d"]);
  assert.deepEqual(diffStat(d), { added: 2, removed: 1 });
  assert.deepEqual(diffStat(diffLines(null, "x\ny")), { added: 2, removed: 0 });
});

test("hunksOf keeps changed lines with context and drops the far-away rest", () => {
  const a = Array.from({ length: 30 }, (_, i) => "l" + i).join("\n");
  const b = a.replace("l15", "CHANGED");
  const h = hunksOf(diffLines(a, b), 2);
  assert.equal(h.length, 1);
  assert.equal(h[0].lines.length, 6, "2 before + del + add + 2 after");
});

test("changesBetween reports added, modified and deleted files with line counts", () => {
  const ch = changesBetween({ "a.js": "1", "b.js": "x\ny", "c.js": "z" }, { "a.js": "1", "b.js": "x\nY", "d.js": "new" });
  assert.deepEqual(ch.map((c) => [c.path, c.status]), [["b.js", "modified"], ["c.js", "deleted"], ["d.js", "added"]]);
  assert.deepEqual([ch[0].added, ch[0].removed], [1, 1]);
});

test("treeOf nests directories first, then files, alphabetically", () => {
  const t = treeOf(["index.html", "src/b.js", "src/a.js", "src/lib/x.js", "README.md"]);
  assert.deepEqual(t.map((n) => n.name), ["src", "index.html", "README.md"].sort((a, b) => (a === "src" ? -1 : b === "src" ? 1 : a.localeCompare(b))));
  const src = t.find((n) => n.name === "src");
  assert.deepEqual(src.children.map((n) => n.name), ["lib", "a.js", "b.js"]);
  assert.equal(src.children[0].children[0].path, "src/lib/x.js");
});

// ───────────────────────── previewing ─────────────────────────

test("bundleForPreview inlines local CSS and JS so a multi-file page runs in one sandboxed srcdoc", () => {
  const ws = createWorkspace({
    "index.html": '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><div id="a"></div><script src="app.js"></script></body></html>',
    "style.css": "body{margin:0}", "app.js": "document.getElementById('a').textContent = 'hi';",
  });
  const b = bundleForPreview(ws);
  assert.match(b.html, /<style data-from="style\.css">\s*body\{margin:0\}/);
  assert.match(b.html, /<script data-from="app\.js">\s*document\.getElementById/);
  assert.doesNotMatch(b.html, /href="style\.css"|src="app\.js"/);
  assert.deepEqual(b.inlined.sort(), ["app.js", "style.css"]); assert.deepEqual(b.missing, []);
});

test("falsifier: a page that names a file the workspace lacks reports it as MISSING rather than inventing it", () => {
  const ws = createWorkspace({ "index.html": '<link rel="stylesheet" href="nope.css"><script src="js/gone.js"></script><script src="https://cdn.example/x.js"></script>' });
  const b = bundleForPreview(ws);
  assert.deepEqual(b.missing.sort(), ["js/gone.js", "nope.css"]);
  assert.match(b.html, /https:\/\/cdn\.example\/x\.js/, "external references are left alone");
});

test("bundleForPreview resolves paths relative to the page, including ../ and nested pages", () => {
  const ws = createWorkspace({ "site/index.html": '<script src="../lib/u.js"></script><script src="main.js"></script>', "lib/u.js": "1", "site/main.js": "2" });
  const b = bundleForPreview(ws, "site/index.html");
  assert.deepEqual(b.missing, []); assert.deepEqual(b.inlined.sort(), ["lib/u.js", "site/main.js"]);
});

test("an inlined script cannot break out of its tag", () => {
  const ws = createWorkspace({ "index.html": '<script src="a.js"></script>', "a.js": "var s = '</script><b>x</b>';" });
  assert.doesNotMatch(bundleForPreview(ws).html.replace(/<\/script>\s*$/, ""), /<\/script><b>/);
});

test("entryOf prefers index.html, then any html, else null", () => {
  assert.equal(entryOf(createWorkspace({ "x.html": "", "index.html": "" })), "index.html");
  assert.equal(entryOf(createWorkspace({ "a/page.html": "" })), "a/page.html");
  assert.equal(entryOf(createWorkspace({ "a.js": "" })), null);
  assert.deepEqual(bundleForPreview(createWorkspace({ "a.js": "" })), { html: "", missing: [], inlined: [], entry: null });
});

// ───────────────────────── export ─────────────────────────

test("zipOf produces a valid stored zip whose entries read back byte for byte", () => {
  const ws = createWorkspace({ "index.html": "<h1>héllo</h1>\n", "src/app.js": "let a = 1;\n" });
  const z = zipOf(ws);
  assert.equal(z[0], 0x50); assert.equal(z[1], 0x4b);
  // end-of-central-directory: entry count and offsets
  const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
  const eocd = z.length - 22;
  assert.equal(dv.getUint32(eocd, true), 0x06054b50);
  assert.equal(dv.getUint16(eocd + 10, true), 2);
  // walk the local headers and read each entry back
  const dec = new TextDecoder(); const got = {};
  let off = 0;
  while (dv.getUint32(off, true) === 0x04034b50) {
    const size = dv.getUint32(off + 18, true), nl = dv.getUint16(off + 26, true), el = dv.getUint16(off + 28, true);
    const name = dec.decode(z.slice(off + 30, off + 30 + nl));
    got[name] = dec.decode(z.slice(off + 30 + nl + el, off + 30 + nl + el + size));
    off += 30 + nl + el + size;
  }
  assert.deepEqual(got, ws.files);
});

test("outline gives a model the shape of files it is not rewriting", () => {
  const ws = createWorkspace({ "a.js": "export function foo() {}\nconst bar = 1;\nclass Baz {}\n// rest" });
  const o = outline(ws);
  assert.match(o, /a\.js \(\d+ lines; defines foo, bar, Baz\)/);
});


// ───────────────────────── unified-diff hunks ─────────────────────────

test("parseEdits: a conflict-marker wrapper around diff hunks — exactly what a model emitted in the experiment", () => {
  const ans = "<<<<<<< src/money.js\n@@\n-export function fmtMoney(cents) {\n-  const d = 1;\n-}\n+export function fmtMoney(cents) {\n+  const d = 2;\n+}\n>>>>>>> REPLACE";
  const { edits } = parseEdits(ans);
  assert.deepEqual(edits, [{ op: "edit", path: "src/money.js", find: "export function fmtMoney(cents) {\n  const d = 1;\n}", replace: "export function fmtMoney(cents) {\n  const d = 2;\n}" }]);
});

test("parseEdits: a standard unified diff, with context lines and several hunks", () => {
  const ans = "--- a/src/a.js\n+++ b/src/a.js\n@@ -1,3 +1,3 @@\n let a = 1;\n-let b = 2;\n+let b = 3;\n let c = 4;\n@@ -10,2 +10,2 @@\n-old();\n+neu();\n";
  const { edits } = parseEdits(ans);
  assert.equal(edits.length, 2);
  assert.deepEqual(edits[0], { op: "edit", path: "src/a.js", find: "let a = 1;\nlet b = 2;\nlet c = 4;", replace: "let a = 1;\nlet b = 3;\nlet c = 4;" });
  assert.equal(edits[1].find, "old();"); assert.equal(edits[1].replace, "neu();");
});

test("parseEdits: a diff inside a fence, and blank context lines whose leading space was dropped", () => {
  const ans = "```diff\n--- a/x.js\n+++ b/x.js\n@@\n-a\n+b\n\n c\n```";
  const { edits } = parseEdits(ans);
  assert.equal(edits.length, 1); assert.equal(edits[0].find, "a\n\nc"); assert.equal(edits[0].replace, "b\n\nc");
});

test("a diff edit APPLIES to the file it came from, end to end", () => {
  const ws = createWorkspace({ "src/m.js": "export function f(c) {\n  return c;\n}\n" });
  const { edits } = parseEdits("<<<<<<< src/m.js\n@@\n-  return c;\n+  return c + 1;\n>>>>>>> REPLACE");
  const r = applyEdits(ws, edits);
  assert.equal(r.failed.length, 0);
  assert.equal(ws.files["src/m.js"], "export function f(c) {\n  return c + 1;\n}\n");
});

test("diff hunks: a pure insertion with no context is REPORTED, never guessed at; a hunk with no path is named", () => {
  const a = parseEdits("--- a/x.js\n+++ b/x.js\n@@\n+only added\n");
  assert.equal(a.edits.length, 0); assert.match(a.notes.join(" "), /pure insertion/);
  const b = parseEdits("@@\n-a\n+b\n");
  assert.equal(b.edits.length, 0); assert.match(b.notes.join(" "), /no file path/);
  assert.equal(parseEdits("@@\n-a\n+b\n", { defaultPath: "d.js" }).edits[0].path, "d.js", "a default path covers a single-file ask");
});

test("SEARCH/REPLACE still wins when both could match, and prose with a lone '-' bullet is not a diff", () => {
  const sr = parseEdits("a.js\n<<<<<<< SEARCH\nx\n=======\ny\n>>>>>>> REPLACE");
  assert.deepEqual(sr.edits, [{ op: "edit", path: "a.js", find: "x", replace: "y" }]);
  assert.equal(parseEdits("Here is what to do:\n- add a button\n- remove the label\n").edits.length, 0);
  assert.equal(parseDiffHunks("no hunks here\n- just bullets").length, 0);
});
