import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeCfEmail, isUsableEmail, contactsFromHtml, pickContact, hostBase } from "./fold-chat-contact.js";

// Build a Cloudflare-protected hex the way Cloudflare does: key byte, then each char XOR key.
const cf = (addr, key = 0x4b) => key.toString(16).padStart(2, "0") + [...addr].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, "0")).join("");
const page = (body, head = "") => `<html><head>${head}</head><body>${body}</body></html>`;

test("decodeCfEmail: the hex of a protected link decodes to the address; junk decodes to nothing", () => {
  assert.equal(decodeCfEmail(cf("hello@example-blog.com")), "hello@example-blog.com");
  assert.equal(decodeCfEmail("zz"), ""); assert.equal(decodeCfEmail("abc"), ""); assert.equal(decodeCfEmail(""), "");
});

test("a Cloudflare protected link on a contact page is found and decoded", () => {
  const h = page(`<a href="/cdn-cgi/l/email-protection#${cf("maria@gmail.com")}"><span class="__cf_email__" data-cfemail="${cf("maria@gmail.com")}">[email&#160;protected]</span></a>`);
  const c = contactsFromHtml(h, "https://latte.test/contact/");
  assert.equal(c.emails[0].address, "maria@gmail.com");
  assert.match(c.emails[0].where, /protected email link/);
});

test("a mailto link is found; its ?subject=&cc= tail is never part of the address", () => {
  const c = contactsFromHtml(page(`<a href="mailto:Ana@Cook.test?subject=Hi&cc=evil@x.test">write</a>`), "https://cook.test/p");
  assert.deepEqual(c.emails.map((e) => e.address), ["ana@cook.test"]);
  assert.match(c.emails[0].where, /mailto link/);
});

test("obfuscation a person reads as an address: name [at] site [dot] com, name (at) site.com", () => {
  const a = contactsFromHtml(page(`<p>Email me: jo [at] jo-writes [dot] com</p>`), "https://jo-writes.com/contact");
  assert.equal(a.emails[0].address, "jo@jo-writes.com");
  const b = contactsFromHtml(page(`<p>jo (at) jo-writes.com</p>`), "https://jo-writes.com/about");
  assert.equal(b.emails[0].address, "jo@jo-writes.com");
});

test("JSON-LD email wins over text and links, and the author comes from structured data", () => {
  const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article","author":{"@type":"Person","name":"Sally McKenney"}},{"@type":"Organization","email":"hello@sally.test"}]}</script>`;
  const c = contactsFromHtml(page(`<a href="mailto:other@sally.test">x</a><p>third@sally.test</p>`, ld), "https://sally.test/recipe");
  assert.equal(c.emails[0].address, "hello@sally.test");
  assert.equal(c.emails[0].where, "the page's structured data");
  assert.equal(c.author, "Sally McKenney");
});

test("ranking: an address on the page's own domain outranks a third party's, same kind of source", () => {
  const c = contactsFromHtml(page(`<a href="mailto:me@gmail.com">a</a><a href="mailto:me@food.test">b</a>`), "https://www.food.test/x");
  assert.deepEqual(c.emails.map((e) => e.address), ["me@food.test", "me@gmail.com"]);
});

test("a third-party address (gmail) is allowed when the page puts it forward by a link", () => {
  const c = contactsFromHtml(page(`<a href="mailto:small.creator@gmail.com">mail</a>`), "https://smallcreator.test/");
  assert.equal(c.emails[0].address, "small.creator@gmail.com");
});

test("contact/about page discovery: same site only, contact before about, non-English labels", () => {
  const h = page(`<nav><a href="/about-me/">About</a> <a href="/contacto">Contacto</a> <a href="https://other.test/contact">Contact</a> <a href="/kontakt/">Kontakt</a> <a href="/lianxi">联系我们</a> <a href="/otoiawase/">お問い合わせ</a> <a href="/contact.pdf">contact</a></nav>`);
  const c = contactsFromHtml(h, "https://blog.test/post/1");
  assert.ok(c.pages.length <= 3);
  assert.ok(c.pages.every((u) => u.startsWith("https://blog.test/")), "never another site");
  assert.ok(!c.pages.some((u) => u.endsWith(".pdf")));
  assert.match(c.pages[0], /contact|kontakt|otoiawase|lianxi/i);
  const labels = contactsFromHtml(page(`<a href="/x1">联系我们</a><a href="/x2">お問い合わせ</a><a href="/x3">Contacto</a>`), "https://b.test/");
  assert.equal(labels.pages.length, 3);
});

test("a message form (a form with a textarea) is detected; a search/comment/newsletter form is not", () => {
  const f = contactsFromHtml(page(`<form action="/send"><input name="n"><textarea name="m"></textarea></form>`), "https://n.test/contact/?utm=1#x");
  assert.deepEqual(f.forms, ["https://n.test/contact/"]);
  assert.deepEqual(contactsFromHtml(page(`<form class="comment-form"><textarea></textarea></form>`), "https://n.test/p").forms, []);
  assert.deepEqual(contactsFromHtml(page(`<form role="search"><input></form>`), "https://n.test/p").forms, []);
});

test("junk is rejected: machinery mailboxes, example/asset strings, placeholders", () => {
  for (const bad of ["abuse@godaddy.com", "noreply@site.test", "privacy@site.test", "legal@site.test", "dmca@site.test", "security@site.test", "postmaster@site.test", "ads@site.test", "webmaster@site.test", "image@2x.png", "logo@3x.webp", "you@example.com", "name@domain.com", "x@sentry.io", "a@b", "not an address", "unsubscribe+abc@site.test"]) assert.equal(isUsableEmail(bad), false, bad);
  for (const good of ["hello@site.test", "maria.lopez@gmail.com", "info@site.test"]) assert.equal(isUsableEmail(good), true, good);
  const c = contactsFromHtml(page(`<a href="mailto:abuse@godaddy.com">report</a><img src="a@2x.png"><p>noreply@site.test</p>`), "https://site.test/contact");
  assert.deepEqual(c.emails, []);
});

test("FALSIFIER: an address only in an HTML comment, a script or a style is not found", () => {
  const h = page(`<!-- info@site.test --><script>var a="contact@site.test"</script><style>/* me@site.test */</style><p>no address here</p>`);
  assert.deepEqual(contactsFromHtml(h, "https://site.test/contact").emails, []);
});

test("FALSIFIER: an address written in ordinary page text on ANOTHER domain is not offered (only a link, structured data, or a contact page puts it forward)", () => {
  const post = page(`<p>Great recipe! Reach out to stranger@elsewhere.test for more.</p>`);
  assert.deepEqual(contactsFromHtml(post, "https://blog.test/recipe/banana").emails, []);
  // but on the site's own contact page the same text is the page putting it forward
  assert.equal(contactsFromHtml(post, "https://blog.test/contact/").emails[0].address, "stranger@elsewhere.test");
  // and an own-domain written address on an ordinary page is the site's own
  assert.equal(contactsFromHtml(page(`<p>Write to cook@blog.test</p>`), "https://www.blog.test/recipe").emails[0].address, "cook@blog.test");
});

test("FALSIFIER: addresses are never read out of URLs or query strings", () => {
  const c = contactsFromHtml(page(`<a href="/contact?to=evil@x.test">Contact us</a><a href="https://blog.test/about?email=bad@x.test">About</a><a href="mailto:?to=evil@x.test">share</a>`), "https://blog.test/post?email=also@x.test&ref=me@y.test");
  assert.deepEqual(c.emails, []);
  assert.ok(c.pages.every((u) => !/[?@]/.test(u)), "discovered pages drop the query");
});

test("pickContact: email beats form beats nothing; nothing is invented", () => {
  assert.deepEqual(pickContact({ emails: [{ address: "a@b.test", where: "a mailto link on the page" }], forms: ["https://b.test/c"] }), { kind: "email", address: "a@b.test", where: "a mailto link on the page" });
  assert.equal(pickContact({ emails: [], forms: ["https://b.test/c"] }).kind, "form");
  assert.deepEqual(pickContact({ emails: [], forms: [] }), { kind: "none" });
  assert.deepEqual(pickContact(null), { kind: "none" });
});

test("hostBase: registrable domain, with two-part country suffixes", () => {
  assert.equal(hostBase("https://www.a.example.com/x"), "example.com");
  assert.equal(hostBase("https://shop.bbc.co.uk/"), "bbc.co.uk");
  assert.equal(hostBase("not a url"), "");
});
