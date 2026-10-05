export function isEmail(s) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s));
}

export function createUser(name, email) {
  if (!isEmail(email)) throw new Error("bad email");
  return { name, email: String(email).toLowerCase() };
}

export function displayName(user) {
  return user.name || user.email.split("@")[0];
}
