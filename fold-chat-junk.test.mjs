// fold-chat-junk.test.mjs — the junk gate, the wall check, the joined-piece re-verification, and their FALSIFIERS
// (docs/SNIP-JUNK-PREREG.md: B1 junk shown, B2 verbatim, B5 walls, B6 false walls). A falsifier is a case where removing the fix makes
// the test FAIL: it names what would be shown if the gate did not exist.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CHROME, STRONG, WALL } from "./fold-chat-junk-lexicon.js";
import { classifyUnit, unitsOf, endsWithAbbreviation, junkOf, hasMarkup, isHollow, hasSentence, gateSnips, wallOf, verifyJoined, piecesOf, JUNK } from "./fold-chat-junk.js";

const PROSE = "The octopus is a soft-bodied animal with eight arms, and it can change the colour of its skin to hide from predators in the sea.";
const NAV = "Home Destinations Trending Europe Asia The Americas Australia Africa The Middle East The Caribbean Our Favorite Places Iceland Italy Japan London Portugal";
const COOKIE = "This website uses cookies to give you the best experience. Accept all cookies or manage preferences. Privacy policy. Cookie settings.";

test("the lexicon is declared multilingual DATA: frozen arrays of strings, one key per language, and no capital-letter logic in code", () => {
  for (const lex of [CHROME, STRONG, WALL]) {
    assert.ok(Object.isFrozen(lex));
    const langs = Object.keys(lex);
    assert.ok(langs.length >= 6, "several languages: " + langs.join(","));
    for (const [k, list] of Object.entries(lex)) { assert.ok(/^[a-z]{2}$/.test(k)); assert.ok(Array.isArray(list) && list.every((p) => typeof p === "string" && p.length >= 2), k); }
  }
  for (const l of ["en", "es", "fr", "de", "pt", "it", "ru", "zh", "ja", "ko", "ar"]) assert.ok(CHROME[l] && WALL[l], "chrome and wall phrases for " + l);
  for (const f of ["fold-chat-junk.js", "fold-chat-junk-lexicon.js"]) assert.ok(!/\[A-Z\]/.test(fs.readFileSync(new URL("./" + f, import.meta.url), "utf8")), f + " has a capital-letter class");
});

test("FALSIFIER (B1): a nav dump, a cookie banner and a footer are chrome; prose is not", () => {
  assert.equal(classifyUnit(NAV).chrome, true, "a menu has no stop and almost no function words");
  assert.equal(classifyUnit(COOKIE).chrome, true);
  assert.equal(classifyUnit("All rights reserved. Privacy policy. Terms of use.").chrome, true);
  assert.equal(classifyUnit(PROSE).chrome, false);
  assert.equal(junkOf(NAV + ". " + NAV).junk, true);
  assert.equal(junkOf(PROSE).junk, false);
});

test("junk is DOMINATED by chrome or LEADS with it; chrome only after real content is not the lead", () => {
  const led = junkOf(COOKIE + " " + PROSE + " " + PROSE);
  assert.equal(led.junk, true); assert.equal(led.leading, true);
  assert.equal(junkOf(PROSE + " " + PROSE + " " + PROSE + " " + COOKIE).leading, false, "three sentences of content, then the banner");
  assert.equal(junkOf("Subscribe to our newsletter. Sign up to get updates. Privacy policy. Terms of use. All rights reserved. This is a short note.").dominated, true);
});

test("multilingual: consent, sign-in and footer text in other languages is chrome; their prose is not", () => {
  const chrome = {
    es: "Usamos cookies. Aceptar todas. Política de privacidad. Todos los derechos reservados.",
    de: "Wir verwenden Cookies. Alle akzeptieren. Datenschutzerklärung. Alle Rechte vorbehalten.",
    fr: "Nous utilisons des cookies. Tout accepter. Politique de confidentialité. Tous droits réservés.",
    ru: "Мы используем cookie. Принять все. Политика конфиденциальности. Все права защищены.",
    ja: "プライバシーポリシー 利用規約 お問い合わせ 会社概要 無断転載を禁じます",
    zh: "隐私政策 使用条款 联系我们 关于我们 版权所有",
    ar: "سياسة الخصوصية شروط الاستخدام اتصل بنا من نحن جميع الحقوق محفوظة",
  };
  for (const [l, t] of Object.entries(chrome)) assert.equal(junkOf(t).junk, true, l);
  const prose = {
    es: "El pulpo es un animal de cuerpo blando con ocho brazos y puede cambiar el color de su piel para esconderse de los depredadores.",
    de: "Der Oktopus ist ein weichkörperiges Tier mit acht Armen und kann die Farbe seiner Haut ändern, um sich vor Raubtieren zu verstecken.",
    ru: "Осьминог — это мягкотелое животное с восемью щупальцами, которое может менять цвет кожи, чтобы прятаться от хищников в море.",
    pt: "O polvo é um animal de corpo mole com oito braços e pode mudar a cor da pele para se esconder dos predadores no mar.",
    nl: "De octopus is een weekdier met acht armen en kan de kleur van zijn huid veranderen om zich voor roofdieren in de zee te verbergen.",
    pl: "Ośmiornica jest miękkim zwierzęciem o ośmiu ramionach i potrafi zmieniać kolor skóry, aby ukryć się przed drapieżnikami w morzu.",
    ja: "タコは八本の腕を持つ軟体動物で、捕食者から身を隠すために皮膚の色を変えることができます。",
    zh: "章鱼是一种有八条腕的软体动物，它可以改变皮肤的颜色来躲避海里的捕食者。",
    ar: "الأخطبوط حيوان رخوي له ثمانية أذرع ويستطيع تغيير لون جلده ليختبئ من الحيوانات المفترسة في البحر.",
  };
  for (const [l, t] of Object.entries(prose)) assert.equal(junkOf(t).junk, false, l + " prose is not junk");
});

test("a STRONG phrase makes a short unit chrome whatever else it says (affiliate, newsletter, endorsement, badge)", () => {
  for (const t of ["This post may contain affiliate links, which means I may earn a commission.", "Join 1M+ other subscribers and receive regular emails on neuroscience and health.", "We do not endorse non-Cleveland Clinic products or services.", "Baseline Widely available This feature is well established and works across many devices and browser versions."]) assert.equal(classifyUnit(t).chrome, true, t);
  assert.equal(classifyUnit("The library lends books to its members and to the staff of the city schools every week.").chrome, false);
});

test("sentence units: decimals and abbreviations do not end a unit", () => {
  assert.deepEqual(unitsOf("The rate was 4.97 percent last year. Dr. Smith said (see Fig. 5b) it rose. J. K. Rowling wrote it."), ["The rate was 4.97 percent last year.", "Dr. Smith said (see Fig. 5b) it rose.", "J. K. Rowling wrote it."]);
  assert.equal(endsWithAbbreviation("see Fig."), true); assert.equal(endsWithAbbreviation("Ask J."), true);
  assert.equal(endsWithAbbreviation("It rained."), false);
});

test("markup that leaked into text, hollow declared blocks, fragments", () => {
  assert.equal(hasMarkup('player/embed width="100%" height="290" frameborder="0" title="x">'), true);
  assert.equal(hasMarkup("The value is 3 < 5 and 7 > 2 in this example, of course."), false);
  assert.equal(junkOf('<iframe src="x"></iframe> and then some more words to read here today').junk, true);
  assert.equal(isHollow("Starts: 2026-10-05\nWhere:"), true, "labels with no values (the empty Event template)");
  assert.equal(isHollow("Starts: 2026-10-05\nWhere: Crest Theater, Sacramento, California, in the main hall"), false);
  assert.equal(junkOf("Starts: 2026-10-05\nWhere:", { declared: true }).reason, "hollow");
  assert.equal(hasSentence("October 5, 2026, 9:00 AM - 10:00 AM"), false);
  assert.equal(hasSentence("American Football Conference AFC East"), false);
  assert.equal(hasSentence(PROSE), true);
  assert.equal(junkOf("American Football Conference AFC East").reason, "fragment");
});

test("a DECLARED block (recipe lists) is judged by the lexicon, markup and hollowness only, never as prose", () => {
  const recipe = "Ingredients:\n- 400g bread flour (14 ounces; about 2 1/2 cups), plus more for dusting\n- 10g kosher salt\n- 4g instant yeast\n- 275g water\nSteps:\n1. Mix everything\n2. Rest for 10 minutes\n3. Bake at 230C";
  assert.equal(junkOf(recipe, { declared: true }).junk, false);
  assert.equal(junkOf("Ingredients: - " + COOKIE, { declared: true }).junk, true, "a declared block that is a consent notice is still junk");
});

test("FALSIFIER (B1): gateSnips shows no junk and returns a typed gap when everything is junk, never a replacement", () => {
  const g = gateSnips([{ text: NAV }, { text: COOKIE }]);
  assert.deepEqual(g.shown, []);
  assert.equal(g.junk.length, 2);
  assert.equal(g.gap.kind, "gap"); assert.equal(g.gap.gap, "junk");
  const h = gateSnips([{ text: NAV }, { text: PROSE }]);
  assert.equal(h.shown.length, 1); assert.equal(h.gap, null);
  assert.equal(gateSnips([]).gap, null, "nothing offered is not 'everything was junk'");
});

test("FALSIFIER (B5): walls — a status refusal, a captcha, an expiry, a member gate, a waiting room all yield a typed 'blocked'", () => {
  for (const status of [401, 403, 404, 410, 429, 451, 500, 503]) assert.equal(wallOf({ status, text: PROSE }).blocked, true, "HTTP " + status);
  const walls = [
    ["Access Denied", "You do not have permission to access this server."],
    ["Just a moment...", "Checking if the site connection is secure. Enable JavaScript and cookies to continue."],
    ["", "Verify you are human by completing the action below. Ray ID: 1234"],
    ["Job posting", "This job is no longer available. Browse similar jobs."],
    ["", "This listing has expired. Search again."],
    ["Story", "Member-only story. Sign in to continue reading."],
    ["", "We've got our hands full at the moment but we should be up and moving shortly. This page will automatically refresh and bring you into the website."],
    ["", "You are in line. Your estimated wait time is 5 minutes."],
    ["", "Subscribe to continue reading. You've reached your limit of free articles."],
  ];
  for (const [title, text] of walls) { const w = wallOf({ status: 200, title, text }); assert.equal(w.blocked, true, text.slice(0, 40)); assert.ok(w.reason.length > 10, "a reason in plain words"); }
  const other = [["Acceso denegado", ""], ["", "Zugriff verweigert. Bestätigen Sie, dass Sie ein Mensch sind."], ["", "Accès refusé. Je ne suis pas un robot."], ["访问被拒绝", ""], ["", "ページが見つかりません"], ["", "Доступ запрещен. Войдите, чтобы продолжить."], ["", "تم رفض الوصول"]];
  for (const [title, text] of other) assert.equal(wallOf({ status: 200, title, text }).blocked, true, title + text.slice(0, 30));
});

test("FALSIFIER (B6): false walls — a long article that mentions a captcha or a 404, or is ABOUT page-not-found errors, is not a wall", () => {
  const article = (lead) => lead + " " + PROSE.repeat(30);
  assert.equal(wallOf({ status: 200, title: "Fixing slow forms", text: article("Most sites protect signup with a captcha, which slows people down.") }).blocked, false, "captcha mentioned in a 3,000-char article");
  assert.equal(wallOf({ status: 200, title: "How to fix page not found errors on your website", text: article("A 404 page not found error means the URL has moved.") }).blocked, false, "an article about 404s");
  assert.equal(wallOf({ status: 200, title: "Octopus", text: PROSE.repeat(20) }).blocked, false);
  assert.equal(wallOf({ status: 200, title: "", text: "" }).blocked, false, "empty text is not 'a wall'");
  assert.equal(wallOf({ status: 202, title: "Okapi", text: PROSE.repeat(40) }).blocked, false, "HTTP 2xx other than 200 is not a refusal");
});

test("a page with almost no prose of its own (menus and notices only) shows nothing: kind no-content", () => {
  const w = wallOf({ status: 200, text: NAV + ". " + COOKIE + " " + NAV });
  assert.equal(w.blocked, true); assert.equal(w.kind, "no-content");
});

test("FALSIFIER (B2): a stitch is re-verified AFTER joining — a piece that is not on the page is dropped, never shown", () => {
  const page = "Alpha starts the page with a first sentence. Menu menu menu. Beta is the second real sentence of the page. Gamma closes it.";
  const ok = verifyJoined(["Alpha starts the page with a first sentence.", "Beta is the second real sentence of the page."], page);
  assert.equal(ok.ok, true); assert.equal(ok.text, "Alpha starts the page with a first sentence. … Beta is the second real sentence of the page.");
  // the false adjacency: "A B" is what you get by joining across the menu; as ONE piece it is not on the page
  const bridged = verifyJoined(["Alpha starts the page with a first sentence. Beta is the second real sentence of the page."], page);
  assert.equal(bridged.ok, false); assert.deepEqual(bridged.pieces, []);
  const mixed = verifyJoined(["Alpha starts the page with a first sentence.", "Invented sentence the page never said."], page);
  assert.equal(mixed.ok, false); assert.deepEqual(mixed.pieces, ["Alpha starts the page with a first sentence."]); assert.equal(mixed.dropped.length, 1);
  assert.equal(verifyJoined(['<iframe width="100%" height="290"> embedded player'], '<iframe width="100%" height="290"> embedded player').ok, false, "leaked markup is dropped even when it is on the page");
  assert.deepEqual(piecesOf("one piece here … another piece there\nthird piece"), ["one piece here", "another piece there", "third piece"]);
});

test("whitespace and the ellipsis join add nothing that is not the page's: pieces keep the page's own words", () => {
  const page = "The  tower\nis 330 metres tall.   It has three levels.";
  const v = verifyJoined(["The tower is 330 metres tall.", "It has three levels."], page);
  assert.equal(v.ok, true);
  assert.equal(v.text.replace(/ … /g, " "), "The tower is 330 metres tall. It has three levels.");
});

test("JUNK constants are declared numbers with the prereg's values", () => {
  assert.equal(JUNK.DOMINATED, 0.5); assert.equal(JUNK.COVER, 0.4); assert.equal(JUNK.STOPLESS_MIN, 12); assert.equal(JUNK.LEAD_UNITS, 2);
});
