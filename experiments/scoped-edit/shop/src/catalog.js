function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function createItem(name, priceCents, tags = []) {
  return { id: slug(name), name, priceCents, tags };
}

export function findItem(items, id) {
  return items.find((i) => i.id === id) || null;
}
