// fold-chat-render.test.mjs — the chat body renderer: markdown becomes markup,
// model output stays escaped, and no unsafe link or tag ever survives.

import test from "node:test";
import assert from "node:assert/strict";
import { mdHtml } from "./fold-chat-render.js";

test("headings, bold, italic, strike, inline code", () => {
  const h = mdHtml("# Title\n\n**bold** and *italic* and ~~gone~~ and `code`.");
  assert.match(h, /<h1>Title<\/h1>/);
  assert.match(h, /<strong>bold<\/strong>/);
  assert.match(h, /<em>italic<\/em>/);
  assert.match(h, /<del>gone<\/del>/);
  assert.match(h, /<code>code<\/code>/);
});

test("lists — flat and nested", () => {
  const h = mdHtml("- one\n- two\n- three");
  assert.match(h, /<ul><li>one<\/li><li>two<\/li><li>three<\/li><\/ul>/);

  const nested = mdHtml("- top\n    - sub a\n    - sub b\n- next");
  assert.match(nested, /<li>top<ul><li>sub a<\/li><li>sub b<\/li><\/ul><\/li><li>next<\/li>/);
});

test("ordered lists", () => {
  const h = mdHtml("1. first\n2. second");
  assert.match(h, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
});

test("blockquote", () => {
  assert.match(mdHtml("> a cited line"), /<blockquote><p>a cited line<\/p><\/blockquote>/);
});

test("table", () => {
  const h = mdHtml("| a | b |\n|---|---|\n| 1 | 2 |");
  assert.match(h, /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><\/tbody><\/table>/);
});

test("fenced code stays escaped, html never runs", () => {
  const h = mdHtml('```js\nconst x = "<script>alert(1)</script>";\n```');
  assert.match(h, /<pre class="md-code"><code class="lang-js">/);
  assert.match(h, /&lt;script&gt;/);
  assert.doesNotMatch(h, /<script>/);
});

test("raw html in markdown is escaped, not executed", () => {
  const h = mdHtml("<script>alert('xss')</script> and <img src=x onerror=alert(1)>");
  assert.match(h, /&lt;script&gt;alert/);
  assert.doesNotMatch(h, /<script>/);
  assert.doesNotMatch(h, /<img/);
});

test("links: http/mailto/fragment survive, javascript: and data: do not", () => {
  assert.match(mdHtml("[fold](https://opencode.ai)"), /<a href="https:\/\/opencode\.ai" rel="noopener noreferrer" target="_blank">fold<\/a>/);
  assert.match(mdHtml("[mail](mailto:a@b.com)"), /href="mailto:a@b\.com"/);
  const js = mdHtml("[j](javascript:alert(1))");
  assert.doesNotMatch(js, /<a/, "javascript: must never become an anchor");
  assert.match(js, /j/, "the label survives as plain text");
  const data = mdHtml("[d](data:text/html,x)");
  assert.doesNotMatch(data, /<a/, "data: must never become an anchor");
});

test("autolinks and images", () => {
  assert.match(mdHtml("see <https://example.com/x>"), /<a href="https:\/\/example\.com\/x"/);
  assert.match(mdHtml("![alt](https://example.com/p.png)"), /<img src="https:\/\/example\.com\/p\.png" alt="alt"/);
});

test("hr and paragraphs", () => {
  const h = mdHtml("above\n\n---\n\nbelow");
  assert.match(h, /<p>above<\/p><hr><p>below<\/p>/);
});

test("empty input renders nothing", () => {
  assert.equal(mdHtml(""), "");
  assert.equal(mdHtml(null), "");
});