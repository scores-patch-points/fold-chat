import { test } from "node:test";
import assert from "node:assert/strict";
import { sandboxDoc, sandboxPageUrl } from "./fold-chat-sandframe.js";

const ext = { chrome: { runtime: { id: "abc", getURL: (p) => "chrome-extension://abc/" + p } } };
const fakeWin = () => { const ls = new Set(); return { addEventListener: (t, f) => ls.add(f), removeEventListener: (t, f) => ls.delete(f), emit: (e) => [...ls].forEach((f) => f(e)), count: () => ls.size }; };
const fakeFrame = () => { const sent = []; const loads = []; const contentWindow = { postMessage: (m, o) => sent.push([m, o]) }; return { contentWindow, sent, srcdoc: undefined, src: undefined, addEventListener: (t, f) => { if (t === "load") loads.push(f); }, fireLoad: () => loads.splice(0).forEach((f) => f()) }; };

test("sandboxPageUrl: the sandbox page inside the extension, nothing on the web", () => {
  assert.equal(sandboxPageUrl({}), null);
  assert.equal(sandboxPageUrl({ chrome: {} }), null);
  assert.equal(sandboxPageUrl(ext), "chrome-extension://abc/fold-sandbox.html");
});

test("on the web it is exactly srcdoc, and nothing else is touched", () => {
  const f = fakeFrame(); const w = fakeWin();
  assert.equal(sandboxDoc(f, "<p>x</p>", { g: {}, win: w }), "srcdoc");
  assert.equal(f.srcdoc, "<p>x</p>");
  assert.equal(f.src, undefined);
  assert.equal(w.count(), 0, "no listener left behind");
});

test("in the extension the frame is pointed at the sandbox page and the HTML is sent when it says it is ready", () => {
  const f = fakeFrame(); const w = fakeWin();
  assert.equal(sandboxDoc(f, "<b>hi</b>", { nonce: "p1", g: ext, win: w }), "sandbox-page");
  assert.equal(f.src, "chrome-extension://abc/fold-sandbox.html");
  assert.equal(f.srcdoc, undefined);
  assert.equal(f.sent.length, 0, "nothing is sent before the sandbox is listening");
  w.emit({ source: {}, data: { __foldsandbox_ready: true } });                      // some other window: ignored
  w.emit({ source: f.contentWindow, data: { something: "else" } });                 // not the handshake: ignored
  assert.equal(f.sent.length, 0);
  w.emit({ source: f.contentWindow, data: { __foldsandbox_ready: true } });
  assert.deepEqual(f.sent, [[{ __foldsandbox: "p1", html: "<b>hi</b>" }, "*"]]);
  assert.equal(w.count(), 0, "the handshake listener removes itself");
});

test("the frame's load event is a backup if the ready message was missed", () => {
  const f = fakeFrame(); const w = fakeWin();
  sandboxDoc(f, "<i>x</i>", { g: ext, win: w });
  f.fireLoad();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0][0].html, "<i>x</i>");
});

test("a frame that has been removed does not throw", () => {
  const f = fakeFrame(); const w = fakeWin();
  f.contentWindow = null;
  sandboxDoc(f, "x", { g: ext, win: w });
  assert.doesNotThrow(() => f.fireLoad());
});
