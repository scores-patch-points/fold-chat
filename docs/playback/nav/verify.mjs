// verify.mjs — drives each stacking model with REAL taps/clicks (Playwright, headless, own context; no model, no network) and writes shots/verify.json
//   node docs/playback/nav/verify.mjs [a-sheets b-push c-zoom d-split]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
let chromium; try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs")); }
const HERE = path.dirname(fileURLToPath(import.meta.url)); const OUT = path.join(HERE, "shots"); fs.mkdirSync(OUT, { recursive: true });
const models = process.argv.slice(2).length ? process.argv.slice(2) : ["a-sheets", "b-push", "c-zoom", "d-split"];
const VPS = [{ name: "375", w: 375, h: 812, touch: true }, { name: "1200", w: 1200, h: 800, touch: false }];
const results = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function state(page) {
  return page.evaluate(() => {
    const N = window.Nav, d = N.stack.length, vh = innerHeight, vw = innerWidth;
    const top = N.stack[d - 1], tel = top ? N.layerEl(top) : null;
    const pill = document.getElementById("ret").getBoundingClientRect(), pillVisible = d > 0 && getComputedStyle(document.getElementById("ret")).visibility !== "hidden";
    let content = null;
    if (tel) { const r = tel.querySelector(".l-body").getBoundingClientRect(); const x0 = Math.max(r.left, 0), x1 = Math.min(r.right, vw), y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, vh); content = { w: Math.round(x1 - x0), h: Math.round(y1 - y0), x: Math.round(x0), y: Math.round(y0) }; }
    const chrome = [...document.querySelectorAll("[data-chrome]")].filter((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.visibility !== "hidden" && cs.display !== "none" && r.width > 0 && r.height > 0 && !(e.closest("[inert]") && e.dataset.chrome === "app" && false); }).map((e) => { const r = e.getBoundingClientRect(); return { kind: e.dataset.chrome, h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top) }; });
    const ae = document.activeElement; const nonInert = [...document.querySelectorAll("#layers > .layer")].filter((n) => !n.inert).length;
    return { depth: d, hash: location.hash, histLen: history.length, stateDepth: history.state && history.state.stack ? history.state.stack.length : null, vh, vw,
      pill: pillVisible ? { x: Math.round(pill.left), bottomGap: Math.round(vh - pill.bottom), w: Math.round(pill.width), h: Math.round(pill.height) } : null, content, chrome,
      focus: ae ? (ae.tagName + (ae.id ? "#" + ae.id : "") + (ae.className && typeof ae.className === "string" ? "." + ae.className.split(" ")[0] : "")) : null,
      focusInTop: !!(tel && ae && tel.contains(ae)), appInert: document.getElementById("app").inert, layersNonInert: nonInert, chatScroll: Math.round(document.getElementById("chat").scrollTop),
      live: document.getElementById("live").textContent, bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
}
const sumChrome = (s) => { // vertical px not given to the top layer's content (permanent chrome) and the floating pill separately
  const contentH = s.content ? s.content.h : s.vh; const lost = Math.max(0, s.vh - contentH); return { contentH, lostPx: lost, lostPct: +((lost / s.vh) * 100).toFixed(1), contentW: s.content ? s.content.w : s.vw };
};

for (const file of models) {
  results[file] = {};
  const browser = await chromium.launch();
  for (const vp of VPS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, isMobile: vp.touch, colorScheme: "light", deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    const R = { steps: [], errors: errs };
    const url = pathToFileURL(path.join(HERE, file + ".html")).href;
    await page.goto(url); await page.waitForFunction(() => window.__ready); await wait(300);
    const tap = async (loc) => { await loc.scrollIntoViewIfNeeded(); if (vp.touch) await loc.tap(); else await loc.click(); await wait(560); };
    // put the nosebleed turn in view, remember the chat scroll
    await page.evaluate(() => { const c = document.getElementById("chat"); c.scrollTop = document.getElementById("turn-nose").offsetTop - 60; });
    await wait(100); const s0 = await state(page); const chat0 = s0.chatScroll; R.chatScrollBefore = chat0;
    const rec = async (name, extra = {}) => { const s = await state(page); R.steps.push({ name, ...s, ...sumChrome(s), ...extra }); return s; };
    await rec("0 chat");
    // 1 evidence card
    await tap(page.locator('#turn-nose .mark[data-claim="1"]')); await rec("1 evidence card");
    if (vp.name === "375" || true) await page.screenshot({ path: path.join(OUT, `${file}-${vp.name}-light-d1.png`) });
    // 2 passage
    await tap(page.locator('#layers .layer[data-k="c"] .ev').first()); await rec("2 passage (NHS)");
    // 3 whole page
    await tap(page.locator('#layers .layer[data-k="p"] button.btn.go')); await rec("3 page as kept");
    await page.screenshot({ path: path.join(OUT, `${file}-${vp.name}-light-d3.png`) });
    // scroll the page layer, to prove position survives a deeper trip
    const pageScroll = await page.evaluate(() => { const n = window.Nav.layerEl(window.Nav.stack[2]); n._body.scrollTop = 120; return n._body.scrollTop; }); R.pageScrollSet = pageScroll;
    // 4 entity
    await tap(page.locator('#layers .layer[data-k="g"] .nm').first()); await rec("4 name -> other places");
    // 5 other site's passage
    await tap(page.locator('#layers .layer[data-k="e"] .e-grp', { hasText: "wikiHow" }).locator(".ev").first()); await rec("5 passage (wikiHow)");
    await page.screenshot({ path: path.join(OUT, `${file}-${vp.name}-light-d5.png`) });
    // 6 the site
    await tap(page.locator('#layers .layer[data-k="p"]').last().locator("button.btn", { hasText: "The site" })); await rec("6 source site");
    await page.screenshot({ path: path.join(OUT, `${file}-${vp.name}-light-d6.png`) });
    // ----- coming back
    await page.keyboard.press("Escape"); await wait(600); const e1 = await rec("Esc -> 5");
    await page.goBack(); await wait(600); const e2 = await rec("history.back -> 4");
    const backBtn = page.locator("#ret .rb"); await (vp.touch ? backBtn.tap() : backBtn.click()); await wait(600); const e3 = await rec("pill back -> 3");
    const pageScrollAfter = await page.evaluate(() => window.Nav.layerEl(window.Nav.stack[2])._body.scrollTop); R.pageScrollAfter = pageScrollAfter;
    await page.goForward(); await wait(600); await rec("history.forward -> 4");
    // one tap from anywhere: Chat
    const chatBtn = page.locator("#ret .rc"); await (vp.touch ? chatBtn.tap() : chatBtn.click()); await wait(800); const home = await rec("pill Chat -> 0");
    R.chatScrollAfter = home.chatScroll; R.homeFocus = home.focus;
    R.markPop = await page.evaluate(() => !!document.querySelector("#turn-nose .mark.pop, #turn-nose .mark:focus"));
    // the phone's Back never leaves the app while layers are open: walk the whole stack with history.back
    await tap(page.locator('#turn-nose .mark[data-claim="0"]')); await tap(page.locator('#layers .layer[data-k="c"] .ev').first()); await tap(page.locator('#layers .layer[data-k="p"] button.btn.go'));
    const deep = await state(page); const urlBefore = page.url().split("#")[0];
    for (let i = 0; i < 3; i++) { await page.goBack(); await wait(550); }
    const afterBacks = await state(page); R.backWalk = { depthBefore: deep.depth, depthAfter: afterBacks.depth, sameDocument: page.url().split("#")[0] === urlBefore, hash: afterBacks.hash };
    // cold deep link: Back must walk it one layer at a time
    const deepHash = "#/c~nose~1/p~nose~0~7/g~nose~0~7/e~nose~blood%20vessels/p~nose~1~8";
    await page.goto("about:blank"); await page.goto(url + deepHash); await page.waitForFunction(() => window.__ready); await wait(300); const cold = await state(page);
    await page.goBack(); await wait(550); const cold2 = await state(page);
    R.cold = { depth: cold.depth, histLen: cold.histLen, afterBack: cold2.depth };
    // keyboard: open a mark with Enter, Escape closes and focus returns
    await page.goto(url); await page.waitForFunction(() => window.__ready); await wait(200);
    await page.evaluate(() => { document.getElementById("turn-curie").querySelector(".mark").focus(); }); await page.keyboard.press("Enter"); await wait(600);
    const kOpen = await state(page); await page.keyboard.press("Escape"); await wait(650); const kClose = await state(page);
    R.keyboard = { openedDepth: kOpen.depth, focusInTop: kOpen.focusInTop, closedDepth: kClose.depth, focusBack: kClose.focus };

    // ----- model-specific gestures
    await page.goto("about:blank"); await page.goto(url + "#/c~nose~1/p~nose~0~7"); await page.waitForFunction(() => window.__ready); await wait(300);
    const G = {};
    if (file === "a-sheets" || (file === "d-split" && vp.name === "375")) {
      const top0 = await page.evaluate(() => window.Nav.layerEl(window.Nav.stack[1]).getBoundingClientRect().top);
      await page.mouse.click(vp.w / 2 + 40, top0 + 24); await wait(600);
      const top1 = await page.evaluate(() => window.Nav.layerEl(window.Nav.stack[1]).getBoundingClientRect().top);
      G.detentTap = { fullTop: Math.round(top0), afterTapTop: Math.round(top1), half: top1 > vp.h * 0.4 };
      await page.mouse.move(vp.w / 2 + 40, top1 + 24); await page.mouse.down(); await page.mouse.move(vp.w / 2 + 40, top1 + 140, { steps: 6 }); await page.mouse.move(vp.w / 2 + 40, top1 + 260, { steps: 6 }); await page.mouse.up(); await wait(700);
      G.dragDown = { depthAfter: (await state(page)).depth };
    }
    if (file === "b-push") {
      await page.mouse.move(8, 300); await page.mouse.down(); await page.mouse.move(120, 300, { steps: 5 }); await page.mouse.move(Math.round(vp.w * 0.62), 300, { steps: 5 }); await page.mouse.up(); await wait(700);
      G.edgeSwipe = { depthAfter: (await state(page)).depth };
      await page.mouse.move(8, 300); await page.mouse.down(); await page.mouse.move(60, 300, { steps: 4 }); await page.mouse.move(20, 300, { steps: 4 }); await page.mouse.up(); await wait(500);
      G.shortSwipeCancels = { depthAfter: (await state(page)).depth };
    }
    if (file === "c-zoom") {
      await page.evaluate(() => { const r = document.getElementById("layers"); const mk = (id, x, y, type) => new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true }); r.dispatchEvent(mk(1, 100, 400, "pointerdown")); r.dispatchEvent(mk(2, 280, 400, "pointerdown")); r.dispatchEvent(mk(1, 150, 400, "pointermove")); r.dispatchEvent(mk(2, 230, 400, "pointermove")); r.dispatchEvent(mk(1, 160, 400, "pointerup")); r.dispatchEvent(mk(2, 220, 400, "pointerup")); }); await wait(700);
      G.pinchIn = { depthAfter: (await state(page)).depth };
      await page.evaluate(() => window.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: 120, cancelable: true, bubbles: true }))); await wait(700);
      G.ctrlWheel = { depthAfter: (await state(page)).depth };
      const mid = [];
      await page.goto("about:blank"); await page.goto(url); await page.waitForFunction(() => window.__ready); await wait(200);
      await page.evaluate(() => { const c = document.getElementById("chat"); c.scrollTop = document.getElementById("turn-nose").offsetTop - 60; }); await wait(100);
      const mk = page.locator('#turn-nose .mark[data-claim="1"]'); const before = await mk.boundingBox();
      await (vp.touch ? mk.tap() : mk.click()); await wait(700); await page.goBack(); await wait(900);
      const after = await mk.boundingBox(); G.returnsToSameRect = { before: before && { x: Math.round(before.x), y: Math.round(before.y) }, after: after && { x: Math.round(after.x), y: Math.round(after.y) } };
    }
    if (file === "d-split" && vp.name === "1200") {
      await page.goto("about:blank"); await page.goto(url + "#/c~nose~1/p~nose~0~7/g~nose~0~7"); await page.waitForFunction(() => window.__ready); await wait(300);
      await page.locator("#dsp button").first().click(); await wait(600); G.spineJump = { depthAfter: (await state(page)).depth };
      await page.goto("about:blank"); await page.goto(url + "#/c~nose~1/p~nose~0~7/g~nose~0~7"); await page.waitForFunction(() => window.__ready); await wait(300);
      await page.locator('#turn-curie .mark[data-claim="0"]').click(); await wait(700); const swapped = await state(page);
      await page.goBack(); await wait(700); const restored = await state(page);
      G.chatTapReplacesStack = { depthAfterTap: swapped.depth, hash: swapped.hash, backRestoresDepth: restored.depth };
    }
    R.gestures = G;
    R.overflowX = R.steps.some((s) => s.bodyOverflow);
    results[file][vp.name] = R; await ctx.close();
  }
  await browser.close();
}
fs.writeFileSync(path.join(OUT, "verify.json"), JSON.stringify(results, null, 1));
for (const [f, byVp] of Object.entries(results)) for (const [v, R] of Object.entries(byVp)) {
  console.log(`\n== ${f} @${v}  errors=${R.errors.length}${R.errors.length ? " " + R.errors.slice(0, 2).join(" | ") : ""}`);
  for (const s of R.steps) console.log(`  ${s.name.padEnd(26)} depth ${s.depth} hist ${s.histLen} content ${s.contentW}x${s.contentH} lost ${s.lostPx}px (${s.lostPct}%) pill ${s.pill ? s.pill.x + "," + s.pill.bottomGap + " " + s.pill.w + "w" : "-"} focusInTop ${s.focusInTop} inertApp ${s.appInert} nonInertLayers ${s.layersNonInert}`);
  console.log("  chat scroll", R.chatScrollBefore, "->", R.chatScrollAfter, "| page layer scroll", R.pageScrollSet, "->", R.pageScrollAfter, "| back walk", JSON.stringify(R.backWalk), "| cold", JSON.stringify(R.cold), "| kbd", JSON.stringify(R.keyboard), "| markPop", R.markPop, "\n  gestures", JSON.stringify(R.gestures));
}
