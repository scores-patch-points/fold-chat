"""Measure Presidio + spaCy on the informal, caseless cases (eval/deid/cases*.json).
A private name counts as caught when none of its distinctive words survives after every detected span is blanked.
Usage: scripts/pii/.venv/bin/python scripts/pii/measure.py [--model en_core_web_lg] [--threshold 0.35] [--lower]
  --lower   lowercase each ask first (the cases are already lowercase mostly; this makes it exact)
"""
import json, sys, argparse, pathlib

ap = argparse.ArgumentParser()
ap.add_argument("--model", default="en_core_web_lg")
ap.add_argument("--threshold", type=float, default=0.35)
ap.add_argument("--lower", action="store_true")
ap.add_argument("--show", action="store_true")
ap.add_argument("--extra", action="store_true", help="add the PROPN, handle and address recognizers")
a = ap.parse_args()

import sys; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import engine
eng = engine.build(a.model)
root = pathlib.Path(__file__).resolve().parents[2] / "eval" / "deid"

def blank(text, results):
    out = list(text)
    for r in results:
        for i in range(r.start, r.end):
            out[i] = "▮" if out[i] != " " else " "
    return "".join(out)

for fname in ["cases.json", "cases-heldout.json"]:
    cases = json.load(open(root / fname))["cases"]
    gold = caught = 0; over = 0; by = {}
    for c in cases:
        text = c["text"].lower() if a.lower else c["text"]
        res = [r for r in eng.analyze(text=text, language="en", score_threshold=a.threshold)]
        m = blank(text, res)
        for g in c["gold"]:
            gold += 1
            ok = g.lower().lstrip("@") not in m.lower()
            caught += ok
            b = by.setdefault(c["reg"], [0, 0]); b[1] += 1; b[0] += ok
        if not c["gold"]: over += len(res)
        if a.show: print(c["id"], [(text[r.start:r.end], r.entity_type, round(r.score, 2)) for r in res])
    print(f"{fname}: presidio+{a.model} recall {caught}/{gold} = {100*caught/gold:.0f}%   entities flagged in no-name asks: {over}")
    print("   " + " · ".join(f"{k} {v[0]}/{v[1]}" for k, v in by.items()))
