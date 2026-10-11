import { recordOf, rowsOf } from "./build.mjs";
const rec = recordOf({ answer: "The Berlin Wall fell on 9 November 1989. It was not rebuilt.", material: [{ ref: "Wikipedia — Berlin Wall", source: "https://en.wikipedia.org/wiki/Berlin_Wall", text: "The Berlin Wall fell on 9 November 1989, after which East Germany opened its borders. The wall was not rebuilt after its fall, and demolition began in 1990." }] });
console.log(JSON.stringify(rowsOf(rec), null, 1).slice(0, 2500));
console.log(rec.unsupported, rec.facing.response.length);
