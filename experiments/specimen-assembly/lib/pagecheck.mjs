// pagecheck.mjs — the oracle for page specimens: a real Chromium (Playwright, already a devDependency of the-fold)
// loads the HTML and drives it like a person would. Obligations are behaviours, not markup, so any page that
// behaves like a tip calculator passes and any that does not fails, whatever its ids are called.
import { chromium } from "playwright";

export const OBLIGATIONS = {
  "P-title": { holon: "shell", say: "the page has a non-empty <title>" },
  "P-clean": { holon: "shell", say: "no console or page errors in any scenario; no external src/href" },
  "P-layout": { holon: "shell", say: "at 390px wide: no horizontal scroll, and bill, people and the three tip buttons are visible inside the viewport" },
  "P-bill": { holon: "bill-input", say: "an input labelled like 'bill' exists and takes a number" },
  "P-people": { holon: "people-input", say: "an input labelled like 'people' exists and takes a number" },
  "P-tipbuttons": { holon: "tip-buttons", say: "buttons named 10%, 15% and 20% exist" },
  "P-compute-15": { holon: "result", say: "bill 100, 1 person, click 15% -> text shows tip 15.00 and per person 115.00" },
  "P-compute-20-split": { holon: "result", say: "bill 100, 2 people, click 20% -> tip 20.00, per person 60.00" },
  "P-live": { holon: "result", say: "then change the bill to 200 with no other click -> tip 40.00, per person 120.00; then change people to 4 -> per person 60.00 (live, no calculate button)" },
  "P-nonneg-bill": { holon: "guard", say: "bill -50 (15%, 1 person): no negative number, NaN or Infinity shown in the result" },
  "P-nonneg-people": { holon: "guard", say: "people 0 and -3 (bill 100, 15%): no negative number, NaN or Infinity shown" },
};
export const OBLIGATION_IDS = Object.keys(OBLIGATIONS);

const num = (s) => parseFloat(String(s).replace(/,/g, ""));
const MONEY = "[^\\n\\d\\-−]*?[$€£]?\\s*([-−]?\\d[\\d.,]*)";
export function readResult(text) {
  const t = text.match(new RegExp("\\btip\\b" + MONEY, "i"));
  const p = text.match(new RegExp("per\\s+person" + MONEY, "i"));
  return { tip: t ? num(t[1].replace("−", "-")) : null, per: p ? num(p[1].replace("−", "-")) : null };
}
const resultLines = (text) => text.split("\n").filter((l) => /\btip\b|per\s+person|total/i.test(l) && !/calculator|custom|recent/i.test(l)).join("\n");
const badNumbers = (text) => /NaN|Infinity|[-−]\s*[$€£]?\s*\d/.test(resultLines(text));

export async function makeOracle() {
  const browser = await chromium.launch();
  let loads = 0;
  async function check(html, { only = null, failFast = false } = {}) {
    const want = only || OBLIGATION_IDS;
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    const out = {};
    const load = async () => { loads++; await page.setContent(html, { waitUntil: "load" }); };
    const bill = () => page.getByLabel(/bill/i).first();
    const people = () => page.getByLabel(/people|persons/i).first();
    const btn = (p) => page.getByRole("button", { name: new RegExp(`^\\s*${p}\\s*%`) }).first();
    const has = async (loc) => (await loc.count()) > 0;
    const body = () => page.locator("body").innerText();
    const T = 1500;
    const run = async (id, fn) => {
      if (!want.includes(id)) return;
      if (failFast && Object.values(out).some((v) => !v.pass)) return;
      try { out[id] = await fn(); } catch (e) { out[id] = { pass: false, detail: "threw: " + String(e.message).split("\n")[0].slice(0, 160) }; }
    };
    try {
      await load();
      await run("P-title", async () => { const t = await page.title(); return { pass: t.trim().length > 0, detail: `title="${t}"` }; });
      await run("P-bill", async () => { const l = bill(); if (!(await has(l))) return { pass: false, detail: "no input labelled bill" }; await l.fill("12.5", { timeout: T }); return { pass: (await l.inputValue()) === "12.5", detail: "ok" }; });
      await run("P-people", async () => { const l = people(); if (!(await has(l))) return { pass: false, detail: "no input labelled people" }; await l.fill("3", { timeout: T }); return { pass: (await l.inputValue()) === "3", detail: "ok" }; });
      await run("P-tipbuttons", async () => { const miss = []; for (const p of [10, 15, 20]) if (!(await has(btn(p)))) miss.push(p + "%"); return { pass: miss.length === 0, detail: miss.length ? `no button for ${miss.join(", ")}` : "10%, 15%, 20% found" }; });
      const scenario = async (b, n, p) => { await load(); await bill().fill(String(b), { timeout: T }); await people().fill(String(n), { timeout: T }); if (p && (await has(btn(p)))) await btn(p).click({ timeout: T }); };
      await run("P-compute-15", async () => { await scenario(100, 1, 15); const r = readResult(await body()); return { pass: r.tip === 15 && r.per === 115, detail: `observed tip=${r.tip}, per person=${r.per}` }; });
      await run("P-compute-20-split", async () => { await scenario(100, 2, 20); const r = readResult(await body()); return { pass: r.tip === 20 && r.per === 60, detail: `observed tip=${r.tip}, per person=${r.per}` }; });
      await run("P-live", async () => { await scenario(100, 2, 20); await bill().fill("200", { timeout: T }); const r = readResult(await body()); if (!(r.tip === 40 && r.per === 120)) return { pass: false, detail: `after changing the bill: tip=${r.tip}, per person=${r.per} (wanted 40, 120)` }; await people().fill("4", { timeout: T }); const q = readResult(await body()); return { pass: q.per === 60, detail: `after changing people to 4: per person=${q.per} (wanted 60)` }; });
      await run("P-nonneg-bill", async () => { await scenario(-50, 1, 15); const t = await body(); return { pass: !badNumbers(t), detail: badNumbers(t) ? "shown: " + resultLines(t).replace(/\n/g, " | ").slice(0, 120) : "nothing negative shown" }; });
      await run("P-nonneg-people", async () => {
        for (const n of [0, -3]) { await scenario(100, n, 15); const t = await body(); if (badNumbers(t)) return { pass: false, detail: `people=${n}: ` + resultLines(t).replace(/\n/g, " | ").slice(0, 120) }; }
        return { pass: true, detail: "nothing negative shown" };
      });
      await run("P-layout", async () => {
        await load();
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        if (m.sw > m.iw) return { pass: false, detail: `horizontal scroll: ${m.sw} > ${m.iw}` };
        for (const [name, loc] of [["bill", bill()], ["people", people()], ["10%", btn(10)], ["15%", btn(15)], ["20%", btn(20)]]) {
          if (!(await has(loc))) return { pass: false, detail: `${name} control missing` };
          const bb = await loc.boundingBox();
          if (!bb || bb.width < 8 || bb.height < 8 || bb.x < 0 || bb.x + bb.width > m.iw + 1) return { pass: false, detail: `${name} not visible inside the viewport` };
        }
        return { pass: true, detail: "fits 390px" };
      });
      await run("P-clean", async () => {
        const ext = /(src|href)\s*=\s*["']\s*(https?:)?\/\//i.test(html);
        return { pass: errors.length === 0 && !ext, detail: ext ? "external reference" : errors.length ? errors[0].slice(0, 140) : "no errors" };
      });
    } finally { await page.close(); }
    for (const id of want) if (!out[id]) out[id] = { pass: false, detail: failFast ? "not evaluated (an earlier obligation failed)" : "not evaluated" };
    return out;
  }
  // which selectors match nothing in this page's initial DOM (for the dead-rule transformation)
  async function unmatched(html, selectorLists) {
    const page = await browser.newPage();
    try { await page.setContent(html, { waitUntil: "load" }); return await page.evaluate((lists) => lists.map((list) => list.every((sel) => { try { return document.querySelector(sel) === null; } catch { return false; } })), selectorLists); }
    finally { await page.close(); }
  }
  // the ids of the controls the obligations found by label/name, so a void can say where its neighbours live
  async function ids(html) {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    try {
      await page.setContent(html, { waitUntil: "load" });
      const get = async (loc) => ((await loc.count()) ? await loc.first().evaluate((e) => e.id || null) : null);
      return { "bill-input": await get(page.getByLabel(/bill/i)), "people-input": await get(page.getByLabel(/people|persons/i)) };
    } finally { await page.close(); }
  }
  return { check, unmatched, ids, close: () => browser.close(), get loads() { return loads; } };
}
