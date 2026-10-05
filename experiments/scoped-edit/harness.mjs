// harness.mjs — load the fixture, apply edits, run the real tests in a scratch copy.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
const SHOP = join(HERE, "shop");

/** The pristine fixture as { path: content }. */
export function loadFixture() {
  const out = {};
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else out[relative(SHOP, p).replace(/\\/g, "/")] = readFileSync(p, "utf8"); } };
  walk(SHOP);
  return out;
}

/** Write `files` to a scratch dir and run `node --test` there. Returns { pass, fail, tests, ok, ms, output, failing:[names] }. */
export function runTests(files, { timeoutMs = 30000 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "scoped-edit-"));
  try {
    for (const [p, c] of Object.entries(files)) { const full = join(dir, p); mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, c); }
    const t0 = Date.now();
    const r = spawnSync(process.execPath, ["--test"], { cwd: dir, encoding: "utf8", timeout: timeoutMs });
    const out = (r.stdout || "") + (r.stderr || "");
    const num = (k) => +(out.match(new RegExp("^ℹ " + k + " (\\d+)", "m"))?.[1] ?? NaN);
    const failing = [...out.matchAll(/^✖ (.+?) \(/gm)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
    const tests = num("tests"), fail = num("fail"), pass = num("pass");
    return { tests, pass, fail, ok: r.status === 0 && fail === 0 && tests > 0, ms: Date.now() - t0, failing, timedOut: r.error?.code === "ETIMEDOUT", output: out.slice(-1500) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** The fixture with a task's hidden tests laid over it. */
export function withHiddenTests(files, task) { return { ...files, ...task.overrides }; }
