import test from "node:test";
import assert from "node:assert/strict";
import { t } from "../src/i18n.js";

test("t falls back to the key", () => { assert.equal(t("total"), "Total"); assert.equal(t("total", "es"), "Total"); assert.equal(t("nope"), "nope"); assert.equal(t("tax", "fr"), "tax"); });
