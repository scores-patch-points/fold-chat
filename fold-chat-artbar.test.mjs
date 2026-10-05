import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
const rule = (sel) => { const m = css.match(new RegExp("\\n\\s*" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}")); return m ? m[1] : ""; };

test("preview bar: labels never break across lines, and the bar wraps its controls as a group (2026-10-05: 'collaps/e', 'cop/y' at phone width)", () => {
  assert.match(rule(".art-btn"), /white-space:\s*nowrap/);
  assert.match(rule(".art-btn"), /flex:\s*none/);
  assert.match(rule(".art-kind"), /white-space:\s*nowrap/);
  assert.match(rule(".art-bar"), /flex-wrap:\s*wrap/);
  assert.match(rule(".art-title"), /text-overflow:\s*ellipsis/);
  assert.match(rule(".art-acts"), /margin-left:\s*auto/);
});

test("renderArtifact puts collapse, copy and iterate in one `.art-acts` group (not loose in the bar)", () => {
  const fn = app.slice(app.indexOf("function renderArtifact"), app.indexOf("function renderArtifact") + 2600);
  assert.match(fn, /const acts = el\("span", "art-acts"\)/);
  assert.match(fn, /acts\.append\(fold, copy\)/);
  assert.match(fn, /acts\.append\(iterate\)/);
  assert.doesNotMatch(fn, /bar\.append\(fold, copy\)/);
});
