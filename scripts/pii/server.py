"""The page's local PII door: POST /redact {"texts": [...], "threshold": 0.35, "entities": [...]} -> {"spans": [[{start,end,type,score}], ...]}.
Loopback only, no logging of text, nothing leaves this machine. Offsets are UTF-16 code units, i.e. JavaScript string indices.
Run: scripts/pii/.venv/bin/python scripts/pii/server.py [--port 18795] [--model en_core_web_lg]"""
import argparse, json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
sys.path.insert(0, __import__("os").path.dirname(__file__))
import engine

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=18795)
ap.add_argument("--model", default="en_core_web_lg")
a = ap.parse_args()
ENG = engine.build(a.model)
MAX_CHARS = 200_000


def u16(text, i):
    """A Python string index -> the JavaScript (UTF-16) index of the same character."""
    return len(text[:i].encode("utf-16-le")) // 2


class H(BaseHTTPRequestHandler):
    def log_message(self, *args):   # never log: the request body is the thing being protected
        pass

    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-private-network", "true")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in (("access-control-allow-origin", "*"), ("access-control-allow-methods", "POST, GET, OPTIONS"), ("access-control-allow-headers", "content-type"), ("access-control-allow-private-network", "true")):
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/health"):
            return self._send(200, {"ok": True, "model": a.model, "recognizers": sorted({e for r in ENG.registry.recognizers for e in r.supported_entities})})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self.path.startswith("/redact"):
            return self._send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("content-length", "0"))
            req = json.loads(self.rfile.read(n) or b"{}")
            texts = req.get("texts")
            if not isinstance(texts, list) or sum(len(str(t)) for t in texts) > MAX_CHARS:
                return self._send(400, {"error": "texts must be a list, under %d characters in all" % MAX_CHARS})
            thr = float(req.get("threshold", 0.35))
            ents = req.get("entities") or None
            out = []
            for t in texts:
                t = str(t)
                res = ENG.analyze(text=t, language="en", score_threshold=thr, entities=ents) if t.strip() else []
                out.append([{"start": u16(t, r.start), "end": u16(t, r.end), "type": r.entity_type, "score": round(float(r.score), 3)} for r in res])
            self._send(200, {"spans": out})
        except Exception as e:   # the error text never carries the request
            self._send(500, {"error": type(e).__name__})


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), H)
    print(f"pii door on http://127.0.0.1:{a.port}  model={a.model}", flush=True)
    srv.serve_forever()
