export function key(req) {
  return req.email + "|" + req.op + "|" + req.amount;
}
