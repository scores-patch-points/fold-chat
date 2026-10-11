// sitestyle.mjs — WEAR THE SITE, safely.
//
// Turns a fetched page's OWN css (inline <style>, the first linked stylesheet's text if the relay fetched it, inline
// style/bgcolor attributes on <html>/<body>, <meta name="theme-color">, <meta name="color-scheme">) into a FIXED set of
// twelve design tokens. A layer that shows a source wears those tokens; it never receives the site's CSS.
//
//   extractSiteTokens({ html, css, domain, theme }, { typeOf })  ->  { tokens, meta }
//
// HARD RULES (each one is a test in sitestyle.test.mjs)
//   1. Output is ONLY the twelve tokens in TOKEN_KEYS, every value from a closed grammar (hex colour, a fixed font stack
//      assembled from OUR constants, an integer weight, one of three case words, integers for ch / px). Nothing the site
//      wrote is ever copied through as a string, so there is nothing to inject.
//   2. No url(), no @import, no @font-face, no external fonts or assets. Site fonts are classified to the nearest generic
//      family (serif / sans / mono / system); a name from LOCAL_FONTS (installed with the OS, so not an asset) may lead
//      the stack.
//   3. Ink, muted and link text on paper are forced to >= 4.5:1 (WCAG). The INK moves, the paper does not. (Paper is only
//      ever clamped for loudness: chroma and lightness bands, never for contrast.)
//   4. Nothing usable found -> the SITE_TYPE entry for the domain (passed in as `typeOf`), run through the same
//      sanitiser, or a neutral reading style.
//   5. The app theme decides: dark app -> the site's own dark layer if it has one (prefers-color-scheme, a .dark /
//      [data-theme=dark] root selector, light-dark()), else a dark paper DERIVED from the site's paper hue (meta.scheme
//      says so); light app -> likewise.
// Pure: no DOM, no network, no clock. Runs wherever the HTML already is (the relay), not in the page.

export const TOKEN_KEYS = ["paper", "ink", "muted", "link", "rule", "accent", "bodyFont", "titleFont", "titleWeight", "titleCase", "measure", "radius"];

// ------------------------------------------------------------------ fonts: only OUR strings leave this module
export const FONT_STACKS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};
// installed with the OS / browser, not downloaded: allowed to lead the stack (name is OUR constant, never site text)
const LOCAL_FONTS = {
  "georgia": ["Georgia", "serif"], "times new roman": ["Times New Roman", "serif"], "times": ["Times", "serif"], "palatino": ["Palatino", "serif"],
  "palatino linotype": ["Palatino Linotype", "serif"], "garamond": ["Garamond", "serif"], "baskerville": ["Baskerville", "serif"], "cambria": ["Cambria", "serif"],
  "charter": ["Charter", "serif"], "iowan old style": ["Iowan Old Style", "serif"], "book antiqua": ["Book Antiqua", "serif"],
  "helvetica neue": ["Helvetica Neue", "sans"], "helvetica": ["Helvetica", "sans"], "arial": ["Arial", "sans"], "verdana": ["Verdana", "sans"],
  "trebuchet ms": ["Trebuchet MS", "sans"], "tahoma": ["Tahoma", "sans"], "segoe ui": ["Segoe UI", "sans"], "optima": ["Optima", "sans"],
  "gill sans": ["Gill Sans", "sans"], "avenir": ["Avenir", "sans"], "courier new": ["Courier New", "mono"], "menlo": ["Menlo", "mono"],
  "consolas": ["Consolas", "mono"], "monaco": ["Monaco", "mono"],
};
const FAMILY_HINTS = {
  serif: /\b(serif(?!\s*sans)|libertine|merriweather|lora|playfair|crimson|spectral|cormorant|bitter|baskerville|garamond|didot|bodoni|caslon|georgia|times|palatino|cambria|charter|tiempos|publico|freight|miller|chronicle|sabon|minion|literata|newsreader|fraunces|noto serif|source serif|pt serif|ibm plex serif|roboto serif|gelasio)\b/,
  mono: /\b(mono|monospace|courier|consolas|menlo|monaco|inconsolata|fira code|jetbrains|source code|sf mono|cascadia)\b/,
  sans: /\b(sans|helvetica|arial|inter|roboto|open sans|lato|montserrat|poppins|nunito|work sans|fira|ibm plex|segoe|dm sans|manrope|barlow|rubik|karla|mulish|arimo|ubuntu|cabin|verdana|tahoma|trebuchet|calibri|gotham|proxima|avenir|futura|gill|univers|frutiger|akzidenz|neue|sf pro|san francisco|apple|blinkmacsystemfont|noto)\b/,
};
const GENERIC = { "serif": "serif", "ui-serif": "serif", "sans-serif": "sans", "ui-sans-serif": "sans", "monospace": "mono", "ui-monospace": "mono", "system-ui": "system", "-apple-system": "system", "blinkmacsystemfont": "system", "ui-rounded": "sans" };

/** A site's font-family value -> { stack, cls } from OUR table, or null when nothing in it can be classified. */
export function classifyFont(value) {
  if (typeof value !== "string" || !value) return null;
  const fams = value.split(",").map((f) => f.trim().replace(/^['"]|['"]$/g, "").toLowerCase()).filter(Boolean).slice(0, 12);
  let lead = null, cls = null, generic = null;
  for (const f of fams) {
    if (LOCAL_FONTS[f]) { lead = lead || LOCAL_FONTS[f][0]; cls = cls || LOCAL_FONTS[f][1]; continue; }
    if (GENERIC[f]) { generic = GENERIC[f]; continue; }                    // the LAST generic keyword is the stack's real fallback
    if (!cls) {
      for (const k of ["mono", "serif", "sans"]) if (FAMILY_HINTS[k].test(f)) { cls = k; break; }
    }
  }
  cls = cls || generic;
  if (!cls) return null;
  const base = FONT_STACKS[cls];
  return { cls, stack: lead && !base.includes(lead) ? `"${lead}", ${base}` : base };
}

// ------------------------------------------------------------------ colour: parse, OKLCH, contrast
const NAMED = {
  white: "#ffffff", black: "#000000", red: "#ff0000", blue: "#0000ff", green: "#008000", gray: "#808080", grey: "#808080", silver: "#c0c0c0", navy: "#000080",
  maroon: "#800000", purple: "#800080", teal: "#008080", olive: "#808000", orange: "#ffa500", yellow: "#ffff00", lime: "#00ff00", aqua: "#00ffff", fuchsia: "#ff00ff",
  ivory: "#fffff0", beige: "#f5f5dc", whitesmoke: "#f5f5f5", gainsboro: "#dcdcdc", lightgray: "#d3d3d3", lightgrey: "#d3d3d3", darkgray: "#a9a9a9", darkgrey: "#a9a9a9",
  dimgray: "#696969", dimgrey: "#696969", linen: "#faf0e6", snow: "#fffafa", seashell: "#fff5ee", antiquewhite: "#faebd7", cornsilk: "#fff8dc", lightyellow: "#ffffe0",
  aliceblue: "#f0f8ff", ghostwhite: "#f8f8ff", honeydew: "#f0fff0", mintcream: "#f5fffa", azure: "#f0ffff", lavender: "#e6e6fa", oldlace: "#fdf5e6", floralwhite: "#fffaf0",
  darkblue: "#00008b", royalblue: "#4169e1", steelblue: "#4682b4", crimson: "#dc143c", darkred: "#8b0000", firebrick: "#b22222", tomato: "#ff6347", goldenrod: "#daa520",
  darkgreen: "#006400", forestgreen: "#228b22", seagreen: "#2e8b57", slategray: "#708090", slategrey: "#708090", midnightblue: "#191970", indigo: "#4b0082", brown: "#a52a2a",
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
export const toHex = ({ r, g, b }) => "#" + hex2(r) + hex2(g) + hex2(b);

/** CSS colour text -> { r, g, b, a } (0-255, a 0-1) or null. Handles hex, rgb[a], hsl[a], a short named list. No var() here. */
export function parseColor(text) {
  if (typeof text !== "string") return null;
  const t = text.trim().toLowerCase().replace(/\s*!important$/, "");
  if (!t || t.length > 80) return null;
  if (t === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (NAMED[t]) return parseColor(NAMED[t]);
  let m = /^#([0-9a-f]{3,8})$/.exec(t);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*([^)]+)\)$/.exec(t);
  if (m) {
    const p = m[1].split(/[\s,\/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const ch = (s) => (s.endsWith("%") ? (parseFloat(s) / 100) * 255 : parseFloat(s));
    const [r, g, b] = [ch(p[0]), ch(p[1]), ch(p[2])];
    const a = p[3] == null ? 1 : p[3].endsWith("%") ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
    if ([r, g, b, a].some((x) => !Number.isFinite(x))) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) };
  }
  m = /^hsla?\(\s*([^)]+)\)$/.exec(t);
  if (m) {
    const p = m[1].split(/[\s,\/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const h = (((parseFloat(p[0]) % 360) + 360) % 360) / 360, s = clamp(parseFloat(p[1]) / 100, 0, 1), l = clamp(parseFloat(p[2]) / 100, 0, 1);
    const a = p[3] == null ? 1 : p[3].endsWith("%") ? parseFloat(p[3]) / 100 : parseFloat(p[3]);
    if ([h, s, l, a].some((x) => !Number.isFinite(x))) return null;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
    const f = (tt) => { tt = (tt + 1) % 1; return tt < 1 / 6 ? pp + (q - pp) * 6 * tt : tt < 0.5 ? q : tt < 2 / 3 ? pp + (q - pp) * (2 / 3 - tt) * 6 : pp; };
    return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255, a: clamp(a, 0, 1) };
  }
  return null;
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const delin = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export const luminance = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
export function toOklch({ r, g, b }) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, Bb), h: (Math.atan2(Bb, A) * 180) / Math.PI };
}
function fromOklchRaw({ L, C, h }) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
/** OKLCH -> in-gamut sRGB: chroma is reduced (never lightness) until the colour fits. */
export function fromOklch(o) {
  let { L, C, h } = o; L = clamp(L, 0, 1);
  const ok = (v) => v.every((x) => x >= -0.0005 && x <= 1.0005);
  let v = fromOklchRaw({ L, C, h });
  if (!ok(v)) { let lo = 0, hi = C; for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; ok(fromOklchRaw({ L, C: mid, h })) ? (lo = mid) : (hi = mid); } v = fromOklchRaw({ L, C: lo, h }); }
  return { r: delin(clamp(v[0], 0, 1)), g: delin(clamp(v[1], 0, 1)), b: delin(clamp(v[2], 0, 1)), a: 1 };
}
const flatten = (c, over) => (c.a >= 1 ? c : { r: c.r * c.a + over.r * (1 - c.a), g: c.g * c.a + over.g * (1 - c.a), b: c.b * c.a + over.b * (1 - c.a), a: 1 });
const mixOk = (a, b, t) => fromOklch({ L: toOklch(a).L * (1 - t) + toOklch(b).L * t, C: toOklch(a).C * (1 - t) + toOklch(b).C * t, h: toOklch(a).C >= toOklch(b).C ? toOklch(a).h : toOklch(b).h });

/** Move `fg` (lightness only, hue and chroma kept) away from `bg` until contrast >= min. Returns fg untouched if it already passes. */
export function fixContrast(fg, bg, min = 4.5) {
  if (contrast(fg, bg) >= min) return fg;
  const o = toOklch(fg), darker = luminance(bg) > 0.18;      // light paper -> darker ink; dark paper -> lighter ink
  let lo = darker ? 0 : o.L, hi = darker ? o.L : 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2, c = fromOklch({ ...o, L: mid });
    if (contrast(c, bg) >= min) darker ? (lo = mid) : (hi = mid); else darker ? (hi = mid) : (lo = mid);
  }
  let out = fromOklch({ ...o, L: darker ? lo : hi });
  if (contrast(out, bg) < min) out = darker ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  return out;
}
const schemeOf = (c) => (luminance(c) < 0.18 ? "dark" : "light");
/** Paper: clamp for LOUDNESS only (chroma band, lightness band per theme). Contrast is never the paper's job. */
function fitPaper(c, theme, hueFrom) {
  const o = toOklch(c);
  if (schemeOf(c) === theme) return fromOklch({ L: theme === "dark" ? clamp(o.L, 0.1, 0.3) : clamp(o.L, 0.86, 1), C: Math.min(o.C, 0.06), h: o.h });
  // derived: the site only made the other scheme. Keep ITS hue; when its paper is neutral (white), borrow the brand hue.
  const tinted = o.C >= 0.006, h = tinted || !hueFrom ? o.h : hueFrom.h;
  return fromOklch({ L: theme === "dark" ? 0.19 : 0.975, C: tinted ? clamp(o.C * 2, 0.012, 0.03) : hueFrom ? Math.min(hueFrom.C * 0.16, 0.022) : 0, h });
}

// ------------------------------------------------------------------ css reading: a small, tolerant parser
const CAPS = { css: 600_000, total: 700_000, html: 4_000_000, rules: 6000, vars: 800 };
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
function findClose(s, i) {           // s[i] === "{" ; returns index of matching "}" (strings and url() respected), or -1
  let d = 0, q = null;
  for (let k = i; k < s.length; k++) {
    const ch = s[k];
    if (q) { if (ch === "\\") k++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") q = ch; else if (ch === "{") d++; else if (ch === "}") { d--; if (d === 0) return k; }
  }
  return -1;
}
function splitTop(s, sep) {          // split on `sep` outside (), [], strings
  const out = []; let d = 0, q = null, cur = "";
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (q) { cur += ch; if (ch === "\\") cur += s[++k] ?? ""; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === "(" || ch === "[") d++; else if (ch === ")" || ch === "]") d--;
    if (ch === sep && d === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur); return out;
}
function parseDecls(body) {
  const d = [];
  let flat = "", depth = 0;           // drop nested { } (css nesting): we only read this rule's own declarations
  for (const ch of body) { if (ch === "{") depth++; else if (ch === "}") depth = Math.max(0, depth - 1); else if (depth === 0) flat += ch; }
  for (const part of splitTop(flat, ";")) {
    const i = part.indexOf(":"); if (i < 1) continue;
    const prop = part.slice(0, i).trim(); const v = part.slice(i + 1).replace(/\s*!important\s*$/i, "").trim();
    if (!v || v.length > 600) continue;
    d.push([prop.startsWith("--") ? prop : prop.toLowerCase(), v]);
  }
  return d;
}
/** -> { rules: [{ sel, decls, dark }], imports: n, fontFaces: n }  (@import / @font-face are COUNTED, never followed or read) */
export function parseCss(text, { dark = false } = {}) {
  const src = stripComments(String(text || "").slice(0, CAPS.css));
  const out = { rules: [], imports: 0, fontFaces: 0 };
  (function walk(s, isDark) {
    let i = 0;
    while (i < s.length && out.rules.length < CAPS.rules) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (i >= s.length) break;
      // prelude up to the first top-level "{" or ";"
      let j = i, q = null, par = 0;
      for (; j < s.length; j++) {
        const ch = s[j];
        if (q) { if (ch === "\\") j++; else if (ch === q) q = null; continue; }
        if (ch === '"' || ch === "'") q = ch; else if (ch === "(") par++; else if (ch === ")") par--; else if (par <= 0 && (ch === "{" || ch === ";" || ch === "}")) break;
      }
      const prelude = s.slice(i, j).trim();
      if (j >= s.length) break;
      if (s[j] === ";" || s[j] === "}") { if (/^@import\b/i.test(prelude)) out.imports++; i = j + 1; continue; }
      const end = findClose(s, j); if (end < 0) break;
      const body = s.slice(j + 1, end); i = end + 1;
      if (prelude.startsWith("@")) {
        const at = /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase();
        if (at === "media") {
          const dm = /prefers-color-scheme\s*:\s*dark/i.test(prelude), lm = /prefers-color-scheme\s*:\s*light/i.test(prelude);
          if (/\bprint\b/i.test(prelude) && !/\bscreen\b/i.test(prelude)) continue;
          if (dm) walk(body, true);                                   // dark layer
          else if (lm) walk(body, false);
          else if (!/(min|max)-(width|height|resolution|device)|orientation|hover|pointer|prefers-(reduced|contrast)|forced-colors/i.test(prelude)) walk(body, isDark);   // plain `screen` / `all`
          continue;                                                    // width-conditional blocks are layout, not identity
        }
        if (at === "layer" || at === "supports" || at === "container") { if (at !== "container") walk(body, isDark); continue; }
        if (at === "font-face") out.fontFaces++;
        continue;                                                      // @keyframes, @scope, @page, @font-face ...: not read
      }
      const decls = parseDecls(body);
      if (!decls.length) continue;
      for (const sel of splitTop(prelude, ",")) { const t = sel.trim(); if (t && t.length < 300) out.rules.push({ sel: t, decls, dark: isDark }); }
    }
  })(src, dark);
  return out;
}

// selector classification (deliberately coarse; this is a sketch of identity, not a cascade engine)
const compounds = (sel) => sel.replace(/\s*([>+~])\s*/g, " $1 ").split(/\s+/).filter((c) => c && !/^[>+~]$/.test(c));
const subjectOf = (sel) => { const c = compounds(sel); return c[c.length - 1] || ""; };
const tagOf = (compound) => (/^([a-z][a-z0-9-]*)/i.exec(compound)?.[1] || "").toLowerCase();
const ROOT_SUBJ = /^(?::root|html|body)(?:[.#\[:][^\s]*)?$|^\[data-[\w-]+[^\]]*\]$|^\.(?:dark|light|night|dark-mode|light-mode|theme-dark|theme-light)$/i;
const NOT_ROOT_DESC = /\s/;
export function rootRank(sel) {            // 3 body, 2 html, 1 :root, 0 not a root selector
  const t = sel.trim(), c = compounds(t);
  if (!c.length) return 0;
  if (c.length > 2 || (c.length === 2 && !(tagOf(c[0]) === "html" && tagOf(c[1]) === "body"))) return 0;
  const sub = c[c.length - 1];
  if (!ROOT_SUBJ.test(sub) && !(c.length === 1 && /^html[.#\[]/i.test(sub))) return 0;
  if (/:(hover|focus|active|visited|before|after|not\()/i.test(sub) && !/:not\(\s*\[data-theme/i.test(sub)) return 0;
  const tg = tagOf(sub);
  return tg === "body" ? 3 : tg === "html" ? 2 : 1;
}
const rootIsDark = (sel) => /dark|night|dusk|data-is-dark-ui=["']?true/i.test(sel) && !/:not\([^)]*(dark|night)/i.test(sel);
const rootIsLightOnly = (sel) => /\[data-theme=["']?light|\.light\b|clientpref-day/i.test(sel);
const isHeading = (sel) => /^h[12]$/.test(tagOf(subjectOf(sel))) && !/:(hover|focus|before|after)/i.test(subjectOf(sel));
const NAV_WORDS = /\b(nav|header|footer|menu|button|btn|toolbar|tab|breadcrumb|sidebar|topbar|skip|logo|cta|badge|pagination|card)\b|^\.?(nav|btn)/i;
const isBodyLink = (sel) => {
  const c = compounds(sel), sub = c[c.length - 1] || "";
  if (tagOf(sub) !== "a" || /:(hover|focus|active|visited|before|after|not)/i.test(sub.replace(/:link/gi, ""))) return false;
  if (/\[|\.|#/.test(sub.slice(1))) return false;
  return !c.slice(0, -1).some((x) => NAV_WORDS.test(x));
};

// ------------------------------------------------------------------ value readers
function resolveVars(v, vars, depth = 0) {
  if (typeof v !== "string") return null;
  if (depth > 6) return null;
  let bad = false;
  const out = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name, fb) => {
    const x = vars.get(name);
    if (x != null) { const r = resolveVars(x, vars, depth + 1); if (r != null) return r; }
    if (fb != null) { const r = resolveVars(fb.trim(), vars, depth + 1); if (r != null) return r; }
    bad = true; return "";
  });
  return bad ? null : out;
}
function lightDark(v, theme) {
  const m = /^light-dark\(\s*([^,]+(?:\([^)]*\))?[^,]*)\s*,\s*(.+)\)$/.exec(v.trim());
  return m ? (theme === "dark" ? m[2] : m[1]).trim() : v;
}
/** First usable colour in a declaration value, ignoring url(), gradients, images. Composite (alpha) colours are flattened on `over`. */
function colorIn(value, vars, theme, over = { r: 255, g: 255, b: 255 }) {
  let v = resolveVars(value, vars); if (v == null) return null;
  v = lightDark(v, theme).replace(/url\([^)]*\)/gi, " ").replace(/(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)/gi, " ");
  const tok = v.match(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|\b[a-z]+\b/gi) || [];
  for (const t of tok) {
    if (/^(inherit|initial|unset|revert|currentcolor|none|transparent)$/i.test(t)) continue;
    const c = parseColor(t); if (c && c.a > 0.5) return flatten(c, over);
  }
  return null;
}
const pxOf = (v, vars) => {
  const r = resolveVars(v, vars); if (r == null) return null;
  const m = /^(-?\d*\.?\d+)\s*(px|rem|em|ch)?$/.exec(r.trim().split(/\s+/)[0]); if (!m) return null;
  const n = parseFloat(m[1]); return m[2] === "ch" ? { ch: n } : { px: m[2] === "rem" || m[2] === "em" ? n * 16 : n };
};

const MEASURE_SELECTOR = /^(main|article|body|\.(?:content|article|post|entry|prose|text|story|main|page|container|wrap|wrapper|layout)[\w-]*|#(?:content|main|article|page|container|wrap)[\w-]*)$/i;

// ------------------------------------------------------------------ the extractor
const attrsOf = (tag) => { const o = {}; for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ""; return o; };
/** What the page itself offers, before any decision: style blocks, root attributes, metas. */
export function readHtml(html, theme = "light") {
  const h = String(html || "").slice(0, CAPS.html);
  const styles = [];
  for (const m of h.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)) {
    const a = attrsOf(m[1]); if (/print/i.test(a.media || "") && !/screen/i.test(a.media || "")) continue;
    styles.push({ text: m[2], dark: /prefers-color-scheme\s*:\s*dark/i.test(a.media || "") });
    if (styles.length >= 64) break;
  }
  const open = (name) => { const m = new RegExp(`<${name}\\b([^>]*)>`, "i").exec(h); return m ? attrsOf(m[1]) : {}; };
  const html_ = open("html"), body_ = open("body");
  let colorScheme = null; const themeColors = { any: null, light: null, dark: null };
  for (const m of h.matchAll(/<meta\b([^>]*)>/gi)) {
    const a = attrsOf(m[1]); const n = (a.name || "").toLowerCase();
    if (n === "theme-color") {
      const dark = /prefers-color-scheme\s*:\s*dark/i.test(a.media || ""), light = /prefers-color-scheme\s*:\s*light/i.test(a.media || "");
      const c = parseColor(a.content || "");
      if (c) { const k = dark ? "dark" : light ? "light" : "any"; if (!themeColors[k]) themeColors[k] = c; }
    } else if (n === "color-scheme") colorScheme = (a.content || "").toLowerCase();
  }
  const themeColor = theme === "dark" ? themeColors.dark || themeColors.any : themeColors.light || themeColors.any;
  return { styles, htmlStyle: html_.style || "", bodyStyle: body_.style || "", bodyAttrs: body_, htmlAttrs: html_, themeColor, themeColors, colorScheme };
}
/** The href the relay should fetch for "the first stylesheet": first <link rel=stylesheet>, not print, https. */
export function firstStylesheetHref(html, baseUrl) {
  for (const m of String(html || "").slice(0, CAPS.html).matchAll(/<link\b([^>]*)>/gi)) {
    const a = attrsOf(m[1]);
    if (!/\bstylesheet\b/i.test(a.rel || "") || !a.href || /print/i.test(a.media || "") || /\bpreload|alternate\b/i.test(a.rel || "")) continue;
    try { const u = new URL(a.href, baseUrl); if (u.protocol === "https:") return u.href; } catch {}
  }
  return null;
}

const NEUTRAL = {
  light: { paper: "#ffffff", ink: "#202122", link: "#1d4ed8", rule: "#e4e4e9", bodyFont: "serif", titleFont: "serif", titleWeight: 400, titleCase: "none" },
  dark: { paper: "#17171a", ink: "#ececf0", link: "#8ab4ff", rule: "#2e2e33", bodyFont: "serif", titleFont: "serif", titleWeight: 400, titleCase: "none" },
};
const WEIGHT_WORDS = { normal: 400, bold: 700, bolder: 800, lighter: 300 };
const normWeight = (v) => { const n = WEIGHT_WORDS[String(v).trim().toLowerCase()] ?? parseInt(v, 10); return Number.isFinite(n) ? clamp(Math.round(n / 100) * 100, 300, 800) : null; };

/**
 * @param {{ html?: string, css?: string|string[], domain?: string, theme?: "light"|"dark" }} input   css = text of the first fetched stylesheet(s), if any
 * @param {{ typeOf?: (domain: string) => object }} deps   typeOf = SITE_TYPE lookup from fold-chat-present.js
 * @returns {{ tokens: object, meta: object }}  tokens has exactly TOKEN_KEYS; meta says where each came from and what was adjusted
 */
/** Parse once, decide per theme: the part of extractSiteTokens that does not depend on the app theme. */
export function prepare({ html = "", css = [] } = {}) {
  const page = readHtml(html, "light");
  const sheets = [].concat(css || []).filter((x) => typeof x === "string").map((text) => ({ text, dark: false }));
  const parsed = [];
  let imports = 0, fontFaces = 0, budget = CAPS.total;
  for (const s of [...sheets, ...page.styles]) {          // the fetched sheet first, then inline blocks, until the budget is spent
    if (budget <= 0) break;
    const text = s.text.length > budget ? s.text.slice(0, budget) : s.text; budget -= text.length;
    const p = parseCss(text, { dark: s.dark }); parsed.push(...p.rules); imports += p.imports; fontFaces += p.fontFaces;
  }
  // inline style attributes on the root elements are rules too (highest rank)
  const inlineRule = (sel, style) => { const decls = parseDecls(style || ""); if (decls.length) parsed.push({ sel, decls, dark: false }); };
  inlineRule("html", page.htmlStyle); inlineRule("body", page.bodyStyle);
  const A = page.bodyAttrs;      // presentational attributes of old sites: <body bgcolor text link>
  if (A.bgcolor) parsed.push({ sel: "body", decls: [["background-color", A.bgcolor]], dark: false });
  if (A.text) parsed.push({ sel: "body", decls: [["color", A.text]], dark: false });
  if (A.link) parsed.push({ sel: "a", decls: [["color", A.link]], dark: false });
  return { page, parsed, imports, fontFaces };
}

export function extractSiteTokens({ html = "", css = [], domain = "", theme = "light", prepared = null } = {}, { typeOf } = {}) {
  theme = theme === "dark" ? "dark" : "light";
  const prep = prepared || prepare({ html, css });
  const { parsed, imports, fontFaces } = prep;
  const page = { ...prep.page, themeColor: theme === "dark" ? prep.page.themeColors.dark || prep.page.themeColors.any : prep.page.themeColors.light || prep.page.themeColors.any };

  // custom properties declared on root selectors, light layer then dark layer
  const varsBase = new Map(), varsDark = new Map(); let nVars = 0;
  for (const r of parsed) {
    const rk = rootRank(r.sel); if (!rk) continue;
    const toDark = r.dark || rootIsDark(r.sel);
    if (rootIsLightOnly(r.sel) && toDark) continue;
    for (const [p, v] of r.decls) if (p.startsWith("--") && nVars++ < CAPS.vars) (toDark ? varsDark : varsBase).set(p, v);
  }
  const hasDark = varsDark.size > 0 || parsed.some((r) => rootRank(r.sel) && (r.dark || rootIsDark(r.sel)) && r.decls.some(([p]) => /^(background|color)/.test(p)));
  const vars = theme === "dark" && hasDark ? new Map([...varsBase, ...varsDark]) : varsBase;

  // gather candidates per role, by priority (body > html > :root) then source order
  const best = { radii: [], rules: [] };
  const consider = (slot, rank, val) => { if (val != null && (!slot.v || rank >= slot.rank)) { slot.v = val; slot.rank = rank; } return slot; };
  const slots = { paper: {}, ink: {}, link: {}, bodyFont: {}, hFont: {}, hWeight: {}, hCase: {}, measureTag: {}, measureCls: {} };
  const wantDark = theme === "dark";
  let paperFoundIn = null, inkFoundIn = null;
  for (const r of parsed) {
    const rk = rootRank(r.sel), hd = isHeading(r.sel);
    const layerOK = r.dark || (rk && rootIsDark(r.sel)) ? wantDark && hasDark : true;       // a dark layer applies only to a dark app; light rules still apply underneath
    if (!layerOK) continue;
    const priority = (r.dark || (rk && rootIsDark(r.sel)) ? 10 : 0) + rk;
    for (const [p, v] of r.decls) {
      if (rk) {
        if (p === "background-color" || p === "background") { const c = colorIn(v, vars, theme); if (c) { consider(slots.paper, priority, c); paperFoundIn = "site-css"; } }
        else if (p === "color") { const c = colorIn(v, vars, theme); if (c) { consider(slots.ink, priority, c); inkFoundIn = "site-css"; } }
        else if (p === "font-family") { const f = classifyFont(resolveVars(v, vars) || ""); if (f) consider(slots.bodyFont, priority, f); }
        else if (p === "max-width" && rk === 3) { const m = pxOf(v, vars); if (m) consider(slots.measureTag, 3, m); }
      }
      if (hd) {
        if (p === "font-family") { const f = classifyFont(resolveVars(v, vars) || ""); if (f) consider(slots.hFont, 1, f); }
        else if (p === "font-weight") { const w = normWeight(resolveVars(v, vars) || v); if (w) consider(slots.hWeight, 1, w); }
        else if (p === "text-transform") { const t = v.trim().toLowerCase(); if (/^(uppercase|capitalize|none|lowercase)$/.test(t)) consider(slots.hCase, 1, t === "lowercase" ? "none" : t); }
      }
      if (isBodyLink(r.sel) && p === "color") { const c = colorIn(v, vars, theme); if (c) consider(slots.link, 1, c); }
      if (p === "max-width" && !rk) { const sub = subjectOf(r.sel); if (MEASURE_SELECTOR.test(sub)) { const m = pxOf(v, vars); if (m) consider(/^(main|article)$/i.test(sub) ? slots.measureTag : slots.measureCls, 1, m); } }
      if (p === "border-radius" && /button|btn|card|input|box|panel|tile|img|figure|alert|callout|\.[\w-]*(?:rounded)/i.test(r.sel)) { const m = pxOf(v, vars); if (m?.px != null && m.px > 0 && m.px <= 24) best.radii.push(m.px); }
    }
    if (/^(hr|blockquote|table|th|td|\.?[\w-]*(?:divider|rule|border))$/i.test(subjectOf(r.sel))) {
      for (const [p, v] of r.decls) if (/^border(-top|-bottom|-left|-color)?$/.test(p)) { const c = colorIn(v, vars, theme); if (c) best.rules.push(c); }
    }
  }
  // named custom properties (the design-system way): they speak louder than guesses, quieter than the body rule itself
  const byName = (re) => { for (const [k, v] of vars) if (re.test(k)) { const c = colorIn(v, vars, theme); if (c) return c; } return null; };
  const varPaper = byName(/^--(?:color-)?(?:bg|background|bg-page|background-page|page|paper|surface|canvas|body-bg)(?:-(?:page|primary|color|base|body))?$/i) || byName(/^--[\w-]*(?:background-page|bg-page|page-bg)$/i);
  const varInk = byName(/^--(?:color-)?(?:text|fg|foreground|ink|body-color|text-primary|text-color|font-color)(?:-(?:primary|color|body|base))?$/i);
  const varLink = byName(/^--(?:color-)?(?:link|a|anchor|link-color|text-link)(?:-(?:primary|color|default))?$/i);
  const varMuted = byName(/^--(?:color-)?(?:muted|text-secondary|text-muted|subtle|dim|caption|gray-text|text-light|secondary-text)(?:-(?:color|text))?$/i);
  const varRule = byName(/^--(?:color-)?(?:border|rule|divider|hairline|separator|line)(?:-(?:primary|color|default|subtle))?$/i);
  const varAccent = byName(/^--(?:color-)?(?:accent|brand|primary|highlight|theme|key)(?:-(?:color|primary|500|600|default))?$/i);

  // ---- decide, token by token; remember where each came from
  const from = {}, notes = [];
  const fb = (() => {
    let ty = null; try { ty = typeOf ? typeOf(domain) : null; } catch {}
    const n = NEUTRAL[theme];
    const usable = ty && (ty.bg || ty.ink);
    return { ty: usable ? ty : null, n };
  })();
  const fbColor = (hex) => parseColor(hex);
  let paperRaw = slots.paper.v || varPaper || null, paperFrom = slots.paper.v ? "site-css" : varPaper ? "site-var" : null;
  if (!paperRaw && page.themeColor && page.themeColor.a > 0.5 && schemeOf(page.themeColor) === theme && toOklch(page.themeColor).C < 0.05) { paperRaw = page.themeColor; paperFrom = "meta-theme-color"; }
  if (!paperRaw && fb.ty?.bg) { paperRaw = fbColor(fb.ty.bg); paperFrom = "site-type"; }
  if (!paperRaw) { paperRaw = fbColor(NEUTRAL.light.paper); paperFrom = "neutral"; }
  const paperSchemeBefore = schemeOf(paperRaw);
  const tcPre = page.themeColor && page.themeColor.a > 0.5 && toOklch(page.themeColor).C >= 0.05 ? toOklch(page.themeColor) : null;
  const brandHue = (varAccent && toOklch(varAccent).C >= 0.04 ? toOklch(varAccent) : null) || tcPre || (fb.ty?.favBg && toOklch(fbColor(fb.ty.favBg)).C >= 0.05 ? toOklch(fbColor(fb.ty.favBg)) : null) || (slots.link.v && toOklch(slots.link.v).C >= 0.05 ? toOklch(slots.link.v) : null);
  const paper = fitPaper(paperRaw, theme, brandHue);
  const derived = paperSchemeBefore !== theme;
  from.paper = derived ? paperFrom + "+derived-" + theme : paperFrom;

  // ink
  let inkRaw = slots.ink.v || varInk || null, inkFrom = slots.ink.v ? "site-css" : varInk ? "site-var" : null;
  if (!inkRaw && fb.ty?.ink) { inkRaw = fbColor(fb.ty.ink); inkFrom = "site-type"; }
  if (!inkRaw) { inkRaw = fbColor(NEUTRAL.light.ink); inkFrom = "neutral"; }
  let ink;
  if (derived) {   // the paper was derived for the other scheme, so the site's ink was made for the wrong paper: keep its hue, flip its role
    const o = toOklch(inkRaw); ink = fromOklch({ L: theme === "dark" ? 0.93 : 0.2, C: Math.min(o.C, 0.03), h: o.h }); inkFrom += "+flipped";
  } else ink = fromOklch({ ...toOklch(inkRaw), C: Math.min(toOklch(inkRaw).C, 0.08) });
  const inkAdj = fixContrast(ink, paper, 7);                // comfortable, not borderline; 4.5 is the floor asserted below
  if (inkAdj !== ink) { inkFrom += "+contrast"; ink = inkAdj; }
  from.ink = inkFrom;

  // muted
  let mutedRaw = varMuted, mutedFrom = varMuted ? "site-var" : null;
  if (!mutedRaw) { mutedRaw = mixOk(ink, paper, 0.42); mutedFrom = "derived"; }
  let muted = fixContrast(schemeOf(mutedRaw) === theme || derived ? mutedRaw : mixOk(ink, paper, 0.42), paper, 4.6);
  if (muted !== mutedRaw) mutedFrom += "+contrast";
  from.muted = mutedFrom;

  // link
  let linkRaw = slots.link.v || varLink || null, linkFrom = slots.link.v ? "site-css" : varLink ? "site-var" : null;
  if (!linkRaw && fb.ty?.favBg && toOklch(fbColor(fb.ty.favBg)).C > 0.07) { linkRaw = fbColor(fb.ty.favBg); linkFrom = "site-type"; }
  if (!linkRaw) { linkRaw = fbColor(NEUTRAL[theme].link); linkFrom = "neutral"; }
  let link = fixContrast(fromOklch({ ...toOklch(linkRaw), C: Math.min(toOklch(linkRaw).C, 0.2) }), paper, 4.6);
  if (contrast(link, paper) >= 4.5 && toOklch(link).C < 0.03) { link = fixContrast(fromOklch({ L: toOklch(link).L, C: 0.12, h: brandHue ? brandHue.h : 255 }), paper, 4.6); linkFrom += "+tinted"; }   // a link must look like a link
  from.link = linkFrom;

  // rule
  let ruleRaw = varRule || best.rules[best.rules.length - 1] || (fb.ty?.rule ? fbColor(fb.ty.rule) : null), ruleFrom = varRule ? "site-var" : best.rules.length ? "site-css" : fb.ty?.rule ? "site-type" : null;
  if (!ruleRaw) { ruleRaw = mixOk(paper, ink, 0.16); ruleFrom = "derived"; }
  let rule = ruleRaw;
  if (derived || contrast(rule, paper) < 1.15 || contrast(rule, paper) > 4) { rule = mixOk(paper, ink, 0.16); ruleFrom += "+derived"; }
  from.rule = ruleFrom;

  // accent: a chromatic brand colour with >= 3:1 on paper (UI, not text)
  const tcOk = page.themeColor && page.themeColor.a > 0.5 && toOklch(page.themeColor).C >= 0.05;
  let accRaw = varAccent && toOklch(varAccent).C >= 0.04 ? varAccent : tcOk ? page.themeColor : null, accFrom = accRaw ? (accRaw === varAccent ? "site-var" : "meta-theme-color") : null;
  if (!accRaw && fb.ty?.favBg && toOklch(fbColor(fb.ty.favBg)).C >= 0.05) { accRaw = fbColor(fb.ty.favBg); accFrom = "site-type"; }
  if (!accRaw) { accRaw = link; accFrom = "link"; }
  const accent = fixContrast(fromOklch({ ...toOklch(accRaw), C: Math.min(toOklch(accRaw).C, 0.2) }), paper, 3);
  if (accent !== accRaw && accFrom !== "link") accFrom += "+contrast";
  from.accent = accFrom;

  // fonts
  const sFont = slots.bodyFont.v || (fb.ty?.body ? classifyFont(fb.ty.body) : null);
  const bodyF = sFont || { cls: "serif", stack: FONT_STACKS.serif };
  from.bodyFont = slots.bodyFont.v ? "site-css" : fb.ty?.body ? "site-type" : "neutral";
  const tF = slots.hFont.v || (!slots.hFont.v && fb.ty?.title && !slots.bodyFont.v ? classifyFont(fb.ty.title) : null) || bodyF;
  from.titleFont = slots.hFont.v ? "site-css" : tF === bodyF ? (slots.bodyFont.v ? "body" : "site-type/neutral") : "site-type";
  const titleWeight = slots.hWeight.v || normWeight(fb.ty?.titleWeight) || 400;
  from.titleWeight = slots.hWeight.v ? "site-css" : fb.ty?.titleWeight ? "site-type" : "neutral";
  const titleCase = slots.hCase.v || (fb.ty?.titleCase && /^(uppercase|capitalize)$/.test(fb.ty.titleCase) ? fb.ty.titleCase : "none");
  from.titleCase = slots.hCase.v ? "site-css" : fb.ty?.titleCase ? "site-type" : "neutral";

  // measure (ch): the page's own text column, clamped to a reading range; radius from its buttons/cards
  const mv = slots.measureTag.v || slots.measureCls.v;
  const measure = mv ? clamp(Math.round(mv.ch ?? mv.px / 8), 40, 80) : 66;
  from.measure = mv ? "site-css" : "neutral";
  const radius = best.radii.length ? clamp(Math.round([...best.radii].sort((a, b) => a - b)[best.radii.length >> 1]), 0, 14) : 2;
  from.radius = best.radii.length ? "site-css" : "neutral";

  const tokens = {
    paper: toHex(paper), ink: toHex(ink), muted: toHex(muted), link: toHex(link), rule: toHex(rule), accent: toHex(accent),
    bodyFont: bodyF.stack, titleFont: tF.stack, titleWeight, titleCase, measure, radius,
  };
  const found = Object.values(from).filter((x) => /^site-(css|var)|^meta-/.test(x)).length;
  return {
    tokens,
    meta: {
      theme, scheme: derived ? "derived-" + theme : hasDark && theme === "dark" ? "site-dark" : "site-" + theme,
      siteHasDark: hasDark, from, found, of: TOKEN_KEYS.length,
      contrast: { ink: +contrast(ink, paper).toFixed(2), muted: +contrast(muted, paper).toFixed(2), link: +contrast(link, paper).toFixed(2), accent: +contrast(accent, paper).toFixed(2) },
      ignored: { imports, fontFaces },       // seen, counted, never followed
      themeColor: page.themeColor ? toHex(page.themeColor) : null, colorScheme: page.colorScheme,
      usedFallback: found === 0, notes,
    },
  };
}

// ------------------------------------------------------------------ the gate the UI calls before it paints
const RX = { color: /^#[0-9a-f]{6}$/, font: /^(?:"[A-Za-z ]{3,24}", )?[A-Za-z0-9 ",\-]{10,170}$/, weight: /^(300|400|500|600|700|800)$/, tcase: /^(none|uppercase|capitalize)$/ };
export function validateTokens(t) {
  const errs = [];
  if (!t || typeof t !== "object") return ["not an object"];
  const keys = Object.keys(t);
  if (keys.length !== TOKEN_KEYS.length || !TOKEN_KEYS.every((k) => k in t)) errs.push("keys differ from TOKEN_KEYS: " + keys.join(","));
  for (const k of ["paper", "ink", "muted", "link", "rule", "accent"]) if (!RX.color.test(String(t[k]))) errs.push(k + " is not #rrggbb");
  for (const k of ["bodyFont", "titleFont"]) { if (!RX.font.test(String(t[k])) || !Object.values(FONT_STACKS).some((s) => String(t[k]).endsWith(s))) errs.push(k + " is not one of our stacks"); if (/url\(|@import|[{};<>]/i.test(String(t[k]))) errs.push(k + " has a forbidden token"); }
  if (!RX.weight.test(String(t.titleWeight))) errs.push("titleWeight");
  if (!RX.tcase.test(String(t.titleCase))) errs.push("titleCase");
  if (!Number.isInteger(t.measure) || t.measure < 40 || t.measure > 80) errs.push("measure");
  if (!Number.isInteger(t.radius) || t.radius < 0 || t.radius > 14) errs.push("radius");
  const p = parseColor(t.paper);
  if (p) for (const [k, min] of [["ink", 4.5], ["muted", 4.5], ["link", 4.5]]) { const c = parseColor(t[k]); if (c && contrast(c, p) < min - 0.001) errs.push(`${k} contrast ${contrast(c, p).toFixed(2)} < ${min}`); }
  return errs;
}
/** Tokens -> a custom-property declaration list for ONE layer's root element (every value already validated). Throws on a bad token. */
export function tokensToVars(t, prefix = "--s-") {
  const e = validateTokens(t); if (e.length) throw new Error("unsafe tokens: " + e.join("; "));
  return `${prefix}paper:${t.paper};${prefix}ink:${t.ink};${prefix}muted:${t.muted};${prefix}link:${t.link};${prefix}rule:${t.rule};${prefix}accent:${t.accent};` +
    `${prefix}body:${t.bodyFont};${prefix}title:${t.titleFont};${prefix}tw:${t.titleWeight};${prefix}tcase:${t.titleCase};${prefix}measure:${t.measure}ch;${prefix}radius:${t.radius}px`;
}
