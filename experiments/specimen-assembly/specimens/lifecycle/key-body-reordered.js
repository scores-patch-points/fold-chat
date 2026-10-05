export function key(req) {
  return req.op + "|" + req.userId + "|" + req.amount;
}
