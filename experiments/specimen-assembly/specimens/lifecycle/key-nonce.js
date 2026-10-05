export function key(req) {
  return req.userId + "|" + Math.random();
}
