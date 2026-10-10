// G2 I3: the FROZEN case table (>= 40 failure cases + controls). Written BEFORE `before.mjs` / `after` were run on it.
// Sources of the inputs: P(id) = a REAL fetched page (eval/ants/g2/pages.json); R(id) = a REAL gemma2:2b reply (model-outputs.json);
// everything else is literal and marked `synth`. Labels (expect) are mine, by reading — never produced by the module.
// usable: ids of the passages a person would accept as material ABOUT the topic (by fetch role: ctl-* on topic, tut-* about writing), judged by me.
import fs from "node:fs";
const pages = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("./pages.json", import.meta.url), "utf8")).map((p) => [p.id, p]));
const outs = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("./model-outputs.json", import.meta.url), "utf8")).out.map((o) => [o.id, o]));
export const P = (id, n = 3000) => ({ id, ref: `${new URL(pages[id].url).hostname.replace(/^www\./, "")} — ${pages[id].title}`, url: pages[id].url, text: pages[id].text.slice(0, n) });
export const R = (id) => ({ text: outs[id].reply, finish: outs[id].finish, real: id });
const WALL = { id: "wall-bartleby", ref: "bartleby.com — Just a moment", url: "https://www.bartleby.com/essay/x", text: "This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot." };
const TEL = [{ role: "user", content: "who invented the telephone?" }, { role: "assistant", content: "Alexander Graham Bell is credited with inventing the telephone in 1876.", grounding: { kind: "research" } }];
const E = (topic, extra = {}) => ({ type: "essay", topic, constraints: {}, needsSources: true, voidIfMissing: [], ...extra });
const NET = { status: 0, message: "bridge unreachable: Failed to fetch" };
const F = [];                       // failure cases
const C = [];                       // controls
const f = (id, cat, ask, ot, o = {}) => F.push({ id, cat, ask, outputType: ot, prior: [], passages: [], failure: null, modelResult: null, hasMaterial: false, barred: null, real: [], synth: [], ...o, expect: { ok: false, reasons: o.reasons || [cat] } });
const c = (id, cat, ask, ot, o = {}) => C.push({ id, cat, ask, outputType: ot, prior: [], passages: [], failure: null, modelResult: null, hasMaterial: false, barred: null, real: [], synth: [], ...o, expect: { ok: true } });
const metaIds = (...ids) => ({ passages: ids.map((i) => P(i)), usable: [], aside: ids });
const goodIds = (...ids) => ({ passages: ids.map((i) => P(i)), usable: ids, aside: [] });

// network / transport
f("net-screenshot", "network", "write me an essay on this", E("invented telephone"), { prior: TEL, ...metaIds("tut-leverageedu-telephone", "tut-gradesfixer-telephone", "tut-essaysio-telephone"), failure: NET, real: ["pages", "live-run"] });
f("net-good", "network", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone", "ctl-nms-bell"), failure: NET, real: ["pages"] });
f("net-poem-nosrc", "network", "write a poem about the sea", { type: "poem", topic: "the sea", constraints: {}, needsSources: false, voidIfMissing: [] }, { failure: NET });
f("net-emptythread-service", "no-topic", "write me an essay on this", E("this"), { ...metaIds("tut-papersowl", "tut-ivypanda-tool"), failure: NET, real: ["pages", "live-run"] });
// timeout / rate limit / gate / sealed / no model
f("timeout-good", "timeout", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), failure: { status: 504, message: "the turn timed out after 90 s" } });
f("timeout-report-nopages", "timeout", "write a report on solar power", { type: "report", topic: "solar power", constraints: {}, needsSources: true, voidIfMissing: [] }, { failure: { status: 504, message: "timed out" } });
f("ratelimit-good", "rate-limit", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone", "ctl-wp-bell"), failure: { status: 429, message: "429 too many requests" } });
f("ratelimit-story", "rate-limit", "write a story about a lighthouse", { type: "story", topic: "a lighthouse", constraints: {}, needsSources: false, voidIfMissing: [] }, { failure: { status: 429, message: "rate limit" } });
f("gate-good", "gate", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), failure: { status: 403, message: "the safety gate said: this request was refused by the gate" } });
f("gate-story", "gate", "write a story about a heist", { type: "story", topic: "a heist", constraints: {}, needsSources: false, voidIfMissing: [] }, { failure: { status: 403, message: "refused by safety" } });
f("sealed-letter", "sealed", "write a letter to my landlord about the leak", { type: "letter", topic: "the leak", constraints: {}, needsSources: false, voidIfMissing: ["details"] }, { hasMaterial: true, failure: { status: 422, message: "the prompt was withheld before it reached the model (pii) — nothing was sent" } });
f("sealed-essay", "sealed", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), failure: { status: 422, message: "withheld before it reached the model (sealed-external)" } });
f("nomodel-good", "no-model", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone", "ctl-nms-bell"), failure: { kind: "no-model", message: "no model — none is available" } });
f("nomodel-nopages", "no-model", "write a report on solar power", { type: "report", topic: "solar power", constraints: {}, needsSources: true, voidIfMissing: [] }, { failure: { kind: "no-model", message: "no model" } });
// the model's reply is not the thing
f("empty-good", "empty", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), modelResult: { text: "", tokens: 0, finish: "stop" } });
f("empty-poem", "empty", "write a poem about the sea", { type: "poem", topic: "the sea", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: { text: "   \n", tokens: 3 }, synth: ["reply"] });
f("refusal-sorry", "refused", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), modelResult: { text: "I'm sorry, but I cannot write an essay for you.", finish: "stop" }, synth: ["reply"] });
f("refusal-asai", "refused", "write a report on solar power", { type: "report", topic: "solar power", constraints: {}, needsSources: true, voidIfMissing: [] }, { ...goodIds("ctl-wp-solar"), modelResult: { text: "As an AI language model, I am not able to produce reports.", finish: "stop" }, synth: ["reply"] });
f("refusal-cannot", "refused", "write a poem about the sea", { type: "poem", topic: "the sea", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: { text: "I cannot fulfil this request.", finish: "stop" }, synth: ["reply"] });
f("stub-teaser", "stub", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), modelResult: { text: "Certainly, I'd be happy to help you write an essay on the telephone!", finish: "stop" }, real: ["pages", "live-run"], synth: ["reply (the string the live run served)"] });
f("stub-oneliner", "stub", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), modelResult: { text: "The telephone was invented by Alexander Graham Bell in 1876 and changed communication.", finish: "stop" }, synth: ["reply"] });
f("stub-colon", "stub", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), modelResult: { text: "Here is your essay on the telephone:", finish: "stop" }, synth: ["reply"] });
f("asked-real-coverletter", "asked-instead", "write a cover letter for my job application", { type: "cover letter", topic: "my job application", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: R("coverletter-nosrc#1"), real: ["reply"] });
f("asked-topics", "asked-instead", "write an essay", E("climate"), { ...goodIds("ctl-wp-climate"), modelResult: { text: "What topics would you like me to cover in the essay? Could you provide more details about the angle you want?", finish: "stop" }, synth: ["reply"] });
f("tutorial-real-service-1", "wrote-tutorial|off-topic-draft", "write me an essay on this", E("invented telephone"), { ...goodIds("ctl-wp-telephone", "ctl-nms-bell"), modelResult: R("telephone-service#1"), real: ["reply"], synth: ["passages substituted: the real reply was written from the service pages"] , reasons: ["wrote-tutorial", "off-topic-draft"] });
f("tutorial-real-service-2", "wrote-tutorial|off-topic-draft", "write me an essay on this", E("invented telephone"), { ...goodIds("ctl-wp-telephone", "ctl-nms-bell"), modelResult: R("telephone-service#2"), real: ["reply"], synth: ["passages substituted"], reasons: ["wrote-tutorial", "off-topic-draft"] });
f("tutorial-synth", "wrote-tutorial", "write an essay about climate", E("climate"), { ...goodIds("ctl-wp-climate"), modelResult: { text: "How to Write an Essay\n\nStep 1: Start with an introduction. Step 2: Write the body with a topic sentence in each paragraph. Step 3: End with a conclusion. Tips for your essay: keep to the word limit and write a thesis statement. ".repeat(6), finish: "stop" }, synth: ["reply"] });
f("offtopic-synth", "off-topic-draft", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), modelResult: { text: "Coffee is a brewed drink prepared from roasted beans. Brazil is the largest producer, and the drink is consumed worldwide in many forms every single day of the year. ".repeat(10), finish: "stop" }, synth: ["reply"] });
// no topic
f("notopic-emptythread", "no-topic", "write me an essay on this", E("this"), { real: [] });
f("notopic-it", "no-topic", "write a report on it", { type: "report", topic: "it", constraints: {}, needsSources: true, voidIfMissing: [] });
f("notopic-pages-cannot-rescue", "no-topic", "write me an essay on that", E("that"), { ...metaIds("tut-papersowl", "tut-ivypanda-tool"), real: ["pages"] });
f("notopic-bare", "no-topic", "write an essay", E(""));
// topic but no pages / only unusable pages
f("nopages-essay", "no-sources", "write an essay about the extinction of dolphins", E("the extinction of dolphins"), { modelResult: R("essay-nosrc#1"), real: ["reply"], synth: ["no pages: the model is not asked in the page; the real reply is carried only to show it must not be spoken"] });
f("nopages-report", "no-sources", "write a report on solar power", { type: "report", topic: "solar power", constraints: {}, needsSources: true, voidIfMissing: [] });
f("nopages-story-sourced", "no-sources", "write a story about the Great Fire of London", { type: "story", topic: "the Great Fire of London", constraints: {}, needsSources: true, voidIfMissing: [] });
f("meta-leverage-gradesfixer", "meta-only", "write me an essay on this", E("invented telephone"), { prior: TEL, ...metaIds("tut-leverageedu-telephone", "tut-gradesfixer-telephone"), modelResult: R("telephone-meta#1"), real: ["pages", "reply"] });
f("meta-service", "meta-only", "write me an essay on this", E("invented telephone"), { ...metaIds("tut-papersowl", "tut-ivypanda-tool"), modelResult: R("telephone-service#1"), real: ["pages", "reply"] });
f("meta-tutorials-climate", "meta-only", "write an essay about climate", E("climate"), { ...metaIds("tut-purdue-essay", "tut-wikihow-essay"), modelResult: R("essay-howto-src#1"), real: ["pages", "reply"] });
f("meta-report-guide", "meta-only", "write a report on solar power", { type: "report", topic: "solar power", constraints: {}, needsSources: true, voidIfMissing: [] }, { ...metaIds("tut-wikihow-report"), real: ["pages"] });
f("meta-speech", "meta-only", "write a speech about my sister's wedding", { type: "speech", topic: "my sister's wedding", constraints: {}, needsSources: true, voidIfMissing: [] }, { ...metaIds("tut-speech-howto", "tut-wikihow-essay"), real: ["pages"], synth: ["type/topic pairing"] });
f("wall-only", "wall-only", "write me an essay on the telephone", E("the telephone"), { passages: [WALL], usable: [], aside: ["wall-bartleby"], real: ["live-run (text of the bot-check page the strand quoted)"] });
f("wall-and-meta", "meta-only|wall-only", "write me an essay on the telephone", E("the telephone"), { passages: [WALL, P("tut-leverageedu-telephone")], usable: [], aside: ["wall-bartleby", "tut-leverageedu-telephone"], reasons: ["meta-only", "wall-only"], real: ["pages"] });
f("offtopic-only", "off-topic-only", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-coffee", "ctl-wp-sea").passages ? { passages: [P("ctl-wp-coffee"), P("ctl-wp-sea")], usable: [], aside: ["ctl-wp-coffee", "ctl-wp-sea"] } : {}, real: ["pages"] });
f("mixed-network", "network", "write me an essay on the telephone", E("the telephone"), { passages: [P("tut-leverageedu-telephone"), P("ctl-wp-telephone"), P("tut-papersowl"), P("ctl-nms-bell")], usable: ["ctl-wp-telephone", "ctl-nms-bell"], aside: ["tut-leverageedu-telephone", "tut-papersowl"], failure: NET, real: ["pages"] });
// output type / own text / policy
f("unsupported-image", "unsupported-type", "make me an image of a dog", { type: "image", topic: "a dog", constraints: {}, needsSources: false, voidIfMissing: [] });
f("unsupported-video", "unsupported-type", "generate a video about cats", { type: "video", topic: "cats", constraints: {}, needsSources: false, voidIfMissing: [] });
f("unsupported-slides", "unsupported-type", "create a slide deck about whales", { type: "slides", topic: "whales", constraints: {}, needsSources: true, voidIfMissing: [] });
f("owntext-coverletter", "own-text-missing", "write a cover letter", { type: "cover letter", topic: "", constraints: {}, needsSources: false, voidIfMissing: ["details"] });
f("owntext-summary", "own-text-missing", "write a summary of this", { type: "summary", topic: "", constraints: {}, needsSources: false, voidIfMissing: ["own-text"] });
f("owntext-reply", "own-text-missing", "write a reply to that email", { type: "email", topic: "a reply", constraints: {}, needsSources: false, voidIfMissing: ["recipient"] });
f("alone-poem", "alone-barred", "write a poem about the sea", { type: "poem", topic: "the sea", constraints: {}, needsSources: false, voidIfMissing: [] }, { barred: "alone" });
f("type-unknown-widget", "type-unknown", "make me a widget about birds", { type: "widget", topic: "birds", constraints: {}, needsSources: true, voidIfMissing: [] });
f("type-none", "type-unknown", "write me something", null);

// controls: successful generate turns (the false-void rate is measured here)
c("ok-essay-telephone-1", "ok", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone", "ctl-wp-history-telephone", "ctl-nms-bell"), modelResult: R("telephone-good#1"), real: ["pages", "reply"] });
c("ok-essay-telephone-2", "ok", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone", "ctl-wp-history-telephone", "ctl-nms-bell"), modelResult: R("telephone-good#2"), real: ["pages", "reply"] });
c("ok-essay-mixed-sources", "ok", "write me an essay on this", E("invented telephone"), { prior: TEL, passages: [P("tut-leverageedu-telephone"), P("ctl-wp-telephone"), P("ctl-nms-bell")], usable: ["ctl-wp-telephone", "ctl-nms-bell"], aside: ["tut-leverageedu-telephone"], modelResult: R("telephone-good#1"), real: ["pages", "reply"] });
c("ok-poem-sea-1", "ok", "write a poem about the sea", { type: "poem", topic: "the sea", constraints: {}, needsSources: false, voidIfMissing: [] }, { ...goodIds("ctl-wp-sea"), modelResult: R("sea-poem#1"), real: ["pages", "reply"] });
c("ok-poem-sea-2", "ok", "write a poem about the sea", { type: "poem", topic: "the sea", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: R("sea-poem#2"), real: ["reply"] });
c("ok-report-solar-1", "ok", "write a report on solar power", { type: "report", topic: "solar power", constraints: {}, needsSources: true, voidIfMissing: [] }, { ...goodIds("ctl-wp-solar", "ctl-nasa-solar"), modelResult: R("solar-report#1"), real: ["pages", "reply"] });
c("ok-report-solar-2", "ok", "write a report on solar power", { type: "report", topic: "solar power", constraints: {}, needsSources: true, voidIfMissing: [] }, { ...goodIds("ctl-wp-solar", "ctl-nasa-solar"), modelResult: R("solar-report#2"), real: ["pages", "reply"] });
c("ok-haiku-1", "ok", "write a haiku about autumn", { type: "haiku", topic: "autumn", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: R("haiku-nosrc#1"), real: ["reply"] });
c("ok-haiku-2", "ok", "write a haiku about autumn", { type: "haiku", topic: "autumn", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: R("haiku-nosrc#2"), real: ["reply"] });
c("ok-speech-wedding-1", "ok", "write a speech for my sister's wedding", { type: "speech", topic: "my sister's wedding", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: R("wedding-speech#1"), real: ["reply"] });
c("ok-speech-wedding-2", "ok", "write a speech for my sister's wedding", { type: "speech", topic: "my sister's wedding", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: R("wedding-speech#2"), real: ["reply"] });
c("ok-essay-constraint-words", "ok", "write a 300 word essay on the telephone", E("the telephone", { constraints: { words: 300 } }), { ...goodIds("ctl-wp-telephone"), modelResult: R("telephone-meta#2"), real: ["pages", "reply"] });
c("ok-limerick", "ok", "write a limerick about a cat", { type: "limerick", topic: "a cat", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: { text: "A cat from the town of Peru\nHad nothing whatever to do\nShe napped on a chair\nWith a languid air\nThen woke up and wanted her stew", finish: "stop" }, synth: ["reply"] });
c("ok-email", "ok", "write an email about a delayed shipment", { type: "email", topic: "a delayed shipment", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: { text: "Hello, my order was due on Monday and has not arrived. Could you tell me where it is and when it will come? I paid for express delivery and need it before the weekend. Thank you for your help.", finish: "stop" }, synth: ["reply"] });
c("ok-html-page", "ok", "make a website for my bakery", { type: "website", topic: "my bakery", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: { text: "```html\n<html><body><h1>My Bakery</h1><p>Fresh bread every morning, baked on the premises with local flour.</p></body></html>\n```", finish: "stop" }, synth: ["reply"] });
c("ok-list", "ok", "make a list of fruit", { type: "list", topic: "fruit", constraints: {}, needsSources: false, voidIfMissing: [] }, { modelResult: { text: "- apples\n- pears\n- plums\n- figs\n- grapes\n- limes\n- dates\n- kiwis", finish: "stop" }, synth: ["reply"] });
c("ok-summary-with-material", "ok", "write a summary of this", { type: "summary", topic: "", constraints: {}, needsSources: false, voidIfMissing: ["own-text"] }, { hasMaterial: true, modelResult: { text: "The text argues that cities that plant trees along their streets lower summer temperatures and improve air quality, and it recommends that planners fund street trees before widening roads.", finish: "stop" }, synth: ["reply"] });
c("ok-cut-at-length", "ok", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), modelResult: { ...R("telephone-good#1"), text: R("telephone-good#1").text, finish: "length" }, real: ["pages", "reply"], note: "finish=length: the text is the model's own words and is shown (not a void)" });
c("ok-stopped-by-person", "ok", "write me an essay on the telephone", E("the telephone"), { ...goodIds("ctl-wp-telephone"), failure: { name: "AbortError", message: "aborted" } });

export const CASES = { failures: F, controls: C, all: [...F, ...C] };
