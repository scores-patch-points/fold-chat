# scripts/pii — the Fold's local PII redactor

Python PII redaction for anything that is about to leave this machine. Presidio (pattern recognizers + spaCy NER) plus three
recognizers for informal typing (a proper-noun tag with no NER head, handles/nicks, street addresses). No word lists decide anything.
It listens on loopback only and never logs request bodies.

```bash
# one-time, into a throwaway venv (~560 MB, not committed)
uv venv --python 3.12 scripts/pii/.venv
uv pip install --python scripts/pii/.venv/bin/python presidio-analyzer presidio-anonymizer spacy
uv pip install --python scripts/pii/.venv/bin/python "https://github.com/explosion/spacy-models/releases/download/en_core_web_lg-3.8.0/en_core_web_lg-3.8.0-py3-none-any.whl"

# run the door (default http://127.0.0.1:18795; the page reads localStorage "fold-chat:piibase" to override)
scripts/pii/.venv/bin/python scripts/pii/server.py
```

- `POST /redact {"texts":[…], "threshold":0.35}` → `{"spans":[[{start,end,type,score}]]}` (offsets are JavaScript string indices)
- `GET /health`
- `engine.py` is the analyzer; `measure.py` scores it on `eval/deid/cases*.json`; `node eval/deid/run.mjs` scores the whole JS pipeline.

The JS side is `fold-chat-redact.js` (the client, and `deidentify()`, which asks the redactor again about the MASKED text) and
`fold-chat-deid.js` (replaces spans with per-turn ids, maps replies back, "default" / "open" modes). If the redactor is supplied and
cannot answer, nothing is sent.
