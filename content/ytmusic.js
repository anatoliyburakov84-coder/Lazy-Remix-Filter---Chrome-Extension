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
   * Do not add hide/test classes inside the live playback UI — doing so can blank the player (Brave / strict privacy).
   */
  function isInsidePlaybackSurface(row) {
    if (!row || !row.closest) return false;
    return !!(
      row.closest("ytmusic-player-bar") ||
      row.closest("ytmusic-player") ||
      row.closest("ytmusic-video") ||
      row.closest("ytmusic-player-queue") ||
      row.closest("ytmusic-playlist-queue") ||
      row.closest("ytmusic-mini-player")
    );
  }

  /**
   * Never hide a row that contains a video element (main player or inline preview). display:none on an ancestor
   * blacks out playback — this can happen when closest() does not match our playback selectors (A/B DOM).
   */
  function rowContainsVideoElement(row) {
    if (!row) return false;
    try {
      if (row.querySelector("video")) return true;
      return !!dq(row, "video");
    } catch (e) {
      return false;
    }
  }

  function injectPlaybackSafetyStyles() {
    if (document.getElementById("lazy-remix-filter-ytm-playback-safety")) return;
    var s = document.createElement("style");
    s.id = "lazy-remix-filter-ytm-playback-safety";
    s.textContent =
      "ytmusic-app video,ytmusic-player video,ytmusic-video video{opacity:1!important;visibility:visible!important;}";
    (document.head || document.documentElement).appendChild(s);
  }

  function clearFilterClassesFromPlaybackChrome() {
    try {
      var roots = document.querySelectorAll(
        "ytmusic-player-bar, ytmusic-player, ytmusic-video, ytmusic-player-queue, ytmusic-playlist-queue, ytmusic-mini-player"
      );
      var k;
      for (k = 0; k < roots.length; k++) {
        dqAll(roots[k], ".lazy-remix-filter-hidden, .lazy-remix-filter-test, .lazy-remix-filter-dim").forEach(function (el) {
          el.classList.remove("lazy-remix-filter-hidden", "lazy-remix-filter-test", "lazy-remix-filter-dim");
        });
      }
    } catch (e) {}
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

  /** Timestamps of recent skip clicks (rolling window) to avoid runaway skip loops. */
  var skipBurstTs = [];
  var lastSkipClickAt = 0;
  var MAX_SKIPS_PER_10S = 25;
  var MIN_MS_BETWEEN_SKIPS = 500;

  /**
   * Title/channel for the *currently playing* track only — not queue previews or other chrome in the bar.
   */
  function getNowPlayingFromPlayerBar() {
    var bar = document.querySelector("ytmusic-player-bar");
    if (!bar) return { title: "", channel: "", videoId: "" };
    var mid =
      dq(bar, ".middle-content") ||
      dq(bar, "#middle-content") ||
      dq(bar, ".middle-controls") ||
      dq(bar, "#middle-controls");
    var root = mid || bar;
    var title = "";
    var channel = "";
    var videoId = "";
    var watchLink =
      dq(root, "a[href*=\"/watch\"]") || dq(root, "a.yt-simple-endpoint[href*=\"/watch\"]");
    if (watchLink) {
      title = txt(watchLink);
      if (!title && watchLink.getAttribute("title")) {
        title = String(watchLink.getAttribute("title")).trim();
      }
      var href = watchLink.href || watchLink.getAttribute("href") || "";
      var m = String(href).match(/[?&]v=([^&]+)/);
      if (m) videoId = m[1];
    }
    if (!title) {
      var tfs = dq(root, ".title yt-formatted-string") || dq(root, "yt-formatted-string.title");
      if (tfs) title = txt(tfs);
    }
    if (!title) {
      var headline = dq(root, "yt-formatted-string.headline");
      if (headline) title = txt(headline);
    }
    var sub =
      dq(root, ".subtitle yt-formatted-string") ||
      dq(root, "yt-formatted-string.subtitle") ||
      dq(root, ".byline yt-formatted-string");
    if (sub) channel = txt(sub);
    if (!title) {
      title = getTitleFromRow(bar);
    }
    if (!channel) {
      channel = getChannelFromRow(bar);
    }
    if (!title) {
      var dt = (document.title || "").trim();
      dt = dt.replace(/\s*-\s*YouTube Music\s*$/i, "").replace(/\s*\|\s*YouTube Music.*$/i, "").trim();
      if (dt && dt.length > 0 && dt.length < 400) {
        title = dt;
      }
    }
    if (!videoId) {
      try {
        var u = new URL(location.href);
        var vParam = u.searchParams.get("v");
        if (vParam) videoId = vParam;
      } catch (e) {}
    }
    if (!title) {
      var pq = document.querySelector("ytmusic-player-queue");
      if (pq) {
        var items = dqAll(pq, "ytmusic-queue-item-renderer, ytmusic-player-queue-item");
        var k;
        for (k = 0; k < items.length; k++) {
          var el = items[k];
          var sel =
            (el.classList && el.classList.contains("selected")) ||
            (el.getAttribute && el.getAttribute("selected") !== null) ||
            (el.getAttribute && el.getAttribute("play-state") === "PLAYING");
          if (sel) {
            title = getTitleFromRow(el);
            if (!channel) channel = getChannelFromRow(el);
            break;
          }
        }
      }
    }
    return { title: title, channel: channel, videoId: videoId };
  }

  /**
   * True only for the real transport "next track" control (not "Up next", ads, chapters, etc.).
   */
  function isNextTrackLabel(combined) {
    var lower = combined.toLowerCase().trim();
    if (!lower) return false;
    if (lower.indexOf("previous") !== -1 || /\bprev\b/.test(lower)) return false;
    if (lower.indexOf("up next") !== -1) return false;
    if (lower.indexOf("next chapter") !== -1) return false;
    if (lower.indexOf("next episode") !== -1 || lower.indexOf("next video") !== -1) return false;
    if (lower === "next" || lower === "next track") return true;
    if (lower.indexOf("next track") !== -1) return true;
    if (lower.indexOf("skip forward") !== -1) return true;
    if (/\bnext\b/.test(lower)) return true;
    return false;
  }

  function tryInternalPlayerSkip() {
    try {
      var app = document.querySelector("ytmusic-app");
      if (!app) return false;
      var objs = [app.player, app.player_, app._player, app.api];
      var oi;
      for (oi = 0; oi < objs.length; oi++) {
        var pl = objs[oi];
        if (!pl || typeof pl !== "object") continue;
        var names = ["nextVideo", "seekToNext", "skipToNext", "playNext", "next"];
        var ni;
        for (ni = 0; ni < names.length; ni++) {
          if (typeof pl[names[ni]] === "function") {
            pl[names[ni]]();
            return true;
          }
        }
      }
    } catch (e) {}
    return false;
  }

  function tryClickNextByKnownSelectors(bar) {
    function safeNextClick(el) {
      if (!el || !el.click) return false;
      var al = ((el.getAttribute && el.getAttribute("aria-label")) || "").toLowerCase();
      if (al.indexOf("up next") !== -1) return false;
      try {
        el.click();
        return true;
      } catch (e2) {
        return false;
      }
    }
    var sels = [
      "[class*=\"next-button\"]",
      "[class*=\"nextButton\"]",
      "tp-yt-paper-icon-button[aria-label*=\"Next\"]",
      "button[aria-label*=\"Next\"]",
    ];
    var si;
    for (si = 0; si < sels.length; si++) {
      try {
        var el = dq(bar, sels[si]) || bar.querySelector(sels[si]);
        if (safeNextClick(el)) return true;
      } catch (e2) {}
    }
    return false;
  }

  function tryKeyboardSkip() {
    var opts = { bubbles: true, cancelable: true };
    var keys = [
      { key: "MediaTrackNext", code: "MediaTrackNext" },
      { key: "n", code: "KeyN", shiftKey: true },
    ];
    var targets = [document.body, document.documentElement];
    var ti;
    var ki;
    for (ti = 0; ti < targets.length; ti++) {
      for (ki = 0; ki < keys.length; ki++) {
        try {
          var down = new KeyboardEvent("keydown", Object.assign({}, keys[ki], opts));
          var up = new KeyboardEvent("keyup", Object.assign({}, keys[ki], opts));
          targets[ti].dispatchEvent(down);
          targets[ti].dispatchEvent(up);
        } catch (e3) {}
      }
    }
  }

  function performSkip() {
    if (tryInternalPlayerSkip()) return;

    var bar = document.querySelector("ytmusic-player-bar");
    if (!bar) {
      tryKeyboardSkip();
      return;
    }

    if (tryClickNextByKnownSelectors(bar)) return;

    function clickEl(el) {
      if (!el) return false;
      try {
        el.click();
        return true;
      } catch (e) {
        return false;
      }
    }

    function labelOf(el) {
      return (
        ((el.getAttribute && el.getAttribute("aria-label")) || "") +
        " " +
        ((el.getAttribute && el.getAttribute("title")) || "")
      )
        .trim()
        .toLowerCase();
    }

    function isPlayPauseButton(el) {
      var al = labelOf(el);
      if (!al) return false;
      if (al.indexOf("previous") !== -1 || /\bprev\b/.test(al)) return false;
      return al.indexOf("play") !== -1 || al.indexOf("pause") !== -1;
    }

    var right =
      dq(bar, "#right-controls") ||
      dq(bar, ".right-controls") ||
      dq(bar, "[class*=\"right-controls\"]");
    var root = right || bar;
    var buttons = C.querySelectorAllDeep(root, "tp-yt-paper-icon-button, paper-icon-button");

    var i;
    var playIdx = -1;
    for (i = 0; i < buttons.length; i++) {
      if (isPlayPauseButton(buttons[i])) {
        playIdx = i;
        break;
      }
    }
    if (playIdx >= 0) {
      var j;
      for (j = 1; j <= 4 && playIdx + j < buttons.length; j++) {
        var cand = buttons[playIdx + j];
        var alC = labelOf(cand);
        if (alC.indexOf("previous") !== -1 || /\bprev\b/.test(alC)) continue;
        if (isPlayPauseButton(cand)) continue;
        if (alC.indexOf("shuffle") !== -1) continue;
        if (alC.indexOf("repeat") !== -1 || alC.indexOf("loop") !== -1) continue;
        if (
          alC.indexOf("cast") !== -1 ||
          alC.indexOf("queue") !== -1 ||
          alC.indexOf("volume") !== -1 ||
          alC.indexOf("lyrics") !== -1
        ) {
          continue;
        }
        if (isNextTrackLabel(alC) || /\bnext\b/.test(alC)) {
          if (clickEl(cand)) return;
          break;
        }
        if (j === 1 && !alC) {
          if (clickEl(cand)) return;
          break;
        }
      }
    }

    for (i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var combined = labelOf(b);
      if (!combined) continue;
      if (!isNextTrackLabel(combined)) continue;
      if (clickEl(b)) return;
    }

    var exactOnly =
      dq(bar, 'tp-yt-paper-icon-button[aria-label="Next"]') ||
      dq(bar, 'tp-yt-paper-icon-button[aria-label="Next track"]') ||
      dq(bar, "paper-icon-button[aria-label=\"Next\"]") ||
      dq(bar, "paper-icon-button[aria-label=\"Next track\"]");
    if (exactOnly) {
      clickEl(exactOnly);
      return;
    }

    tryKeyboardSkip();
  }

  /**
   * When the currently playing track matches block rules, advance playback (radio / playlists still
   * contain those entries server-side; skipping is what removes them from actual playback).
   */
  function maybeSkipCurrentTrack(settings) {
    if (!settings.enabled || settings.mode === "test") return;
    var np;
    try {
      np = getNowPlayingFromPlayerBar();
    } catch (e) {
      return;
    }
    var title = np.title;
    var channel = np.channel;
    if (!title && !channel) return;
    if (!F.shouldBlock(title, channel, settings)) {
      skipBurstTs.length = 0;
      return;
    }
    var now = Date.now();
    if (now - lastSkipClickAt < MIN_MS_BETWEEN_SKIPS) return;
    skipBurstTs = skipBurstTs.filter(function (t) {
      return now - t < 10000;
    });
    if (skipBurstTs.length >= MAX_SKIPS_PER_10S) return;
    skipBurstTs.push(now);
    lastSkipClickAt = now;
    try {
      performSkip();
    } catch (e2) {}
  }

  function pollSkipPlayback() {
    try {
      if (!lastSettings || !lastSettings.enabled || lastSettings.mode === "test") return;
      if (lastSettings.skipBlockedOnPlayback === false) return;
      maybeSkipCurrentTrack(lastSettings);
    } catch (e) {}
  }

  function process(settings) {
    try {
      lastSettings = settings;
      var showFloat = settings.showFloatingCounter !== false;

      if (!settings.enabled) {
        skipBurstTs.length = 0;
        document.querySelectorAll(".lazy-remix-filter-hidden, .lazy-remix-filter-test, .lazy-remix-filter-dim").forEach(function (el) {
          el.classList.remove("lazy-remix-filter-hidden", "lazy-remix-filter-test", "lazy-remix-filter-dim");
        });
        C.reportBlockedCount(0, false);
        return;
      }

      if (settings.mode === "test") {
        C.clearBootingIfFirst();
      }

      clearFilterClassesFromPlaybackChrome();

      var rows = collectRows();
      var blockedCount = 0;
      var j;
      for (j = 0; j < rows.length; j++) {
        var row = rows[j];
        if (isInsidePlaybackSurface(row)) continue;
        if (rowContainsVideoElement(row)) continue;
        var title = getTitleFromRow(row);
        var channel = getChannelFromRow(row);
        if (!title && !channel) continue;
        var blocked = F.shouldBlock(title, channel, settings);
        C.applyToRow(row, blocked, settings.mode);
        if (blocked) blockedCount += 1;
      }

      maybeSkipCurrentTrack(settings);

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
  }, 400);

  function init() {
    C.injectStyles({ skipBoot: true });
    injectPlaybackSafetyStyles();
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
    setInterval(pollSkipPlayback, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
