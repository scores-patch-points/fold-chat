#!/usr/bin/env python3
"""Real Claude Code sessions in this repo → real-sessions.json: the per-turn context curve, what filled it, and
how much was re-reading. Nothing here is a model or a simulation: it is what the transcripts recorded."""
import json, glob, os, collections, statistics as st

def load(path):
    last, order = {}, []
    tool_name, comp, sizes = {}, collections.Counter(), collections.Counter()
    reads = collections.Counter(); rt = rd = rc = rdc = 0
    seen = set()
    for l in open(path):
        try: d = json.loads(l)
        except Exception: continue
        if d.get("isSidechain"): continue
        t = d.get("type"); m = d.get("message") or {}; c = m.get("content")
        if t == "assistant":
            mid = m.get("id"); u = m.get("usage")
            if u and mid:
                if mid not in last: order.append(mid)
                last[mid] = (u, m.get("model"))
            if mid and mid not in seen and isinstance(c, list):
                seen.add(mid)
                for b in c:
                    if b.get("type") == "text": comp["assistant text"] += len(b.get("text", ""))
                    elif b.get("type") == "thinking": comp["assistant thinking"] += len(b.get("thinking", ""))
                    elif b.get("type") == "tool_use":
                        comp["assistant tool calls"] += len(json.dumps(b.get("input", {})))
                        inp = b.get("input", {}); tool_name[b["id"]] = (b.get("name"), inp.get("file_path") or inp.get("path") or "")
        elif t == "user":
            if isinstance(c, str): comp["user text"] += len(c)
            elif isinstance(c, list):
                for b in c:
                    if b.get("type") == "text": comp["user text"] += len(b.get("text", ""))
                    elif b.get("type") == "tool_result":
                        cont = b.get("content")
                        s = sum(len(x.get("text", "")) for x in cont if isinstance(x, dict)) if isinstance(cont, list) else len(str(cont or ""))
                        name, key = tool_name.get(b.get("tool_use_id"), ("other", ""))
                        comp["tool results"] += s; sizes[name] += s
                        if name == "Read":
                            rt += 1; rc += s
                            if reads[key]: rd += 1; rdc += s
                            reads[key] += 1
    ctx, out_tokens, cr, cc, fresh = [], 0, 0, 0, 0
    model = None
    for i in order:
        u, mo = last[i]; model = model or mo
        x = (u.get("input_tokens") or 0) + (u.get("cache_read_input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0)
        if x > 0: ctx.append(x); out_tokens += u.get("output_tokens") or 0; cr += u.get("cache_read_input_tokens") or 0; cc += u.get("cache_creation_input_tokens") or 0; fresh += u.get("input_tokens") or 0
    return dict(model=model, ctx=ctx, out=out_tokens, cacheRead=cr, cacheWrite=cc, fresh=fresh, comp=dict(comp), toolSizes=dict(sizes), reads=rt, rereads=rd, readChars=rc, rereadChars=rdc)

files = sorted(glob.glob(os.path.expanduser("~/.claude/projects/*the-fold*/*.jsonl")), key=os.path.getsize, reverse=True)[:4]
sessions = []
for f in files:
    s = load(f)
    if len(s["ctx"]) < 100: continue
    ctx = s["ctx"]; n = len(ctx)
    step = max(1, n // 400)
    deltas = [b - a for a, b in zip(ctx, ctx[1:]) if b >= a]
    total_in = s["fresh"] + s["cacheRead"] + s["cacheWrite"]
    tot = sum(s["comp"].values()) or 1
    sessions.append(dict(
        id=os.path.basename(f)[:8], model=s["model"], turns=n, series=[ctx[i] for i in range(0, n, step)], seriesStep=step,
        first=ctx[0], max=max(ctx), median=int(st.median(ctx)), growthMedian=int(st.median(deltas)), growthMean=int(st.mean(deltas)),
        neverShrank=sum(1 for a, b in zip(ctx, ctx[1:]) if b >= a), compactions=sum(1 for a, b in zip(ctx, ctx[1:]) if b < a * 0.6),
        inputSideTokens=total_in, outputTokens=s["out"], cacheReadShare=s["cacheRead"] / max(1, total_in), ratioInOut=total_in / max(1, s["out"]),
        composition={k: v / tot for k, v in s["comp"].items()}, reads=s["reads"], rereads=s["rereads"], rereadShareOfReadChars=s["rereadChars"] / max(1, s["readChars"])))
json.dump(dict(built="real transcripts, ~/.claude/projects (this repo)", sessions=sessions), open("real-sessions.json", "w"))
for s in sessions: print(s["id"], s["model"], "turns", s["turns"], "median ctx", s["median"], "max", s["max"], "growth/turn", s["growthMedian"], "never shrank %d/%d" % (s["neverShrank"], s["turns"] - 1), "in:out %.0f:1" % s["ratioInOut"])
