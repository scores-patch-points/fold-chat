// fold-options.js — the one setting: may The Fold read arbitrary websites?
//
// It is an OPTIONAL host permission (manifest optional_host_permissions), which the
// browser only lets an extension request from a click — so it lives here, not in the
// middle of a turn. The permission is the browser's, not ours: the person can also see
// and revoke it on the extension's details page.

import { webReadAccess } from "./fold-chat-exit.js";

const $ = (id) => document.getElementById(id);
const access = webReadAccess();

async function paint() {
  const on = await access.granted();
  const status = $("status");
  status.textContent = on ? "On — The Fold can read the pages its searches find." : "Off — The Fold can search, but reads only the always-allowed sources.";
  status.classList.toggle("on", on);
  $("grant").hidden = on;
  $("revoke").hidden = !on;
}

$("grant").addEventListener("click", async () => {
  const note = $("note");
  note.hidden = true;
  let ok = false;
  try { ok = await access.request(); } catch (e) { note.textContent = "The browser could not ask: " + (e && e.message || e); note.hidden = false; }
  if (!ok && note.hidden) { note.textContent = "Not allowed — nothing changed."; note.hidden = false; }
  await paint();
});

$("revoke").addEventListener("click", async () => {
  await access.revoke();
  await paint();
});

const hosts = $("hosts");
for (const h of chrome.runtime.getManifest().host_permissions || []) {
  const li = document.createElement("li");
  const c = document.createElement("code");
  c.textContent = h.replace(/\/\*$/, "");
  li.append(c);
  hosts.append(li);
}

paint();
