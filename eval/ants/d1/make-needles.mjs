// make-needles.mjs — the gold. For each topic: two needles, each a SENTENCE that occurs VERBATIM in the passages the app itself kept for that ask (corpus/passages-<lang>.json,
// written by needles-from-store.mjs from the recorded store). Chosen by hand by a start-phrase below; the script extracts the whole sentence and fails if it is not there.
import fs from "node:fs";
import { sentencesWithOffsets } from "../../../fold-chat-impression.js";
const SPEC = {
  en: {
    eiffel: ["The tower is 330 metres", "It is named after the engineer Gustave Eiffel"],
    greatwall: ["Successive dynasties expanded the wall system", "The first walls date to the 7th century BC"],
    everest: ["In 1856, Andrew Waugh announced Everest", "Tenzing Norgay and Edmund Hillary made the first documented ascent"],
    telephone: ["Alexander Graham Bell was the first to be awarded a patent", "The first telephone patent was granted to Alexander Graham Bell"],
    curie: ["Maria Salomea Skłodowska Curie", "She shared the 1903 Nobel Prize in Physics"],
    photo: ["Photosynthesis was discovered in 1779", "Plants usually convert light into chemical energy"],
    berlinwall: ["The Berlin Wall fell on 9 November 1989", "Construction of the Berlin Wall was commenced"],
    canberra: ["With an estimated population of 484,630", "The capital city was founded and formally named as Canberra in 1913"],
    panama: ["The Panama Canal (Spanish: Canal de Panamá) is an artificial", "Annual traffic has risen from about 1,000 ships in 1914"],
    suez: ["The 193.3-kilometre-long", "Construction took 11 years, and the canal opened on 17 November 1869"],
    titanic: ["RMS Titanic sank in the North Atlantic Ocean on 15 April 1912", "Of the 2,208 passengers and crew aboard"],
    pisa: ["The height of the tower is 55.86 metres", "Construction of the tower occurred in three stages"],
  },
  es: { colon: ["Cristóbal Colón (¿1451?", "="], garcia: ["Gabriel José García Márquez (Aracataca", "="], teide: ["En la década de 1970 se estimó que la altitud real del Teide", "="] },
  fr: { montblanc: ["Avec une altitude de 4 806 mètres", "="], pasteur: ["Louis Pasteur, né le 27 décembre 1822", "="], eiffelfr: ["La tour Eiffel [tuʁɛfɛl] est une tour autoportante", "="] },
};
const asks = JSON.parse(fs.readFileSync(new URL("./corpus/asks.json", import.meta.url), "utf8"));
const out = JSON.parse(fs.existsSync(new URL("./corpus/needles.json", import.meta.url)) ? fs.readFileSync(new URL("./corpus/needles.json", import.meta.url), "utf8") : "{}");
for (const [lang, topics] of Object.entries(SPEC)) {
  const P = JSON.parse(fs.readFileSync(new URL(`./corpus/passages-${lang}.json`, import.meta.url), "utf8"));
  out[lang] ||= {};
  for (const [id, specs] of Object.entries(topics)) {
    const found = specs.map((st, k) => {
      if (st.startsWith("@")) return null;
      if (st === "=") return "=";   // es/fr: no second needle (para/return probes are English only)
      const q = asks[lang][id].qa[k]; const ps = (P[q]?.passages || []);
      for (const p of ps) for (const s of sentencesWithOffsets(p.text)) if (s.text.startsWith(st)) return s.text;
      return "NOT-FOUND:" + st;
    });
    out[lang][id] = found.map((x) => (x === "=" ? found[0] : x));
  }
}
fs.writeFileSync(new URL("./corpus/needles.json", import.meta.url), JSON.stringify(out, null, 1));
for (const [l, t] of Object.entries(out)) for (const [id, n] of Object.entries(t)) console.log(l, id, n.map((x) => (x == null ? "(pending)" : x.startsWith("NOT-FOUND") ? x : "ok:" + x.slice(0, 60))).join(" | "));
