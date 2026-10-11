// scripts/fold-narrate.mjs — run the mechanical BOOK FOLD through a model, CHUNKED per book and stitched.
//
// The fold (fold-chat-bookfold.js + fold-chat-bookscenes.js) is model-free: every line of its material is a
// sentence of the book, verbatim at its address. A small model cannot hold all 17 books' fold + scenes at once,
// so this legs the narration over books: ONE grounded prompt per book (material = the book's own fold line +
// its measured scene events), the outputs collected in story order and STITCHED into one summary. A final MERGE
// pass is the mouth joining the paragraphs into a flowing whole — it may reword and join, never add a fact
// (a claim not in the paragraphs is refused by the same rule the fold enforces on every turn).
//
//   node scripts/fold-narrate.mjs [pg2600.txt]            # stitched + merged, written under /3.0
//   ENDPOINT=http://127.0.0.1:11434/v1/chat/completions   MODEL=gemma2:2b
import fs from "node:fs";
import { parse } from "../fold-chat-book.js";
import { plotFold } from "../fold-chat-bookfold.js";
import { bookGrammar, bookScenesFor } from "../fold-chat-bookscenes.js";

const FILE = process.argv[2] || "/Users/mlacy/Documents/3.0/pg2600.txt";
const MODEL = process.env.MODEL || "gemma2:2b";
const ENDPOINT = process.env.ENDPOINT || "http://127.0.0.1:11434/v1/chat/completions";
const OUT = process.env.OUT || "/Users/mlacy/Documents/3.0";

const BOOK = { id: "war-and-peace", title: "War and Peace", author: "Leo Tolstoy", translator: "Louise and Aylmer Maude", home: "https://www.gutenberg.org/ebooks/2600", via: "test" };

const MOUTH = `You are the mouth of a reading machine. You may only phrase, order and join what the material states — you may not originate a fact, a person, a date, a place, a figure, or a claim. The material is a sentence or more of the book, verbatim at its byte address. Write tightly, in the person's language, ground every point in the material, keep the Book/Chapter references, and where the material does not cover something say so plainly instead of filling it in.`;

async function chat(msgs, { maxTokens = 420, temperature = 0.5 } = {}) {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: msgs, temperature, max_tokens: maxTokens, stream: false }),
  });
  if (!r.ok) throw new Error(`model answered ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return String(j.choices?.[0]?.message?.content ?? "");
}

const main = async () => {
  const raw = fs.readFileSync(FILE, "utf8");
  const parsed = parse(raw);
  const t0 = Date.now();
  console.error("folding the plot\u2026");
  const fold = plotFold(raw, parsed, BOOK, "summarize war and peace");
  console.error("reading the grammar of the whole book\u2026");
  const grammar = bookGrammar(raw, BOOK);
  console.error("cutting scenes\u2026");
  const scenes = bookScenesFor(raw, parsed, BOOK, { grammar, maxScenes: 3, maxEvents: 3, progress: (t) => console.error("  " + t) });
  console.error(`fold: ${fold.books.length} books · ${scenes.cut} scenes cut · ${scenes.per.reduce((a, p) => a + p.scenes.length, 0)} kept · ${(Date.now() - t0) / 1000 | 0}s`);

  // one chunk per book: the fold's own line + the book's measured scene events, all the book's words
  const chunks = scenes.per.map((p) => {
    const fb = fold.books.find((b) => b.label === p.book);
    return {
      label: p.book,
      line: fb?.fold ?? null,
      events: (p.scenes || []).flatMap((sc) => sc.events.map((e) => ({ ref: e.ref, text: e.text }))).slice(0, 6),
    };
  });

  const stitched = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const material = [
      `The fold read ${BOOK.title} and cut ${c.label} into scenes.`,
      c.line ? `The fold's event line for ${c.label}: \u201c${c.line}\u201d` : `(no event line held for ${c.label})`,
      c.events.length ? "The scenes' events (each \u201c\u201d is a sentence of the book, verbatim):" : "(no scene events were bound)",
      ...c.events.map((e) => `\u2022 [${e.ref}] \u201c${e.text}\u201d`),
    ].join("\n");
    const user = `Material:\n${material}\n\nNarrate ${c.label} in 3\u20135 sentences, grounded ONLY in the material, in story order, naming the Book and Chapter for each point. Invent nothing; say plainly what the material does not cover.`;
    const out = await chat([{ role: "system", content: MOUTH }, { role: "user", content: user }]);
    stitched.push(`## ${c.label.replace(/ \(.*\)/, "")}\n${out.trim()}`);
    process.stderr.write(`${i + 1}/${chunks.length} `);
  }
  const body = stitched.join("\n\n");
  fs.writeFileSync(`${OUT}/war-and-peace-narrated.md`, `# War and Peace \u2014 narrated from the fold (chunked, grounded per book; every quoted line is the book's own)\n\n${body}\n`);
  console.log(`\n\n=== STITCHED (${chunks.length} chunks) ===\n\n${body}`);

  // the merge: the mouth joins the paragraphs into one continuous account — reword and join ONLY
  console.error("\nmerging into one continuous narrative\u2026");
  const merged = await chat([
    { role: "system", content: `${MOUTH} You are now joining the paragraphs into one continuous summary: reword, join, shorten, order \u2014 never add a fact.` },
    { role: "user", content: `The paragraphs below narrate ${BOOK.title} book by book. Fuse them into ONE continuous narrative of 3\u20134 paragraphs that flows in story order. Keep the Book/Chapter references. Do not add any event, person, date, place or figure that is not already in them.\n\n${body}` },
  ], { maxTokens: 900 });
  fs.writeFileSync(`${OUT}/war-and-peace-narrated-merged.md`, `# War and Peace \u2014 the fold's summary, merged (the mouth joined the fold's grounded paragraphs; it may reword, never add)\n\n${merged.trim()}\n`);
  console.log(`\n\n=== MERGED ===\n\n${merged.trim()}`);
};

main().catch((e) => { console.error(e); process.exit(1); });