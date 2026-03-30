/**
 * Toolbar icon opens options; badge shows blocked count for the active tab.
 */
chrome.action.onClicked.addListener(function () {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== "LAZY_REMIX_BLOCKED_COUNT") return;
  var tabId = sender.tab && sender.tab.id;
  if (tabId == null) return;
  var n = Number(msg.count) || 0;
  var text = "";
  if (n > 0) {
    text = n > 999 ? "999+" : String(n);
  }
  chrome.action.setBadgeText({ text: text, tabId: tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#4a3a6a", tabId: tabId });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (!changeInfo.url) return;
  var u = changeInfo.url.toLowerCase();
  if (u.indexOf("youtube.com") === -1 && u.indexOf("music.youtube.com") === -1) {
    chrome.action.setBadgeText({ text: "", tabId: tabId });
  }
});
