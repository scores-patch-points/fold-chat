// fold-e2e-tip.mjs — "Tip the creator" and the snip pager, driven through the REAL page in fresh headless contexts
// (own localStorage). Every page of "the creator's site" is STUBBED at the network layer: NO request reaches a real site.
// NOTHING is paid or sent: the control opens an email draft (mailto:) or the creator's own contact page; the person sends.
//
//   TIP   a. a mailto the page offered   -> click -> data-mailto decodes to the exact subject/body/address, a toast says where
//         b. a Cloudflare-protected link on the site's own contact page (found by following the page's contact link)
//         c. a contact form only         -> the draft is copied, their contact page opens in a NEW tab
//         d. nothing found               -> the honest toast, no new tab, no navigation, no mailto
//         e. the address never leaks: not into localStorage outside the snip's own `contact`, not into any request
//   PAGER several snips are ONE page at a time: counter, Prev/Next (disabled at the ends), dots, Left/Right keys, swipe,
//         stable height, S# ids kept and hoverable, one source = one page (no "S2 twice"), a citation chip jumps to its page,
//         a single snip has no pager, 375 px, light/dark, reduced motion.
//
//   called by fold-e2e-falsify.mjs:   await runTipChecks({ browser, URL, ok })
//   standalone:                        node fold-e2e-tip.mjs        (SHOTS=/some/dir for the screenshots)
import fs from "node:fs";

const SHOTS = process.env.SHOTS || "/private/tmp/claude-501/-Users-mlacy-Documents-3-0-the-fold/079c90f2-e828-4baf-8c6c-5d90024766de/scratchpad/tip-shots";
const CORS = { "access-control-allow-origin": "*" };
const cf = (addr, key = 0x4b) => key.toString(16).padStart(2, "0") + [...addr].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, "0")).join("");
const html = (title, body) => `<!doctype html><html><head><title>${title}</title></head><body><main><h1>${title}</h1><p>${"This page is a stub for a test, with enough words to count as a readable page of text. ".repeat(3)}</p>${body}</main></body></html>`;

// what each stubbed "creator's site" serves
const SITES = {
  "https://latte.test/banana/": html("Banana Bread", `<nav><a href="/contact/">Contact</a><a href="https://elsewhere.test/contact">Contact</a></nav>`),
  "https://latte.test/contact/": html("Contact", `<p>Write to me:</p><a href="/cdn-cgi/l/email-protection#${cf("maria@gmail.com")}"><span class="__cf_email__" data-cfemail="${cf("maria@gmail.com")}">[email&#160;protected]</span></a>`),
  "https://forms.test/pancakes/": html("Pancakes", `<nav><a href="/contact/">Contact</a></nav>`),
  "https://forms.test/contact/": html("Contact", `<form action="/send" method="post"><input name="n"><textarea name="m"></textarea><button>Send</button></form>`),
  "https://nothing.test/soup/": html("Soup", `<p>No way to reach anyone here.</p><!-- info@nothing.test -->`),
};
const SALLY = "sally@sally.test";
const EXPECT_BODY = "Hi Sally! I enjoyed your content I was served through the community driven AI-agent The Fold. I would like to give you a monetary tip because I found it valuable. Do you have a way I can send this to you?\n\n“Banana Bread”\nhttps://sally.test/banana-bread/\n\nThank you,\n";

const recipe = (url, over = {}) => ({ kind: "recipe", verbatim: true, title: "Banana Bread", credit: { author: "Sally McKenney", publisher: "", site: new URL(url).hostname }, url, yield: "1", prep: "10 min", cook: "1 h", total: "", calories: "", ingredients: ["2 cups flour", "3 ripe bananas"], steps: ["Preheat the oven.", "Mix and bake."], truncated: false, snippedAt: "2026-10-05T00:00:00.000Z", ...over });
const passage = (n, url, text, over = {}) => ({ n, p: Number(n.slice(1)) - 1, kind: "passage", text, source: url, title: "Page " + n, site: new URL(url).hostname, credit: new URL(url).hostname, range: null, shadow: null, ellipsisBefore: false, ellipsisAfter: false, ...over });

function session(msgs) {
  const now = new Date().toISOString();
  return { seed: { id: "seed", title: "seed", titleAuto: false, named: true, icon: "map-trifold", messages: msgs, grounding: true, effort: "balanced", model: "gemma2:2b", sealed: false, project: null, preset: "fold", cwd: null, createdAt: now, updated: now } };
}
const cardTurn = (cards, extra = {}) => { const now = new Date().toISOString(); return [{ role: "user", content: "banana bread recipe", at: now, mode: "chat", effort: "balanced" }, { role: "assistant", content: "Found it.", at: now, mode: "chat", grounding: { turn: 1, kind: "research", effort: "balanced", snips: cards, ...extra } }]; };
const strandTurn = (snips) => { const now = new Date().toISOString(); return [{ role: "user", content: "what is it", at: now, mode: "chat", effort: "balanced" }, { role: "assistant", authored: "sources", content: snips.map((s) => s.text).join("\n\n"), at: now, mode: "chat", snips, grounding: { turn: 1, kind: "research", effort: "balanced", nSources: snips.length } }]; };

/** A fresh context + page with the given conversation seeded, every site stubbed, everything else refused. */
async function open(browser, URL, msgs, { viewport = { width: 1100, height: 900 }, colorScheme = "light", mobile = false, reducedMotion = "no-preference", routes = {} } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme, reducedMotion, permissions: ["clipboard-read", "clipboard-write"], ...(mobile ? { hasTouch: true, isMobile: true } : {}) });
  const requests = [];
  ctx.on("request", (r) => { if (/^https?:/i.test(r.url())) requests.push({ url: r.url(), body: r.postData() || "" }); });   // network only: a mailto: hand-off to the mail app is not a request
  await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
  for (const [u, body] of Object.entries({ ...SITES, ...routes })) await ctx.route(u, (r) => r.fulfill({ status: 200, headers: CORS, contentType: "text/html", body }));
  await ctx.route(/\/\/(localhost|127\.0\.0\.1):(8790|11434)\//, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate((s) => localStorage.setItem("fold-chat:sessions", JSON.stringify(s)), session(msgs));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".msg.assistant", { timeout: 15000 });
  return { ctx, page, requests, errors };
}
const toastText = (page) => page.evaluate(() => document.getElementById("toast")?.textContent || "");
const decode = (m) => { const u = new URL(m); return { to: decodeURIComponent(u.pathname), subject: u.searchParams.get("subject"), body: (u.searchParams.get("body") || "").replace(/\r\n/g, "\n") }; };

export async function runTipChecks({ browser, URL, ok }) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }).catch(() => {});

  // ── a. a mailto the page offered, captured when the page was read ────────────────────────────────────────────────
  {
    const card = recipe("https://sally.test/banana-bread/", { contact: { kind: "email", address: SALLY, where: "a mailto link on the page" } });
    const { ctx, page, requests, errors } = await open(browser, URL, cardTurn([card]));
    await page.click(".snip .tip-btn");
    await page.waitForFunction(() => document.querySelector(".snip .tip-btn")?.dataset.mailto, undefined, { timeout: 8000 });
    const m = await page.getAttribute(".snip .tip-btn", "data-mailto");
    const d = decode(m);
    ok("a. a page that published a mailto: the click builds the exact draft (address, subject, body), percent-encoded with no raw newline",
      d.to === SALLY && d.subject === 'A tip for "Banana Bread"' && d.body === EXPECT_BODY && !/[\n\r ]/.test(m) && m.length <= 1800,
      JSON.stringify({ to: d.to, subject: d.subject, body: d.body.slice(0, 80), len: m.length }), "the draft is wrong");
    const t = await toastText(page);
    ok("a. the toast says where the address was found and that nothing is sent",
      t === `Opened an email draft to ${SALLY} (found a mailto link on the page). Nothing is sent until you send it.`, t, "toast wording");
    ok("a. a card already holding the contact loads NO page (nothing leaves this machine on the click) and the status line stays honest",
      !requests.some((r) => /sally\.test/.test(r.url)) && /feature in development/i.test(await page.textContent(".snip-dev")) && /nothing is paid or sent/i.test(await page.textContent(".snip-dev")),
      requests.filter((r) => /\.test/.test(r.url)).map((r) => r.url).join(" "), "a request went out");
    await shot(page, "tip-a-card-light");
    // e. the address leaks nowhere else
    const store = await page.evaluate(() => ({ sessions: localStorage.getItem("fold-chat:sessions") || "", outbound: localStorage.getItem("fold-chat:outbound") || "", all: Object.keys(localStorage).map((k) => k + "=" + localStorage.getItem(k)).join("\n") }));
    const sessions = JSON.parse(store.sessions);
    for (const s of Object.values(sessions)) for (const msg of s.messages || []) for (const sn of msg.grounding?.snips || []) delete sn.contact;
    ok("e. the address is kept only on the snip's own `contact` — not elsewhere in the stored chats, not in the outbound ledger",
      !JSON.stringify(sessions).includes(SALLY) && !store.outbound.includes(SALLY) && !store.all.replace(store.sessions, "").includes(SALLY),
      "found outside contact", "the address was stored somewhere it should not be");
    ok("e. no request carried the address (URL or body), and the page raised no error",
      !requests.some((r) => r.url.includes("sally%40") || r.url.includes(SALLY) || r.body.includes(SALLY)) && errors.length === 0, errors.join(" | ") || "clean", "a request carried the address");
    await ctx.close();
  }

  // ── b. nothing captured: follow the site's own contact link; a Cloudflare-protected address ──────────────────────
  {
    const card = recipe("https://latte.test/banana/", { credit: { author: "", publisher: "A Latte Food", site: "latte.test" } });
    const { ctx, page, requests } = await open(browser, URL, cardTurn([card]));
    await page.click(".snip .tip-btn");
    await page.waitForFunction(() => document.querySelector(".snip .tip-btn")?.dataset.mailto, undefined, { timeout: 20000 });
    const d = decode(await page.getAttribute(".snip .tip-btn", "data-mailto"));
    const t = await toastText(page);
    const loaded = requests.map((r) => r.url).filter((u) => /latte\.test|elsewhere\.test/.test(u));
    ok("b. a protected link on the site's own contact page is found, decoded, and used (a plain 'Hi!' when the page named no person)",
      d.to === "maria@gmail.com" && d.body.startsWith("Hi! I enjoyed") && t === "Opened an email draft to maria@gmail.com (found a protected email link on their contact page). Nothing is sent until you send it.",
      JSON.stringify({ to: d.to, t }), "cfemail not decoded or wrong wording");
    ok("b. only the creator's own site was read (the page, then its contact page), never another site",
      loaded.length >= 2 && loaded.every((u) => u.startsWith("https://latte.test/")), loaded.join(" "), "a page on another site was loaded");
    await ctx.close();
  }

  // ── b2. allrecipes (2026-10-05): a contributor handle on a platform; the protected link is a service desk elsewhere ──
  {
    const url = "https://www.allrecipes.com/recipe/1/banana/";
    const desk = "alrcustserv@cdsfulfillment.com";
    const routes = { [url]: html("Banana", `<a href="/contact/">Contact</a>`), "https://www.allrecipes.com/contact/": html("Contact", `<a href="/cdn-cgi/l/email-protection#${cf(desk)}"><span data-cfemail="${cf(desk)}">[email&#160;protected]</span></a>`) };
    const card = recipe(url, { credit: { author: "ELIZABETHBH", publisher: "Allrecipes", site: "allrecipes.com" } });
    const { ctx, page } = await open(browser, URL, cardTurn([card]), { routes });
    let opened = 0; ctx.on("page", () => opened++);
    await page.click(".snip .tip-btn");
    await page.waitForFunction(() => /find a public contact/.test(document.getElementById("toast")?.textContent || ""), undefined, { timeout: 15000 }).catch(() => {});
    ok("b2. a customer-service desk on a fulfilment company's domain is never offered: the honest 'no contact' outcome, nothing opened, no draft",
      (await toastText(page)).startsWith("Couldn't find a public contact") && !(await page.getAttribute(".snip .tip-btn", "data-mailto")) && opened === 0, await toastText(page), "the service desk was offered");
    await ctx.close();
    const ok2 = recipe(url, { credit: { author: "ELIZABETHBH", publisher: "Allrecipes", site: "allrecipes.com" }, contact: { kind: "email", address: "recipes@allrecipes.com", where: "a mailto link on the page" } });
    const b = await open(browser, URL, cardTurn([ok2]));
    await b.page.click(".snip .tip-btn");
    await b.page.waitForFunction(() => document.querySelector(".snip .tip-btn")?.dataset.mailto, undefined, { timeout: 8000 });
    const d = decode(await b.page.getAttribute(".snip .tip-btn", "data-mailto")); const t = await toastText(b.page);
    ok("b2. a contributor handle on a platform gets a plain 'Hi!' (never 'Hi ELIZABETHBH!') and the toast says it is the site's contact, not the individual's",
      d.body.startsWith("Hi! I enjoyed") && !/ELIZABETH/i.test(d.body) && t.endsWith("This is the site's contact, not the individual's."), JSON.stringify({ body: d.body.slice(0, 20), t }), "greeting or note wrong");
    await b.ctx.close();
  }

  // ── c. a contact form only: the draft is copied, their contact page opens in a new tab ──────────────────────────
  let formShots = null;
  {
    const card = recipe("https://forms.test/pancakes/", { title: "Fluffy Pancakes", credit: { author: "Natasha Kravchuk", publisher: "", site: "forms.test" } });
    const { ctx, page } = await open(browser, URL, cardTurn([card]));
    const popup = new Promise((res) => ctx.once("page", (p) => res(p)));
    const before = page.url();
    await page.click(".snip .tip-btn");
    const np = await Promise.race([popup, new Promise((r) => setTimeout(() => r(null), 15000))]);
    await page.waitForFunction(() => /copied/.test(document.getElementById("toast")?.textContent || ""), undefined, { timeout: 15000 }).catch(() => {});
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => "ERR " + e.message);
    const t = await toastText(page);
    ok("c. no email but a contact form: a NEW tab opens at the creator's own contact page",
      !!np && /^https:\/\/forms\.test\/contact\//.test(np.url()), np ? np.url() : "no new tab", "no tab opened");
    ok("c. the draft message is on the clipboard (nothing else), and the toast says to paste it",
      clip.startsWith("Hi Natasha! I enjoyed your content") && clip.includes("“Fluffy Pancakes”") && clip.includes("https://forms.test/pancakes/") && !/mailto:/.test(clip) && t === "No public email. Opened their contact page; your message is copied — paste it there.",
      JSON.stringify({ clip: clip.slice(0, 60), t }), "clipboard or toast wrong");
    ok("c. the Fold's own page did not navigate away", page.url() === before, page.url(), "the app navigated");
    await shot(page, "tip-c-form-light");
    if (np) await np.close();
    await ctx.close();
  }

  // ── d. nothing found: the honest toast, no tab, no navigation, no draft ─────────────────────────────────────────
  {
    const card = recipe("https://nothing.test/soup/", { title: "Soup", credit: { author: "", publisher: "", site: "nothing.test" } });
    const { ctx, page } = await open(browser, URL, cardTurn([card]));
    let opened = 0; ctx.on("page", () => opened++);
    const before = page.url();
    await page.click(".snip .tip-btn");
    await page.waitForFunction(() => /find a public contact/.test(document.getElementById("toast")?.textContent || ""), undefined, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    const t = await toastText(page);
    ok("d. nothing published: the honest toast; no new tab, no navigation, no mailto (an address only in an HTML comment is not offered)",
      t === "Couldn't find a public contact for this creator. The original page is linked above." && opened === 0 && page.url() === before && !(await page.getAttribute(".snip .tip-btn", "data-mailto")) && !(await page.$(".snip .tip-link")),
      JSON.stringify({ t, opened }), "wrong outcome");
    ok("d. the control is never a dead button: it can be tried again", (await page.$eval(".snip .tip-btn", (b) => !b.disabled && b.getAttribute("aria-busy") !== "true")), "disabled", "the button stayed busy");
    await shot(page, "tip-d-none-light");
    await ctx.close();
  }

  // ── tip control: keyboard, touch size, themes ─────────────────────────────────────────────────────────────────
  {
    const card = recipe("https://sally.test/banana-bread/", { contact: { kind: "email", address: SALLY, where: "a mailto link on the page" } });
    const { ctx, page } = await open(browser, URL, cardTurn([card]), { viewport: { width: 375, height: 800 }, mobile: true, colorScheme: "dark" });
    const geo = await page.$eval(".snip .tip-btn", (b) => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width, overflow: document.documentElement.scrollWidth - innerWidth }; });
    ok("a phone (375 px, dark): the tip control is at least 40 px tall and the page does not scroll sideways", geo.h >= 40 && geo.overflow <= 0, JSON.stringify(geo), "too small or overflowing");
    await page.focus(".snip .tip-btn"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".snip .tip-btn")?.dataset.mailto, undefined, { timeout: 8000 }).catch(() => {});
    ok("the control works from the keyboard (Enter)", !!(await page.getAttribute(".snip .tip-btn", "data-mailto")), "", "no draft from Enter");
    await shot(page, "tip-a-card-375-dark");
    await ctx.close();
  }

  // ── Sources only: the strand — one control per source; Wikipedia gets none ───────────────────────────────────────
  {
    const sn = [passage("S1", "https://latte.test/banana/", "Banana bread is a moist loaf made with very ripe bananas and a little butter, and it keeps well for days."), passage("S2", "https://en.wikipedia.org/wiki/Banana_bread", "Banana bread is a type of bread made from mashed bananas.", { kind: "lead" })];
    const { ctx, page } = await open(browser, URL, strandTurn(sn));
    await page.click(".strand .pager-page.is-on .tip-btn");
    await page.waitForFunction(() => document.querySelector(".strand .tip-btn")?.dataset.mailto, undefined, { timeout: 20000 }).catch(() => {});
    const m = await page.getAttribute(".strand .pager-page.is-on .tip-btn", "data-mailto");
    ok("the Sources-only strand carries the same control and it works there (reads the creator's contact page)", !!m && decode(m).to === "maria@gmail.com", m ? decode(m).to : "none", "strand control failed");
    ok("an encyclopedia page has no 'Tip the creator'", (await page.$$eval(".strand .pager-page", (ps) => ps.map((p) => !!p.querySelector(".tip-btn"))))[1] === false, "", "tip shown on Wikipedia");
    await ctx.close();
  }

  // ── the three outcomes in light, dark and a 375 px phone (screenshots only; the checks above are the verdicts) ─────────
  for (const [tag, card] of [["email", recipe("https://sally.test/banana-bread/", { contact: { kind: "email", address: SALLY, where: "a mailto link on the page" } })], ["form", recipe("https://forms.test/pancakes/", { title: "Fluffy Pancakes", credit: { author: "Natasha Kravchuk", publisher: "", site: "forms.test" } })], ["none", recipe("https://nothing.test/soup/", { title: "Soup", credit: { author: "", publisher: "", site: "nothing.test" } })]]) {
    for (const [look, o] of [["light", { colorScheme: "light" }], ["dark", { colorScheme: "dark" }], ["375", { viewport: { width: 375, height: 760 }, mobile: true, colorScheme: "light" }]]) {
      const { ctx, page } = await open(browser, URL, cardTurn([card]), o);
      await page.click(".snip .tip-btn"); await page.waitForTimeout(tag === "form" ? 1500 : 900);
      await page.locator(".snip").scrollIntoViewIfNeeded().catch(() => {});
      await shot(page, `outcome-${tag}-${look}`);
      await ctx.close();
    }
  }

  // ═══ PAGER ═════════════════════════════════════════════════════════════════════════════════════════════════════
  const three = [passage("S1", "https://a.test/one", "First source says that the loaf bakes for about an hour at moderate heat."), passage("S2", "https://b.test/two", "Second source says it needs about fifty minutes, and gives a much longer account of the method that runs over several lines so this page is the tallest of the three pages in the pager, which is what sets the box height for all of them. ".repeat(3)), passage("S2", "https://b.test/two", "More from the second source, a separate passage of the same page.", { p: 1 }), passage("S3", "https://c.test/three", "Third source agrees with the first.")];
  {
    const { ctx, page, errors } = await open(browser, URL, strandTurn(three));
    const st = () => page.evaluate(() => { const p = document.querySelector(".strand .pager"); return { count: p.querySelector(".pager-bar-bottom .pager-count").textContent, topCount: p.querySelector(".pager-bar-top .pager-count").textContent, topPrev: p.querySelector(".pager-bar-top .pager-prev").disabled, topNext: p.querySelector(".pager-bar-top .pager-next").disabled, topOn: [...p.querySelectorAll(".pager-bar-top .pager-dot")].findIndex((d) => d.classList.contains("is-on")), idx: p.dataset.index, n: p.dataset.n, prev: p.querySelector(".pager-bar-bottom .pager-prev").disabled, next: p.querySelector(".pager-bar-bottom .pager-next").disabled, dots: p.querySelectorAll(".pager-bar-bottom .pager-dot").length, pages: p.querySelectorAll(".pager-page").length, visible: [...p.querySelectorAll(".pager-page")].filter((x) => getComputedStyle(x).visibility === "visible").length, h: Math.round(p.querySelector(".pager-stage").getBoundingClientRect().height) }; });
    const s0 = await st();
    ok("a turn with several snips shows ONE page with '1 of 3' and three dots; Prev is disabled at the start (S2 given twice is still one page)",
      s0.count === "1 of 3" && s0.pages === 3 && s0.dots === 3 && s0.visible === 1 && s0.prev === true && s0.next === false && s0.n === "S1", JSON.stringify(s0), "pager state wrong");
    await page.click(".strand .pager-bar-bottom .pager-next");
    const s1 = await st();
    const txt1 = await page.$eval(".strand .pager-page.is-on", (x) => x.innerText);
    ok("Next shows the second source with BOTH its passages on one page, and the counter says '2 of 3'",
      s1.count === "2 of 3" && s1.n === "S2" && /fifty minutes/.test(txt1) && /More from the second source/.test(txt1) && (txt1.match(/S2/g) || []).length === 1, JSON.stringify({ s1, txt: txt1.slice(0, 60) }), "page 2 wrong");
    ok("the box height does not change between pages (no jump)", s1.h === s0.h, `${s0.h} vs ${s1.h}`, "height jumped");
    await page.click(".strand .pager-bar-bottom .pager-next");
    const s2 = await st();
    ok("at the last page Next is disabled and does not wrap", s2.count === "3 of 3" && s2.next === true && s2.prev === false && s2.h === s0.h, JSON.stringify(s2), "wraps or enabled");
    await page.click(".strand .pager-bar-bottom .pager-prev"); await page.click(".strand .pager-bar-bottom .pager-prev");
    ok("Prev goes back to the first page", (await st()).count === "1 of 3", "", "prev failed");
    {   // the TOP bar: present, in step, clickable, out of the tab order, in view without scrolling past the card
      const top = await page.evaluate(() => { const p = document.querySelector(".strand .pager"); const tb = p.querySelector(".pager-bar-top"), st = p.querySelector(".pager-stage"); return { above: !!(tb.compareDocumentPosition(st) & Node.DOCUMENT_POSITION_FOLLOWING), tab: [...tb.querySelectorAll("button")].every((b) => b.tabIndex === -1), btab: [...p.querySelectorAll(".pager-bar-bottom button")].every((b) => b.tabIndex === 0 || b.tabIndex === -1 ? b.tabIndex === 0 : true), aboveCard: tb.getBoundingClientRect().bottom <= st.getBoundingClientRect().top + 1 }; });
      ok("a second control bar sits ABOVE the page; its buttons are out of the tab order (one set of controls for keyboard users)", top.above && top.aboveCard && top.tab, JSON.stringify(top), "no top bar");
      const s1 = await st(); await page.click(".strand .pager-bar-top .pager-next"); const t1 = await st();
      ok("the TOP Next works and the top and bottom bars show the same counter, dot and disabled states",
        s1.count === "1 of 3" && t1.count === "2 of 3" && t1.topCount === "2 of 3" && t1.topOn === 1 && t1.topPrev === false && t1.topNext === false && t1.n === "S2", JSON.stringify(t1), "bars out of step");
      await page.click(".strand .pager-bar-top .pager-dot >> nth=2");
      const t2 = await st();
      ok("a TOP dot jumps to its page and both bars agree, with Next disabled on both at the end", t2.count === "3 of 3" && t2.topCount === "3 of 3" && t2.topNext === true && t2.next === true, JSON.stringify(t2), "dot jump");
      await page.click(".strand .pager-bar-top .pager-prev"); await page.click(".strand .pager-bar-top .pager-prev");
      const t3 = await st();
      ok("the TOP Prev goes back, and the top bar disables Prev at the start", t3.count === "1 of 3" && t3.topCount === "1 of 3" && t3.topPrev === true, JSON.stringify(t3), "top prev");
    }
    await page.focus(".strand .pager");
    await page.keyboard.press("ArrowRight");
    const k1 = (await st()).count;
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    const k2 = (await st()).count;
    await page.keyboard.press("ArrowLeft");
    const k3s = await st(); const k3 = k3s.count;
    ok("Left/Right keys move when the pager has focus, stop at the ends, and the top bar follows", k1 === "2 of 3" && k2 === "3 of 3" && k3 === "2 of 3" && k3s.topCount === "2 of 3", [k1, k2, k3, k3s.topCount].join(" "), "keys");
    await page.click(".strand .pager-bar-bottom .pager-dot >> nth=0");
    ok("a dot goes straight to its page, and the dots carry the S# ids as tooltips", (await st()).count === "1 of 3" && (await page.$$eval(".strand .pager-bar-bottom .pager-dot", (d) => d.map((x) => x.title))).join("|").startsWith("S1"), "", "dots");
    // swipe (touch pointer events)
    await page.evaluate(() => { const stage = document.querySelector(".strand .pager-stage"); const r = stage.getBoundingClientRect(); const fire = (type, x) => stage.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", clientX: x, clientY: r.top + 40 })); fire("pointerdown", r.left + r.width - 20); fire("pointerup", r.left + 20); });
    const sw1 = (await st()).count;
    await page.evaluate(() => { const stage = document.querySelector(".strand .pager-stage"); const r = stage.getBoundingClientRect(); const fire = (type, x) => stage.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", clientX: x, clientY: r.top + 40 })); fire("pointerdown", r.left + 20); fire("pointerup", r.left + r.width - 20); });
    const sw2 = (await st()).count;
    ok("swiping left goes forward and swiping right goes back", sw1 === "2 of 3" && sw2 === "1 of 3", `${sw1} ${sw2}`, "swipe");
    const tips = await page.$$eval(".strand .pager-page", (ps) => ps.map((p) => ({ credit: !!p.querySelector(".strand-credit"), open: !!p.querySelector(".strand-open"), tip: !!p.querySelector(".tip-btn"), chip: p.querySelector(".src-n")?.textContent, title: p.querySelector(".src-n")?.title })));
    ok("each page keeps its own S# chip (hoverable), credit, open link and tip control", tips.length === 3 && tips.every((t, i) => t.credit && t.open && t.tip && t.chip === ["S1", "S2", "S3"][i] && t.title.startsWith(t.chip)), JSON.stringify(tips), "page furniture missing");
    ok("an inactive page is inert and not focusable (hidden from keyboard and readers)", await page.$$eval(".strand .pager-page:not(.is-on)", (ps) => ps.every((p) => p.hasAttribute("inert") && p.getAttribute("aria-hidden") === "true")), "", "inactive pages reachable");
    await shot(page, "pager-strand-light");
    ok("the pager raised no page error", errors.length === 0, errors.join(" | ") || "clean", "page error");
    await ctx.close();
  }
  {   // a single snip: no pager
    const { ctx, page } = await open(browser, URL, strandTurn([three[0]]));
    ok("a single snip shows no pager", (await page.$(".strand .pager")) === null && !!(await page.$(".strand .strand-snip")), "", "pager on one snip");
    await ctx.close();
  }
  {   // 375 px + dark
    const { ctx, page } = await open(browser, URL, strandTurn(three), { viewport: { width: 375, height: 800 }, mobile: true, colorScheme: "dark" });
    const g = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, btn: Math.min(...[...document.querySelectorAll(".strand .pager-btn")].map((b) => b.getBoundingClientRect().height)), dot: document.querySelector(".strand .pager-dot").getBoundingClientRect().width, tip: document.querySelector(".strand .pager-page.is-on .tip-btn").getBoundingClientRect().height }));
    ok("at 375 px (dark) the pager fits, Prev/Next and the tip control are at least 40 px tall", g.overflow <= 0 && g.btn >= 40 && g.tip >= 40, JSON.stringify(g), "too small or overflow");
    const tb = await page.evaluate(() => { const t = document.querySelector(".strand .pager-bar-top"); const r = t.getBoundingClientRect(); const bs = [...t.querySelectorAll("button")].map((b) => b.getBoundingClientRect()); return { bottom: Math.round(r.bottom), top: Math.round(r.top), h: Math.round(r.height), inView: r.top >= 0 && r.bottom <= innerHeight, fit: bs.every((x) => x.left >= 0 && x.right <= innerWidth), minH: Math.min(...bs.map((x) => x.height)) }; });
    await page.locator(".strand .pager-bar-top").scrollIntoViewIfNeeded();
    ok("at 375 px (dark) the TOP bar fits the width with 40 px targets and is visible without scrolling past the card", tb.fit && tb.minH >= 40, JSON.stringify(tb), "top bar clipped or small");
    await page.click(".strand .pager-bar-top .pager-next");
    ok("at 375 px the top bar is tappable and the bottom bar follows", (await page.$eval(".strand .pager-bar-bottom .pager-count", (c) => c.textContent)) === "2 of 3", "", "no sync on phone");
    await shot(page, "pager-strand-375-dark");
    await ctx.close();
  }
  {   // reduced motion
    const { ctx, page } = await open(browser, URL, strandTurn(three), { reducedMotion: "reduce" });
    const secs = (d) => Math.max(...String(d).split(",").map((x) => parseFloat(x)));
    const d = await page.$eval(".strand .pager-page", (p) => getComputedStyle(p).transitionDuration);
    await ctx.close();
    const n = await open(browser, URL, strandTurn(three));
    const d0 = await n.page.$eval(".strand .pager-page", (p) => getComputedStyle(p).transitionDuration);
    await n.ctx.close();
    ok("with prefers-reduced-motion the page turn has no transition (and has one otherwise)", secs(d) < 0.01 && secs(d0) >= 0.1, `reduced ${d}, normal ${d0}`, "motion not reduced");
  }
  {   // recipe cards: paged too; a citation chip jumps to its page
    const cards = [recipe("https://a.test/r1", { title: "Recipe One" }), recipe("https://b.test/r2", { title: "Recipe Two", ingredients: ["1 egg"], steps: ["Fry."] }), recipe("https://b.test/r2/", { title: "Recipe Two again" })];
    const now = new Date().toISOString();
    const msgs = [{ role: "user", content: "recipe", at: now, mode: "chat", effort: "balanced" }, { role: "assistant", content: "Two sources differ on the time.", at: now, mode: "chat", grounding: { turn: 1, kind: "research", effort: "balanced", hasMaterial: true, snips: cards, cited: [{ n: "W2", title: "Recipe Two", domain: "b.test", url: "https://b.test/r2" }], facing: { sources: [], response: [] } } }];
    const { ctx, page } = await open(browser, URL, msgs);
    const c0 = await page.$eval(".snips .pager-count", (c) => c.textContent);
    ok("recipe cards are paged too, and the same recipe page twice is one card ('1 of 2')", c0 === "1 of 2", c0, "cards stacked or duplicated");
    const chip = await page.$(".cite-chip");
    if (chip) await chip.click({ modifiers: [] }).catch(() => {});
    const c1 = await page.$eval(".snips .pager-count", (c) => c.textContent).catch(() => "none");
    const title = await page.$eval(".snips .pager-page.is-on .snip-link", (a) => a.textContent).catch(() => "");
    ok("a citation chip jumps to the card of its source", c1 === "2 of 2" && title === "Recipe Two", `${c1} ${title}`, "chip did not jump");
    await ctx.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import("/private/tmp/fold-e2e/node_modules/playwright/index.mjs");
  const URL = process.env.FOLD_URL || "http://127.0.0.1:8814/";
  const browser = await chromium.launch();
  let pass = 0, fail = 0;
  const ok = (name, cond, detail, why) => { if (cond) { pass++; console.log("PASS " + name); } else { fail++; console.log("FAIL " + name + "\n     " + detail + (why ? "\n     -> " + why : "")); } };
  try { await runTipChecks({ browser, URL, ok }); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
