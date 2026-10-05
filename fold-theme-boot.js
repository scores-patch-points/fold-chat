// fold-theme-boot.js — resolve the theme before first paint: a stored light/dark
// choice wins, otherwise follow the system (prefers-color-scheme). fold-chat.js
// keeps it in step afterwards.
//
// This was an inline <script> in index.html. It is a file now because a browser
// extension page forbids inline script (its CSP is script-src 'self'); the
// static page loses nothing — it is still a plain, render-blocking script in
// <head>, so there is still no flash of the wrong theme.
(function () { try { var t = localStorage.getItem("fold-chat:theme"); if (t !== "light" && t !== "dark") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; document.documentElement.setAttribute("data-theme", t); } catch (e) {} })();
