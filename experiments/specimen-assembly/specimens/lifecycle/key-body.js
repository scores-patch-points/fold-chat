export function key(req) {
  return req.userId + "|" + req.op + "|" + req.amount;
}
