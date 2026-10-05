let n = 0;

export function nextId(prefix = "id") {
  n += 1;
  return prefix + "_" + n;
}

export function resetIds() {
  n = 0;
}
