// node --test docs/playback/nav/sitestyle.test.mjs      (no network, no model)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TOKEN_KEYS, FONT_STACKS, parseColor, contrast, toOklch, fromOklch, toHex, fixContrast, classifyFont, parseCss, readHtml,
  firstStylesheetHref, prepare, extractSiteTokens, validateTokens, tokensToVars,
} from "./sitestyle.mjs";
import { typeOf } from "../../../fold-chat-present.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const X = (input, deps = { typeOf }) => extractSiteTokens(input, deps);
const page = (css, extra = "", head = "") => `<!doctype html><html><head>${head}<style>${css}</style></head><body ${extra}>x</body></html>`;
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

test("the token set is exactly the twelve, and every output validates", () => {
  assert.deepEqual(TOKEN_KEYS, ["paper", "ink", "muted", "link", "rule", "accent", "bodyFont", "titleFont", "titleWeight", "titleCase", "measure", "radius"]);
  for (const theme of ["light", "dark"]) for (const html of ["", "<html>", page("body{background:#123456;color:#fedcba}"), page("p{color:red}")]) {
    const { tokens } = X({ html, domain: "example.com", theme });
    assert.deepEqual(Object.keys(tokens).sort(), [...TOKEN_KEYS].sort());
    assert.deepEqual(validateTokens(tokens), []);
  }
});

test("colour parsing: hex, rgb, hsl, names; refuses the rest", () => {
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("#1d2b3a"), { r: 29, g: 43, b: 58, a: 1 });
  assert.equal(parseColor("rgb(10 20 30 / 50%)").a, 0.5);
  assert.equal(Math.round(parseColor("rgb(100%, 0%, 0%)").r), 255);
  assert.equal(toHex(parseColor("hsl(120 100% 25%)")), "#008000");
  assert.equal(toHex(parseColor("Navy")), "#000080");
  for (const bad of ["", "url(x)", "var(--x)", "expression(alert(1))", "#12", "notacolor", "calc(1px)", "x".repeat(200)]) assert.equal(parseColor(bad), null, bad);
});

test("OKLCH round-trips and contrast is WCAG", () => {
  for (const hex of ["#1d4ed8", "#c62828", "#0d7a70", "#fdf0b0", "#202122"]) {
    const c = parseColor(hex), back = fromOklch(toOklch(c));
    assert.ok(Math.abs(back.r - c.r) < 1.2 && Math.abs(back.g - c.g) < 1.2 && Math.abs(back.b - c.b) < 1.2, hex);
  }
  assert.equal(contrast(parseColor("#000"), parseColor("#fff")).toFixed(1), "21.0");
  assert.equal(contrast(parseColor("#777"), parseColor("#fff")).toFixed(2), "4.48");
});

test("contrast: the INK moves, the paper does not; 4.5:1 is a floor", () => {
  // grey ink on a grey paper, both 'designed' to be quiet: contrast ~1.4
  const html = page("body{background:#e8e8e8;color:#cfcfcf}");
  const { tokens, meta } = X({ html, domain: "quiet.example", theme: "light" });
  assert.equal(tokens.paper, "#e8e8e8");                    // paper kept
  assert.ok(contrast(parseColor(tokens.ink), parseColor(tokens.paper)) >= 4.5);
  assert.match(meta.from.ink, /contrast/);
  // the same, fuzzed: 400 random paper/ink pairs, light and dark, never below 4.5 for ink, muted, link
  const r = rng(7);
  const hx = () => "#" + [r(), r(), r()].map((x) => Math.floor(x * 256).toString(16).padStart(2, "0")).join("");
  for (let i = 0; i < 400; i++) {
    const theme = i % 2 ? "dark" : "light";
    const out = X({ html: page(`body{background:${hx()};color:${hx()}}a{color:${hx()}}`), domain: "fuzz.example", theme });
    const p = parseColor(out.tokens.paper);
    for (const k of ["ink", "muted", "link"]) assert.ok(contrast(parseColor(out.tokens[k]), p) >= 4.5 - 1e-6, `${k} ${out.tokens[k]} on ${out.tokens.paper} (${theme})`);
    assert.deepEqual(validateTokens(out.tokens), []);
  }
});

test("paper is clamped for loudness (chroma, lightness band), not for contrast", () => {
  const { tokens } = X({ html: page("body{background:#ff00aa;color:#000}"), domain: "loud.example", theme: "light" });
  const o = toOklch(parseColor(tokens.paper));
  assert.ok(o.C <= 0.061, "chroma " + o.C);
  assert.ok(o.L >= 0.86, "lightness " + o.L);
  const d = X({ html: page("body{background:#ff00aa;color:#000}"), domain: "loud.example", theme: "dark" }).tokens;
  assert.ok(toOklch(parseColor(d.paper)).L <= 0.3);
});

test("never injects site CSS: url(), @import, @font-face and friends leave no trace", () => {
  const evil = `@import url("https://evil.test/x.css"); @import 'https://evil.test/y.css';
    @font-face{font-family:"Evil Face";src:url(https://evil.test/f.woff2)}
    body{background:url(https://evil.test/p.png) #fafafa;color:#222;font-family:"Evil Face",cursive}
    h1{font-family:"Evil Face", Georgia;background-image:url(javascript:alert(1))}
    a{color:expression(alert(1))} :root{--bg:url(https://evil.test/z)} .x{behavior:url(x.htc)}`;
  const { tokens, meta } = X({ html: page(evil), css: [evil], domain: "evil.example", theme: "light" });
  const blob = JSON.stringify(tokens) + tokensToVars(tokens);
  for (const bad of ["url(", "evil", "@import", "@font-face", "javascript", "expression", "Evil Face", "http", "behavior"]) assert.ok(!blob.includes(bad), bad);
  assert.ok(meta.ignored.imports >= 2 && meta.ignored.fontFaces >= 1, "seen and counted, never followed");
  assert.equal(tokens.paper, "#fafafa");                     // the colour in a url()+colour shorthand is still read
  assert.deepEqual(validateTokens(tokens), []);
});

test("fonts: unknown names fall to the nearest generic family; only OUR stacks leave", () => {
  assert.equal(classifyFont('"Merriweather", "Helvetica Neue", serif').cls, "serif");
  assert.equal(classifyFont("'IBM Plex Mono', monospace").cls, "mono");
  assert.equal(classifyFont("Inter, system-ui, sans-serif").cls, "sans");
  assert.equal(classifyFont("-apple-system, BlinkMacSystemFont, sans-serif").cls, "sans");
  assert.equal(classifyFont("system-ui").cls, "system");
  assert.equal(classifyFont('"Totally Unknown Face"'), null);          // nothing to classify -> caller falls back
  assert.equal(classifyFont('"Totally Unknown Face", serif').cls, "serif");
  assert.equal(classifyFont("Linux Libertine, Georgia, Times, serif").stack, FONT_STACKS.serif);
  assert.ok(!/Merriweather|Libertine|Plex/.test(classifyFont('"Merriweather", serif').stack));
  assert.match(classifyFont('"Palatino Linotype", "Zzz", serif').stack, /^"Palatino Linotype", Georgia/);   // OS-installed lead is allowed
  const { tokens } = X({ html: page("body{font-family:'Lora',serif} h1{font-family:'Inter',sans-serif;font-weight:800;text-transform:uppercase}"), domain: "f.example" });
  assert.equal(tokens.bodyFont, FONT_STACKS.serif);
  assert.equal(tokens.titleFont, FONT_STACKS.sans);
  assert.equal(tokens.titleWeight, 800);
  assert.equal(tokens.titleCase, "uppercase");
});

test("nothing usable -> the SITE_TYPE entry for the domain, else neutral", () => {
  const w = X({ html: "<html><body>no css at all</body></html>", domain: "en.wikipedia.org", theme: "light" });
  assert.equal(w.meta.usedFallback, true);
  assert.equal(w.tokens.paper, "#ffffff");
  assert.equal(w.tokens.ink, "#202122");                      // SITE_TYPE['wikipedia.org'].ink
  assert.equal(w.tokens.rule, "#a2a9b1");                     // SITE_TYPE edge
  assert.equal(w.tokens.bodyFont, FONT_STACKS.sans);          // wikipedia body is sans in SITE_TYPE
  assert.equal(w.tokens.titleFont, FONT_STACKS.serif);        // 'Linux Libertine' title -> serif
  const g = X({ html: "", domain: "gutenberg.org", theme: "light" });
  assert.equal(g.tokens.titleCase, "uppercase");              // SITE_TYPE gutenberg
  assert.equal(g.tokens.paper, "#fffffa");
  const n = X({ html: "", domain: "never-heard-of-it.example", theme: "light" });
  assert.equal(n.meta.usedFallback, true);
  assert.deepEqual(validateTokens(n.tokens), []);
  assert.equal(n.tokens.measure, 66);
  const nd = X({ html: "", domain: "never-heard-of-it.example", theme: "dark" }, {});    // no typeOf at all
  assert.equal(nd.meta.scheme, "derived-dark");
  assert.deepEqual(validateTokens(nd.tokens), []);
});

test("app theme: the site's own dark layer wins in dark; otherwise a dark paper derived from the site's hue", () => {
  const css = "body{background:#faf3e0;color:#2b2118} @media (prefers-color-scheme: dark){body{background:#1b1712;color:#e8dcc4}}";
  const l = X({ html: page(css), domain: "d.example", theme: "light" }), d = X({ html: page(css), domain: "d.example", theme: "dark" });
  assert.equal(l.tokens.paper, "#faf3e0");
  assert.equal(d.meta.scheme, "site-dark");
  assert.equal(d.tokens.paper, "#1b1712");
  assert.ok(d.meta.siteHasDark);
  const onlyLight = X({ html: page("body{background:#faf3e0;color:#2b2118}"), domain: "d.example", theme: "dark" });
  assert.equal(onlyLight.meta.scheme, "derived-dark");
  assert.ok(toOklch(parseColor(onlyLight.tokens.paper)).L < 0.25);
  const h = (t) => Math.round(toOklch(parseColor(t.paper)).h);
  assert.ok(Math.abs(h(onlyLight.tokens) - h(l.tokens)) < 12, "keeps the cream/amber hue");     // identity survives the flip
  // class-based dark mode
  const cls = X({ html: page("body{background:#fff;color:#111} html.dark body, [data-theme=dark]{background:#0f1a24;color:#dde}"), domain: "c.example", theme: "dark" });
  assert.equal(cls.tokens.paper, "#0f1a24");
  // a site that is only dark, in a light app
  const dk = X({ html: page("body{background:#1d2b3a;color:#f2ece0}"), domain: "toureiffel.paris", theme: "light" });
  assert.equal(dk.meta.scheme, "derived-light");
  assert.ok(toOklch(parseColor(dk.tokens.paper)).L >= 0.86);
});

test("width media queries are layout, not identity; print is ignored", () => {
  const p = parseCss("@media (min-width:900px){body{background:#ff0000}} @media print{body{background:#00ff00}} @media screen{body{color:#123456}} body{background:#eeeeee}");
  const sels = p.rules.map((r) => r.sel + JSON.stringify(r.decls));
  assert.equal(p.rules.length, 2);
  assert.ok(sels.some((s) => s.includes("#123456")) && sels.some((s) => s.includes("#eeeeee")) && !sels.join().includes("ff0000") && !sels.join().includes("00ff00"));
});

test("custom properties: var() chains, fallbacks, cycles, light-dark()", () => {
  const css = ":root{--paper:#fbfaf5;--text:var(--ink-base);--ink-base:#1c1c1c;--cyc:var(--cyc2);--cyc2:var(--cyc);--link:light-dark(#0645ad,#8ab4ff);--brand:#b3261e} body{background:var(--paper);color:var(--text)} a{color:var(--link)}";
  const l = X({ html: page(css), domain: "v.example", theme: "light" }).tokens;
  assert.equal(l.paper, "#fbfaf5"); assert.equal(l.ink, "#1c1c1c");
  const d = X({ html: page(css), domain: "v.example", theme: "dark" });
  assert.equal(d.tokens.link, "#8ab4ff");
  const noCycle = X({ html: page("body{background:var(--cyc);color:var(--cyc2)} :root{--cyc:var(--cyc2);--cyc2:var(--cyc)}"), domain: "cyc.example" });
  assert.deepEqual(validateTokens(noCycle.tokens), []);               // cycles resolve to nothing, never loop
  const fbk = X({ html: page("body{background:var(--nope,#f0e6d2)}"), domain: "fb.example" });
  assert.equal(fbk.tokens.paper, "#f0e6d2");
  // design-system names, no body rule at all
  const ds = X({ html: page(":root{--color-background-page:#f6f1e7;--color-text-primary:#241f18;--color-border-primary:#cdbfa3;--color-accent:#2a6f4d}"), domain: "ds.example" });
  assert.equal(ds.tokens.paper, "#f6f1e7"); assert.equal(ds.tokens.ink, "#241f18"); assert.equal(ds.tokens.rule, "#cdbfa3");
  assert.ok(ds.meta.from.accent.startsWith("site-var"));
});

test("theme-color becomes the accent (and the paper only when it is a quiet neutral of the right scheme)", () => {
  const a = X({ html: page("p{margin:0}", "", '<meta name="theme-color" content="#b70402">'), domain: "tc.example", theme: "light" });
  assert.equal(a.meta.themeColor, "#b70402");
  assert.ok(toOklch(parseColor(a.tokens.accent)).C > 0.1);
  assert.ok(contrast(parseColor(a.tokens.accent), parseColor(a.tokens.paper)) >= 3);
  const b = X({ html: page("p{margin:0}", "", '<meta name="theme-color" content="#f7f7f2">'), domain: "tc.example", theme: "light" });
  assert.equal(b.tokens.paper, "#f7f7f2"); assert.equal(b.meta.from.paper, "meta-theme-color");
  const c = X({ html: page("p{margin:0}", "", '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#101820"><meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f4ee">'), domain: "tc.example", theme: "dark" });
  assert.equal(c.meta.themeColor, "#101820");
});

test("legacy presentational attributes and inline root styles count", () => {
  const old = '<html><body bgcolor="#faf0d7" text="#330000" link="#990000">hi</body></html>';
  const o = X({ html: old, domain: "old.example" }).tokens;
  const pc = parseColor(o.paper), want = parseColor("#faf0d7");
  assert.ok(Math.abs(pc.r - want.r) <= 2 && Math.abs(pc.g - want.g) <= 2 && Math.abs(pc.b - want.b) <= 2, o.paper);
  assert.ok(contrast(parseColor(o.ink), parseColor(o.paper)) >= 4.5);
  const inl = X({ html: '<html style="background:#102030;color:#eee"><body>x</body></html>', domain: "inl.example", theme: "dark" }).tokens;
  assert.equal(inl.paper, "#102030");
});

test("measure and radius come from the page's text column and buttons, clamped", () => {
  assert.equal(X({ html: page("main{max-width:640px}"), domain: "m.example" }).tokens.measure, 80);   // 640/8 = 80
  assert.equal(X({ html: page("article{max-width:480px}"), domain: "m.example" }).tokens.measure, 60);
  assert.equal(X({ html: page("article{max-width:12000px}"), domain: "m.example" }).tokens.measure, 80);
  assert.equal(X({ html: page(".content{max-width:20px}"), domain: "m.example" }).tokens.measure, 40);
  assert.equal(X({ html: page("body{max-width:60ch}"), domain: "m.example" }).tokens.measure, 60);
  assert.equal(X({ html: page(".btn{border-radius:6px} .card{border-radius:6px} button{border-radius:999px}"), domain: "r.example" }).tokens.radius, 6);
  assert.equal(X({ html: page(".card{border-radius:50px}"), domain: "r.example" }).tokens.radius, 2);   // pills and circles are not a radius
});

test("the first stylesheet's text works the same as an inline <style>", () => {
  const sheet = "body{background:#f5efe0;color:#2a2118;font-family:Charter,'Bitstream Charter',serif} h1,h2{font-family:'Gill Sans',sans-serif;text-transform:uppercase;font-weight:600} a{color:#7a2e12}";
  const viaSheet = X({ html: "<html><head></head><body></body></html>", css: [sheet], domain: "s.example", theme: "light" });
  const viaInline = X({ html: page(sheet), domain: "s.example", theme: "light" });
  assert.deepEqual(viaSheet.tokens, viaInline.tokens);
  assert.equal(viaSheet.tokens.paper, "#f5efe0");
  assert.equal(viaSheet.tokens.titleCase, "uppercase");
  assert.match(viaSheet.tokens.titleFont, /^"Gill Sans"/);
  assert.match(viaSheet.tokens.bodyFont, /^"Charter"/);
  assert.equal(viaSheet.meta.found >= 6, true);
});

test("which stylesheet to fetch: the first screen stylesheet over https, resolved against the page", () => {
  const html = '<link rel="preload" href="/a.css"><link rel="stylesheet" media="print" href="/p.css"><link rel="stylesheet" href="/s/main.css?v=3"><link rel="stylesheet" href="/two.css">';
  assert.equal(firstStylesheetHref(html, "https://example.org/a/b"), "https://example.org/s/main.css?v=3");
  assert.equal(firstStylesheetHref('<link rel="stylesheet" href="http://insecure.test/x.css">', "https://example.org/"), null);
  assert.equal(firstStylesheetHref("<p>none</p>", "https://example.org/"), null);
});

test("prepare() once, decide per theme: same answer as the one-shot call", () => {
  const html = page("body{background:#faf3e0;color:#2b2118} @media (prefers-color-scheme: dark){body{background:#1b1712;color:#e8dcc4}}", "", '<meta name="theme-color" content="#b3261e">');
  const prepared = prepare({ html });
  for (const theme of ["light", "dark"]) assert.deepEqual(X({ html: "", prepared, domain: "p.example", theme }), X({ html, domain: "p.example", theme }));
});

test("the gate: tampered tokens are refused and never become CSS", () => {
  const { tokens } = X({ html: page("body{background:#fff;color:#111}"), domain: "g.example" });
  assert.match(tokensToVars(tokens), /^--s-paper:#ffffff;/);
  for (const [k, v] of [["paper", "url(x)"], ["ink", "red"], ["bodyFont", "Evil, serif"], ["titleFont", `${FONT_STACKS.serif}; background:url(x)`], ["measure", 500], ["radius", 99], ["titleCase", "x"], ["titleWeight", 123]]) {
    const bad = { ...tokens, [k]: v };
    assert.notDeepEqual(validateTokens(bad), [], k);
    assert.throws(() => tokensToVars(bad), /unsafe tokens/);
  }
  assert.notDeepEqual(validateTokens({ ...tokens, extra: 1 }), []);
  assert.notDeepEqual(validateTokens({ ...tokens, ink: tokens.paper }), []);       // 1:1 contrast is refused
});

test("hostile or huge input neither throws nor stalls", () => {
  const r = rng(99), junk = () => Array.from({ length: 4000 }, () => String.fromCharCode(32 + Math.floor(r() * 94))).join("");
  for (let i = 0; i < 40; i++) { const j = junk(); assert.doesNotThrow(() => X({ html: "<style>" + j + "</style><body " + j.slice(0, 200) + ">", css: [j], domain: "j.example", theme: i % 2 ? "dark" : "light" })); }
  assert.doesNotThrow(() => X({ html: "<style>{{{{{{{{{{{{{{{{{{{{{{{{{</style>", css: ["}}}}}}}}{{{{;;;;;:::::((((("], domain: "j.example" }));
  const big = ("a{color:#123456}\n").repeat(2_000_000);                       // ~32 MB
  const t0 = Date.now(); const out = X({ html: page(big), css: [big], domain: "big.example" });
  assert.ok(Date.now() - t0 < 3000, "capped, not read to the end");
  assert.deepEqual(validateTokens(out.tokens), []);
  assert.deepEqual(validateTokens(X({ html: null, css: null, domain: null, theme: "mauve" }).tokens), []);
});

test("readHtml: style blocks, metas, root attributes; print styles skipped", () => {
  const h = readHtml('<html lang="en"><head><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#ffffff"><style media="print">a{}</style><style>b{}</style></head><body class="x" style="color:red" bgcolor="#eee">', "light");
  assert.equal(h.styles.length, 1); assert.equal(h.colorScheme, "light dark"); assert.equal(h.bodyStyle, "color:red"); assert.equal(h.bodyAttrs.bgcolor, "#eee");
});

// ---------------------------------------------------------------- REAL cached pages (skipped where the cache is absent)
const CACHE = path.join(ROOT, "eval/snips/cache");
const REAL = {
  "www.nhs.uk": "0d580599812ebc2c52fef8efa30dc875269b60a9", "www.wikihow.com": "df235667ec172b59c2fcb6f58271275a31e2a411", "github.com": "a5f7792f904956a38a6ae491efda510a6cc39d2e",
  "www.bbc.com": "3e4b592a53bab4fb217bd176da8090f72fea9e46", "en.wikipedia.org": "1dbcd8016f8698b712704e701563271d6493fa16", "stackoverflow.com": "23ee1e4c651c2dc50b48c43a3457d419a34b4214",
  "www.usatoday.com": "d07d44754f43727410ba84d70527ea957fc7a173", "docs.python.org": "d9f5f45c3a1dc98f9d9fac3ac8231e3ed5f77d78", "www.nobelprize.org": "12abdf0ee343021fa068271df472df5dd9fa0844",
  "www.w3schools.com": "a2c600d42fb3857cff1f73c160559d6a6b21d9f5", "www.britannica.com": "e97d020790b53b24f4cfbfeb7eae8460595b8aae", "developer.mozilla.org": "72145d63059d7bb67a301c43bbc0db33ee0b30e5",
};
const real = (host) => { const f = path.join(CACHE, REAL[host] + ".body"); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };

test("real pages: every site, both themes, validates and clears 4.5:1", { skip: !real("www.nhs.uk") && "eval/snips/cache not present" }, () => {
  for (const host of Object.keys(REAL)) for (const theme of ["light", "dark"]) {
    const html = real(host); if (!html) continue;
    const { tokens, meta } = X({ html, domain: host.replace(/^www\./, ""), theme });
    assert.deepEqual(validateTokens(tokens), [], host + " " + theme);
    assert.ok(meta.contrast.ink >= 4.5 && meta.contrast.link >= 4.5, host);
  }
});

test("real pages: what the page itself says is what we read (NHS paper+ink+font, wikiHow palette, GitHub dark, BBC red)", { skip: !real("www.nhs.uk") && "eval/snips/cache not present" }, () => {
  const nhs = X({ html: real("www.nhs.uk"), domain: "nhs.uk" });
  assert.equal(nhs.tokens.paper, "#f0f4f5"); assert.equal(nhs.tokens.ink, "#212b32"); assert.equal(nhs.meta.from.paper, "site-css");
  assert.match(nhs.tokens.bodyFont, /Arial/);
  const how = X({ html: real("www.wikihow.com"), domain: "wikihow.com" });
  assert.ok(how.meta.found >= 5, "wikiHow has real identity inline");
  assert.notEqual(how.tokens.paper, "#ffffff");
  const gh = X({ html: real("github.com"), domain: "github.com", theme: "dark" });
  assert.equal(gh.meta.colorScheme && gh.meta.colorScheme.includes("dark"), true);
  const bbc = X({ html: real("www.bbc.com"), domain: "bbc.com" });
  assert.ok(toOklch(parseColor(bbc.tokens.accent)).C > 0.1, "BBC's theme-color is red");
  const wp = X({ html: real("en.wikipedia.org"), domain: "en.wikipedia.org" });
  assert.equal(wp.tokens.ink, "#202122"); assert.equal(wp.tokens.titleFont, FONT_STACKS.serif);      // from SITE_TYPE: Vector's sheet is linked, not inline
  assert.equal(wp.meta.from.titleFont.startsWith("site-type"), true);
});

test("real pages: different sites really do get different looks", { skip: !real("www.nhs.uk") && "eval/snips/cache not present" }, () => {
  const looks = new Set();
  for (const host of Object.keys(REAL)) { const html = real(host); if (!html) continue; const t = X({ html, domain: host.replace(/^www\./, "") }).tokens; looks.add([t.paper, t.accent, t.bodyFont, t.titleCase, t.titleWeight].join("|")); }
  assert.ok(looks.size >= 7, "distinct looks from inline css + metas alone: " + looks.size);   // honest floor: Wikipedia, Britannica, MDN, python.org keep their sheets in linked files
});
