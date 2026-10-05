// Preload (node --import) that makes `typeof process === "undefined"`, so the khora organs take their
// BROWSER branch (they skip the node-only canon reader). Use only in child processes that import the
// vendored organs; the node:test runner itself needs `process`.
const real = globalThis.process;
globalThis.__realProcess = real;
delete globalThis.process;
