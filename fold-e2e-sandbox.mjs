// fold-e2e-sandbox.mjs — the agent's eyes, in a REAL browser: does the sandbox observer give the right verdict, fast?
//   node fold-e2e-sandbox.mjs        (needs the app served on :8814 and Playwright chromium)
// Regression for the 2026-10-05 bug: a hidden/off-screen cross-origin frame has its timers throttled to ~1/s, so every
// click step cost a second, a 12-button page took >13s, and good pages were reported as "never finished loading".
import { chromium } from "/private/tmp/fold-e2e/node_modules/playwright/index.mjs";
const URL = process.env.FOLD_URL || "http://127.0.0.1:8814/";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(URL + "experiments/scoped-edit/report.html", { waitUntil: "domcontentloaded" });   // any same-origin page will do
const out = await page.evaluate(async () => {
  const m = await import("/fold-chat-sandbox.js?" + Date.now());
  const time = async (html, o = {}) => { const t0 = Date.now(); const r = await m.observeArtifact(html, { kind: "html", ...o }); return { ms: Date.now() - t0, ...r }; };
  const btns = (n) => Array.from({ length: n }, (_, i) => `<button onclick="this.textContent='x${i}'">b${i}</button>`).join("");
  return {
    counter: await time('<!doctype html><title>Counter</title><div id=d>0</div><button id=i>Increment</button><button id=r>Reset</button><script>var n=0;i.onclick=function(){d.textContent=++n};r.onclick=function(){d.textContent=n=0}<\/script>'),
    twelve: await time("<!doctype html><title>m</title>" + btns(12)),
    blockedResource: await time('<!doctype html><title>t</title><button onclick="document.title=1">Go</button><img src="http://10.255.255.1/never.png">', { timeoutMs: 9000 }),
    syntaxError: await time("<!doctype html><button>x</button><script>function (</script>"),
    loadError: await time("<!doctype html><button>x</button><script>nope.foo()</script>"),
    clickError: await time('<!doctype html><button onclick="undefinedFn()">Boom</button>'),
    blank: await time("<!doctype html><html><body></body></html>"),
    script: await time("const a = 1; a.b.c;", { kind: "js" }),
    moduleOk: await time("export function slugify(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }\nexport default slugify;", { kind: "js" }),
    moduleBad: await time("export function f() { return nope.x; }\nf();", { kind: "js" }),
  };
});
// A tab in the background cannot run the test frame: silence there must not be judged a hang. Mute the probe's messages,
// pretend the tab is hidden, and watch the verdict wait for it to be shown.
const bg = await page.evaluate(async () => {
  const m = await import("/fold-chat-sandbox.js?" + Date.now());
  const mute = (e) => { if (e.data && e.data.__foldprobe) e.stopImmediatePropagation(); };
  window.addEventListener("message", mute, true);
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  let settled = null; const t0 = Date.now();
  const p = m.observeArtifact("<!doctype html><button>x</button>", { kind: "html", timeoutMs: 600 }).then((r) => { settled = { ms: Date.now() - t0, r }; });
  await new Promise((r) => setTimeout(r, 1800));
  const whileHidden = settled === null;
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
  await p;
  window.removeEventListener("message", mute, true);
  return { whileHidden, afterShown: settled.ms - 1800, never: settled.r.checks.find((c) => c.name === "loads without errors") };
});
await browser.close();
const R = [];
const check = (name, ok, ev) => { R.push(ok); console.log(`${ok ? "✔ stands " : "✘ FALSIFIED"} — ${name}\n    ${ev}`); };
const name = (r, n) => r.checks.find((c) => c.name === n);
check("a good 2-button page is judged clean and fast (< 2.5s)", out.counter.ms < 2500 && out.counter.facts.loaded && out.counter.facts.controls === 2 && out.counter.facts.loadErrors.length === 0 && name(out.counter, "controls respond").ok === true, `${out.counter.ms}ms · controls=${out.counter.facts.controls} · changed=${out.counter.facts.changed}`);
check("a 12-button page is clicked through in < 4s (was > 13s under throttling)", out.twelve.ms < 4000 && out.twelve.facts.clicked === 12 && out.twelve.facts.changed === 12, `${out.twelve.ms}ms · clicked=${out.twelve.facts.clicked} · changed=${out.twelve.facts.changed}`);
check("a page held up by a blocked external resource is NOT reported as hung", out.blockedResource.facts.loaded && out.blockedResource.facts.controls === 1 && name(out.blockedResource, "loads without errors").ok === true, `${out.blockedResource.ms}ms · loaded=${out.blockedResource.facts.loaded}`);
check("a syntax error is caught as a load error, with its message", out.syntaxError.facts.loadErrors.length >= 1 && /syntax|unexpected/i.test(out.syntaxError.facts.loadErrors[0].message), JSON.stringify(out.syntaxError.facts.loadErrors[0]));
check("errors are reported on the MODEL's line numbers, not the probe's (a script on line 1 says line 1)", out.syntaxError.facts.loadErrors[0].line === 1 && out.script.facts.loadErrors[0].line === 1, `html line=${out.syntaxError.facts.loadErrors[0].line} · script line=${out.script.facts.loadErrors[0].line}`);
check("a runtime error at load is caught", out.loadError.facts.loadErrors.length >= 1 && /nope/i.test(out.loadError.facts.loadErrors[0].message), JSON.stringify(out.loadError.facts.loadErrors[0]));
check("a click that throws is caught as a CLICK error, not a load error", out.clickError.facts.clickErrors.length >= 1 && out.clickError.facts.loadErrors.length === 0 && name(out.clickError, "controls respond").ok === false, JSON.stringify(out.clickError.facts.clickErrors[0]));
check("a blank page is reported blank", out.blank.facts.rendered === false && name(out.blank, "renders something visible").ok === false, JSON.stringify(out.blank.facts));
check("a bare script that throws is caught", out.script.facts.loadErrors.length >= 1, JSON.stringify(out.script.facts.loadErrors[0]));
check("a tab in the background is NOT judged a hang: the verdict waits until it is shown, then runs its own clock", bg.whileHidden && bg.afterShown >= 400 && bg.never && bg.never.ok === false, JSON.stringify(bg));
check("a MODULE (export/import) is run as a module — `export` is not a syntax error — and a function that draws nothing is not 'blank'", out.moduleOk.facts.loaded && out.moduleOk.facts.loadErrors.length === 0 && !out.moduleOk.checks.some((c) => c.ok === false) && !out.moduleOk.checks.some((c) => c.name === "renders something visible"), JSON.stringify(out.moduleOk.checks));
check("…but a module that really throws is still caught", out.moduleBad.facts.loadErrors.length >= 1 && /nope/i.test(out.moduleBad.facts.loadErrors[0].message), JSON.stringify(out.moduleBad.facts.loadErrors[0]));
console.log(`\n${R.filter(Boolean).length}/${R.length} stand`);
process.exit(R.every(Boolean) ? 0 : 1);
