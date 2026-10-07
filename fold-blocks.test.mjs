// node --test fold-blocks.test.mjs — the same suite the Block Kit page runs.
import test from "node:test";
import { TESTS } from "./fold-blocks-tests.js";
for (const [name, fn] of TESTS) test(name, fn);
