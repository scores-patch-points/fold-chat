function tokens(s) {
  return String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function searchItems(items, q) {
  const want = tokens(q);
  if (!want.length) return [];
  return items.filter((i) => {
    const have = tokens(i.name + " " + (i.tags || []).join(" "));
    return want.every((w) => have.some((h) => h.startsWith(w)));
  });
}
