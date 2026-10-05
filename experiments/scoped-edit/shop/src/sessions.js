export function startSession(user, now = Date.now(), ttlMs = 3600000) {
  return { user: user.email, startedAt: now, expiresAt: now + ttlMs };
}

export function isExpired(session, now = Date.now()) {
  return now >= session.expiresAt;
}
