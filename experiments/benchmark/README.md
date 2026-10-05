# Search benchmark

Questions with known answers, used to test how searching behaves on a real browser — not to rank engines.

- `questions.json` — 54 development questions (35 easy, 15 hard, 4 no-answer controls). **Tuned on; do not use to adopt anything.**
- `holdout.json` — 33 questions written after the rule was frozen (24 English answerable, 3 non-English, 6 controls).
- `seed-en.json` — the English background (word → number of cards it stood in) derived from the development SERPs.
- `collect-in-page.js` — collects results from DuckDuckGo **inside a browser page**. Node's fetch is challenged/429'd by the
  engines on the same address where a browser gets 200 OK, so a Node run measures Node, not the product.
- `build-page-bundle.mjs` — turns the shipped `fold-chat-snippets.js` into a paste-able, comment-free bundle so the
  evaluated code *is* the shipped code.

Each question has `re`, a regex the answer must match; controls use `(?!)` (never matches) — for them the measure is
whether the rule fires at all. Search results change daily; the SERPs themselves are not committed. Outcomes and
verdicts are in `experiments/source-routing/RESULTS.md`.

Protocol: freeze rule + thresholds + criteria in RESULTS.md **first**; collect new questions; run once; report every
criterion, including failures; audit the passes by reading the evidence.
