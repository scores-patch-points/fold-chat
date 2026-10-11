// G3 corpus2 — HELD OUT. Written and hashed (corpus2.sha) after the gate was tuned on corpus.mjs and BEFORE any run of the gate on this file.
// Same schema as corpus.mjs. Asks are typed the way people type (lowercase, typos, run-ons); the prior turns reuse corpus.mjs's topics plus new ones.
import { T } from "./corpus.mjs";
const T2 = {
  en: {
    ...T.en,
    dino: { q: "what killed the dinosaurs", a: "Most scientists think an asteroid struck Earth about 66 million years ago near what is now Mexico, causing a mass extinction.", t: ["Cretaceous–Paleogene extinction event"] },
    bread: { q: "how do i make sourdough bread", a: "Mix flour, water and an active starter, let it rise overnight, shape it and bake in a hot Dutch oven.", t: ["Sourdough"] },
    lincoln: { q: "who was abraham lincoln", a: "Abraham Lincoln was the 16th president of the United States. He led the country through the Civil War and was shot by John Wilkes Booth in 1865.", t: ["Abraham Lincoln"] },
    tesla: { q: "who was nikola tesla", a: "Nikola Tesla was a Serbian-American inventor who worked on alternating current. He worked for Thomas Edison briefly in 1884.", t: ["Nikola Tesla"] },
    mars: { q: "tell me about mars", a: "Mars is the fourth planet from the sun. It has two small moons, Phobos and Deimos, and the tallest volcano in the solar system, Olympus Mons.", t: ["Mars"] },
  },
  es: { ...T.es, lincoln: { q: "¿quién fue Abraham Lincoln?", a: "Abraham Lincoln fue el decimosexto presidente de Estados Unidos. Dirigió el país durante la Guerra Civil y murió asesinado en 1865.", t: ["Abraham Lincoln"] } },
  fr: { ...T.fr, lincoln: { q: "qui était Abraham Lincoln ?", a: "Abraham Lincoln fut le seizième président des États-Unis. Il dirigea le pays pendant la guerre de Sécession et fut assassiné en 1865.", t: ["Abraham Lincoln"] } },
};
const turn = (lang, k) => ({ ask: T2[lang][k].q, answer: T2[lang][k].a, titles: T2[lang][k].t });
let n = 0;
const S = (cls, lang, prior, ask, expect, extra = {}) => ({ id: `x${cls[0]}${String(++n).padStart(3, "0")}`, cls, lang, prior: Array.isArray(prior) ? prior : [prior], ask, expect, ...extra });
const E = (k) => turn("en", k);
export const CORPUS2 = [
  // FOLLOW en (14)
  S("follow", "en", E("dino"), "what else", "carry"),
  S("follow", "en", E("lincoln"), "who shot him", "carry", { ref: "Lincoln" }),
  S("follow", "en", E("bread"), "can you give an example", "carry", { ref: "sourdough" }),
  S("follow", "en", E("tesla"), "and what did he do for edison", "carry", { ref: "Tesla" }),
  S("follow", "en", E("mars"), "how big are they", "carry", { ref: "Mars" }),
  S("follow", "en", E("lincoln"), "ok and after that?", "carry", { ref: "Lincoln" }),
  S("follow", "en", E("dino"), "when did that happen", "carry", { ref: "Cretaceous" }),
  S("follow", "en", E("bread"), "a bit more sour please", "carry", { ref: "sourdough" }),
  S("follow", "en", E("tesla"), "its meaning?", "carry"),
  S("follow", "en", E("mars"), "any more?", "carry", { ref: "Mars" }),
  S("follow", "en", E("lincoln"), "why did he do it", "carry", { ref: "Lincoln" }),
  S("follow", "en", E("tesla"), "and in 1893?", "carry", { ref: "Tesla" }),
  S("follow", "en", [E("lincoln"), E("tesla")], "where was he born", "carry", { ref: "Tesla", three: true }),
  S("follow", "en", [E("mars"), E("dino")], "and how long ago was that", "carry", { ref: "Cretaceous", three: true }),
  // FOLLOW es (4) / fr (4)
  S("follow", "es", turn("es", "lincoln"), "¿cuándo nació?", "carry", { ref: "Lincoln", note: "pro-drop verb only: the known weak side" }),
  S("follow", "es", turn("es", "curie"), "cuéntame más sobre ella", "carry", { ref: "Curie" }),
  S("follow", "es", turn("es", "lincoln"), "¿y su asesino?", "carry", { ref: "Lincoln" }),
  S("follow", "es", turn("es", "eiffel"), "¿y por qué?", "carry"),
  S("follow", "fr", turn("fr", "lincoln"), "qui l'a tué ?", "carry", { ref: "Lincoln", note: "clitic l' only: the known weak side" }),
  S("follow", "fr", turn("fr", "curie"), "parle-moi plus d'elle", "carry", { ref: "Curie" }),
  S("follow", "fr", turn("fr", "lincoln"), "et sa femme ?", "carry", { ref: "Lincoln" }),
  S("follow", "fr", turn("fr", "eiffel"), "et alors ?", "carry"),
  // SWITCH en (16), several that share words / look like follow-ups
  S("switch", "en", E("lincoln"), "why is the ocean blue", "none", { share: false }),
  S("switch", "en", E("mars"), "how does a hot air balloon work", "none"),
  S("switch", "en", E("tesla"), "what is the best way to learn spanish", "none"),
  S("switch", "en", E("bread"), "how many calories are in an apple", "none"),
  S("switch", "en", E("dino"), "how do i change a flat tire", "none"),
  S("switch", "en", E("lincoln"), "who was the first president of the united states", "none", { share: true }),
  S("switch", "en", E("tesla"), "what does a volt measure", "none", { share: true }),
  S("switch", "en", E("mars"), "how far is the sun from the earth", "none", { share: true }),
  S("switch", "en", E("bread"), "why does bread go stale", "none", { share: true }),
  S("switch", "en", E("dino"), "what is the largest animal alive today", "none"),
  S("switch", "en", E("curie"), "what is the periodic table", "none"),
  S("switch", "en", E("eiffel"), "when is the next full moon", "none"),
  S("switch", "en", E("napoleon"), "why do we dream", "none"),
  S("switch", "en", E("lincoln"), "what is the population of canada", "none"),
  S("switch", "en", [E("tesla"), E("mars")], "what is a black hole", "none", { three: true }),
  S("switch", "en", [E("mars"), E("lincoln")], "why is the sea salty", "none", { three: true }),
  // SWITCH es (4) / fr (4)
  S("switch", "es", turn("es", "lincoln"), "¿por qué el mar es salado?", "none"),
  S("switch", "es", turn("es", "curie"), "¿cuántos habitantes tiene Canadá?", "none"),
  S("switch", "es", turn("es", "napoleon"), "¿cómo se hace una tortilla de patatas?", "none"),
  S("switch", "es", turn("es", "lincoln"), "¿quién fue el primer presidente de México?", "none", { share: true }),
  S("switch", "fr", turn("fr", "lincoln"), "pourquoi la mer est-elle salée ?", "none"),
  S("switch", "fr", turn("fr", "curie"), "combien d'habitants a le Canada ?", "none"),
  S("switch", "fr", turn("fr", "napoleon"), "comment faire une omelette ?", "none"),
  S("switch", "fr", turn("fr", "lincoln"), "qui fut le premier président de la France ?", "none", { share: true }),
  // HARD (pre-declared)
  S("hard", "en", E("tesla"), "is it hard to learn the piano", "none", { note: "expletive it" }),
  S("hard", "en", E("mars"), "does it snow in texas", "none", { note: "expletive it" }),
  S("hard", "en", E("lincoln"), "that was sad, tell me something happy about spring", "none", { note: "that reacts, ask has own subject" }),
  S("hard", "en", E("bread"), "what is a good one for beginners", "carry", { ref: "sourdough", note: "one, 7 words, no noun of its own" }),
  S("hard", "en", E("dino"), "what about birds", "carry", { ref: "Cretaceous", note: "what-about + a noun" }),
  S("hard", "en", E("mars"), "which one is bigger", "carry", { ref: "Mars", note: "which one + comparative" }),
  S("hard", "en", E("lincoln"), "one more thing, who is the current president", "none", { note: "a new question after 'one more thing'" }),
  S("hard", "en", E("tesla"), "why", "carry"),
  S("hard", "en", E("tesla"), "how come the sky is blue", "none", { note: "how come + own subject" }),
  S("hard", "en", E("dino"), "who", "carry"),
];
