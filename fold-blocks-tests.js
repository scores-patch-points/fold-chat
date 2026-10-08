// fold-blocks-tests.js — the fold's reading + the block kit that survives.
// The maker that used fixed templates (website/widget/document plans) is gone, so
// its tests are gone with it. What remains: the monologue (the induced reading),
// the expression evaluator, and the kernel.
import { monologue } from "./fold-blocks-make.js";
import { expr, formatValue } from "./fold-blocks.js";
import { createKernel } from "./fold-blocks-kernel.js";

const A = {
  eq(a, b, m = "") { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  ok(v, m = "expected true") { if (!v) throw new Error(m); },
  has(s, sub, m = "") { if (!String(s).includes(sub)) throw new Error(`${m} expected to contain ${JSON.stringify(sub)}`); },
  near(a, b, eps, m = "") { if (Math.abs(a - b) > eps) throw new Error(`${m} expected ≈${b}, got ${a}`); },
};

export const TESTS = [
  ["monologue: an ordinary ask is a thing to BUILD (code) — no template, no menu", () => {
    const m = monologue("make me a calendar");
    A.ok(m.code && m.satisfiable, "an ordinary ask routes to the build loop");
    A.ok(m.lines.some((l) => /no template, no menu/.test(l.say)), "and says so");
  }],
  ["monologue: an ask that needs a live source the fold lacks is a typed gap", () => {
    const m = monologue("make a widget that shows gas prices");
    A.ok(!m.satisfiable, "refused");
    A.has(m.why, "live data source");
  }],
  ["monologue: the model's reading (WHAT/SATISFY/NEEDS) is shown — induced, not chosen from a list", () => {
    const m = monologue("make me a countdown timer", { what: "a countdown timer that ticks down", satisfy: "it counts down when opened", needs: "time to run" });
    A.ok(m.lines.some((l) => /I induce what it is: a countdown timer/.test(l.say)));
    A.ok(m.code, "still a thing to build");
  }],
  ["compute: expressions evaluate; precedence and powers hold", () => {
    A.eq(expr("2 + 3 * 4").run(), 14); A.eq(expr("-2 ^ 2").run(), -4); A.eq(expr("2 ^ 3 ^ 2").run(), 512);
    A.eq(expr("round(10 / 3, 2)").run(), 3.33); A.ok(!expr("2 +").ok); A.ok(!expr("alert(1)").ok);
    A.eq(formatValue(1527.04, "money"), "£1,527");
  }],
  ["kernel: a result is the model's own expression over declared inputs", () => {
    const k = createKernel();
    A.ok(k.submit(`a : input\na.name = price\na.label = Price\na.kind = number\n!EVA a`).ok, "a declared input");
    A.ok(k.submit(`m : result\nm.label = Double\nm.expr = price * 2\n!EVA m`).ok, "an expression over it");
    A.near(expr(k.model().blocks.m.props.expr).run({ price: 5 }), 10, 1e-9);
    A.ok(k.submit(`z : result\nz.label = Z\nz.expr = magic * 2\n!EVA z`).errors.some((e) => e.code === "dependency"), "an undeclared name is caught");
  }],
  ["monologue: the mouth's OVER-CLAIMED needs do not gate — only the ask does", () => {
    const m = monologue("make me a website about dolphins", { what: "a website about dolphins", satisfy: "it gives information about dolphins", needs: "live data feeds, images, and videos" });
    A.ok(m.code && m.satisfiable, "a static page builds anyway, despite the model claiming needs");
    A.ok(!monologue("make a widget that shows gas prices").satisfiable, "an ask that SHOWS external data still gaps");
  }],
];
