// The Fold viewer's styles, injected once as <style id="fold-foldview-style">. Everything is prefixed `fv-` so it cannot
// collide with the page's own rules; colors come from the page's CSS variables with calm fallbacks (light and dark).
export const FOLDVIEW_STYLE_ID = "fold-foldview-style";
export const FOLDVIEW_CSS = `
.fv { --fv-a:#0d7a70; --fv-b:#4f46e5; --fv-c:#a16207; --fv-d:#be185d; --fv-ok:#15803d; --fv-bad:#c2410c;
  margin: 8px 0 12px; border: 1px solid var(--line, #e2e2e8); border-radius: 12px; background: var(--bg, #fff); overflow: hidden; font: 13px/1.5 var(--mono, ui-monospace, Menlo, monospace); color: var(--ink, #16161a); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .fv { --fv-a:#2dd4bf; --fv-b:#a5b4fc; --fv-c:#facc15; --fv-d:#f9a8d4; --fv-ok:#4ade80; --fv-bad:#fb923c; } }
:root[data-theme="dark"] .fv { --fv-a:#2dd4bf; --fv-b:#a5b4fc; --fv-c:#facc15; --fv-d:#f9a8d4; --fv-ok:#4ade80; --fv-bad:#fb923c; }
.fv-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:7px 10px; background: var(--side2, #f1f1f4); border-bottom:1px solid var(--line, #e2e2e8); }
.fv-title { font-weight:700; } .fv-sp { flex:1; }
.fv-chip { font-size:11.5px; font-weight:700; padding:0 9px; border-radius:999px; border:1px solid currentColor; }
.fv-run { color: var(--fv-a); } .fv-ok { color: var(--fv-ok); } .fv-bad { color: var(--fv-bad); } .fv-mut { color: var(--mut, #6b6b78); }
.fv-live .fv-run::before { content:"● "; animation: fvpulse 1.1s ease-in-out infinite; } @keyframes fvpulse { 50% { opacity:.25 } }
.fv-tabs { display:flex; gap:2px; }
.fv-tab { font: inherit; border:0; background:transparent; color: var(--mut, #6b6b78); padding:3px 11px; border-radius:8px; cursor:pointer; }
.fv-tab:hover { color: var(--ink, #16161a); } .fv-tab.on { background: var(--bg, #fff); color: var(--ink, #16161a); font-weight:700; box-shadow: 0 0 0 1px var(--line, #e2e2e8); }
.fv-body { max-height: 440px; overflow:auto; padding: 8px 10px 10px; }
.fv-empty, .fv-dim, .fv-cap { color: var(--mut, #6b6b78); } .fv-empty { padding: 18px 4px; text-align:center; } .fv-cap { font-size:12px; }
.fv-chips, .fv-filters { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin:0 0 8px; }
.fv-vchip, .fv-filter { font: inherit; font-size:12px; border:1px solid var(--line, #e2e2e8); background: var(--bg, #fff); color: var(--ink, #16161a); border-radius:999px; padding:1px 10px; cursor:pointer; }
.fv-vchip.on, .fv-filter.on { border-color: var(--fv-b); color: var(--fv-b); font-weight:700; } .fv-vchip.held { box-shadow: inset 0 0 0 1px var(--fv-ok); }
.fv-art .art { margin: 0; border-radius: 8px; } .fv-art iframe { width:100%; min-height:240px; border:0; }
.fv-problems { margin: 8px 0 0; padding-left: 18px; color: var(--fv-bad); } .fv-problems li { margin: 2px 0; }
.fv-code { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
.fv-round { margin: 10px 0 2px; color: var(--fv-a); font-weight:700; text-transform: uppercase; font-size:11px; letter-spacing:.06em; border-top:1px dashed var(--line, #e2e2e8); padding-top:6px; } .fv-round:first-of-type { border-top:0; margin-top:2px; }
.fv-row { display:grid; grid-template-columns: 22px 14px minmax(0,1fr); gap:6px; padding: 3px 0; }
.fv-seq { color: var(--mut, #6b6b78); font-size:11px; text-align:right; padding-top:2px; } .fv-glyph { font-weight:700; text-align:center; }
.fv-row.ok .fv-glyph { color: var(--fv-ok); } .fv-row.bad .fv-glyph, .fv-row.bad .fv-t { color: var(--fv-bad); }
.fv-main { min-width:0; } .fv-line { display:flex; flex-wrap:wrap; gap: 2px 8px; align-items:baseline; }
.fv-stage { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color: var(--fv-b); min-width: 38px; }
.fv-t { font-weight:600; overflow-wrap:anywhere; } .fv-who, .fv-time { color: var(--mut, #6b6b78); font-size:12px; } .fv-time { margin-left:auto; }
.fv-detail { color: var(--mut, #6b6b78); overflow-wrap:anywhere; margin: 0 0 0 0; }
.fv-more, .fv-copy { font: inherit; font-size:12px; border:0; background:transparent; color: var(--fv-b); cursor:pointer; padding:0; text-decoration: underline dotted; margin-top:2px; } .fv-copy { margin-top:10px; }
.fv-diff { margin: 4px 0; padding: 6px 8px; background: var(--side2, #f1f1f4); border-radius:8px; overflow:auto; }
.fv-d { white-space: pre; font-size:12px; } .fv-d-add { color: var(--fv-ok); background: color-mix(in srgb, var(--fv-ok) 10%, transparent); } .fv-d-del { color: var(--fv-bad); background: color-mix(in srgb, var(--fv-bad) 10%, transparent); } .fv-d-eq { color: var(--mut, #6b6b78); } .fv-d-gap { color: var(--mut, #6b6b78); text-align:center; }
.fv-tech summary { cursor:pointer; color: var(--mut, #6b6b78); font-size:11.5px; display:inline; } .fv-tech code { display:block; overflow-wrap:anywhere; font-size:11.5px; color: var(--mut, #6b6b78); }
.fv-share { display:flex; height:10px; border-radius:5px; overflow:hidden; margin:2px 0 6px; background: var(--line, #e2e2e8); } .fv-share i { display:block; height:100%; }
.fv-legend { display:flex; flex-wrap:wrap; gap:4px 14px; font-size:12px; color: var(--mut, #6b6b78); margin-bottom:8px; } .fv-legend i { display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:5px; }
.fv-fold { border:1px solid var(--line, #e2e2e8); border-radius:8px; overflow:auto; }
.fv-eotmeta { color: var(--mut, #6b6b78); font-size:12px; margin: 0 0 6px; overflow-wrap:anywhere; }
.fv-raw { background: var(--side2, #f1f1f4); border-radius:8px; padding:8px; max-height:340px; overflow:auto; font-size:12px; margin:6px 0 0; }
.fv-evts { border:1px solid var(--line, #e2e2e8); border-radius:8px; overflow:hidden; margin-top:6px; }
.fv-ev { padding: 4px 8px; border-bottom:1px solid var(--line, #e2e2e8); cursor:pointer; } .fv-ev:last-child { border-bottom:0; } .fv-ev:hover { background: var(--side2, #f1f1f4); }
.fv-ev.bad .fv-evok { color: var(--fv-bad); } .fv-ev.ok .fv-evok { color: var(--fv-ok); }
.fv-evline { display:flex; flex-wrap:wrap; align-items:baseline; gap: 2px 8px; }
.fv-evn { color: var(--mut, #6b6b78); font-size:11px; } .fv-id { color: var(--mut, #6b6b78); font-size:11.5px; }
.fv-evstage { font-weight:700; font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; }
.fv-s-a { color: var(--mut, #6b6b78); } .fv-s-b { color: var(--fv-c); } .fv-s-c { color: var(--fv-b); } .fv-s-d { color: var(--fv-a); } .fv-s-e { color: var(--fv-ok); } .fv-s-f { color: var(--fv-d); }
.fv-evt { font-weight:600; } .fv-evunit, .fv-evr { color: var(--mut, #6b6b78); font-size:12px; } .fv-evok { font-weight:700; margin-left:auto; }
.fv-evsub { display:flex; flex-wrap:wrap; gap: 0 12px; color: var(--mut, #6b6b78); font-size:11.5px; padding-left: 26px; overflow-wrap:anywhere; } .fv-evnote { color: var(--ink, #16161a); opacity:.8; }
.fv-srcs { border:1px solid var(--line, #e2e2e8); border-radius:8px; padding: 4px 8px; margin: 4px 0; } .fv-src-row { display:flex; flex-wrap:wrap; gap: 0 10px; font-size:11.5px; padding:2px 0; } .fv-sk { font-weight:700; } .fv-sl, .fv-sm { color: var(--mut, #6b6b78); overflow-wrap:anywhere; }
.fv-plain .fv-fl { grid-template-columns: 34px minmax(0,1fr); border-left-color: transparent; }
.fv-unit { padding: 2px 8px; background: var(--side2, #f1f1f4); color: var(--fv-b); font-size:11.5px; font-weight:700; border-top:1px solid var(--line, #e2e2e8); border-bottom:1px solid var(--line, #e2e2e8); }
.fv-fl { display:grid; grid-template-columns: 34px 74px minmax(0,1fr); border-left: 3px solid var(--m, var(--fv-a)); }
.fv-n { color: var(--mut, #6b6b78); text-align:right; padding-right:8px; user-select:none; font-size:12px; } .fv-gut { color: var(--m, var(--fv-a)); font-size:11px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; padding-right:6px; }
.fv-src { white-space: pre-wrap; overflow-wrap:anywhere; }
`;
