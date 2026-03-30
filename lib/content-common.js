/**
 * Shared content-script helpers: storage, styles, debounce.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "lazyRemixSettings";
  var SESSION_FLOATING_DISMISSED = "lazyRemixFloatingDismissed";

  function defaults() {
    return {
      enabled: true,
      blockPatterns: "",
      allowPatterns: "",
      matchChannel: true,
      mode: "hide",
      showFloatingCounter: true,
      skipBlockedOnPlayback: true,
    };
  }

  function normalizeSettings(o) {
    if (o.mode === "dim") o.mode = "test";
    if (o.skipBlockedOnPlayback !== false) o.skipBlockedOnPlayback = true;
    return o;
  }

  function loadSettings(cb) {
    chrome.storage.local.get(STORAGE_KEY, function (data) {
      var raw = data[STORAGE_KEY];
      var o = normalizeSettings(Object.assign({}, defaults(), raw || {}));
      cb(o);
    });
  }

  function isFloatingDismissedInSession() {
    try {
      return sessionStorage.getItem(SESSION_FLOATING_DISMISSED) === "1";
    } catch (e) {
      return false;
    }
  }

  /** Matches row tags in content/youtube.js + content/ytmusic.js (light DOM only; shadow-internal rows rely on fast first pass). */
  var BOOT_ROW_SELECTOR =
    "ytd-video-renderer,ytd-rich-item-renderer,ytd-compact-video-renderer,ytd-rich-grid-media," +
    "ytd-playlist-video-renderer,ytd-channel-video-renderer,ytd-grid-video-renderer,ytd-reel-item-renderer," +
    "ytd-compact-radio-renderer,ytd-compact-movie-renderer,ytd-movie-renderer,ytd-playlist-panel-video-renderer," +
    "ytd-compact-playlist-renderer,ytd-grid-playlist-renderer,ytd-radio-renderer,ytd-promoted-video-renderer," +
    "yt-lockup-view-model,ytd-playlist-renderer,ytd-channel-renderer,ytd-grid-show-renderer,ytd-rich-metadata-renderer," +
    "ytd-compact-autoplay-renderer,ytd-vertical-watch-card-renderer,ytd-grid-game-renderer,ytd-game-details-renderer," +
    "ytd-post-renderer," +
    "ytmusic-responsive-list-item-renderer,ytmusic-two-row-item-renderer,ytmusic-queue-item-renderer," +
    "ytmusic-list-item-renderer,ytmusic-entity-row-renderer,ytmusic-playlist-item-renderer," +
    "ytmusic-material-list-item-renderer";

  var BOOTING_CLASS = "lazy-remix-filter-booting";
  var bootPhasePending = true;
  var bootSafetyTimer = null;

  function bootPhaseStart() {
    try {
      document.documentElement.classList.add(BOOTING_CLASS);
    } catch (e) {}
    if (bootSafetyTimer) {
      clearTimeout(bootSafetyTimer);
      bootSafetyTimer = null;
    }
    bootSafetyTimer = setTimeout(function () {
      bootSafetyTimer = null;
      clearBootingIfFirst();
    }, 5000);
  }

  /**
   * Removes boot overlay after the first filter pass so rows are not shown unclassified.
   * Safe to call multiple times; only the first call clears the class.
   */
  function clearBootingIfFirst() {
    if (bootSafetyTimer) {
      clearTimeout(bootSafetyTimer);
      bootSafetyTimer = null;
    }
    if (!bootPhasePending) return;
    bootPhasePending = false;
    try {
      document.documentElement.classList.remove(BOOTING_CLASS);
    } catch (e2) {}
  }

  /**
   * @param {{ skipBoot?: boolean }} [opts] — YouTube Music uses skipBoot so the boot overlay never dims the player.
   */
  function injectStyles(opts) {
    if (document.getElementById("lazy-remix-filter-styles")) return;
    opts = opts || {};
    var style = document.createElement("style");
    style.id = "lazy-remix-filter-styles";
    var parts = [];
    if (!opts.skipBoot) {
      var bootSel =
        "html." +
        BOOTING_CLASS +
        " " +
        BOOT_ROW_SELECTOR.split(",")
          .map(function (s) {
            return s.trim();
          })
          .join(", html." + BOOTING_CLASS + " ");
      parts.push(
        bootSel +
          "{opacity:0!important;pointer-events:none!important;}" +
          "html." +
          BOOTING_CLASS +
          " ytmusic-player video,html." +
          BOOTING_CLASS +
          " ytmusic-player ytmusic-video{opacity:1!important;pointer-events:auto!important;}" +
          "html." +
          BOOTING_CLASS +
          " .lazy-remix-filter-test{opacity:1!important;pointer-events:auto!important;visibility:visible!important;}"
      );
    }
    parts.push(
      ".lazy-remix-filter-hidden{display:none!important;}" +
      ".lazy-remix-filter-test{position:relative!important;opacity:1!important;visibility:visible!important;" +
      "outline:3px solid rgba(220,60,120,0.95)!important;outline-offset:2px!important;" +
      "box-shadow:inset 0 0 0 2px rgba(255,200,120,0.4),0 0 0 1px rgba(200,60,100,0.35)!important;" +
      "background:rgba(240,70,110,0.14)!important;}" +
      ".lazy-remix-filter-test::after{content:\"Would block\";position:absolute;top:6px;right:6px;z-index:100;" +
      "font:600 11px/1.2 system-ui,Segoe UI,sans-serif;padding:3px 8px;border-radius:6px;" +
      "background:rgba(200,40,85,0.96);color:#fff;pointer-events:none;" +
      "box-shadow:0 1px 4px rgba(0,0,0,0.35);letter-spacing:0.02em;}" +
      "#lazy-remix-filter-floating-count{position:fixed;bottom:14px;right:14px;z-index:2147483646;" +
      "max-width:min(92vw,300px);pointer-events:auto;font:12px/1.35 system-ui,Segoe UI,sans-serif;}" +
      "#lazy-remix-filter-floating-count .lazy-remix-filter-chip{display:flex;align-items:center;gap:8px;" +
      "padding:8px 8px 8px 12px;border-radius:12px;color:#f0f0f8;" +
      "background:rgba(22,22,32,0.94);border:1px solid rgba(255,255,255,0.14);" +
      "box-shadow:0 4px 24px rgba(0,0,0,0.45),0 0 0 1px rgba(0,0,0,0.2);" +
      "backdrop-filter:saturate(1.2) blur(10px);-webkit-backdrop-filter:saturate(1.2) blur(10px);}" +
      "#lazy-remix-filter-floating-count .lazy-remix-filter-chip-text{flex:1;min-width:0;}" +
      "#lazy-remix-filter-floating-count .lazy-remix-filter-chip-dismiss{flex-shrink:0;" +
      "display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin:0;padding:0;" +
      "border:none;border-radius:999px;cursor:pointer;font-size:18px;line-height:1;color:rgba(255,255,255,0.85);" +
      "background:rgba(255,255,255,0.08);transition:background .15s,color .15s;}" +
      "#lazy-remix-filter-floating-count .lazy-remix-filter-chip-dismiss:hover{background:rgba(255,255,255,0.16);color:#fff;}" +
      "#lazy-remix-filter-floating-count .lazy-remix-filter-chip-dismiss:focus{outline:2px solid rgba(140,160,255,0.9);outline-offset:2px;}" +
      "#lazy-remix-filter-floating-count .lazy-remix-filter-chip-dismiss:focus:not(:focus-visible){outline:none;}"
    );
    style.textContent = parts.join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function removeFloatingChip() {
    var el = document.getElementById("lazy-remix-filter-floating-count");
    if (el) el.remove();
  }

  function reportBlockedCount(count, showFloating, mode) {
    try {
      chrome.runtime.sendMessage({
        type: "LAZY_REMIX_BLOCKED_COUNT",
        count: count,
      });
    } catch (e) {}
    if (showFloating === false) {
      removeFloatingChip();
      return;
    }
    if (isFloatingDismissedInSession()) {
      return;
    }

    var wrap = document.getElementById("lazy-remix-filter-floating-count");
    var labelText;
    if (mode === "test") {
      labelText =
        count === 1 ? "1 would be blocked (test)" : count + " would be blocked (test)";
    } else {
      labelText =
        count === 1 ? "1 lazy remix hidden" : count + " lazy remixes hidden";
    }

    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "lazy-remix-filter-floating-count";
      wrap.setAttribute("role", "status");
      wrap.setAttribute("aria-live", "polite");

      var chip = document.createElement("div");
      chip.className = "lazy-remix-filter-chip";

      var textSpan = document.createElement("span");
      textSpan.className = "lazy-remix-filter-chip-text";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lazy-remix-filter-chip-dismiss";
      btn.setAttribute("aria-label", "Hide counter");
      btn.appendChild(document.createTextNode("\u00d7"));

      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        try {
          sessionStorage.setItem(SESSION_FLOATING_DISMISSED, "1");
        } catch (e2) {}
        removeFloatingChip();
      });

      chip.appendChild(textSpan);
      chip.appendChild(btn);
      wrap.appendChild(chip);

      var root = document.body || document.documentElement;
      if (root) root.appendChild(wrap);
    }

    var textEl = wrap.querySelector(".lazy-remix-filter-chip-text");
    if (textEl) textEl.textContent = labelText;
  }

  function applyToRow(row, blocked, mode) {
    if (!row) return;
    row.classList.remove("lazy-remix-filter-hidden", "lazy-remix-filter-dim", "lazy-remix-filter-test");
    if (!blocked) return;
    if (mode === "test") row.classList.add("lazy-remix-filter-test");
    else row.classList.add("lazy-remix-filter-hidden");
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  /**
   * Query within root, including shadow roots (depth-first).
   * @param {Element|ShadowRoot} root
   * @param {string} sel
   * @returns {Element|null}
   */
  function deepQuerySelector(root, sel) {
    if (!root || !sel) return null;
    try {
      var direct = root.querySelector(sel);
      if (direct) return direct;
    } catch (e) {
      return null;
    }
    var all = root.querySelectorAll("*");
    var i;
    for (i = 0; i < all.length; i++) {
      var node = all[i];
      if (node.shadowRoot) {
        var found = deepQuerySelector(node.shadowRoot, sel);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * querySelectorAll on root and every shadowRoot under it (YouTube Music player / queue use shadow DOM).
   * @param {Element|ShadowRoot|Document} root
   * @param {string} selectorString
   * @returns {Element[]}
   */
  function querySelectorAllDeep(root, selectorString) {
    var seen = new Set();
    var out = [];
    function walk(r) {
      if (!r) return;
      try {
        r.querySelectorAll(selectorString).forEach(function (el) {
          if (!seen.has(el)) {
            seen.add(el);
            out.push(el);
          }
        });
      } catch (e) {}
      var all = r.querySelectorAll("*");
      var i;
      for (i = 0; i < all.length; i++) {
        if (all[i].shadowRoot) walk(all[i].shadowRoot);
      }
    }
    walk(root);
    return out;
  }

  function textFromElement(el) {
    if (!el) return "";
    var t = el.getAttribute && el.getAttribute("title");
    if (t && t.trim()) return t.trim();
    if (el.textContent && el.textContent.trim()) return el.textContent.trim();
    return "";
  }

  globalThis.LazyRemixContent = {
    STORAGE_KEY: STORAGE_KEY,
    SESSION_FLOATING_DISMISSED: SESSION_FLOATING_DISMISSED,
    defaults: defaults,
    loadSettings: loadSettings,
    injectStyles: injectStyles,
    bootPhaseStart: bootPhaseStart,
    clearBootingIfFirst: clearBootingIfFirst,
    applyToRow: applyToRow,
    debounce: debounce,
    reportBlockedCount: reportBlockedCount,
    deepQuerySelector: deepQuerySelector,
    querySelectorAllDeep: querySelectorAllDeep,
    textFromElement: textFromElement,
    clearFloatingDismiss: function () {
      try {
        sessionStorage.removeItem(SESSION_FLOATING_DISMISSED);
      } catch (e) {}
    },
  };
})();
