/**
 * YouTube: hide or highlight (test mode) video rows matching block patterns.
 * Row list covers home, search, watch (incl. sidebar/queue), channel, playlist, subs, Shorts, Live, etc.
 * Uses shadow-DOM title lookup + fallback row detection for unknown ytd-* cards.
 */
(function () {
  "use strict";

  var F = globalThis.LazyRemixFilter;
  var C = globalThis.LazyRemixContent;
  if (!F || !C) return;

  var dq = C.deepQuerySelector.bind(C);
  var txt = C.textFromElement.bind(C);

  /** Single-tag selectors only (valid for Element.closest). */
  var ROW_TAGS = [
    "ytd-video-renderer",
    "ytd-rich-item-renderer",
    "ytd-compact-video-renderer",
    "ytd-rich-grid-media",
    "ytd-playlist-video-renderer",
    "ytd-channel-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-reel-item-renderer",
    "ytd-compact-radio-renderer",
    "ytd-compact-movie-renderer",
    "ytd-movie-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-compact-playlist-renderer",
    "ytd-grid-playlist-renderer",
    "ytd-radio-renderer",
    "ytd-promoted-video-renderer",
    "yt-lockup-view-model",
    "ytd-playlist-renderer",
    "ytd-channel-renderer",
    "ytd-grid-show-renderer",
    "ytd-rich-metadata-renderer",
    "ytd-compact-autoplay-renderer",
    "ytd-vertical-watch-card-renderer",
    "ytd-grid-game-renderer",
    "ytd-game-details-renderer",
    "ytd-post-renderer",
  ];

  var ROW_CLOSEST_SELECTOR = ROW_TAGS.join(", ");

  /**
   * Descendant queries for shelves/sections where inner cards share the same tag names as elsewhere
   * but are easier to target as a group (optional redundancy with global tag query).
   */
  var ROW_EXTRA_QUERIES = [
    "ytd-rich-shelf-renderer ytd-rich-item-renderer",
    "ytd-rich-section-renderer ytd-rich-item-renderer",
    "ytd-shelf-renderer ytd-rich-item-renderer",
    "ytd-item-section-renderer ytd-video-renderer",
    "ytd-item-section-renderer ytd-rich-item-renderer",
    "ytd-expanded-shelf-contents-renderer ytd-video-renderer",
    "ytd-expanded-shelf-contents-renderer ytd-rich-item-renderer",
    "ytd-expanded-shelf-contents-renderer ytd-compact-video-renderer",
    "ytd-watch-next-secondary-results-renderer ytd-compact-video-renderer",
    "ytd-watch-next-secondary-results-renderer ytd-compact-playlist-renderer",
    "ytd-two-column-browse-results-renderer ytd-video-renderer",
    "ytd-two-column-search-results-renderer ytd-video-renderer",
    "ytd-search ytd-video-renderer",
    "ytd-search ytd-playlist-renderer",
    "ytd-search ytd-channel-renderer",
    "ytd-grid-renderer ytd-video-renderer",
    "ytd-rich-grid-renderer ytd-rich-item-renderer",
    "ytd-rich-grid-renderer ytd-reel-item-renderer",
    "ytd-playlist-video-list-renderer ytd-playlist-video-renderer",
    "ytd-playlist-panel-renderer ytd-playlist-panel-video-renderer",
    "ytd-engagement-panel-section-list-renderer ytd-compact-video-renderer",
  ];

  var TITLE_SELECTORS_LIGHT = [
    "a#video-title",
    "#video-title",
    "#playlist-title",
    "yt-formatted-string#video-title",
    "h3 a",
    "h3 yt-formatted-string a",
    ".yt-lockup-metadata-view-model__title a",
    ".yt-lockup-metadata-view-model__title",
    "a.yt-simple-endpoint.style-scope.ytd-grid-video-renderer",
    "a.yt-simple-endpoint.style-scope.ytd-playlist-renderer",
    "a[href*=\"/watch\"]",
    "a[href*=\"/shorts/\"]",
    "a[href*=\"/playlist\"]",
  ];

  /** Inner components: keep walking up to the card row. */
  var SHELL_SKIP = {
    ytdapp: true,
    ytdbrowse: true,
    ytdpagemanager: true,
    ytdmasthead: true,
    ytdminiplayer: true,
    ytdminiplayerlayout: true,
    ytdnotification: true,
    ytdnotificationaction: true,
    ytdguided: true,
    ytdguiderenderer: true,
    ytdchannelname: true,
    ytdvideometadatablock: true,
    ytdmetadatarowrenderer: true,
    ytdthumbnailoverlaytimeseeker: true,
    ytdthumbnailoverlaytimeseekerpreview: true,
    ytdthumbnailhoveroverlay: true,
    ytdmenu: true,
    ytdbuttontext: true,
    ytdbuttontextrenderer: true,
    ytdbadge: true,
    ytdbadgesupportedrenderer: true,
    ytdsentimentbar: true,
    ytdcomments: true,
    ytdcomment: true,
    ytdcommentthread: true,
    ytdcommentbox: true,
    ytdcommentaction: true,
    ytdcommentauthor: true,
    ytdcommentreply: true,
    ytdcommentview: true,
    ytdcommentfooter: true,
    ytdcommentheader: true,
    ytdcommentsection: true,
    ytdcommentsectionheader: true,
    ytdcommentsectionfooter: true,
    ytdrichshelfrenderer: true,
    ytdshelfrenderer: true,
    ytditemsectionrenderer: true,
    ytdrichsectionrenderer: true,
  };

  function findRowFallback(anchor) {
    var p = anchor;
    var depth;
    for (depth = 0; depth < 32 && p; depth++) {
      var tag = p.tagName && p.tagName.toLowerCase();
      if (tag && (tag.indexOf("ytd-") === 0 || tag.indexOf("yt-") === 0)) {
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
    for (i = 0; i < TITLE_SELECTORS_LIGHT.length; i++) {
      var sel = TITLE_SELECTORS_LIGHT[i];
      var el = row.querySelector(sel) || dq(row, sel);
      if (el) {
        var t = txt(el);
        if (t) return t;
      }
    }
    var anyWatch = row.querySelector("a[href*=\"/watch\"]") || dq(row, "a[href*=\"/watch\"]");
    if (anyWatch) {
      var w = txt(anyWatch);
      if (w) return w;
    }
    return "";
  }

  function getChannelFromRow(row) {
    if (!row) return "";
    var channelSelectors = [
      "ytd-channel-name a",
      "#channel-name a",
      ".yt-lockup-metadata-view-model__text a",
      "a.yt-simple-endpoint.style-scope.ytd-channel-name",
      "span.style-scope.ytd-channel-name a",
      "a[href*=\"/channel/\"]",
      "a[href*=\"/@\"]",
    ];
    var i;
    for (i = 0; i < channelSelectors.length; i++) {
      var el = row.querySelector(channelSelectors[i]) || dq(row, channelSelectors[i]);
      if (el) {
        var href = el.getAttribute && el.getAttribute("href");
        if (href && (href.indexOf("/watch") !== -1 || href.indexOf("/playlist") !== -1)) continue;
        var t = txt(el);
        if (t && t.length < 200) return t;
      }
    }
    return "";
  }

  /**
   * Shadow-aware walk (matches ytmusic.js): miniplayer, watch UI, and experiments may host rows in open shadow roots.
   */
  function collectRows() {
    var set = new Set();
    var rowSelectors = [ROW_CLOSEST_SELECTOR].concat(ROW_EXTRA_QUERIES);
    var anchorSelectors = [
      "a[href*=\"/watch?v=\"]",
      "a[href*=\"/watch?\"]",
      "a[href*=\"/shorts/\"]",
      "a[href*=\"/playlist?\"]",
      "a[href*=\"/playlist&\"]",
    ];

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
      for (hi = 0; hi < TITLE_SELECTORS_LIGHT.length; hi++) {
        try {
          r.querySelectorAll(TITLE_SELECTORS_LIGHT[hi]).forEach(function (node) {
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
      var idx;
      for (idx = 0; idx < rows.length; idx++) {
        var row = rows[idx];
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
