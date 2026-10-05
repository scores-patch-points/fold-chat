// fold-boot.js — the page's one entry point.
//
// This was an inline <script type="module"> in index.html; it is a file because
// a browser extension page forbids inline script. Same page, same behaviour.
//
// The ONE difference between the static site and the extension: inside the extension the page may
// make its own web calls (an extension page with host permissions is not subject to CORS), so
// web search and page reads can go straight from this machine, with no relay in the path. That is
// a sharp tool, so the exit rules in fold-chat-exit.js are put on the global fetch FIRST — before
// any other module loads — and every web call in the page passes through them. On a plain web page
// the install is a no-op.

import "./fold-exit-install.js";
import { mount } from "./fold-chat.js";

mount(document.querySelector(".app"));
