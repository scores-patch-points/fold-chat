import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUrl, guard, installGlobalGuard, isExtension, webReadAccess, ExitBlocked, LOOPBACK_BRIDGES } from "./fold-chat-exit.js";

const ok = (u, o) => checkUrl(u, o).ok;
const code = (u, o) => checkUrl(u, o).code;

test("checkUrl: ordinary public https names pass", () => {
  for (const u of ["https://en.wikipedia.org/wiki/Law", "https://api.github.com/search/repositories?q=x", "https://www.law.cornell.edu/wex/statute_of_frauds", "https://search.brave.com/search?q=a%20b", "https://sub.domain.example.co.uk/p?x=1#y"]) assert.equal(ok(u), true, u);
});

test("checkUrl: not https, or carrying a login, or on an odd port", () => {
  assert.equal(code("http://example.com/"), "scheme");
  assert.equal(code("ftp://example.com/"), "scheme");
  assert.equal(code("file:///etc/passwd"), "scheme");
  assert.equal(code("javascript:alert(1)"), "scheme");
  assert.equal(code("https://user:pw@example.com/"), "credentials");
  assert.equal(code("https://user@example.com/"), "credentials");
  assert.equal(code("https://example.com:8443/"), "port");
  assert.equal(code("https://example.com:443/"), undefined, "the default port written out is still the default port");
});

test("checkUrl: this machine and the person's network cannot be named, however the address is spelled", () => {
  for (const u of [
    "https://127.0.0.1/", "https://127.1/", "https://0x7f.0.0.1/", "https://2130706433/", "https://0177.0.0.1/",   // loopback, four ways
    "https://10.0.0.5/", "https://192.168.1.1/", "https://169.254.169.254/latest/meta-data/", "https://8.8.8.8/",    // any IP literal at all
    "https://[::1]/", "https://[fe80::1]/", "https://[::ffff:127.0.0.1]/", "https://[2001:db8::1]/",
  ]) assert.equal(code(u), "ip-literal", u);
  for (const u of ["https://localhost/", "https://localhost./", "https://%6c%6fcalhost/", "https://intranet/", "https://router/"]) assert.equal(code(u), "single-label", u);
  for (const u of ["https://printer.local/", "https://nas.lan/", "https://git.internal/", "https://x.localhost/", "https://box.home.arpa/", "https://wiki.corp/"]) assert.equal(code(u), "private-name", u);
  for (const u of ["https://127.0.0.1.nip.io/", "https://a.b.sslip.io/", "https://localtest.me/", "https://foo.lvh.me/"]) assert.equal(code(u), "private-name", u);
});

test("checkUrl: junk is refused, not thrown", () => {
  assert.equal(code("not a url"), "malformed");
  assert.equal(code(""), "malformed");
  assert.equal(code(undefined), "malformed");
  assert.equal(code("https://example.com/" + "a".repeat(5000)), "too-long");
});

test("checkUrl: the person's own bridge passes over plain http, on exactly the port named — nothing else on loopback does", () => {
  const o = { bridges: LOOPBACK_BRIDGES };
  const r = checkUrl("http://127.0.0.1:8790/api/tags", o);
  assert.equal(r.ok, true); assert.equal(r.bridge, true);
  assert.equal(ok("http://localhost:8790/v1/chat/completions", o), true);
  assert.equal(ok("http://127.0.0.1:9999/", o), false, "another port is not the bridge");
  assert.equal(ok("http://127.0.0.1/", o), false);
  assert.equal(ok("http://127.0.0.1:8790/", { bridges: [] }), false, "no bridge configured, no exception");
  assert.equal(ok("http://127.0.0.1:7777/x", { bridges: () => ["http://127.0.0.1:7777"] }), true, "bridges may be a function (read at call time)");
});

test("checkUrl: data: and blob: never touch the network and pass", () => {
  assert.equal(checkUrl("data:text/plain,hi").bridge, true);
  assert.equal(checkUrl("blob:chrome-extension://abc/1234").bridge, true);
});

// ── guard ────────────────────────────────────────────────────────────────────
const spy = (res = { ok: true, status: 200, url: "" }) => { const calls = []; const f = async (u, o) => { calls.push({ u, o }); return typeof res === "function" ? res(u, o) : { ...res, url: res.url || String(u?.url || u) }; }; f.calls = calls; return f; };

test("guard: a web call leaves without credentials, referrer, or an Authorization header, and follows redirects", async () => {
  const f = spy(); const g = guard()(f);
  await g("https://example.com/a", { credentials: "include", headers: { Authorization: "Bearer x", Accept: "text/html", cookie: "a=b" }, referrerPolicy: "unsafe-url" });
  const { o } = f.calls[0];
  assert.equal(o.credentials, "omit");
  assert.equal(o.referrerPolicy, "no-referrer");
  assert.equal(o.redirect, "follow");
  assert.deepEqual(o.headers, { Accept: "text/html" });
});

test("guard: headers given as a Headers object or pairs are cleaned too", async () => {
  const f = spy(); const g = guard()(f);
  await g("https://example.com/", { headers: new Headers({ Authorization: "x", "X-Ok": "1" }) });
  assert.deepEqual(f.calls[0].o.headers, { "x-ok": "1" });
  await g("https://example.com/", { headers: [["Cookie", "a"], ["Accept", "*/*"]] });
  assert.deepEqual(f.calls[1].o.headers, { Accept: "*/*" });
});

test("guard: a refusal throws ExitBlocked, never reaches the network, and is reported", async () => {
  const f = spy(); const seen = [];
  const g = guard({ onBlock: (e) => seen.push(e.code) })(f);
  for (const u of ["http://example.com/", "https://127.0.0.1/", "https://localhost/", "https://x.local/"]) await assert.rejects(g(u), (e) => e instanceof ExitBlocked && /exit rules/.test(e.message), u);
  assert.equal(f.calls.length, 0, "nothing was sent");
  assert.deepEqual(seen, ["scheme", "ip-literal", "single-label", "private-name"]);
});

test("guard: a web call may only read — no POST, no body", async () => {
  const f = spy(); const g = guard()(f);
  await assert.rejects(g("https://example.com/", { method: "POST" }), (e) => e.code === "method");
  await assert.rejects(g("https://example.com/", { method: "PUT", body: "x" }), (e) => e.code === "method");
  await assert.rejects(g("https://example.com/", { body: "secret" }), (e) => e.code === "body");
  await g("https://example.com/", { method: "HEAD" });
  assert.equal(f.calls.length, 1);
});

test("guard: the person's own bridge may POST a body (that is how a model is asked), and still sends no credentials", async () => {
  const f = spy(); const g = guard({ bridges: LOOPBACK_BRIDGES })(f);
  await g("http://127.0.0.1:8790/v1/chat/completions", { method: "POST", body: "{}", credentials: "include" });
  assert.equal(f.calls[0].o.method, "POST");
  assert.equal(f.calls[0].o.body, "{}");
  assert.equal(f.calls[0].o.credentials, "omit");
});

test("guard: a redirect into a blocked place discards the response, and the body is cancelled", async () => {
  let cancelled = false;
  const f = spy((u) => ({ ok: true, status: 200, url: "https://192.168.0.1/admin", body: { cancel: () => { cancelled = true; } } }));
  const g = guard()(f);
  await assert.rejects(g("https://example.com/go"), (e) => e.code === "redirect" && /ip address/i.test(e.reason));
  assert.equal(cancelled, true);
  const down = spy({ ok: true, status: 200, url: "http://example.com/downgraded" });
  await assert.rejects(guard()(down)("https://example.com/"), (e) => e.code === "redirect");
});

test("guard: a Request object is held to the same rules", async () => {
  const f = spy(); const g = guard()(f);
  await g(new Request("https://example.com/ok"));
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].u.credentials, "omit");
  await assert.rejects(g(new Request("https://example.com/", { method: "POST", body: "x" })), (e) => e.code === "method" || e.code === "body");
  await assert.rejects(g(new Request("https://localhost/")), (e) => e.code === "single-label");
});

test("guard: wrapping twice is the same wrapper (no double rules, no double cost)", () => {
  const w = guard(); const g = w(spy());
  assert.equal(w(g), g);
});

// ── installGlobalGuard ───────────────────────────────────────────────────────
test("installGlobalGuard: after it runs, the page's own fetch obeys the rules; the extension's own pages and the loopback bridge pass", async () => {
  const f = spy();
  const g = { fetch: f, chrome: { runtime: { id: "abc", getURL: () => "chrome-extension://abc/" } }, localStorage: { getItem: () => "http://localhost:9001" } };
  assert.equal(installGlobalGuard({ g, onBlock: () => {} }), true);
  assert.notEqual(g.fetch, f);
  await g.fetch("chrome-extension://abc/fold-chat-icons.js");                    // its own files
  await g.fetch("http://127.0.0.1:8790/api/tags");                                 // the default bridge
  await g.fetch("http://localhost:9001/api/tags");                                 // the bridge the person set
  await g.fetch("https://en.wikipedia.org/w/api.php?x=1");                         // a public site
  assert.equal(f.calls.length, 4);
  await assert.rejects(g.fetch("http://localhost:9002/"), ExitBlocked);            // some other local port
  await assert.rejects(g.fetch("https://10.1.1.1/"), ExitBlocked);
  await assert.rejects(g.fetch("http://example.com/"), ExitBlocked);
  assert.equal(f.calls.length, 4, "the refused ones never left");
  assert.equal(installGlobalGuard({ g }), false, "installing twice does not stack");
});

test("installGlobalGuard: a bridge override that is not on this machine is ignored", async () => {
  const f = spy();
  const g = { fetch: f, chrome: { runtime: { id: "abc", getURL: () => "chrome-extension://abc/" } }, localStorage: { getItem: () => "http://192.168.1.50:8790" } };
  installGlobalGuard({ g, onBlock: () => {} });
  await assert.rejects(g.fetch("http://192.168.1.50:8790/api/tags"), ExitBlocked);
});

// ── environment + permission helpers ─────────────────────────────────────────
test("isExtension: true only where chrome.runtime.id exists", () => {
  assert.equal(isExtension({}), false);
  assert.equal(isExtension({ chrome: {} }), false);
  assert.equal(isExtension({ chrome: { runtime: {} } }), false);
  assert.equal(isExtension({ chrome: { runtime: { id: "abc" } } }), true);
});

test("webReadAccess: asks for https sites only, from a click, and can be revoked", async () => {
  const asked = [];
  let held = false;
  const chromeApi = { permissions: {
    contains: async (q) => { asked.push(["contains", q]); return held; },
    request: async (q) => { asked.push(["request", q]); held = true; return true; },
    remove: async (q) => { asked.push(["remove", q]); held = false; return true; },
  } };
  const a = webReadAccess(chromeApi);
  assert.equal(a.available, true);
  assert.equal(await a.granted(), false);
  assert.equal(await a.request(), true);
  assert.equal(await a.granted(), true);
  assert.equal(await a.revoke(), true);
  assert.equal(await a.granted(), false);
  for (const [, q] of asked) assert.deepEqual(q, { origins: ["https://*/*"] });
  const none = webReadAccess(undefined);
  assert.equal(none.available, false);
  assert.equal(await none.granted(), false);
  assert.equal(await none.request(), false);
});
