// fold-chat-region.test.mjs — where a page's content is: sentence scoring starts after the nav/header region (docs/SNIP-JUNK-PREREG.md).
import test from "node:test";
import assert from "node:assert/strict";
import { parseHtml, regionOfHtml, visibleTextOfHtml, titleOfHtml, maskNavRegion, isProse, contentOf, tableRowsOfHtml, codeBlocksOfHtml, askTerms } from "./fold-chat-region.js";
import { groupsOf } from "./fold-chat-strand.js";
import { verifyJoined } from "./fold-chat-junk.js";

const P1 = "The okapi is an artiodactyl mammal that is endemic to the northeast of the Democratic Republic of the Congo in Central Africa, and it is related to the giraffe.";
const P2 = "Both sexes have a dark chestnut coat with white stripes on the legs, and the males carry short skin-covered horns that are called ossicones in the literature.";
const NAVHTML = `<nav><a href="/">Home</a> <a href="/a">Animals</a> <a href="/b">Plants</a> <a href="/c">About us</a> <a href="/d">Sign in</a></nav>`;
const PAGE = `<html><head><title>Okapi</title><script>var x = "Skip to main content";</script><style>.a{color:red}</style></head><body>
  <header><a href="/">Site name</a> ${NAVHTML}</header>
  <div class="cookie-banner">We use cookies to improve your experience. Accept all cookies. Cookie settings.</div>
  <main><h1>Okapi</h1><p>${P1}</p><p>${P2}</p><aside>Related: giraffe, zebra, antelope, forest</aside></main>
  <footer>All rights reserved. Privacy policy. Terms of use. Contact us.</footer></body></html>`;

test("the region is the main content: nav, header, banner, aside and footer are dropped; scripts and styles never appear", () => {
  const r = regionOfHtml(PAGE);
  assert.equal(r.scope, "main");
  assert.ok(r.text.includes(P1) && r.text.includes(P2));
  for (const chrome of ["Sign in", "Site name", "cookies", "All rights reserved", "Related:", "Skip to main content", "color:red"]) assert.ok(!r.text.includes(chrome), chrome);
});

test("FALSIFIER (B1): scoring from the top of the page's text finds the menu; scoring from the region does not", () => {
  const top = visibleTextOfHtml(PAGE);
  assert.ok(top.indexOf("Sign in") < top.indexOf("The okapi"), "the page's text starts with its chrome (this is what the old ladder scored)");
  const r = regionOfHtml(PAGE);
  assert.ok(r.text.startsWith("Okapi") || r.text.startsWith(P1), "the region starts at the content");
});

test("without landmarks: the densest prose is found by link density and chrome share, and a class like has-sidebar is not a sidebar", () => {
  const html = `<body class="page has-sidebar"><div class="topbar"><a href="/">Home</a><a href="/x">Shop</a><a href="/y">Blog</a></div>
    <div class="menu"><a href="/1">One two</a> <a href="/2">Three four</a></div>
    <div class="content"><p>${P1}</p><p>${P2}</p></div></body>`;
  const r = regionOfHtml(html);
  assert.ok(r.text.includes(P1) && r.text.includes(P2));
  assert.ok(!r.text.includes("Shop"));
});

test("a token like 'sidebar' in a BEM modifier or a layout-state class does not drop the content; a real sidebar is dropped", () => {
  const html = `<main><div class="layout__main--sidebar"><p>${P1}</p><p>${P2}</p></div><div class="sidebar"><p>Short promo line here.</p></div></main>`;
  const r = regionOfHtml(html);
  assert.ok(r.text.includes(P1));
  assert.ok(!r.text.includes("promo line"));
});

test("a page that wraps everything in a <header>/<nav>-named container keeps its text (a drop that removes most of the page is refused)", () => {
  const html = `<body><header class="wrap"><h1>Lisbon</h1><p>${P1}</p><p>${P2}</p></header></body>`;
  const r = regionOfHtml(html);
  assert.ok(r.text.includes(P1));
});

test("content start: leading short non-prose blocks (breadcrumbs, labels) before the first prose run are not scored", () => {
  const blocks = ["Home", "Animals / Mammals", "Okapi", P1, P2].map((text, i) => ({ text, tag: "p", chars: text.length, linkChars: 0, idx: i }));
  const c = contentOf(blocks);
  assert.equal(c.kept[c.start].text, P1);
  assert.ok(isProse(P1)); assert.ok(!isProse("Home Animals Plants About us Sign in Contact"));
});

test("FALSIFIER (B2): passages cut from the region stay contiguous on the page — a dropped block between two kept ones is a masked line, never bridged", () => {
  const html = `<main><p>${P1}</p><div class="cookie-banner"><p>We use cookies so please accept all cookies now to keep reading this page.</p></div><p>${P2}</p></main>`;
  const r = regionOfHtml(html);
  const groups = groupsOf(r.text, "okapi horns stripes", 900);
  const vis = visibleTextOfHtml(html);
  const pieces = groups.map((g) => r.text.slice(g.start, g.end));
  const v = verifyJoined(pieces, vis);
  assert.equal(v.ok, true, "every piece is on the page: " + JSON.stringify(v.dropped));
  assert.ok(!pieces.some((p) => p.includes(P1) && p.includes(P2)), "P1 and P2 are NOT one passage — the banner sits between them");
});

test("maskNavRegion keeps offsets: masked text has the same length and a slice of it is a slice of the original", () => {
  const text = ["Home", "Sign in or create an account to continue", "Menu Shop Blog About", P1, P2].join("\n\n");
  const m = maskNavRegion(text);
  assert.equal(m.text.length, text.length);
  assert.ok(m.masked >= 1);
  assert.ok(!m.text.includes("Sign in"));
  const i = m.text.indexOf(P1); assert.equal(text.slice(i, i + P1.length), P1);
});

test("the parser is tolerant: unclosed tags, stray closers, entities, void elements, comments", () => {
  const html = `<!-- c --><p>one &amp; two<br>three</i></b><p>four &#233; &#x41; &nbsp;five<li>six<li>seven</ul><img src=x><script>ignore("</p>")</script> tail`;
  const t = visibleTextOfHtml(html);
  assert.ok(t.includes("one & two") && t.includes("four é A") && t.includes("five") && t.includes("six") && t.includes("seven") && t.includes("tail"));
  assert.ok(!t.includes("ignore"));
  assert.equal(titleOfHtml("<title> A  B </title>"), "A B");
  assert.ok(parseHtml("<div><p>x").kids.length >= 1);
});

test("tables: a row that shares >= 2 words with the ask is quoted with its header row, verbatim; nothing is computed", () => {
  const html = "<table><tr><th>Team</th><th>Wins</th><th>Losses</th></tr><tr><td>Boston Celtics</td><td>18</td><td>3</td></tr><tr><td>Miami Heat</td><td>2</td><td>4</td></tr></table>";
  const rows = tableRowsOfHtml(html, "How many wins do the Boston Celtics have");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].header, "Team Wins Losses"); assert.equal(rows[0].row, "Boston Celtics 18 3");
  assert.equal(verifyJoined([rows[0].header, rows[0].row], visibleTextOfHtml(html)).ok, true);
  assert.deepEqual(tableRowsOfHtml(html, "Which team leads the standings"), [], "'leads' is a sort the page did, not a sentence: no row is chosen by value");
  assert.deepEqual(tableRowsOfHtml("<table><tr><td>one</td></tr></table>", "one two three"), []);
});

test("code: a <pre> block that shares a word with the ask or the line before it is quoted whole; markup-bearing code is not", () => {
  const html = "<p>Install it with the command:</p><pre>pip install requests\nimport requests</pre><pre>&lt;div&gt;\nhello world greeting here for you&lt;/div&gt;</pre>";
  const c = codeBlocksOfHtml(html, "How do I install requests with pip");
  assert.equal(c.length, 1); assert.equal(c[0].code, "pip install requests\nimport requests");
  assert.deepEqual(codeBlocksOfHtml(html, "hello world greeting"), [], "code holding < or > is left out (it would be mistaken for leaked markup)");
  assert.deepEqual(askTerms("What is the best way to do it?"), ["best", "way"]);
});
