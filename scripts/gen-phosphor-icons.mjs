// gen-phosphor-icons.mjs — generate fold-chat-icons.js from the vendored
// Phosphor "regular" SVGs.
//
// The fold's chat icons are a CURATED subset of Phosphor (MIT), vendored under
// vendor/phosphor/regular so the surface stays local-first — no CDN at runtime.
// Run:  node scripts/gen-phosphor-icons.mjs
//
// The generated module is checked in; the surface never builds.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const srcDir = join(root, "vendor", "phosphor", "regular");
const outFile = join(root, "fold-chat-icons.js");

const ICONS = [
  // documents, records, law, reading
  "scales", "gavel", "book-open", "books", "newspaper", "file-text", "files",
  "folder", "receipt", "note-pencil", "article", "pen-nib", "pencil", "envelope",
  // money, data, charts
  "currency-dollar", "money", "credit-card", "chart-line", "chart-bar",
  "chart-pie", "database", "bank",
  // code, machines, AI
  "code", "terminal", "bug", "cpu", "robot", "brain", "gear", "wrench", "hammer",
  // health, science
  "heart", "first-aid", "pill", "stethoscope", "pulse", "flask", "atom", "dna",
  "microscope", "binoculars", "planet",
  // world, places, transport
  "globe", "map-pin", "buildings", "house", "car", "train", "airplane", "truck",
  "package", "factory", "storefront", "suitcase", "rocket",
  // environment
  "tree", "leaf", "drop", "fire", "lightning", "plug",
  // people, society, politics
  "users", "fingerprint", "handshake", "briefcase", "megaphone", "flag",
  "graduation-cap", "student",
  // security
  "shield-check", "lock",
  // media, arts, leisure, food
  "music-notes", "film-strip", "camera", "video-camera", "headphones",
  "microphone", "paint-brush", "palette", "game-controller", "soccer-ball",
  "fork-knife",
  // time, work, conversation, ideas
  "calendar", "clock", "chat-circle", "question", "lightbulb", "sparkle",
  "magnifying-glass", "detective",
];

const present = new Set(readdirSync(srcDir).map((f) => f.replace(/\.svg$/, "")));
const missing = ICONS.filter((n) => !present.has(n));
if (missing.length) {
  console.error("missing vendored icons:", missing.join(", "));
  process.exit(1);
}

const entries = ICONS.map((name) => {
  const raw = readFileSync(join(srcDir, name + ".svg"), "utf8");
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();
  return [name, inner];
});

const body = entries
  .map(([name, inner]) => `  ${JSON.stringify(name)}: ${JSON.stringify(inner)},`)
  .join("\n");

const out = `// fold-chat-icons.js — GENERATED, do not edit by hand.
//
// A curated subset of Phosphor Icons (regular weight), MIT licensed. The SVGs
// are vendored under vendor/phosphor/regular and compiled here by
// scripts/gen-phosphor-icons.mjs, so the surface ships its icons locally and
// never reaches a CDN at runtime.
//
// Phosphor Icons — Copyright (c) 2023 Phosphor Icons — MIT (see vendor/phosphor/LICENSE).

export const PHOSPHOR_VIEWBOX = "0 0 256 256";

export const PHOSPHOR = Object.freeze({
${body}
});

export const PHOSPHOR_NAMES = Object.freeze(Object.keys(PHOSPHOR));
`;

writeFileSync(outFile, out);
console.log(`wrote ${outFile} (${entries.length} icons)`);
