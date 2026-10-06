// measure.mjs — score the support-route recognizers on the saved fixtures against the frozen hand labels.
// node eval/support-fixtures/measure.mjs [--uncapped]     (offline: reads pages/*.html, no network)
// Bars: docs/CREATOR-SUPPORT-ROUTES-PREREG.md. Prints KIND and WHERE per fixture (never an email).
import fs from "node:fs";
import crypto from "node:crypto";
import { routesInPage, scanPage, parseFeed, authorFromFeed, feedsOfHtml, urlKey } from "../../fold-chat-support.js";
const DIR = new URL("./", import.meta.url).pathname;
const read = (f) => fs.readFileSync(DIR + f, "utf8");
const labels = JSON.parse(read("labels.json")), soc = JSON.parse(read("labels-social.json"));
const uncapped = process.argv.includes("--uncapped");
const sha = (f) => crypto.createHash("sha256").update(read(f)).digest("hex");
const tkey = (u) => { try { const x = new URL(u); return x.hostname.replace(/^www\./, "").toLowerCase() + x.pathname.replace(/\/+$/, ""); } catch { return String(u).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").toLowerCase(); } };
const skey = (u) => tkey(u.startsWith("http") ? u : "https://" + u).replace(/^twitter\.com\//, "x.com/");
const out = { labelsSha: sha("labels.json"), socialLabelsSha: sha("labels-social.json"), uncapped, tip: { E: 0, L: 0, TP: 0, fp: [], miss: [], constructed: [], otherOrg: [] }, social: { E: 0, L: 0, TP: 0, fp: [], miss: [], constructed: [], share: [] }, perFixture: {}, feeds: [], website: [] };
for (const [id, f] of Object.entries(labels.fixtures)) {
  const html = read(`pages/${id}.html`);
  const r = routesInPage(html, f.url, uncapped ? { cap: 99 } : {});
  // TIP LINKS
  const E = r.findings.filter((x) => ["tip-link", "structured-donate", "rel-payment"].includes(x.kind)).map((x) => x.url);
  const L = f.tip.map((t) => t.url);
  const tp = E.filter((u) => L.some((l) => tkey(l) === tkey(u)));
  out.tip.E += E.length; out.tip.L += L.length; out.tip.TP += tp.length;
  for (const u of E) if (!L.some((l) => tkey(l) === tkey(u))) { out.tip.fp.push(`${id} ${tkey(u)}`); if (f.notTip.some((n) => tkey(n.url) === tkey(u))) out.tip.otherOrg.push(`${id} ${tkey(u)}`); }
  for (const l of L) if (!E.some((u) => tkey(u) === tkey(l))) out.tip.miss.push(`${id} ${tkey(l)}`);
  // constructed: the accepted URL's host+path must occur as a resolved href / sameAs / url in the saved page
  const published = new Set(); const sc = scanPage(html);
  for (const a of sc.anchors) { try { published.add(tkey(new URL(a.attrs.href, f.url).href)); } catch {} }
  for (const l of sc.links) { try { published.add(tkey(new URL(l.attrs.href, f.url).href)); } catch {} }
  for (const m of html.matchAll(/https?:(?:\\?\/){2}(?:[^"'\s<>\\]|\\\/)+/g)) published.add(tkey(m[0].replace(/\\\//g, "/")));
  for (const x of r.findings.filter((x) => x.url && x.kind !== "form" && x.kind !== "website")) if (!published.has(tkey(x.url))) (x.kind === "social-profile" ? out.social.constructed : out.tip.constructed).push(`${id} ${tkey(x.url)}`);
  // SOCIAL
  const SE = r.socials.map((x) => x.url), SL = soc.fixtures[id].social, ign = soc.fixtures[id].ignore.map(skey);
  const se = SE.filter((u) => !ign.includes(skey(u)));
  const stp = se.filter((u) => SL.some((l) => skey(l) === skey(u)));
  out.social.E += se.length; out.social.L += SL.length; out.social.TP += stp.length;
  for (const u of se) if (!SL.some((l) => skey(l) === skey(u))) out.social.fp.push(`${id} ${skey(u)}${soc.fixtures[id].notSocial.some((n) => skey(n.url) === skey(u)) ? " [labelled notSocial]" : ""}`);
  for (const l of SL) if (!se.some((u) => skey(u) === skey(l))) out.social.miss.push(`${id} ${skey(l)}`);
  for (const u of SE) if (/share|sharer|intent|pin\/create|\/send|dialog/i.test(u)) out.social.share.push(`${id} ${u}`);
  // FEEDS (advertised, same site) and EMAIL / FORM kinds (no addresses printed)
  const feedsOk = JSON.stringify(r.feeds.map(tkey)) === JSON.stringify(f.feeds.map(tkey));
  out.feeds.push({ id, advertised: r.feeds.length, expected: f.feeds.length, ok: feedsOk, otherSiteFetched: (f.otherSiteFeeds || []).some((o) => r.feeds.map(tkey).includes(tkey(o))) });
  out.website.push({ id, website: r.website && tkey(r.website.url) });
  out.perFixture[id] = { tip: E.map(tkey), social: SE.map(skey), emailKinds: r.findings.filter((x) => x.kind === "email").map((x) => x.where), forms: r.findings.filter((x) => x.kind === "form").length };
}
for (const [fid, ff] of Object.entries(labels.feedFixtures)) {
  const a = authorFromFeed(parseFeed(read(`pages/${fid}.html`)), labels.fixtures[ff.of].url, labels.fixtures[ff.of].url);
  out.feeds.push({ id: fid, authorName: a && a.name === ff.authorName, emailOffered: !!(a && a.email), expectedEmail: ff.email });
}
const pct = (a, b) => (b ? (a / b).toFixed(3) : "undefined");
out.tip.precision = pct(out.tip.TP, out.tip.E); out.tip.recall = pct(out.tip.TP, out.tip.L);
out.social.precision = pct(out.social.TP, out.social.E); out.social.recall = pct(out.social.TP, out.social.L);
console.log(JSON.stringify(out, null, 1));
