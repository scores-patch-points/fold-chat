import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SUPPORT, SUPPORT_KINDS, SUPPORT_KIND_IDS, FALSIFIER_IDS, kindOf, routesInPage, judgeLink, judgeSocial, websiteOf, feedsOfHtml, parseFeed, authorFromFeed, humansOfText, addressOf, expand, offeredKind, sourcesOffering, tipStillValid, socialStillValid } from "./fold-chat-support.js";
import { mirrorSource } from "./scripts/gen-support-routes.mjs";
import { findContact, contactOfPassage, contactsOfRaw, TIP_LIMITS, TIP_SAY, TIP_LABELS } from "./fold-chat-tip.js";
import { contactsFromHtml } from "./fold-chat-contact.js";
import { sourcesPrompt } from "./fold-chat-gaps.js";

const page = (body, head = "") => `<!doctype html><html><head><title>t</title>${head}</head><body>${body}</body></html>`;
const SITE = "https://maria.test/";
const tips = (html, url = SITE, opts) => routesInPage(html, url, opts).findings.filter((f) => ["tip-link", "structured-donate", "rel-payment"].includes(f.kind));
const socials = (html, url = SITE, opts) => routesInPage(html, url, opts).socials;
const reasonOf = (html, url = SITE) => routesInPage(html, url).rejected.map((r) => r.reason);
const cf = (addr, key = 0x4b) => key.toString(16).padStart(2, "0") + [...addr].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, "0")).join("");

// ── the definition ─────────────────────────────────────────────────────────────────────────────────────────────────
test("the definition: schema, kind, order, every sub-kind declares id / what / yields / standing / falsifiers / address, all at nomination", () => {
  assert.equal(SUPPORT.schema, "SupportRoutes@1");
  assert.equal(SUPPORT.kind, "creator-support-route");
  const ids = SUPPORT_KINDS.map((k) => k.id);
  for (const want of ["tip-link", "structured-donate", "rel-payment", "feed-author", "humans-txt", "email", "form", "social-profile", "website"]) assert.ok(ids.includes(want), want);
  assert.deepEqual(SUPPORT.order.filter((i) => !ids.includes(i)), [], "every id in the order is a declared sub-kind");
  assert.deepEqual(SUPPORT.outcomeOrder, ["tip", "email", "form", "social", "website"]);
  for (const k of SUPPORT_KINDS) {
    assert.ok(k.id && k.what.length > 20 && k.yields && Number.isInteger(k.step), k.id);
    assert.equal(k.standing, "nomination", `${k.id}: nothing has standing before it is measured on a pre-registered set`);
    assert.ok(k.notThis.length >= 1 && k.notThis.every((n) => n.id && n.what), `${k.id}: what it is NOT`);
    assert.ok(k.address && k.where.length, `${k.id}: address shape and where it is looked for`);
  }
  assert.equal(SUPPORT.standing.default, "nomination");
  assert.equal(kindOf("tip-link").yields, "tip");
  assert.equal(kindOf("nope"), null);
  assert.deepEqual(SUPPORT_KIND_IDS, ids);
  assert.deepEqual(SUPPORT.address.shape.unit, "utf8-bytes");
});

test("the JS mirror the browser imports is exactly the JSON definition (run scripts/gen-support-routes.mjs after editing the JSON)", () => {
  const json = JSON.parse(fs.readFileSync(new URL("./fold-chat-support-routes.json", import.meta.url), "utf8"));
  assert.equal(fs.readFileSync(new URL("./fold-chat-support-routes-def.js", import.meta.url), "utf8"), mirrorSource(json));
  assert.deepEqual(JSON.parse(JSON.stringify(SUPPORT)), json);
});

test("the word lists cover the fourteen asked-for languages plus English, in their own scripts, and tolerate case and diacritics", () => {
  const strong = SUPPORT.words.strong;
  for (const l of ["en", "es", "fr", "de", "pt", "it", "ru", "zh", "ja", "ko", "ar", "hi", "tr", "nl", "pl"]) assert.ok(strong[l] && strong[l].length >= 3, l);
  // every language's FIRST strong word, as a footer link to a page on the creator's own site, is a tip link
  for (const [l, words] of Object.entries(strong)) {
    if (l === "note") continue;
    for (const w of words.slice(0, 2)) {
      const label = w.endsWith("*") ? w.slice(0, -1) + "x" : w;
      const found = tips(page(`<footer><a href="/p">${label}</a></footer>`));
      assert.equal(found.length, 1, `${l}: ${label}`);
    }
  }
  // upper case, accents and the Turkish dotless i fold the same way
  for (const label of ["DONATE", "UNTERSTÜTZEN SIE UNS: SPENDEN", "Soutenez-nous: FAIRE UN DON", "BAĞIŞ YAP", "Apóyame", "ПОДДЕРЖАТЬ", "打赏作者", "寄付する", "후원하기", "تبرع", "दान करें"]) {
    assert.equal(tips(page(`<footer><a href="/p">${label}</a></footer>`)).length, 1, label);
  }
});

test("the whole definition is read, not copied: contact.js takes its role-mailbox / free-mail / contact words from it", async () => {
  const { isUsableEmail, emailDomainOk } = await import("./fold-chat-contact.js");
  for (const m of SUPPORT.emailRules.machinery) assert.equal(isUsableEmail(`${m}@x.test`), false, m);
  for (const d of ["gmail.com", "yahoo.co.uk", "hotmail.fr", "gmx.de"]) assert.equal(emailDomainOk(`a@${d}`, "https://x.test/"), true, d);
  assert.equal(emailDomainOk("a@evil.test", "https://x.test/"), false);
});

// ── every platform in the definition: accepted as published, refused as a lookalike ─────────────────────────────────
test("every declared platform: its example URL is a tip link; lookalike hosts of it are not", () => {
  for (const p of SUPPORT.platforms) {
    const w = p.needsWords ? "Support me" : "Support me";
    const ok = tips(page(`<footer><a href="${p.example}">${w}</a></footer>`));
    assert.equal(ok.length, 1, `${p.id}: ${p.example}`);
    assert.equal(ok[0].platform, p.id);
    assert.equal(new URL(ok[0].url).protocol, "https:");
    const u = new URL(p.example);
    for (const bad of [`https://${u.host}.evil.test${u.pathname}`, `https://${u.host}@evil.test${u.pathname}`, ...(u.host.replace(/^www\./, "").split(".").length !== 2 ? [] : [`https://evil-${u.host.replace(/^www\./, "")}${u.pathname}`]), `https://${u.host.replace(/\./g, "-")}.test${u.pathname}`]) {
      assert.equal(tips(page(`<footer><a href="${bad}">Support me</a></footer>`)).length, 0, bad);
    }
  }
});

test("every declared social platform: its example is a profile link in the footer of a page named like it; lookalikes are not", () => {
  for (const p of SUPPORT.social.platforms) {
    const handle = (new URL(p.example).pathname.split("/").filter(Boolean).pop() || new URL(p.example).hostname.split(".")[0]).replace(/^@/, "");
    // the page is named like the handle (own-handle) and the link sits in the chrome; mastodon needs rel=me
    const rel = p.anyHost ? ' rel="me"' : "";
    const found = socials(page(`<footer><a${rel} href="${p.example}">x</a></footer>`), "https://" + handle.replace(/[^a-z0-9]/gi, "") + ".test/");
    assert.equal(found.length, 1, `${p.id}: ${p.example}`);
    if (p.anyHost) continue;
    const u = new URL(p.example);
    for (const bad of [`https://${u.host}.evil.test${u.pathname}`, `https://${u.host}@evil.test${u.pathname}`]) assert.equal(socials(page(`<footer><a href="${bad}">x</a></footer>`), "https://" + handle.replace(/[^a-z0-9]/gi, "") + ".test/").length, 0, bad);
  }
});

// ── the falsifiers: one per declared anti-pattern, enforced against the definition's own list ───────────────────────
const SOC_PAGE = "https://janedoe.test/";
const none = (html, url = SITE) => { const r = routesInPage(html, url); return { tips: r.findings.filter((f) => ["tip-link", "structured-donate", "rel-payment"].includes(f.kind)), socials: r.socials }; };
const FALSIFIERS = {
  "tip-link/comment-section": () => {
    assert.equal(tips(page(`<section id="comments"><ol class="comment-list"><li><a href="https://ko-fi.com/commenter">tip me</a></li></ol></section>`)).length, 0);
    assert.equal(tips(page(`<footer><a rel="ugc nofollow" href="https://www.patreon.com/spammer">support me</a><a rel="sponsored" href="https://ko-fi.com/ad">buy me a coffee</a></footer>`)).length, 0);
  },
  "tip-link/other-org-donate": () => {
    assert.equal(tips(page(`<footer><a href="https://www.redcross.org/donate">Donate to the Red Cross</a><a href="https://example.org/donation">Donate</a></footer>`)).length, 0);
    assert.ok(reasonOf(page(`<footer><a href="https://www.redcross.org/donate">Donate</a></footer>`)).includes("other-org-donate"));
  },
  "tip-link/store-checkout": () => {
    for (const a of [`<a href="https://www.etsy.com/listing/123">Buy now</a>`, `<a href="https://buy.stripe.com/abc123XYZ">Buy now</a>`, `<a href="/shop/checkout">Donate</a>`, `<a href="/cart">Add to cart</a>`, `<a href="https://maria.gumroad.com/l/ebook">Get the ebook</a>`]) assert.equal(tips(page(`<footer>${a}</footer>`)).length, 0, a);
    assert.equal(tips(page(`<footer><a href="https://buy.stripe.com/abc123XYZ">Leave a tip</a></footer>`)).length, 1, "a payment link whose own words say tip counts");
  },
  "tip-link/lookalike-host": () => {
    for (const h of ["https://ko-fi.com.evil.test/maria", "https://ko-fi.com@evil.test/maria", "https://www.patreon.com.evil.test/maria", "https://paypal.me.evil.test/maria", "https://github.com.evil.test/sponsors/maria"]) {
      assert.equal(tips(page(`<footer><a href="${h}">Support me</a></footer>`)).length, 0, h);
    }
    assert.ok(reasonOf(page(`<footer><a href="https://ko-fi.com.evil.test/maria">Support me</a></footer>`)).includes("lookalike-host"));
  },
  "tip-link/shortener-tracker": () => {
    for (const h of ["https://bit.ly/3abc", "https://linktr.ee/maria", "https://www.awin1.com/cread.php?x=1", "https://t.co/abc", "https://williams-sonoma.pdy5.net/YRxrZq"]) assert.equal(tips(page(`<footer><a href="${h}">Donate</a></footer>`)).length, 0, h);
  },
  "tip-link/news-tip": () => {
    for (const a of [`<a href="/tips">Have a tip?</a>`, `<a href="/contact">Send us a tip</a>`, `<a href="/submit-a-tip">Submit a tip</a>`, `<a href="/securedrop">SecureDrop</a>`]) assert.equal(tips(page(`<header>${a}</header>`)).length, 0, a);
  },
  "tip-link/helpdesk-support": () => {
    for (const a of [`<a href="https://support.maria.test/">Customer support</a>`, `<a href="/support/ticket">Contact support</a>`, `<a href="/help">Support center</a>`, `<a href="/support">Support</a>`]) assert.equal(tips(page(`<footer>${a}</footer>`)).length, 0, a);
  },
  "tip-link/generic-platform-page": () => {
    for (const h of ["https://github.com/open-source/sponsors", "https://www.patreon.com/explore", "https://ko-fi.com/gold", "https://opencollective.com/discover", "https://www.paypal.com/donate"]) assert.equal(tips(page(`<footer><a href="${h}">Support</a></footer>`)).length, 0, h);
  },
  "tip-link/ambiguous-handles": () => {
    const f = tips(page(`<footer><a href="https://ko-fi.com/alice">Ko-fi</a><a href="https://ko-fi.com/bob">Ko-fi</a></footer>`));
    assert.equal(f.length, 0, "two different creator pages on one platform: none is offered");
    assert.equal(tips(page(`<footer><a href="https://ko-fi.com/alice">a</a><a rel="payment" href="https://ko-fi.com/bob">b</a></footer>`)).length, 1, "unless one is declared");
  },
  "tip-link/body-link-no-evidence": () => {
    assert.equal(tips(page(`<article><p>Thanks to <a href="https://ko-fi.com/otherperson">this lovely person</a> for the idea.</p></article>`)).length, 0);
    assert.equal(tips(page(`<article><p>Like it? <a href="https://ko-fi.com/otherperson">Buy me a coffee</a>.</p></article>`)).length, 1, "its own words make it the page's");
    assert.equal(tips(page(`<article><p>Jane's <a href="https://www.patreon.com/jane">Patreon</a>.</p></article>`)).length, 0, "a platform NAME alone proves nothing for a link already on that platform");
  },
  "tip-link/constructed-link": () => {
    const r = routesInPage(page(`<p>find me on ko-fi.com/maria or patreon.com/maria</p><script data-name="BMC-Widget" data-id="maria" src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"></script>`, `<link rel="monetization" href="$wallet.example/alice">`), SITE);
    assert.equal(r.findings.filter((f) => f.url && f.kind !== "website").length, 0, "a handle in a script attribute, a payment pointer or bare text is never turned into a URL");
  },
  "tip-link/prefilled-amount": () => {
    const f = tips(page(`<footer><a href="https://www.paypal.com/donate/?hosted_button_id=ABC123&amount=50&currency_code=USD&email=a@b.test&utm_source=x">Donate</a><a href="https://www.patreon.com/maria?amount=5&fbclid=z">Support me</a></footer>`));
    assert.equal(f.length, 2);
    for (const x of f) assert.ok(!/amount|email|currency|utm_|fbclid/.test(x.url), x.url);
    assert.ok(f.some((x) => x.url === "https://www.paypal.com/donate/?hosted_button_id=ABC123"));
  },
  "structured-donate/url-template": () => {
    const ld = { "@context": "https://schema.org", "@type": "Organization", potentialAction: { "@type": "DonateAction", target: { "@type": "EntryPoint", urlTemplate: "https://maria.test/donate?amount={amount}" } } };
    assert.equal(tips(page(`<p>hi</p>`, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`)).length, 0);
  },
  "structured-donate/sameas-not-payment": () => {
    const ld = { "@type": "Person", sameAs: ["https://en.wikipedia.org/wiki/Maria", "https://github.com/maria", "https://twitter.com/maria"] };
    assert.equal(tips(page(`<p>x</p>`, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`)).length, 0);
  },
  "structured-donate/other-org-donate": () => {
    const ld = { "@type": "Organization", potentialAction: { "@type": "DonateAction", target: "https://other-charity.example/give" } };
    assert.equal(tips(page(`<p>x</p>`, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`)).length, 0);
  },
  "rel-payment/rel-me-social": () => {
    assert.equal(tips(page(`<p>x</p>`, `<link rel="me" href="https://social.maria.test/@maria"><link rel="me" href="https://github.com/maria">`)).length, 0);
  },
  "rel-payment/rel-monetization": () => {
    assert.equal(tips(page(`<p>x</p>`, `<link rel="monetization" href="$ilp.example/alice">`)).length, 0);
  },
  "feed-author/other-site-feed": () => {
    assert.deepEqual(feedsOfHtml(page("x", `<link rel="alternate" type="application/rss+xml" href="https://feeds.feedburner.com/maria">`), SITE), []);
    assert.deepEqual(feedsOfHtml(page("x", `<link rel="alternate" type="application/rss+xml" href="/feed/"><link rel="alternate" type="application/rss+xml" title="Comments Feed" href="/comments/feed/">`), SITE), ["https://maria.test/feed/"]);
  },
  "feed-author/many-authors": () => {
    const x = `<?xml version="1.0"?><rss><channel><title>Group</title><item><link>https://maria.test/a</link><dc:creator>Ann</dc:creator></item><item><link>https://maria.test/b</link><dc:creator>Bo</dc:creator></item></channel></rss>`;
    assert.equal(authorFromFeed(parseFeed(x), "https://maria.test/zzz"), null);
    assert.equal(authorFromFeed(parseFeed(x), "https://maria.test/b").name, "Bo", "the item that IS the page names its author");
  },
  "feed-author/machinery-address": () => {
    const x = `<rss><channel><managingEditor>webmaster@maria.test (Admin)</managingEditor><webMaster>noreply@maria.test</webMaster></channel></rss>`;
    assert.equal(authorFromFeed(parseFeed(x), SITE), null);
    const y = `<rss><channel><managingEditor>ana@other-company.test (Ana)</managingEditor></channel></rss>`;
    assert.equal(authorFromFeed(parseFeed(y), SITE).email, undefined, "another company's domain is dropped");
    assert.equal(authorFromFeed(parseFeed(y), SITE).name, "Ana");
  },
  "humans-txt/security-txt": async () => {
    const asked = [];
    await findContact({ url: "https://s.test/p" }, { readText: async (u) => { asked.push(u); return { ok: false }; }, pause: async () => {}, humans: true });
    assert.ok(asked.every((u) => !/security\.txt|\.well-known/.test(u)), asked.join(" "));
  },
  "humans-txt/registry-lookup": async () => {
    const asked = [];
    const feedPage = page(`<a href="/contact">c</a>`, `<link rel="alternate" type="application/rss+xml" href="/feed.xml">`);
    await findContact({ url: "https://s.test/p" }, { readText: async (u) => { asked.push(u); return u === "https://s.test/p" ? { ok: true, contacts: contactsOfRaw(feedPage, u) || undefined } : { ok: false }; }, pause: async () => {}, humans: true });
    assert.ok(asked.length > 1 && asked.every((u) => u.startsWith("https://s.test/")), asked.join(" "));
    assert.ok(asked.every((u) => !/rdap|whois|arin|ripe|godaddy|iana|ipinfo|shodan/i.test(u)));
  },
  "email/guessed-address": () => { const c = contactsFromHtml(page(`<p>Contact us!</p>`), SITE); assert.equal(c.emails.length, 0); },
  "email/machinery-mailbox": () => { assert.equal(contactsFromHtml(page(`<a href="mailto:abuse@maria.test">r</a><a href="mailto:noreply@maria.test">n</a>`), SITE).emails.length, 0); },
  "email/service-desk": () => { assert.equal(contactsFromHtml(page(`<a href="mailto:customer.service@maria.test">r</a><a href="mailto:orders@maria.test">o</a>`), SITE).emails.length, 0); },
  "email/other-company-domain": () => { assert.equal(contactsFromHtml(page(`<a href="mailto:ana@fulfilment-house.test">r</a>`), SITE).emails.length, 0); },
  "email/commented-out": () => {
    assert.equal(contactsFromHtml(page(`<!-- <a href="mailto:ana@maria.test">mail</a> --><p>hi</p>`), SITE).emails.length, 0, "a commented-out mailto is not published");
    assert.equal(contactsFromHtml(page(`<a href="mailto:ana@maria.test">mail</a>`), SITE).emails.length, 1);
  },
  "email/written-for-elsewhere": () => { assert.equal(contactsFromHtml(page(`<p>For advertising enquiries write to ads2@maria.test</p>`), "https://maria.test/contact/").emails.length, 0); },
  "form/comment-form": () => { assert.equal(contactsFromHtml(page(`<form id="commentform"><textarea name="comment"></textarea></form>`), SITE).forms.length, 0); },
  "social-profile/share-button": () => {
    const shares = ["https://www.facebook.com/sharer/sharer.php?u=https://x.test/p", "https://www.facebook.com/sharer.php?u=https%3A%2F%2Fx.test", "https://www.facebook.com/dialog/share?app_id=1&href=https://x.test", "https://twitter.com/intent/tweet?text=hi&url=https://x.test", "https://twitter.com/share?url=https://x.test", "https://x.com/intent/post?text=hi", "https://www.pinterest.com/pin/create/button/?url=https://x.test", "https://api.whatsapp.com/send?text=hi", "https://wa.me/?text=hi", "https://www.linkedin.com/shareArticle?mini=true&url=https://x.test", "https://www.linkedin.com/sharing/share-offsite/?url=https://x.test", "https://t.me/share/url?url=https://x.test", "https://www.reddit.com/submit?url=https://x.test", "https://www.facebook.com/plugins/like.php?href=https://x.test"];
    for (const h of shares) assert.equal(socials(page(`<footer><a href="${h}">Share</a></footer>`), SOC_PAGE).length, 0, h);
    assert.equal(socials(page(`<footer><a href="mailto:?subject=Look&body=https://x.test">Share by email</a></footer>`), SOC_PAGE).length, 0);
  },
  "social-profile/share-toolbar": () => {
    for (const cls of ["addtoany_share_save_container", "sharedaddy sd-sharing-enabled", "social-share", "sharethis-inline-share-buttons", "shareaholic-canvas", "post-share-buttons"]) assert.equal(socials(page(`<div class="${cls}"><a href="https://www.instagram.com/janedoe">i</a><a href="https://www.facebook.com/janedoe">f</a></div>`), SOC_PAGE).length, 0, cls);
    assert.equal(socials(page(`<footer><a href="https://www.instagram.com/janedoe">i</a></footer>`), SOC_PAGE).length, 1, "the same links outside a toolbar are profiles");
  },
  "social-profile/comment-profile": () => {
    assert.equal(socials(page(`<ol class="comment-list"><li><a href="https://www.instagram.com/janedoe">my insta</a></li></ol><div id="respond"><a href="https://twitter.com/janedoe">me</a></div>`), SOC_PAGE).length, 0);
    assert.equal(socials(page(`<footer><a rel="ugc" href="https://www.instagram.com/janedoe">i</a></footer>`), SOC_PAGE).length, 0);
  },
  "social-profile/embedded-post": () => {
    assert.equal(socials(page(`<blockquote class="twitter-tweet"><p>hi</p>&mdash; Jane (@janedoe) <a href="https://twitter.com/janedoe">link</a></blockquote>`), SOC_PAGE).length, 0);
    assert.equal(socials(page(`<div class="instagram-media"><a href="https://www.instagram.com/janedoe/">view</a></div><blockquote><a href="https://www.tiktok.com/@janedoe">x</a></blockquote>`), SOC_PAGE).length, 0);
  },
  "social-profile/post-or-video-url": () => {
    for (const h of ["https://twitter.com/janedoe/status/123", "https://www.instagram.com/p/ABC123/", "https://www.instagram.com/reel/ABC/", "https://www.youtube.com/watch?v=abc", "https://www.tiktok.com/@janedoe/video/1", "https://github.com/janedoe/repo", "https://www.facebook.com/janedoe/posts/123", "https://bsky.app/profile/janedoe.test/post/3k", "https://www.youtube.com/playlist?list=PL1", "https://www.pinterest.com/pin/123/"]) assert.equal(socials(page(`<footer><a href="${h}">x</a></footer>`), SOC_PAGE).length, 0, h);
  },
  "social-profile/lookalike-host": () => {
    for (const h of ["https://instagram.com.evil.test/janedoe", "https://instagram.com@evil.test/janedoe", "https://www.facebook.com.evil.test/janedoe", "https://x.com.evil.test/janedoe"]) assert.equal(socials(page(`<footer><a href="${h}">x</a></footer>`), SOC_PAGE).length, 0, h);
  },
  "social-profile/platform-own-nav": () => {
    const gh = page(`<header><a href="https://github.com/features">Features</a><a href="https://github.com/marketplace">Marketplace</a><a href="/enterprise">Enterprise</a><a href="https://github.com/sindresorhus">owner</a><a href="https://github.com/torvalds">other</a></header>`);
    const f = socials(gh, "https://github.com/sindresorhus/got");
    assert.deepEqual(f.map((x) => x.url), ["https://github.com/sindresorhus"], "on a platform's own pages only the page owner's profile counts");
  },
  "social-profile/someone-elses-profile": () => {
    assert.equal(socials(page(`<article><p>Follow <a href="https://www.instagram.com/someoneelse">Someone</a> too.</p></article>`), SOC_PAGE).length, 0);
    assert.equal(socials(page(`<article><p><a href="https://www.instagram.com/janedoe">me</a></p></article>`), SOC_PAGE).length, 1, "the page's own name in the handle is evidence");
    // two profiles on one platform: the second only when declared, named like the site, or both in the chrome as the page owner's
    assert.equal(socials(page(`<footer><a href="https://www.instagram.com/janedoe">a</a><a href="https://www.instagram.com/stranger">b</a></footer>`), SOC_PAGE).length, 1);
    // a link hub or a subreddit is shared ground unless declared or named like the site
    assert.equal(socials(page(`<footer><a href="https://linktr.ee/somepodcast">Podcast</a><a href="https://www.reddit.com/r/somecommunity">Subreddit</a></footer>`), SOC_PAGE).length, 0);
    assert.equal(socials(page(`<footer><a href="https://linktr.ee/janedoe">Links</a></footer>`), SOC_PAGE).length, 1);
  },
  "social-profile/constructed-profile": () => {
    assert.equal(socials(page(`<p>Follow @janedoe on Instagram, find me at @janedoe@mastodon.social, X: @janedoe</p><footer><span>instagram: janedoe</span></footer>`), SOC_PAGE).length, 0);
  },
  "website/other-site": () => {
    assert.equal(websiteOf("https://maria.test/a/b?x=1#y").url, "https://maria.test/");
    const r = routesInPage(page(`<footer><a href="https://friend.test/">my friend's site</a></footer>`), "https://maria.test/p");
    assert.equal(r.website.url, "https://maria.test/", "the page's own origin, never a site it links to");
  },
  "website/non-http": () => { assert.equal(websiteOf("javascript:alert(1)"), null); assert.equal(websiteOf("data:text/html,x"), null); assert.equal(websiteOf("mailto:a@b.test"), null); assert.equal(websiteOf(""), null); },
};

test("FALSIFIERS: every anti-pattern the definition declares has a test here, and no test is for an anti-pattern the definition does not declare", () => {
  assert.deepEqual(Object.keys(FALSIFIERS).sort(), FALSIFIER_IDS.slice().sort());
});
for (const [id, fn] of Object.entries(FALSIFIERS)) test(`FALSIFIER ${id}`, async () => { await fn(); });

// ── positives and details ───────────────────────────────────────────────────────────────────────────────────────────
test("tip links: a published platform link, in the chrome or with its own words, is found with platform, host, evidence and an address that re-expands to the anchor", () => {
  const html = page(`<p>héllo wörld ✓</p><footer><a href="https://ko-fi.com/maria" class="x">Buy me a coffee</a></footer>`);
  const f = tips(html, SITE);
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, "tip-link"); assert.equal(f[0].platform, "kofi"); assert.equal(f[0].host, "ko-fi.com"); assert.equal(f[0].url, "https://ko-fi.com/maria");
  assert.ok(f[0].evidence.includes("platform-host") && f[0].evidence.includes("chrome") && f[0].evidence.includes("words"));
  assert.equal(f[0].at.page, SITE); assert.equal(f[0].at.node, "a"); assert.equal(f[0].at.unit, "utf8-bytes");
  assert.match(expand(html, f[0].at), /^<a href="https:\/\/ko-fi\.com\/maria" class="x">Buy me a coffee<\/a>$/, "the byte range survives non-ASCII text before it");
  assert.equal(f[0].where, "on the page");
  assert.equal(expand("abc", { range: null }), "");
  assert.deepEqual(addressOf("p", "a", "héé", 1, 2).range, [1, 3]);
});

test("tip links: http is upgraded for a platform host, a port or credentials refuse, the same page is not a tip link, a fragment and tracking are dropped", () => {
  assert.equal(tips(page(`<footer><a href="http://ko-fi.com/maria">Support me</a></footer>`))[0].url, "https://ko-fi.com/maria");
  assert.equal(tips(page(`<footer><a href="https://ko-fi.com:8443/maria">Support me</a></footer>`)).length, 0);
  assert.equal(tips(page(`<footer><a href="/#patreon">Patreon</a><a href="/">Donate</a></footer>`)).length, 0, "an anchor to this very page is not a tip page");
  assert.equal(tips(page(`<footer><a href="https://ko-fi.com/maria?utm_source=x#top">Support me</a></footer>`))[0].url, "https://ko-fi.com/maria");
});

test("tip links: the creator's own site counts only on its own strong words; a headline or an article slug is not a button", () => {
  assert.equal(tips(page(`<header><a href="https://give.maria.test/campaign/9/donate">Donate</a></header>`))[0].platform, "own-site");
  assert.equal(tips(page(`<header><a href="https://members.maria.test/">Patreon</a></header>`))[0].platform, "own-site", "a platform name counts for the creator's OWN subdomain");
  assert.equal(tips(page(`<main><a href="/article/campaign-donations-investigation-by-our-staff-of-three">Investigation: how campaign donations moved</a></main>`)).length, 0);
  assert.equal(tips(page(`<main><a href="/news/2026/big-story">${"Why donations matter to every one of us and how it all works out, a long headline for sure"}</a></main>`)).length, 0);
  assert.equal(tips(page(`<footer><a href="/about">About</a><a href="/membership">Membership</a></footer>`)).length, 0, "weak words alone never accept a link");
});

test("tip links: Substack and Gumroad need words; a mailing-list sign-up is not a tip", () => {
  assert.equal(tips(page(`<footer><a href="https://maria.substack.com/subscribe">Mailing list</a></footer>`)).length, 0);
  assert.equal(tips(page(`<footer><a href="https://maria.substack.com/subscribe">Support the writing</a></footer>`)).length, 1);
  assert.equal(tips(page(`<footer><a href="https://substack.com/subscribe">Support the writing</a></footer>`)).length, 0, "the bare platform page is not a publication");
});

test("structured data and rel links: a DonateAction target, a sameAs on a creator platform, rel=payment, rel=me on a platform", () => {
  const ld = { "@graph": [{ "@type": "Organization", sameAs: ["https://www.patreon.com/maria", "https://twitter.com/maria"], potentialAction: { "@type": "DonateAction", target: { "@type": "EntryPoint", url: "https://maria.test/donate" } } }] };
  const f = tips(page(`<p>x</p>`, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`));
  assert.deepEqual(f.map((x) => x.kind), ["structured-donate", "structured-donate"]);
  assert.deepEqual(f.map((x) => x.url).sort(), ["https://maria.test/donate", "https://www.patreon.com/maria"]);
  assert.ok(f.every((x) => x.where === "in the page's structured data" && x.at.node === "json-ld"));
  const r = tips(page(`<p>x</p>`, `<link rel="payment" href="https://paypal.me/maria"><link rel="me" href="https://liberapay.com/maria">`));
  assert.deepEqual(r.map((x) => x.kind), ["rel-payment", "rel-payment"]);
  assert.ok(r.every((x) => /marks as a payment or donation link/.test(x.where)));
});

test("a marketplace page (skipTips) offers no tip, social or website: the site's address is the platform's, not the creator's", () => {
  const r = routesInPage(page(`<footer><a href="https://ko-fi.com/maria">tip me</a><a href="https://www.instagram.com/allrecipes">i</a></footer>`), "https://www.allrecipes.com/recipe/1/", { skipTips: true });
  assert.deepEqual([r.findings.filter((f) => f.kind !== "email").length, r.socials.length, r.website], [0, 0, null]);
});

test("social profiles: rel=me (any Mastodon instance), JSON-LD sameAs and footer icons are found, capped at six, one per platform unless declared, shown with platform and host", () => {
  const ld = { "@type": "Person", sameAs: ["https://www.instagram.com/maria", "https://www.youtube.com/@maria"] };
  const html = page(`<footer><a rel="me" href="https://hachyderm.io/@maria">Mastodon</a><a href="https://bsky.app/profile/maria.bsky.social">b</a><a href="https://www.linkedin.com/in/maria">l</a><a href="https://www.tiktok.com/@maria">t</a><a href="https://www.twitch.tv/maria">tw</a><a href="https://www.pinterest.com/maria">p</a></footer>`, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
  const f = socials(html, "https://maria.test/");
  assert.equal(f.length, 6, "capped");
  assert.ok(f.every((x) => x.platformName && x.host && x.url.startsWith("https://") && x.at.node));
  assert.ok(socials(html, "https://maria.test/", { cap: 99 }).length >= 8);
  const m = f.find((x) => x.platform === "mastodon");
  assert.ok(m && m.platformName === "Mastodon (hachyderm.io)" && m.evidence.includes("rel"));
  assert.equal(socials(page(`<footer><a href="https://hachyderm.io/@maria">Mastodon</a></footer>`), "https://maria.test/").length, 0, "a Mastodon instance counts only when the page declares it (rel=me / sameAs)");
  assert.equal(socials(page(`<footer><a href="https://twitter.com/maria">t</a><a href="https://x.com/maria">x</a></footer>`), "https://maria.test/").length, 1, "x.com and twitter.com are one account");
});

test("website: the page's own origin, derived (no fetch); stored social routes are re-verified, never trusted", () => {
  assert.equal(websiteOf("https://www.maria.test/a/b").host, "maria.test");
  assert.equal(socialStillValid({ url: "https://www.instagram.com/maria", platform: "instagram" }, SITE), true);
  assert.equal(socialStillValid({ url: "javascript:alert(1)" }, SITE), false);
  assert.equal(socialStillValid({ url: "https://evil.test/@x", platform: "mastodon", evidence: ["chrome"] }, SITE), false);
  assert.equal(socialStillValid({ url: "https://www.facebook.com/sharer/sharer.php?u=x" }, SITE), false);
  assert.equal(tipStillValid({ url: "https://ko-fi.com.evil.test/x" }, SITE), false);
  assert.equal(tipStillValid({ url: "http://ko-fi.com/x" }, SITE), false, "stored routes must already be https");
  assert.equal(tipStillValid({ url: "https://ko-fi.com/maria" }, SITE), true);
});

test("the feed: an RSS managingEditor and an Atom author give a NAME; an address only through the email rules", () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title><managingEditor>maria@maria.test (Maria Lopez)</managingEditor><item><link>https://maria.test/a</link><dc:creator><![CDATA[Maria Lopez]]></dc:creator></item></channel></rss>`;
  const a = authorFromFeed(parseFeed(rss), SITE);
  assert.equal(a.name, "Maria Lopez"); assert.equal(a.email, "maria@maria.test"); assert.match(a.emailFrom, /managingEditor/);
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><author><name>Julia</name></author><entry><link href="https://maria.test/a" rel="alternate"/><author><name>Julia E</name></author></entry></feed>`;
  assert.equal(authorFromFeed(parseFeed(atom), "https://maria.test/a").name, "Julia E");
  assert.equal(authorFromFeed(parseFeed(atom), "https://maria.test/zz").name, "Julia");
  assert.equal(parseFeed("<html><body>not a feed</body></html>"), null);
  assert.equal(authorFromFeed(parseFeed(`<rss><channel><managingEditor>x@gmail.com (admin)</managingEditor></channel></rss>`), SITE).name, undefined, "a role word is not a name");
});

test("humans.txt: names and tip links only through the same rules; an HTML error page offers nothing", () => {
  const h = humansOfText(`/* TEAM */\nName: Maria Lopez\nSupport: https://ko-fi.com/maria\nShop: https://www.etsy.com/shop/maria\nContact: maria@maria.test\nAbuse: abuse@maria.test`, SITE);
  assert.equal(h.name, "Maria Lopez");
  assert.deepEqual(h.tips.map((t) => t.url), ["https://ko-fi.com/maria"]);
  assert.deepEqual(h.emails, ["maria@maria.test"]);
  assert.equal(humansOfText("<!doctype html><html><body>Not found</body></html>", SITE), null);
});

// ── findContact: the route order and its budgets ─────────────────────────────────────────────────────────────────────
const reader = (pages, log = []) => ({ asked: log, readText: async (u, o) => { log.push(o && o.direct ? u + " [direct]" : u); const raw = pages[u]; return raw == null ? { ok: false, url: u } : { ok: true, url: u, text: "x", contacts: contactsOfRaw(raw, u) || undefined }; }, pause: async () => {} });

test("findContact: a tip link on the page wins over an email; both are reported; nothing is loaded when the card holds them", async () => {
  const p = page(`<footer><a href="https://ko-fi.com/maria">Support me</a><a href="mailto:maria@gmail.com">mail</a></footer>`);
  const contact = contactOfPassage({ url: SITE, contacts: contactsOfRaw(p, SITE) });
  assert.equal(contact.kind, "tip"); assert.equal(contact.tip.url, "https://ko-fi.com/maria"); assert.equal(contact.email.address, "maria@gmail.com");
  const s = reader({});
  const r = await findContact({ url: SITE, contact }, s);
  assert.deepEqual([r.kind, r.tip.platform, r.email.address, r.tip.where], ["tip", "kofi", "maria@gmail.com", "on the page"]);
  assert.deepEqual(s.asked, [], "the click loads nothing");
  assert.equal(r.website.url, SITE);
});

test("findContact: with nothing captured the page is read; a tip link on the creator's contact page is found there and says so", async () => {
  const s = reader({ "https://m.test/r": page(`<a href="/contact/">Contact</a>`), "https://m.test/contact/": page(`<footer><a href="https://www.patreon.com/maria">Support me</a></footer>`) });
  const r = await findContact({ url: "https://m.test/r" }, s);
  assert.deepEqual([r.kind, r.tip.url, r.tip.where], ["tip", "https://www.patreon.com/maria", "on their contact page"]);
  assert.deepEqual(s.asked, ["https://m.test/r", "https://m.test/contact/"]);
});

test("findContact: feed (route 2) then humans.txt (route 3, direct door only): at most 2 extra loads, sequential, paced, same site, never a registry", async () => {
  const feed = `<rss><channel><managingEditor>maria@m.test (Maria Lopez)</managingEditor></channel></rss>`;
  const home = page(`<p>nothing</p>`, `<link rel="alternate" type="application/rss+xml" href="/feed/">`);
  const s = reader({ "https://m.test/r": home, "https://m.test/feed/": feed });
  const r = await findContact({ url: "https://m.test/r" }, s);
  assert.deepEqual([r.kind, r.address, r.where, r.name], ["email", "maria@m.test", "the site's feed (managingEditor)", "Maria Lopez"]);
  assert.deepEqual(s.asked, ["https://m.test/r", "https://m.test/feed/"]);
  // a feed that names only an author (no address) then humans.txt: both consumed, then the budget stops
  const s2 = reader({ "https://m.test/r": home, "https://m.test/feed/": `<rss><channel><item><link>https://m.test/r</link><dc:creator>Maria</dc:creator></item></channel></rss>`, "https://m.test/humans.txt": "Name: Maria\nSupport: https://liberapay.com/maria" });
  const r2 = await findContact({ url: "https://m.test/r" }, { ...s2, humans: true });
  assert.deepEqual([r2.kind, r2.tip.url, r2.tip.where, r2.name], ["tip", "https://liberapay.com/maria", "in their humans.txt", "Maria"]);
  assert.deepEqual(s2.asked, ["https://m.test/r", "https://m.test/feed/", "https://m.test/humans.txt [direct]"]);
  assert.equal(TIP_LIMITS.maxExtra, 2);
  // humans.txt is off by default (the app turns it on) and never reaches beyond the site
  const s3 = reader({ "https://m.test/r": page(`<p>x</p>`) });
  await findContact({ url: "https://m.test/r" }, s3);
  assert.deepEqual(s3.asked, ["https://m.test/r"]);
  const s4 = reader({ "https://m.test/r": page(`<p>x</p>`) });
  await findContact({ url: "https://m.test/r" }, { ...s4, humans: true });
  assert.deepEqual(s4.asked, ["https://m.test/r", "https://m.test/humans.txt [direct]"]);
});

test("findContact: the extra loads are capped at TIP_LIMITS.maxExtra even when more are offered", async () => {
  const home = page(`<p>x</p>`, `<link rel="alternate" type="application/rss+xml" href="/feed/"><link rel="alternate" type="application/atom+xml" href="/atom/">`);
  const s = reader({ "https://m.test/r": home, "https://m.test/feed/": `<rss><channel></channel></rss>`, "https://m.test/atom/": `<feed></feed>` });
  const r = await findContact({ url: "https://m.test/r" }, { ...s, humans: true, maxExtra: 2 });
  assert.equal(s.asked.length, 3, s.asked.join(" "));
  assert.equal(r.kind, "none");
});

test("findContact: nothing to tip -> kind none, but the creator's own website and profiles are returned (never a dead end), never fetched", async () => {
  const p = page(`<footer><a href="https://www.instagram.com/janedoe">i</a><a href="https://www.youtube.com/@janedoe">y</a></footer>`);
  const contact = contactOfPassage({ url: SOC_PAGE + "r/1", contacts: contactsOfRaw(p, SOC_PAGE + "r/1") });
  assert.equal(contact.kind, "social");
  const s = reader({});
  const r = await findContact({ url: SOC_PAGE + "r/1", contact }, s);
  assert.equal(r.kind, "none");
  assert.deepEqual(r.socials.map((x) => x.platform), ["instagram", "youtube"]);
  assert.equal(r.website.url, SOC_PAGE);
  assert.deepEqual(s.asked, [], "a profile page is never visited by the Fold");
  const bare = await findContact({ url: "https://q.test/r" }, reader({ "https://q.test/r": page(`<p>nothing</p>`) }));
  assert.deepEqual([bare.kind, bare.website.url, bare.socials], ["none", "https://q.test/", undefined]);
});

test("findContact: a marketplace page gets no website, profiles or tips (the old honest none)", async () => {
  const r = await findContact({ url: "https://www.allrecipes.com/recipe/1/", contact: { kind: "tip", tip: { url: "https://ko-fi.com/x", platform: "kofi", platformName: "Ko-fi", host: "ko-fi.com", where: "on the page" } } }, reader({}));
  assert.deepEqual([r.kind, r.website, r.socials], ["none", undefined, undefined]);
});

test("findContact: a stored tip or profile is re-verified: another host, a javascript: URL or a lookalike is dropped", async () => {
  for (const tip of [{ url: "javascript:alert(1)" }, { url: "https://evil.test/pay", own: false }, { url: "https://ko-fi.com.evil.test/x" }, { url: "http://ko-fi.com/x" }]) {
    const r = await findContact({ url: "https://m.test/r", contact: { kind: "tip", tip: { platform: "kofi", platformName: "Ko-fi", host: "x", where: "on the page", ...tip } } }, reader({}));
    assert.notEqual(r.kind, "tip", JSON.stringify(tip));
  }
  const r = await findContact({ url: "https://m.test/r", contact: { kind: "social", socials: [{ url: "https://evil.test/janedoe", platform: "instagram", platformName: "Instagram", host: "evil.test" }, { url: "https://www.instagram.com/m", platform: "instagram", platformName: "Instagram", host: "www.instagram.com" }] } }, reader({}));
  assert.deepEqual(r.socials.map((x) => x.url), ["https://www.instagram.com/m"]);
});

test("no registry, WHOIS, RDAP, IP or hosting lookup exists in the tip code, and nothing in it fetches by itself", () => {
  for (const f of ["fold-chat-support.js", "fold-chat-tip.js", "fold-chat-tipview.js", "fold-chat-contact.js"]) {
    const src = fs.readFileSync(new URL("./" + f, import.meta.url), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/\b(rdap|whois|arin\.net|ripe\.net|ipinfo|ipapi|shodan|dns\.google|cloudflare-dns|nslookup|dns\.resolve)\b/i.test(src), `${f}: a registry / IP / hosting lookup`);
    assert.ok(!/security\.txt|\.well-known/i.test(src), `${f}: security.txt`);
    assert.ok(!/\bfetch\s*\(/.test(src), `${f}: fetches by itself (the injected reader is the only door)`);
  }
  assert.ok(SUPPORT.never.some((n) => /registry|WHOIS|RDAP/.test(n)) && SUPPORT.never.some((n) => /security\.txt/.test(n)));
  assert.deepEqual(SUPPORT.budget.directDoorOnly, ["humans.txt"]);
});

test("the holograph query: which sources offer a way to support the creator? (typed, ordered tip -> email -> form; the model is never handed where it was found)", () => {
  const withTip = { url: "https://a.test/", contacts: contactsOfRaw(page(`<footer><a href="https://ko-fi.com/a">support me</a></footer>`), "https://a.test/") };
  const withMail = { url: "https://b.test/", contacts: contactsOfRaw(page(`<a href="mailto:b@gmail.com">m</a>`), "https://b.test/") };
  const nothing = { url: "https://c.test/", contacts: null };
  assert.equal(offeredKind(withTip), "tip"); assert.equal(offeredKind(withMail), "email"); assert.equal(offeredKind(nothing), null);
  assert.deepEqual(sourcesOffering([nothing, withMail, withTip]).map((x) => x.via), ["tip", "email"]);
  assert.deepEqual(sourcesOffering([withMail, withTip], ["email"]).map((x) => x.via), ["email"]);
  const p = { ref: "x — T", url: "https://a.test/", text: "Some recipe text here", contacts: withTip.contacts };
  const block = sourcesPrompt([p]);
  assert.ok(!block.includes("ko-fi") && !block.includes("utf8-bytes"), "the prompt carries the page text, not its routes or their addresses");
  const c = contactOfPassage(p);
  assert.equal(offeredKind({ contact: c }), "tip");
});

test("TIP_SAY / TIP_LABELS: the exact words the surface uses for the new outcomes", () => {
  assert.equal(TIP_SAY.tip("Ko-fi", "ko-fi.com", "on the page"), "Opened the creator's Ko-fi page (ko-fi.com), found on the page. The Fold sends nothing and takes nothing; you tip on their page.");
  assert.match(TIP_SAY.tip("their own site", "give.m.test", "on the page"), /own support page/);
  assert.match(TIP_SAY.tipFound("Ko-fi", "ko-fi.com", "on the page"), /Press the link below to open it/);
  assert.equal(TIP_SAY.noneHere, "No way to tip them directly. Their own pages:");
  assert.equal(TIP_LABELS.open("Ko-fi", "ko-fi.com"), "Open Ko-fi (ko-fi.com)");
  assert.equal(TIP_LABELS.emailAlt, "Or email them");
});

test("contactsOfRaw: a feed and a humans.txt are read for what they name; an ordinary page that offers only a feed carries it", () => {
  assert.ok(contactsOfRaw(`<rss><channel><managingEditor>a@b.test (Ann)</managingEditor></channel></rss>`, "https://b.test/feed/").feed);
  assert.equal(contactsOfRaw("Name: Ann\nSupport: https://liberapay.com/ann", "https://b.test/humans.txt").humans.tips.length, 1);
  const c = contactsOfRaw(page(`<p>x</p>`, `<link rel="alternate" type="application/rss+xml" href="/feed">`), "https://b.test/p");
  assert.deepEqual(c.feeds, ["https://b.test/feed"]);
  assert.equal(contactsOfRaw(page(`<p>x</p>`), "https://b.test/p"), null);
});
