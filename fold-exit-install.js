// fold-exit-install.js — imported FIRST by fold-boot.js. ES modules run in import order, so by the time
// anything else in the page asks for `fetch`, it is already the guarded one (see fold-chat-exit.js).
// On the plain web page (not an extension) this does nothing at all.

import { isExtension, installGlobalGuard } from "./fold-chat-exit.js";

if (isExtension()) installGlobalGuard();
