// fold-blocks-tests.js — the block kit's tests, as plain data so they run in node (fold-blocks.test.mjs) and in the page (Block Kit).
import { CELLS, BLOCKS, TERRAINS, STANCES, DESERT, expr, render, contrastRatio, formatValue } from "./fold-blocks.js";
import { createKernel, assemble, ingest, parseLine, splitAssemblies } from "./fold-blocks-kernel.js";
import { make, guessKind, frameOf, PLANS, fillSkeleton, supplyInputs, followUp } from "./fold-blocks-make.js";
import { editorFor, editEOT } from "./fold-blocks-edit.js";
import { weaveAssembly, createMemory, probe, unitsOf, DECLARED as WEAVE } from "./fold-blocks-weave.js";
// A fake mouth: answers by the slot it is asked for. Each answer list is consumed in order (a retry gets the next one).
const mouth = (answers, seen = []) => async (msgs) => { const q = msgs[msgs.length - 1].content; seen.push(q); const k = (/The value for (\S+) \(/.exec(q) || [])[1]; const a = answers[k]; return Array.isArray(a) ? (a.length > 1 ? a.shift() : a[0]) : a ?? ""; };
const mem = () => createMemory(null);

const A = {
  eq(a, b, m = "") { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  ok(v, m = "expected true") { if (!v) throw new Error(m); },
  near(a, b, eps, m = "") { if (Math.abs(a - b) > eps) throw new Error(`${m} expected ≈${b}, got ${a}`); },
  has(s, sub, m = "") { if (!String(s).includes(sub)) throw new Error(`${m} expected to contain ${JSON.stringify(sub)}`); },
};
const codes = (v) => v.errors.map((e) => e.code);

const THEME = `look : theme\nlook.accent = #a5532e\nlook.font = serif\n!EVA look`;
const ROOM = `classes : room\nclasses.schema.name = text\nclasses.schema.price = text\nclasses.row = Intro to the wheel | £45\nclasses.row = Glazing | £35\n!EVA classes`;
const PAGE = `top : nav\ntop.brand = Clay & Kiln\nhi : hero\nhi.title = Make something this weekend\nhi.cta = Book\nprices : cards\nprices.room = classes\nprices.title = name\nprices.sub = price\nbook : form\nbook.fields = Name, Email, Date\n!EVA top, hi, prices, book`;
const APP = `site : app\nsite.kind = website\nsite.title = Clay & Kiln\nsite.blocks = top, hi, prices, book\n!EVA site`;
const WEBSITE = [THEME, ROOM, PAGE, APP].join("\n\n");

export const TESTS = [
  ["follow-up: a literal replacement is box-owned — no model is asked, case is kept, undo restores", async () => {
    const k = assemble(WEBSITE).kernel;
    let asked = 0;
    const r = await followUp(k, 'change the title from "something" to "pottery"', { complete: async () => { asked++; return ""; } });
    A.ok(r.ok, r.why); A.eq(asked, 0, "the mouth was never asked"); A.eq(r.mode, "replace");
    A.has(render(k.model()), "Make pottery this weekend");
    A.ok(k.submit(r.inverse, { by: "you" }).ok); A.has(render(k.model()), "Make something this weekend");
    const miss = await followUp(k, 'change "zebra" to "lion"', { complete: async () => "" }); A.ok(!miss.ok); A.has(miss.why, "does not appear");
  }],
  ["weave: law order — box derives, the request is snipped, the mouth draws only the residue", async () => {
    const k = createKernel();
    const sk = PLANS.website[2].skeleton(k, 'a site for a bike shop called "Spoke & Chain" in Leith with a booking form');
    const ask = 'a site for a bike shop called "Spoke & Chain" in Leith with a booking form';
    const w = await weaveAssembly({ skeleton: sk, hints: PLANS.website[2].hints, ask, kind: "website", kernel: k, memory: mem(), complete: mouth({ "top.items": "Repairs, Visit, Book", "intro.title": "Bikes fixed while you wait", "intro.sub": "Same-day repairs, six days a week.", "intro.image": "the shop front", "book.title": "Book a repair" }) });
    A.ok(w.ok, JSON.stringify(w.verdict?.errors));
    const by = Object.fromEntries(w.units.map((u) => [u.key, u.by]));
    A.eq(by["top.brand"], "hunt"); A.eq(by["book.fields"], "box"); A.eq(by["book.submit"], "box"); A.eq(by["intro.title"], "mouth"); A.eq(by["end.text"], "hunt");
    A.eq(w.units.find((u) => u.key === "end.text").value, "Spoke & Chain · Leith");
  }],
  ["weave: an invented figure is refused; the sharpened atom is positive; only that unit is redrawn", async () => {
    const seen = [];
    const k = createKernel();
    const w = await weaveAssembly({ skeleton: PLANS.document[1].skeleton(), hints: PLANS.document[1].hints, ask: "a guide for food bank volunteers", kind: "document", kernel: k, memory: mem(),
      complete: mouth({ "t.text": "Volunteer guide", "intro.text": "Welcome to the food bank.", "h1.text": "Opening hours", "p1.text": ["We are open from 10am to 2pm.", "We open on weekday mornings."], "h2.text": "What to wear", "p2.text": "Closed shoes and clothes you can move in.", "h3.text": "Who to ask", "p3.text": "Ask the shift lead for anything you need." }, seen) });
    A.ok(w.ok, JSON.stringify(w.verdict?.errors));
    const p1 = w.units.find((u) => u.key === "p1.text");
    A.eq(p1.attempts.length, 2); A.has(p1.attempts[0].why, "invented"); A.eq(p1.value, "We open on weekday mornings.");
    A.ok(seen.filter((q) => q.includes("for p1.text")).pop().includes("Use words only"), "the atom was sharpened");
    A.ok(!seen.join("").includes("Do not"), "never a prohibition");
    A.eq(w.units.filter((u) => u.attempts.length > 1).map((u) => u.key), ["p1.text"], "only the failing unit was redrawn");
  }],
  ["weave: a record is atomized into cells; an invented price is cut, a repeated name redrawn alone, the good cells kept", async () => {
    const w = await weaveAssembly({ skeleton: PLANS.website[1].skeleton(), hints: PLANS.website[1].hints, ask: "a pottery studio site", kind: "website", kernel: createKernel(), memory: mem(),
      complete: mouth({ "offer.row#1.name": "Wheel class", "offer.row#1.price": "£45", "offer.row#1.note": "weekends", "offer.row#2.name": ["Wheel class", "Glazing"], "offer.row#2.price": "£30", "offer.row#2.note": "two evenings", "offer.row#3.name": "raku_firing_name", "offer.row#3.price": "—", "offer.row#3.note": "outdoors" }) });
    A.ok(w.ok, JSON.stringify(w.verdict?.errors));
    A.has(w.text, "offer.row = Wheel class | — | weekends\noffer.row = Glazing | — | two evenings");
    A.eq(w.units.find((u) => u.key === "offer.row#2.name").attempts.length, 2, "a repeated name is redrawn alone");
    A.eq(w.units.find((u) => u.key === "offer.row#1.note").attempts.length, 1, "the good cells are kept");
    A.ok(!w.text.includes("raku_firing_name"), "an identifier is an echo, not content");
  }],
  ["weave: a kernel error goes back to the unit on its line, and nowhere else", async () => {
    const k = createKernel();
    const w = await weaveAssembly({ skeleton: PLANS.widget[1].skeleton(), hints: PLANS.widget[1].hints, ask: "a calculator", kind: "widget", kernel: k, memory: mem(),
      complete: mouth({ "title.text": "Price check", "a.label": "Price", "a.value": "100", "b.label": "Price", "b.value": "20", "b.name": "deposit", "c.label": "Rate", "c.value": "4" }) });
    A.ok(w.ok, JSON.stringify(w.verdict?.errors));
    const b = w.units.find((u) => u.key === "b.name"); A.eq(b.value, "deposit"); A.eq(b.by, "mouth");
    A.eq(w.units.find((u) => u.key === "a.name").by, "box");
  }],
  ["weave: a widget's formula, arguments and label are box-owned; the missing input is supplied", async () => {
    const r = await make("A mortgage calculator: home price, deposit percent and interest rate, over 25 years", { memory: mem(), complete: mouth({ "look.accent": "#1d4ed8", "look.font": "sans", "look.radius": "round", "title.text": "Mortgage calculator", "a.label": "Home price", "a.value": "250000", "b.label": "Deposit percent", "b.value": "20", "c.label": "Interest rate", "c.value": "4.5" }) });
    A.ok(r.ok, JSON.stringify(r.steps));
    const res = r.steps[2].units; A.ok(res.every((u) => u.by === "box"), "no mouth draw for the result");
    const p = r.model.blocks.out.props; A.near(expr(p.expr).run({ home_price: 250000, deposit_percent: 20, interest_rate: 4.5, years: 25 }), 1111.67, 1, "the answer");
  }],
  ["memory: kept values are recalled by frame; a shape that walls three times becomes a standing rule; a rejected value is never recalled", async () => {
    const m = mem();
    m.keep("hero.title", "Make something this weekend", ["pottery", "studio", "classes"], "mouth");
    A.ok(m.recall("hero.title", ["pottery", "classes", "edinburgh"]), "two words in common");
    A.ok(!m.recall("hero.title", ["bike", "classes"]), "one word is not a frame");
    m.reject("hero.title", "Make something this weekend", "you replaced it"); A.ok(!m.recall("hero.title", ["pottery", "classes"]));
    for (let i = 0; i < WEAVE.promoteAfter; i++) m.count("hero.image", "wall");
    A.ok(m.standing("hero.image"), "promoted");
    const w = await weaveAssembly({ skeleton: "h : hero\nh.title = \nh.image = \n!EVA h", ask: "a site", kind: "website", kernel: createKernel(), memory: m, complete: mouth({ "h.title": "Hello there" }) });
    A.ok(w.ok); A.eq(w.units.find((u) => u.key === "h.image").by, "gap", "the mouth is never asked again");
  }],
  ["weave: a required slot the mouth cannot fill drops its part; the rest is set down", async () => {
    const r = await make("a guide", { kind: "document", memory: mem(), complete: mouth({ "look.accent": "#7c3aed", "t.text": "A guide", "intro.text": "An opening line.", "h1.text": "First", "p1.text": "", "h2.text": "Second", "p2.text": "More words here.", "h3.text": "Third", "p3.text": "And the last part." }) });
    A.ok(r.ok, JSON.stringify(r.steps.map((s) => s.attempts)));
    A.ok(!r.model.blocks.p1, "p1 is not drawn"); A.ok(r.model.blocks.p2); A.has(r.steps[1].attempts[0].notes.join(" "), "without p1");
  }],
  ["follow-up: a change rewrites one standing part; only what changed is written", async () => {
    const k = assemble(WEBSITE).kernel;
    const r = await followUp(k, "make the hero headline warmer", { complete: async () => "hi.title = Come and make something with us\nhi.cta = Book\n!EVA hi" });
    A.ok(r.ok); A.eq(r.mode, "change"); A.eq(r.name, "hi"); A.eq(r.text, "hi.title = Come and make something with us\n!EVA hi");
    A.has(render(k.model()), "Come and make something with us");
    A.ok(k.submit(r.inverse, { by: "you", label: "undo" }).ok); A.has(render(k.model()), "Make something this weekend");
  }],
  ["follow-up: an add writes a new block and the app re-frames it before the footer-less end", async () => {
    const k = assemble(WEBSITE).kernel;
    const r = await followUp(k, "add the steps of a first class", { complete: async () => "x.title = Your first class\nx.items = Wedge the clay, Centre it, Pull a cylinder\n!EVA x" });
    A.ok(r.ok, JSON.stringify(r.attempts?.map((a) => a.errors))); A.eq(r.mode, "add");
    A.eq(k.model().app.blocks.slice(-1)[0], r.name); A.has(render(k.model()), "Pull a cylinder");
  }],
  ["edit: a person's change is one more checked assembly, by them, and undo appends its inverse", () => {
    const r = assemble(WEBSITE); const k = r.kernel;
    const ed = editorFor(k, "hi"); A.eq(ed.fields.find((f) => f.key === "title").value, "Make something this weekend");
    const e = editEOT(k, "hi", { title: "Weekend wheel classes", sub: "" });
    A.eq(e.text, "hi.title = Weekend wheel classes\n!EVA hi", "only what changed is written");
    A.ok(k.submit(e.text, { by: "you", label: "edit hi" }).ok);
    A.has(render(k.model()), "Weekend wheel classes");
    A.ok(k.submit(e.inverse, { by: "you", label: "undo" }).ok);
    A.has(render(k.model()), "Make something this weekend");
    A.eq(k.history().map((v) => v.by), ["model", "model", "model", "model", "you", "you"]);
  }],
  ["edit: a bad edit is rejected by the same checks, and nothing changes", () => {
    const k = assemble(WEBSITE).kernel;
    const v = k.submit(editEOT(k, "look", { ink: "#dddddd" }).text, { by: "you" });
    A.eq(codes(v), ["contrast"]); A.ok(!render(k.model()).includes("#dddddd"));
    A.eq(codes(k.submit(editEOT(k, "hi", { title: "" }).text, { by: "you" })), ["missing-prop"], "a required value cannot be emptied");
  }],
  ["edit: a room's records are restated whole, so the cards that read it follow", () => {
    const k = assemble(WEBSITE).kernel;
    const ed = editorFor(k, "prices"); A.eq(ed.room.name, "classes");
    const e = editEOT(k, "prices", {}, ed.room.rowsText + "\nRaku firing | £50");
    A.has(e.text, "classes.rows = ~"); A.ok(k.submit(e.text, { by: "you" }).ok);
    A.has(render(k.model()), "Raku firing");
    A.eq(codes(k.submit(editEOT(k, "prices", {}, "Only one value").text, { by: "you" })), ["bad-value"], "a row must fill every field");
  }],
  ["catalog: 27 coherent cells, one desert at SYN·Ground", () => {
    A.eq(CELLS.length, 27);
    A.ok(CELLS.every((c) => TERRAINS[c.terrain].grain === c.grain && STANCES[c.stance].grain === c.grain), "every cell shares a grain");
    A.eq(CELLS.filter((c) => c.desert).map((c) => c.terrain + "×" + c.stance), [DESERT.terrain + "×" + DESERT.stance]);
  }],
  ["catalog: every block lives in one coherent, non-desert cell", () => {
    for (const [name, b] of Object.entries(BLOCKS)) {
      const cell = CELLS.find((c) => c.terrain === b.cell[0] && c.stance === b.cell[1]);
      A.ok(cell, `${name} has a cell`); A.ok(!cell.desert, `${name} is not in the desert`);
    }
  }],
  ["ingest: recovers the operator from punctuation", () => {
    A.eq(parseLine("hi : hero", 1).op, "INS"); A.eq(parseLine("hi.title = Hello: world", 1).op, "DEF");
    A.eq(parseLine("a -> b", 1).op, "CON"); A.eq(parseLine("!EVA a, b", 1).targets, ["a", "b"]);
    A.eq(parseLine("!FOO a", 1).kind, "bad"); A.eq(parseLine("# note", 1), null);
  }],
  ["ingest: strips fences and prose, and says what it dropped", () => {
    const r = ingest("Sure! Here it is:\n```eot\nhi : hero\nhi.title = Hello\n!EVA hi\n```\nHope that helps.");
    A.eq(r.text, "hi : hero\nhi.title = Hello\n!EVA hi"); A.eq(r.dropped.length, 2);
  }],
  ["assemble: a whole website passes, assembly by assembly", () => {
    const r = assemble(WEBSITE);
    A.ok(r.ok, JSON.stringify(r.verdicts.flatMap((v) => v.errors)));
    A.eq(r.verdicts.length, 4); A.eq(r.model.app.blocks, ["top", "hi", "prices", "book"]);
    const html = render(r.model);
    A.has(html, "Make something this weekend"); A.has(html, "Glazing"); A.has(html, "--accent:#a5532e"); A.has(html, 'type="email"');
  }],
  ["law 2: a failed assembly leaves the standing ones untouched", () => {
    const k = createKernel();
    A.ok(k.submit(ROOM).ok);
    const bad = k.submit(`x : hero\nx.titel = Hi\n!EVA x`);
    A.ok(!bad.ok); A.ok(codes(bad).includes("unknown-prop")); A.has(bad.errors[0].msg, "did you mean .title");
    A.eq(k.names().map((n) => n.name), ["classes"], "only the room stands");
  }],
  ["unknown block → unknown-surface, with the nearest name", () => {
    const v = createKernel().submit(`h : heros\nh.title = x\n!EVA h`);
    A.eq(codes(v), ["unknown-surface"]); A.has(v.errors[0].msg, "hero");
  }],
  ["helix: a block over a room that does not exist → dependency", () => {
    const v = createKernel().submit(`p : cards\np.room = nope\np.title = name\n!EVA p`);
    A.ok(codes(v).includes("dependency"));
  }],
  ["site: a field the room lacks → terrain-mismatch", () => {
    const k = createKernel(); k.submit(ROOM);
    const v = k.submit(`p : cards\np.room = classes\np.title = title\n!EVA p`);
    A.eq(codes(v), ["terrain-mismatch"]);
  }],
  ["narrowing: a form cannot create records in a read-only room", () => {
    const k = createKernel();
    A.ok(k.submit(`r : room\nr.schema.name = text\nr.contract.ops = NUL\n!EVA r`).ok);
    const v = k.submit(`f : form\nf.fields = Name\nf.room = r\n!EVA f`);
    A.eq(codes(v), ["narrowing-violation"]);
  }],
  ["narrowing: a block cannot widen its own contract; desert contracts are refused", () => {
    const v = createKernel().submit(`c : card\nc.title = x\nc.contract.ops = NUL, INS\n!EVA c`);
    A.ok(codes(v).includes("narrowing-violation"));
    const d = createKernel().submit(`r : room\nr.schema.a = text\nr.contract.ops = SYN\nr.contract.terrains = Field\nr.contract.stances = Clearing\n!EVA r`);
    A.ok(codes(d).includes("desert-cell"));
  }],
  ["law 2: lines with no checkpoint → unassembled", () => {
    A.ok(codes(createKernel().submit(`h : hero\nh.title = x`)).includes("unassembled"));
    A.eq(splitAssemblies("a : hero\n!EVA a\nb : hero").length, 2);
  }],
  ["existence: a room's records are distinct instances; a repeated row → repeated", () => {
    const v = createKernel().submit(`o : room\no.schema.name = text\no.row = Glazing\no.row = glazing\n!EVA o`);
    A.eq(codes(v), ["repeated"]);
  }],
  ["atmosphere: unreadable ink on surface → contrast", () => {
    const v = createKernel().submit(`t : theme\nt.ink = #bbbbbb\nt.surface = #ffffff\n!EVA t`);
    A.eq(codes(v), ["contrast"]); A.ok(contrastRatio("#17171a", "#ffffff") > 15);
  }],
  ["compute: the app evaluates formulas; precedence and powers hold", () => {
    A.eq(expr("2 + 3 * 4").run(), 14); A.eq(expr("-2 ^ 2").run(), -4); A.eq(expr("2 ^ 3 ^ 2").run(), 512);
    A.eq(expr("round(10 / 3, 2)").run(), 3.33); A.ok(!expr("2 +").ok); A.ok(!expr("alert(1)").ok);
    const m = expr("(price * (1 - deposit / 100)) * (rate / 1200) / (1 - (1 + rate / 1200) ^ (-years * 12))");
    A.near(m.run({ price: 320000, deposit: 15, rate: 4.6, years: 25 }), 1527.0, 2, "mortgage");
    A.eq(formatValue(1527.04, "money"), "£1,527");
  }],
  ["compute: catalog formulas are expanded by the app; arity and names are checked", () => {
    const k = createKernel();
    A.ok(k.submit(`a : input\na.name = price\na.label = Price\na.kind = number\nb : input\nb.name = dep\nb.label = Deposit\nb.kind = number\nc : input\nc.name = rate\nc.label = Rate\nc.kind = number\n!EVA a, b, c`).ok);
    A.eq(codes(k.submit(`m : result\nm.label = Monthly\nm.formula = mortgage_payment\nm.args = price, dep, rate\n!EVA m`)), ["bad-value"], "three args for four params");
    A.ok(k.submit(`m : result\nm.label = Monthly\nm.formula = mortgage_payment\nm.args = price, dep, rate, 25\n!EVA m`).ok);
    const r = k.model().blocks.m.props;
    A.eq(r.format, "money"); A.near(expr(r.expr).run({ price: 320000, dep: 15, rate: 4.6 }), 1527.0, 2, "mortgage via catalog");
    A.ok(codes(k.submit(`z : result\nz.label = Z\nz.formula = magic\n!EVA z`)).includes("bad-value"));
  }],
  ["compute: a result may only name declared inputs", () => {
    const k = createKernel();
    A.ok(k.submit(`a : input\na.name = bill\na.label = Bill\na.kind = number\n!EVA a`).ok);
    A.eq(codes(k.submit(`r : result\nr.label = Each\nr.expr = bill / people\n!EVA r`)), ["dependency"]);
    A.ok(k.submit(`r : result\nr.label = Each\nr.expr = bill / 2\nr.format = money\n!EVA r`).ok);
  }],
  ["provenance: a citation must resolve to a declared source", () => {
    const base = `src : room\nsrc.schema.key = text\nsrc.schema.title = text\nsrc.row = S1 | Site audit\n!EVA src\nrefs : sources\nrefs.room = src\np : text\np.text = Times fell.\np.cite = S1\n!EVA refs, p\n`;
    A.ok(assemble(base + `d : app\nd.kind = document\nd.blocks = p, refs\n!EVA d`).ok);
    const bad = assemble(base.replace("p.cite = S1", "p.cite = S9") + `d : app\nd.kind = document\nd.blocks = p, refs\n!EVA d`);
    A.ok(!bad.ok); A.eq(codes(bad.verdicts[bad.verdicts.length - 1]), ["unsourced"]);
  }],
  ["closure: the app's contract is computed; a declared one must match", () => {
    const r = assemble(WEBSITE); A.ok(r.model.app.envelope.ops.includes("INS"), "the form's INS is in the envelope");
    const bad = assemble([THEME, ROOM, PAGE, APP.replace("!EVA site", "site.contract.ops = NUL\n!EVA site")].join("\n"));
    A.ok(codes(bad.verdicts[3]).includes("closure-violation"));
  }],
  ["render: model text is escaped, never executed", () => {
    const r = assemble(`h : hero\nh.title = <img src=x onerror=alert(1)>\n!EVA h`);
    A.ok(r.ok); const html = render(r.model);
    A.ok(!html.includes("<img src=x"), "raw tag must not appear"); A.has(html, "&lt;img");
  }],
  ["make: kind is guessed from the ask", () => {
    A.eq(guessKind("a mortgage calculator"), "widget"); A.eq(guessKind("a guide to composting"), "document"); A.eq(guessKind("site for my pottery studio"), "website");
  }],
  ["make: the model only fills values; the app's skeleton carries names and bindings", () => {
    const k = createKernel();
    A.ok(k.submit(ROOM.replaceAll("classes", "offer").replace("offer.schema.price = text", "offer.schema.price = text\noffer.schema.note = text").replace("| £45", "| £45 | 2 hrs").replace("| £35", "| £35 | 90 min")).ok);
    const sk = PLANS.website[2].skeleton(k, "a site with a booking form");
    A.has(sk, "list.room = offer"); A.has(sk, "book : form"); A.ok(!PLANS.website[2].skeleton(createKernel(), "a site").includes("cards"), "no room, no cards");
    const blank = createKernel().submit(PLANS.website[0].skeleton());
    A.ok(blank.ok, "an unfilled optional value is simply absent");
    A.ok(codes(createKernel().submit(PLANS.document[1].skeleton())).includes("missing-prop"), "an unfilled required value is caught");
  }],
  ["make: an input a catalog formula needs is supplied by the app, with the value the request states", () => {
    const k = createKernel();
    A.ok(k.submit(`a : input\na.name = price\na.label = Price\na.kind = number\nb : input\nb.name = dep\nb.label = Deposit\nb.kind = number\nc : input\nc.name = rate\nc.label = Rate\nc.kind = number\n!EVA a, b, c`).ok);
    const s = supplyInputs(k, "out.formula = mortgage_payment\nout.args = price, dep, rate, years", "a mortgage calculator over 25 years");
    A.ok(s, "supplied"); A.has(s.note, "years = 25");
    A.ok(k.submit(`m : result\nm.label = Monthly\nm.formula = mortgage_payment\nm.args = price, dep, rate, years\n!EVA m`).ok);
  }],
  ["make: the skeleton owns structure; a model that renames a type is ignored, and that is reported", () => {
    const f = fillSkeleton(PLANS.website[0].skeleton(), "look : minimalist\nlook.accent = #222222\nlook.font = sans\n!EVA look");
    A.has(f.text, "look : theme"); A.has(f.text, "look.accent = #222222"); A.eq(f.ignored, ["look : minimalist"]);
    const rows = fillSkeleton("o : room\no.schema.a = text\no.row = \no.row = \n!EVA o", "o.row = x\no.row = y");
    A.has(rows.text, "o.row = x\no.row = y", "repeated slots fill in order");
    const doc = fillSkeleton("t : heading\nt.text = \np : text\np.text = \n!EVA t, p", "intro : text\nintro.text = Body words.\ntitle : heading\ntitle.text = The Title\n!EVA title, intro");
    A.has(doc.text, "t.text = The Title\np : text\np.text = Body words.", "renamed parts are matched by their type, not their order");
  }],
];

export async function runTests() {
  const out = [];
  for (const [name, fn] of TESTS) { const t0 = performance.now(); try { await fn(); out.push({ name, ok: true, ms: Math.round(performance.now() - t0) }); } catch (e) { out.push({ name, ok: false, error: e.message, ms: Math.round(performance.now() - t0) }); } }
  return out;
}
