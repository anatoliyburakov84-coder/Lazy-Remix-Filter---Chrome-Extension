/**
 * YouTube Music: hide or highlight (test mode) rows on Home, Explore, Search, etc.
 */
(function () {
  "use strict";

  var F = globalThis.LazyRemixFilter;
  var C = globalThis.LazyRemixContent;
  if (!F || !C) return;

  var dq = C.deepQuerySelector.bind(C);
  var dqAll = C.querySelectorAllDeep.bind(C);
  var txt = C.textFromElement.bind(C);

  var ROW_TAGS = [
    "ytmusic-responsive-list-item-renderer",
    "ytmusic-two-row-item-renderer",
    "ytmusic-queue-item-renderer",
    "ytmusic-list-item-renderer",
    "ytmusic-entity-row-renderer",
    "ytmusic-playlist-item-renderer",
    "ytmusic-material-list-item-renderer",
    "ytmusic-player-queue-item",
    "ytmusic-playlist-queue-item",
  ];

  var ROW_CLOSEST_SELECTOR = ROW_TAGS.join(", ");

  var ROW_EXTRA_QUERIES = [
    "ytmusic-carousel-shelf-renderer ytmusic-two-row-item-renderer",
    "ytmusic-playlist-shelf-renderer ytmusic-two-row-item-renderer",
    "ytmusic-shelf-renderer ytmusic-two-row-item-renderer",
    "ytmusic-shelf-renderer ytmusic-responsive-list-item-renderer",
    "ytmusic-tabbed-search-results-renderer ytmusic-responsive-list-item-renderer",
    "ytmusic-section-list-renderer ytmusic-two-row-item-renderer",
    "ytmusic-browse-page ytmusic-two-row-item-renderer",
    "ytmusic-rich-grid-renderer ytmusic-two-row-item-renderer",
    "ytmusic-player-queue ytmusic-queue-item-renderer",
    "ytmusic-player-queue ytmusic-responsive-list-item-renderer",
    "ytmusic-playlist-queue ytmusic-queue-item-renderer",
    "ytmusic-tab-renderer ytmusic-queue-item-renderer",
    "ytmusic-player-page ytmusic-queue-item-renderer",
    "ytmusic-app-layout ytmusic-queue-item-renderer",
  ];

  /** Narrow selectors for discovering rows (avoid bare yt-formatted-string — too many matches). */
  var TITLE_HINT_SELECTORS = [
    "a[href*=\"/watch\"]",
    "a[href*=\"music.youtube.com/watch\"]",
    "a.yt-simple-endpoint[href*=\"/watch\"]",
    "yt-formatted-string.title",
    "yt-formatted-string.title.style-scope",
    ".title yt-formatted-string",
    "ytmusic-item-thumbnail-overlay-renderer + div yt-formatted-string",
  ];

  var TITLE_SELECTORS = TITLE_HINT_SELECTORS.concat([
    "yt-formatted-string.headline",
    "yt-formatted-string[slot=\"primary\"]",
  ]);

  var SHELL_SKIP = {
    ytmusicapp: true,
    ytmusicappbar: true,
    ytmusicnav: true,
    ytmusicnavbar: true,
    ytmusicplayerbar: true,
    ytmusicplayernav: true,
    ytmusicplayer: true,
    ytmusicplayerqueue: true,
    ytmusicplayerqueueheader: true,
    ytmusicthumbnail: true,
    ytmusicitemthumbnail: true,
    ytmusicitemthumbnailoverlay: true,
    ytmusicmenubutton: true,
    ytmusiciconbutton: true,
  };

  function isInsideThumbnail(el) {
    if (!el || !el.closest) return false;
    return !!el.closest(
      "ytmusic-item-thumbnail-renderer, ytmusic-thumbnail-renderer, ytmusic-thumbnail, ytmusic-item-thumbnail"
    );
  }

  function isSubtitleFormattedString(el) {
    if (!el || !el.classList) return false;
    if (el.classList.contains("subtitle")) return true;
    var c = el.getAttribute && el.getAttribute("class");
    if (typeof c === "string") {
      return (
        c.indexOf("subtitle") !== -1 ||
        c.indexOf("secondary") !== -1 ||
        c.indexOf("metadata") !== -1
      );
    }
    return false;
  }

  function collectFormattedStringsDeep(row) {
    if (!row) return [];
    return dqAll(row, "yt-formatted-string");
  }

  function getTitleFromFormattedStrings(row) {
    var nodes = collectFormattedStringsDeep(row);
    var i;
    var best = "";
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (isInsideThumbnail(el)) continue;
      if (isSubtitleFormattedString(el)) continue;
      var t = txt(el);
      if (!t) continue;
      if (t.length > best.length) best = t;
    }
    if (best) return best;
    for (i = 0; i < nodes.length; i++) {
      var el2 = nodes[i];
      if (isInsideThumbnail(el2)) continue;
      var t2 = txt(el2);
      if (t2) return t2;
    }
    return "";
  }

  function findRowFallback(anchor) {
    var p = anchor;
    var depth;
    for (depth = 0; depth < 28 && p; depth++) {
      var tag = p.tagName && p.tagName.toLowerCase();
      if (tag && tag.indexOf("ytmusic-") === 0) {
        var key = tag.replace(/-/g, "");
        if (!SHELL_SKIP[key]) return p;
      }
      p = p.parentElement;
    }
    return null;
  }

  function getTitleFromRow(row) {
    if (!row) return "";
    var i;
    for (i = 0; i < TITLE_SELECTORS.length; i++) {
      var sel = TITLE_SELECTORS[i];
      var el = row.querySelector(sel) || dq(row, sel);
      if (el && !isInsideThumbnail(el)) {
        var t = txt(el);
        if (t) return t;
      }
    }
    var a =
      row.querySelector("a.yt-simple-endpoint[href*=\"/watch\"]") ||
      row.querySelector("a[href*=\"/watch\"]") ||
      dq(row, "a[href*=\"/watch\"]");
    if (a) {
      var linkText = txt(a);
      if (linkText) return linkText;
    }
    var fromStrings = getTitleFromFormattedStrings(row);
    if (fromStrings) return fromStrings;
    var fs = row.querySelector("yt-formatted-string") || dq(row, "yt-formatted-string");
    if (fs && !isInsideThumbnail(fs)) return txt(fs);
    return "";
  }

  function getChannelFromRow(row) {
    if (!row) return "";
    var channelSelectors = [
      "yt-formatted-string.subtitle",
      ".subtitle yt-formatted-string",
      "yt-formatted-string.style-scope.ytmusic-responsive-list-item-renderer",
    ];
    var i;
    for (i = 0; i < channelSelectors.length; i++) {
      var el = row.querySelector(channelSelectors[i]) || dq(row, channelSelectors[i]);
      if (el) {
        var t = txt(el);
        if (t && t.length < 200) return t;
      }
    }
    var parts = collectFormattedStringsDeep(row);
    if (parts && parts.length > 1 && parts[1].textContent) return parts[1].textContent.trim();
    return "";
  }

  /**
   * One shadow-aware walk (Up Next / player UI lives in shadow roots — avoid N full-tree passes).
   */
  function collectRows() {
    var set = new Set();
    var rowSelectors = [ROW_CLOSEST_SELECTOR].concat(ROW_EXTRA_QUERIES);
    var anchorSelectors = ["a[href*=\"/watch\"]", "a[href*=\"music.youtube.com/watch\"]"];

    function walk(r) {
      if (!r) return;
      var si;
      for (si = 0; si < rowSelectors.length; si++) {
        try {
          r.querySelectorAll(rowSelectors[si]).forEach(function (el) {
            set.add(el);
          });
        } catch (e) {}
      }
      var hi;
      for (hi = 0; hi < TITLE_HINT_SELECTORS.length; hi++) {
        try {
          r.querySelectorAll(TITLE_HINT_SELECTORS[hi]).forEach(function (node) {
            var row = node.closest(ROW_CLOSEST_SELECTOR);
            if (!row) row = findRowFallback(node);
            if (row) set.add(row);
          });
        } catch (e2) {}
      }
      var ai;
      for (ai = 0; ai < anchorSelectors.length; ai++) {
        try {
          r.querySelectorAll(anchorSelectors[ai]).forEach(function (a) {
            var row = a.closest(ROW_CLOSEST_SELECTOR);
            if (!row) row = findRowFallback(a);
            if (row) set.add(row);
          });
        } catch (e3) {}
      }
      var all = r.querySelectorAll("*");
      var i;
      for (i = 0; i < all.length; i++) {
        if (all[i].shadowRoot) walk(all[i].shadowRoot);
      }
    }

    walk(document.documentElement);
    return Array.from(set);
  }

  var lastSettings = null;

  function process(settings) {
    try {
      lastSettings = settings;
      var showFloat = settings.showFloatingCounter !== false;

      if (!settings.enabled) {
        document.querySelectorAll(".lazy-remix-filter-hidden, .lazy-remix-filter-test, .lazy-remix-filter-dim").forEach(function (el) {
          el.classList.remove("lazy-remix-filter-hidden", "lazy-remix-filter-test", "lazy-remix-filter-dim");
        });
        C.reportBlockedCount(0, false);
        return;
      }

      if (settings.mode === "test") {
        C.clearBootingIfFirst();
      }

      var rows = collectRows();
      var blockedCount = 0;
      var j;
      for (j = 0; j < rows.length; j++) {
        var row = rows[j];
        var title = getTitleFromRow(row);
        var channel = getChannelFromRow(row);
        if (!title && !channel) continue;
        var blocked = F.shouldBlock(title, channel, settings);
        C.applyToRow(row, blocked, settings.mode);
        if (blocked) blockedCount += 1;
      }

      C.reportBlockedCount(blockedCount, showFloat, settings.mode);
    } finally {
      C.clearBootingIfFirst();
    }
  }

  function run() {
    C.loadSettings(process);
  }

  var debouncedProcess = C.debounce(function () {
    if (lastSettings) process(lastSettings);
    else run();
  }, 80);

  function init() {
    C.injectStyles();
    C.bootPhaseStart();
    run();
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local" || !changes[C.STORAGE_KEY]) return;
      var ch = changes[C.STORAGE_KEY];
      var oldVal = ch.oldValue;
      var newVal = ch.newValue;
      if (newVal && newVal.showFloatingCounter === true) {
        var wasOff = !oldVal || oldVal.showFloatingCounter === false;
        if (wasOff) C.clearFloatingDismiss();
      }
      run();
    });
    var obs = new MutationObserver(debouncedProcess);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
