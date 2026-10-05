import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  composerLocked, nextAfterDelete, newChatInto, pruneStaleEmpties, isStaleEmpty, isBlankChat, detachProject, moveToProjectId,
  mergeSessions, mergeTombstones, pruneTombstones, applyInPlace, blankSession, TOMBSTONE_TTL_MS,
} from "./fold-chat-sessions.js";

const T = (n) => new Date(Date.UTC(2026, 9, 5, 12, 0, n)).toISOString();
const chat = (id, over = {}) => ({ id, title: "chat " + id, messages: [{ role: "user", content: "hi" }], createdAt: T(0), updated: T(1), ...over });
const empty = (id, over = {}) => ({ ...blankSession({ id, now: T(0) }), ...over });
const map = (...list) => Object.fromEntries(list.map((s) => [s.id, s]));

/* ---- composerLocked ---- */
test("composerLocked: only the OPEN chat's own turn locks the composer", () => {
  const inflight = new Map([["a", { label: "x" }]]);
  assert.equal(composerLocked(inflight, "a"), true);
  assert.equal(composerLocked(inflight, "b"), false, "a turn running in chat A never locks chat B");
  assert.equal(composerLocked(inflight, null), false, "the welcome state is never locked");
  assert.equal(composerLocked(new Map(), "a"), false);
  assert.equal(composerLocked(new Set(["a"]), "a"), true);
  assert.equal(composerLocked({ a: 1 }, "a"), true);
  assert.equal(composerLocked(undefined, "a"), false);
});

/* ---- nextAfterDelete ---- */
test("nextAfterDelete prefers the most recent NON-EMPTY chat over an empty New chat", () => {
  const s = map(chat("old", { updated: T(1) }), chat("new", { updated: T(5) }), empty("e", { updated: T(9) }), chat("x"));
  assert.equal(nextAfterDelete(s, { id: "x" }).id, "new");
});
test("nextAfterDelete: only empties left means the welcome state, never another blank chat", () => {
  const s = map(empty("e1"), empty("e2"), chat("gone"));
  assert.deepEqual(nextAfterDelete(s, { id: "gone" }), { id: null, clearSearch: false });
  assert.deepEqual(nextAfterDelete(map(chat("gone")), { id: "gone" }), { id: null, clearSearch: false });
});
test("nextAfterDelete stays inside the project filter", () => {
  const s = map(chat("p1", { project: "P", updated: T(2) }), chat("o", { project: null, updated: T(9) }), chat("gone", { project: "P" }));
  assert.equal(nextAfterDelete(s, { id: "gone", filterProject: "P" }).id, "p1");
  assert.equal(nextAfterDelete(map(chat("o", { updated: T(9) }), chat("gone", { project: "P" })), { id: "gone", filterProject: "P" }).id, null);
});
test("nextAfterDelete ignores search for choosing but clears it when the choice is hidden", () => {
  const s = map(chat("a", { title: "alpha", updated: T(2) }), chat("b", { title: "beta", updated: T(8) }), chat("gone", { title: "alpha two" }));
  const r = nextAfterDelete(s, { id: "gone", search: "alpha" });
  assert.equal(r.id, "b", "the most recent chat wins even though the filter hides it");
  assert.equal(r.clearSearch, true);
  const visible = nextAfterDelete(map(chat("a", { title: "alpha", updated: T(2) }), chat("gone", { title: "alpha two" })), { id: "gone", search: "ALPHA" });
  assert.deepEqual(visible, { id: "a", clearSearch: false });
});

/* ---- newChatInto ---- */
test("two newChat calls leave ONE empty session", () => {
  const s = {};
  const first = newChatInto(s, { activeId: null, newId: "n1", now: T(1) });
  const second = newChatInto(s, { activeId: first.id, newId: "n2", now: T(2) });
  const third = newChatInto(s, { activeId: null, newId: "n3", now: T(3) });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  assert.equal(third.created, false, "even with nothing open, an existing empty chat is reused");
  assert.equal(Object.keys(s).length, 1);
  for (let i = 0; i < 5; i++) newChatInto(s, { activeId: first.id, newId: "z" + i, now: T(9) });
  assert.equal(Object.values(s).filter(isBlankChat).length, 1, "five presses are still one empty chat");
});
test("newChat from a used chat makes a new one; a project scope reuses within the project", () => {
  const s = map(chat("a"));
  const r = newChatInto(s, { activeId: "a", newId: "n", now: T(2) });
  assert.equal(r.created, true);
  const projects = { P: { id: "P", cwd: "/work/p", preset: "code" } };
  const inP = newChatInto(s, { activeId: "a", filterProject: "P", projects, newId: "np", now: T(3) });
  assert.equal(inP.created, false, "the empty chat is brought into the project instead of making another");
  assert.equal(s.n.project, "P"); assert.equal(s.n.cwd, "/work/p"); assert.equal(s.n.cwdFromProject, true);
  assert.equal(Object.values(s).filter(isBlankChat).length, 1);
});
test("a chat with an agent session is not blank, even with no messages", () => {
  assert.equal(isBlankChat(empty("x", { codeSessionId: "ses_1" })), false);
  assert.equal(isStaleEmpty(empty("x", { codeSessionId: "ses_1" })), false);
});

/* ---- pruneStaleEmpties ---- */
test("pruneStaleEmpties removes only anonymous empties", () => {
  const s = map(
    empty("stale"), empty("keepme"), chat("used"),
    empty("named", { title: "Trip", titleAuto: false }), empty("renamedAuto", { named: true }), empty("proj", { project: "P" }),
    empty("code", { codeSessionId: "ses" }), empty("cwd", { cwd: "/x" }),
  );
  const gone = pruneStaleEmpties(s, { keep: ["keepme"] });
  assert.deepEqual(gone, ["stale"]);
  assert.deepEqual(Object.keys(s).sort(), ["code", "cwd", "keepme", "named", "proj", "renamedAuto", "used"]);
});
test("pruneStaleEmpties with minAgeMs spares a brand new empty chat", () => {
  const s = map(empty("fresh", { createdAt: T(100) }), empty("old", { createdAt: T(0) }));
  const gone = pruneStaleEmpties(s, { minAgeMs: 60_000, nowMs: Date.parse(T(110)) });
  assert.deepEqual(gone, ["old"]);
});

/* ---- detachProject ---- */
test("detachProject ungroups, clearing only an INHERITED folder", () => {
  const s = map(
    chat("inh", { project: "P", cwd: "/work/p", cwdFromProject: true }),
    chat("own", { project: "P", cwd: "/mine", cwdFromProject: false }),
    chat("legacy", { project: "P", cwd: "/work/p" }),
    chat("legacyOwn", { project: "P", cwd: "/elsewhere" }),
    chat("other", { project: "Q", cwd: "/work/q", cwdFromProject: true }),
    chat("none", { project: null }),
  );
  const touched = detachProject(s, "P", { projectCwd: "/work/p" });
  assert.deepEqual(touched.sort(), ["inh", "legacy", "legacyOwn", "own"]);
  assert.equal(s.inh.project, null); assert.equal(s.inh.cwd, null);
  assert.equal(s.own.project, null); assert.equal(s.own.cwd, "/mine", "a folder the person set on the chat stays");
  assert.equal(s.legacy.cwd, null, "an unflagged chat whose folder IS the project's was inherited");
  assert.equal(s.legacyOwn.cwd, "/elsewhere");
  assert.equal(s.other.project, "Q"); assert.equal(s.other.cwd, "/work/q");
});
test("moveToProjectId: an inherited folder follows, a chosen one stays", () => {
  const a = chat("a", { project: "P", cwd: "/work/p", cwdFromProject: true });
  moveToProjectId(a, "Q", { project: { cwd: "/work/q" } });
  assert.equal(a.project, "Q"); assert.equal(a.cwd, "/work/q");
  const b = chat("b", { project: "P", cwd: "/mine", cwdFromProject: false });
  moveToProjectId(b, null);
  assert.equal(b.project, null); assert.equal(b.cwd, "/mine");
  const c = chat("c", { project: "P", cwd: "/work/p" });
  moveToProjectId(c, null, { oldProjectCwd: "/work/p" });
  assert.equal(c.cwd, null);
});

/* ---- tombstones + mergeSessions ---- */
test("tombstones: union keeps the later delete; pruned after 30 days", () => {
  const m = mergeTombstones({ a: T(1), b: T(9) }, { a: T(5), c: T(2) });
  assert.deepEqual(m, { a: T(5), b: T(9), c: T(2) });
  const now = Date.parse(T(0)) + 40 * 86400000;
  const p = pruneTombstones({ old: T(0), fresh: new Date(now - 86400000).toISOString() }, now);
  assert.deepEqual(Object.keys(p), ["fresh"]);
  assert.equal(TOMBSTONE_TTL_MS, 30 * 86400000);
});
test("mergeSessions never resurrects a tombstoned id", () => {
  const stale = chat("dead", { updated: T(3) });
  const merged = mergeSessions(map(stale), map(), { dead: T(10) });
  assert.deepEqual(Object.keys(merged), []);
  const fromRemote = mergeSessions(map(), map(stale), { dead: T(10) });
  assert.deepEqual(Object.keys(fromRemote), []);
});
test("mergeSessions never loses a chat only one tab has", () => {
  const merged = mergeSessions(map(chat("mine")), map(chat("theirs")), {});
  assert.deepEqual(Object.keys(merged).sort(), ["mine", "theirs"]);
});
test("TWO-TAB RESURRECTION REGRESSION: tab B (stale) saves after tab A deleted and made a chat", () => {
  // tab A and tab B both start with chats x and y
  const x = chat("x"), y = chat("y");
  const tombstones = {};
  let stored = { x, y };
  // tab A deletes x and creates z; it saves (merging with what is stored)
  const aMem = { y, z: chat("z", { updated: T(20) }) };
  tombstones.x = T(15);
  stored = mergeSessions(aMem, stored, tombstones);
  assert.deepEqual(Object.keys(stored).sort(), ["y", "z"]);
  // tab B still holds x and y (stale), edits y and saves WITHOUT having seen A's writes
  const bMem = { x: { ...x }, y: { ...y, updated: T(30), messages: [...y.messages, { role: "assistant", content: "b" }] } };
  stored = mergeSessions(bMem, stored, tombstones);
  assert.deepEqual(Object.keys(stored).sort(), ["y", "z"], "x stays deleted, z (only A has it) is not wiped");
  assert.equal(stored.y.messages.length, 2, "B's newer edit of y wins");
});
test("mergeSessions: later `updated` wins; a tie keeps the longer chat", () => {
  const older = chat("c", { updated: T(1) }), newer = chat("c", { updated: T(9), title: "newer" });
  assert.equal(mergeSessions(map(older), map(newer), {}).c.title, "newer");
  assert.equal(mergeSessions(map(newer), map(older), {}).c.title, "newer");
  const short = chat("c", { updated: T(5) }), long = chat("c", { updated: T(5), messages: [{}, {}, {}] });
  assert.equal(mergeSessions(map(short), map(long), {}).c.messages.length, 3);
});
test("mergeSessions: `keep` (a running turn) holds the LOCAL object", () => {
  const local = chat("run", { updated: T(1) }), remote = chat("run", { updated: T(99), title: "remote" });
  const merged = mergeSessions(map(local), map(remote), {}, { keep: ["run"] });
  assert.equal(merged.run, local);
});
test("mergeSessions: an Undo (restoredAt after the tombstone) outlives the tombstone; a stale copy does not", () => {
  const restored = chat("r", { updated: T(2), restoredAt: T(30) });
  assert.deepEqual(Object.keys(mergeSessions(map(restored), map(), { r: T(20) })), ["r"]);
  const stale = chat("r", { updated: T(2) });
  assert.deepEqual(Object.keys(mergeSessions(map(stale), map(), { r: T(20) })), []);
  // the restored copy beats a stale copy in the other tab even though `updated` is equal
  const merged = mergeSessions(map(stale), map(restored), {});
  assert.equal(merged.r.restoredAt, T(30));
});
test("applyInPlace mutates the live map and reports what changed", () => {
  const live = map(chat("a"), chat("b"));
  const keepA = live.a;
  const r = applyInPlace(live, { a: keepA, c: chat("c"), b: chat("b", { title: "B2" }) });
  assert.deepEqual(r.added, ["c"]); assert.deepEqual(r.replaced, ["b"]); assert.deepEqual(r.removed, []);
  const r2 = applyInPlace(live, { a: keepA });
  assert.deepEqual(r2.removed.sort(), ["b", "c"]);
  assert.equal(live.a, keepA);
});

/* ---- static guards on the surface ---- */
const src = readFileSync(new URL("./fold-chat.js", import.meta.url), "utf8");
function fnBody(name) {
  const at = src.search(new RegExp(`\\n  (async )?function ${name}\\(`));
  assert.ok(at >= 0, `${name} exists`);
  const open = src.indexOf("{", src.indexOf(")", at));
  let depth = 0, i = open;
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) break; }
  return src.slice(open, i + 1);
}
test("appendMsg takes its session explicitly and never reads sessions[activeId]", () => {
  assert.match(src, /function appendMsg\(s, role, content, meta = \{\}\)/);
  for (const name of ["buildMsg", "appendMsg"]) assert.doesNotMatch(fnBody(name), /sessions\[activeId\]|\bactiveId\b/, `${name} must not read the open chat`);
});
test("run() and runCode() never touch the composer or thread without an activeId === id check", () => {
  for (const name of ["run", "runCode"]) {
    const body = fnBody(name);
    assert.doesNotMatch(body, /sessions\[activeId\]/, `${name} reads sessions[activeId]`);
    assert.doesNotMatch(body, /E\.send\b|E\.input\.disabled/, `${name} sets the composer globally`);
    const lines = body.split("\n");
    lines.forEach((ln, i) => {
      if (/E\.(stage|thread\b|threadCol|input)|appendMsg\(|setView\(|E\.input\.focus/.test(ln) && !/isLive\(\)|activeId === id|=== activeId/.test(ln)) {
        assert.fail(`${name}: unguarded UI write on line ${i + 1}: ${ln.trim()}`);
      }
    });
    assert.match(body, /inflight\.set\(id,/, `${name} registers itself as in flight`);
    assert.match(body, /inflight\.delete\(id\)/, `${name} unregisters itself`);
  }
});
