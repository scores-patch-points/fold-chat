// fold-background.js — the extension's service worker. It holds no state and
// makes no network calls: all web access happens in the page itself, behind the
// exit rules in fold-chat-exit.js. This worker only does two small things.
//
//   · toolbar button → open The Fold in a tab (or focus the one already open).
//     The same page is also offered in Chrome's side panel (manifest side_panel).
//   · first install → show the options page, where reading arbitrary websites
//     is switched on (or left off).

const APP_URL = chrome.runtime.getURL("index.html");

chrome.action.onClicked.addListener(async () => {
  const [open] = await chrome.tabs.query({ url: APP_URL });
  if (open) {
    await chrome.tabs.update(open.id, { active: true });
    await chrome.windows.update(open.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: APP_URL });
  }
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.runtime.openOptionsPage();
});
