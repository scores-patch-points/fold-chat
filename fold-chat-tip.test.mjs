import { test } from "node:test";
import assert from "node:assert/strict";
import { tipDraft, findContact, firstNameOf, contactOfPassage, contactsOfRaw, TIP_SAY, TIP_LIMITS, DRAFT_LINE } from "./fold-chat-tip.js";
import { contactsFromHtml } from "./fold-chat-contact.js";
import { sourcesPrompt } from "./fold-chat-gaps.js";

const cf = (addr, key = 0x4b) => key.toString(16).padStart(2, "0") + [...addr].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, "0")).join("");
const html = (body) => `<html><body>${body}</body></html>`;
// A fake reader over inline pages; counts loads and remembers what it was asked for.
const site = (pages) => { const asked = []; return { asked, readText: async (u) => { asked.push(u); const raw = pages[u]; return raw == null ? { ok: false, url: u } : { ok: true, url: u, text: "x", contacts: contactsOfRaw(raw, u) || undefined }; }, pause: async () => {} }; };
const decode = (m) => { const u = new URL(m); return { to: decodeURIComponent(u.pathname), subject: u.searchParams.get("subject"), body: u.searchParams.get("body") }; };

test("tipDraft: the user's words, the title and link, a blank sign-off; subject names the title", () => {
  const d = tipDraft({ to: "sally@sally.test", creator: "Sally McKenney", title: "Banana Bread", url: "https://sally.test/banana-bread/" });
  assert.equal(d.subject, 'A tip for "Banana Bread"');
  assert.ok(d.body.startsWith("Hi Sally! " + DRAFT_LINE));
  assert.ok(d.body.includes("Banana Bread") && d.body.includes("https://sally.test/banana-bread/"));
  assert.ok(d.body.endsWith("Thank you,\n"), "a blank line is left for the person's name");
  const m = decode(d.mailto);
  assert.equal(m.to, "sally@sally.test"); assert.equal(m.subject, d.subject); assert.equal(m.body.replace(/\r\n/g, "\n"), d.body);
});

test("tipDraft: 'Hi <first name>!' only when the page declared a person; otherwise a plain 'Hi!'", () => {
  assert.ok(tipDraft({ creator: "", title: "T" }).body.startsWith("Hi! I enjoyed"));
  for (const org of ["Sally's Baking Addiction", "Natasha's Kitchen", "The Editorial Team", "example.com", "Bon Appétit Magazine", "A B C D E F"]) assert.equal(firstNameOf(org), "", org);
  assert.equal(firstNameOf("Natasha Kravchuk"), "Natasha"); assert.equal(firstNameOf("Élodie Martin"), "Élodie");
});

test("tipDraft: encoded, no raw newline or space in the URL, capped, title trimmed to ~100", () => {
  const long = "T".repeat(500);
  const d = tipDraft({ to: "a@b.test", creator: "Ann Lee", title: long, url: "https://b.test/x?" + "q=1&".repeat(600) });
  assert.ok(d.mailto.length <= TIP_LIMITS.maxMailto, "length " + d.mailto.length);
  assert.ok(!/[\n\r ]/.test(d.mailto));
  assert.ok(d.mailto.includes("%0D%0A"));
  assert.ok(decode(d.mailto).subject.length <= 100 + 'A tip for ""'.length);
});

test("tipDraft: a title with &, ?, #, quotes and line breaks cannot add a recipient or a header", () => {
  const d = tipDraft({ to: "a@b.test", title: 'Eggs & "Toast"?\n&cc=evil@x.test&bcc=evil@x.test#x', url: "https://b.test/" });
  const u = new URL(d.mailto);
  assert.deepEqual([...u.searchParams.keys()].sort(), ["body", "subject"]);
  assert.ok(!/(^|[&?])(cc|bcc|to)=/.test(d.mailto));
});

test("FALSIFIER: tipDraft refuses an address that is a list or carries a query (header smuggling)", () => {
  for (const to of ["a@b.test,evil@x.test", "a@b.test?bcc=evil@x.test", "a@b.test\nbcc: evil@x.test", "a@b.test;evil@x.test", "<a@b.test>", "abuse@b.test", "x"]) assert.throws(() => tipDraft({ to, title: "T" }), /usable/, to);
  assert.equal(tipDraft({ title: "T" }).mailto, null, "no address, no mailto (a contact form needs only the body)");
});

test("findContact (a): the address captured when the page was read is used, and nothing is loaded", async () => {
  const s = site({});
  const found = contactsFromHtml(html(`<a href="mailto:ana@cook.test">hi</a>`), "https://cook.test/p");
  const r = await findContact({ url: "https://cook.test/p", contacts: found }, s);
  assert.deepEqual([r.kind, r.address, r.where], ["email", "ana@cook.test", "a mailto link on the page"]);
  assert.deepEqual(s.asked, []);
  const r2 = await findContact({ url: "https://cook.test/p", contact: { kind: "email", address: "ana@cook.test", where: "a mailto link on the page" } }, s);
  assert.equal(r2.address, "ana@cook.test"); assert.deepEqual(s.asked, []);
});

test("findContact (b): with nothing captured, reads the page, then the site's own contact page; says where it was found", async () => {
  const s = site({
    "https://latte.test/banana/": html(`<a href="/contact/">Contact</a><a href="https://elsewhere.test/contact">Contact</a>`),
    "https://latte.test/contact/": html(`<a href="/cdn-cgi/l/email-protection#${cf("maria@gmail.com")}">[email protected]</a>`),
  });
  const r = await findContact({ url: "https://latte.test/banana/" }, s);
  assert.deepEqual([r.kind, r.address], ["email", "maria@gmail.com"]);
  assert.equal(r.where, "a protected email link on their contact page");
  assert.deepEqual(s.asked, ["https://latte.test/banana/", "https://latte.test/contact/"]);
});

test("findContact: loads are capped (the page + at most 2 of the site's contact pages), one at a time, same site only, paced", async () => {
  const pauses = []; let busy = 0, peak = 0;
  const pages = { "https://s.test/p": html(`<a href="/contact">c</a><a href="/about">a</a><a href="/kontakt">k</a><a href="https://evil.test/contact">e</a>`) };
  const reader = async (u) => { busy++; peak = Math.max(peak, busy); await new Promise((r) => setTimeout(r, 2)); busy--; return pages[u] ? { ok: true, contacts: contactsOfRaw(pages[u], u) || undefined } : { ok: true, contacts: undefined }; };
  const asked = []; 
  const r = await findContact({ url: "https://s.test/p" }, { readText: async (u) => { asked.push(u); return reader(u); }, pause: async (ms) => { pauses.push(ms); } });
  assert.equal(r.kind, "none");
  assert.equal(asked.length, 3, asked.join(" "));
  assert.ok(asked.every((u) => u.startsWith("https://s.test/")));
  assert.equal(peak, 1);
  assert.deepEqual(pauses, [TIP_LIMITS.pauseMs, TIP_LIMITS.pauseMs]);
  assert.deepEqual(r.tried, asked);
});

test("findContact (c): no email but a message form -> the form; (d) nothing -> none, listing what was tried", async () => {
  const form = html(`<form><textarea></textarea></form>`);
  const s = site({ "https://n.test/r": html(`<a href="/contact/">Contact</a>`), "https://n.test/contact/": form });
  const r = await findContact({ url: "https://n.test/r" }, s);
  assert.deepEqual([r.kind, r.url, r.where], ["form", "https://n.test/contact/", "the site's contact form"]);
  const s2 = site({ "https://q.test/r": html(`<p>nothing</p>`) });
  const n = await findContact({ url: "https://q.test/r" }, s2);
  assert.deepEqual([n.kind, n.tried], ["none", ["https://q.test/r"]]);
  const dead = await findContact({ url: "https://q.test/r" }, site({}));
  assert.equal(dead.kind, "none");
});

test("findContact: a reader that throws is a 'none', never a crash", async () => {
  const r = await findContact({ url: "https://z.test/" }, { readText: async () => { throw new Error("boom"); }, pause: async () => {} });
  assert.equal(r.kind, "none");
});

test("FALSIFIER: a page whose only address is info@ in an HTML comment is not offered (never guessed, never constructed)", async () => {
  const s = site({ "https://c.test/p": html(`<!-- info@c.test --><p>Contact us</p>`) });
  const r = await findContact({ url: "https://c.test/p" }, s);
  assert.equal(r.kind, "none");
  assert.equal(JSON.stringify(r).includes("@"), false);
});

test("FALSIFIER: an abuse@ / machinery address is dropped even when the page links it", async () => {
  const s = site({ "https://c.test/p": html(`<a href="mailto:abuse@c.test">report</a><a href="mailto:privacy@c.test">p</a>`) });
  assert.equal((await findContact({ url: "https://c.test/p" }, s)).kind, "none");
  // and a hand-fed (stored) contact is re-checked, not trusted
  assert.equal((await findContact({ url: "https://c.test/p", contact: { kind: "email", address: "abuse@godaddy.com", where: "a mailto link on the page" } }, site({}))).kind, "none");
  assert.equal((await findContact({ url: "https://c.test/p", contact: { kind: "email", address: "x@y.test", where: "WHOIS record" } }, site({}))).kind, "none", "an address from anywhere but the page's own offerings is refused");
});

test("FALSIFIER: an address written in plain page text of another site is not offered", async () => {
  const s = site({ "https://c.test/p": html(`<p>Questions? stranger@other.test</p>`) });
  assert.equal((await findContact({ url: "https://c.test/p" }, s)).kind, "none");
});

test("FALSIFIER: smuggling through a query string — in the source URL or in a discovered contact link — offers nothing", async () => {
  const s = site({ "https://c.test/p?email=evil@x.test&to=evil@x.test": html(`<a href="/contact?to=evil@x.test">Contact</a>`), "https://c.test/contact/": html(`<p>hello</p>`) });
  const r = await findContact({ url: "https://c.test/p?email=evil@x.test&to=evil@x.test" }, s);
  assert.equal(r.kind, "none");
  assert.ok(s.asked.every((u) => !/evil/.test(u) || u === "https://c.test/p?email=evil@x.test&to=evil@x.test"), "no contact page was requested with an address in it");
  // and the same-site rule holds for a stored contact's pages
  const s2 = site({}); await findContact({ url: "https://c.test/p", contact: { kind: "pages", pages: ["https://evil.test/contact"] } }, s2);
  assert.deepEqual(s2.asked, [], "a page on another site is never loaded");
});

test("the address stays on the card: contactOfPassage keeps it only on the snip's own contact; the model's source block never carries it", () => {
  const p = { ref: "x — T", url: "https://a.test/r", text: "Some recipe text here", contacts: contactsFromHtml(html(`<a href="mailto:ana@a.test">m</a>`), "https://a.test/r") };
  const c = contactOfPassage(p);
  assert.deepEqual([c.kind, c.address, c.where], ["email", "ana@a.test", "a mailto link on the page"]);
  const block = sourcesPrompt([p]);
  assert.ok(!block.includes("ana@a.test") && !block.includes("a.test/r\u0000"), "the prompt carries the page text, not its contacts");
  assert.equal(contactOfPassage({ url: "https://a.test/" }), null);
  assert.equal(contactOfPassage({ url: "https://a.test/", contacts: { emails: [{ address: "abuse@a.test", where: "a mailto link on the page" }], pages: [], forms: [] } }), null);
});

test("TIP_SAY: the exact words the surface uses", () => {
  assert.equal(TIP_SAY.looking("Ana"), "Looking for a way to reach Ana…");
  assert.equal(TIP_SAY.email("a@b.test", "a mailto link on the page"), "Opened an email draft to a@b.test (found a mailto link on the page). Nothing is sent until you send it.");
  assert.equal(TIP_SAY.form, "No public email. Opened their contact page; your message is copied — paste it there.");
  assert.equal(TIP_SAY.none, "Couldn't find a public contact for this creator. The original page is linked above.");
});
