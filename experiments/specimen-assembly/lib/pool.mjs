// pool.mjs — read specimen files into specimens, recording where each came from.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect } from "./specimen.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "specimens");

export function load(rel, extra = {}) {
  const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
  return collect({ source, origin: "authored-for-harness", path: `specimens/${rel}`, note: "written for this experiment; not found in the wild", ...extra });
}
export const byName = (names) => Object.fromEntries(Object.entries(names).map(([slot, list]) => [slot, list.map((n) => load(n))]));

export const LIFECYCLE_POOL = () => byName({
  key: ["lifecycle/key-body.js", "lifecycle/key-header.js", "lifecycle/key-email.js", "lifecycle/key-nonce.js"],
  store: ["lifecycle/store-setnx.js", "lifecycle/store-getset.js", "lifecycle/store-memory.js"],
  retry: ["lifecycle/retry-blind.js", "lifecycle/retry-lookup.js", "lifecycle/retry-none.js"],
  cancel: ["lifecycle/cancel-before-only.js", "lifecycle/cancel-always.js", "lifecycle/cancel-never.js"],
});
export const CACHE_POOL = () => byName({ cache: ["cache/cache-unbounded.js", "cache/cache-none.js", "cache/cache-stale.js"] });
