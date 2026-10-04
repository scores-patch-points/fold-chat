// fold-chat-artifacts.test.mjs — the artifact parser: fences, kinds,
// explicit declarations, prose/artifact splitting.
import test from "node:test";
import assert from "node:assert/strict";
import { artifactsOf, artifactOf, hasArtifacts, artifactSummary, previewable } from "./fold-chat-artifacts.js";

test("a reply with an html fence splits into prose + artifact", () => {
  const blocks = artifactsOf("Here is a button:\n\n```html\n<button>hi</button>\n```\n\nDone.");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].kind, "prose");
  assert.equal(blocks[1].kind, "artifact");
  assert.equal(blocks[1].artifact.kind, "html");
  assert.equal(blocks[1].artifact.code, "<button>hi</button>");
  assert.equal(blocks[2].kind, "prose");
  assert.equal(blocks[2].text.trim(), "Done.");
});

test("mermaid is a diagram artifact, js/python are code artifacts", () => {
  assert.equal(artifactOf("mermaid", "graph TD\n  A-->B").kind, "mermaid");
  assert.equal(artifactOf("js", "const x = 1").kind, "code");
  assert.equal(artifactOf("python", "print(1)").kind, "code");
  assert.equal(artifactOf("sh", "echo hi").kind, "code");
});

test("unknown or empty fences are not artifacts", () => {
  assert.equal(artifactOf("unknowngarbage", "x"), null);
  assert.equal(artifactOf("js", "   "), null);
});

test("an explicit fold.artifact declaration names the artifact", () => {
  const spec = artifactOf("json", JSON.stringify({ schema: "fold.artifact", kind: "html", title: "Counter", body: "<b>1</b>" }));
  assert.equal(spec.kind, "html");
  assert.equal(spec.title, "Counter");
  assert.equal(spec.code, "<b>1</b>");
});

test("html artifacts preview in an isolated frame; code does not", () => {
  assert.equal(previewable("html"), true);
  assert.equal(previewable("code"), false);
  assert.equal(previewable("mermaid"), false);
});

test("artifactSummary lists every artifact in a reply", () => {
  const s = artifactSummary("a\n```html\n<b>x</b>\n```\nb\n```js\n1\n```");
  assert.equal(s.length, 2);
  assert.equal(s[0].kind, "html");
  assert.equal(s[1].kind, "code");
});

test("hasArtifacts is true only when a fence exists", () => {
  assert.equal(hasArtifacts("```html\nx\n```"), true);
  assert.equal(hasArtifacts("plain text"), false);
});