(function () {
  "use strict";

  var STORAGE_KEY = "lazyRemixSettings";
  var F = globalThis.LazyRemixFilter;

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

  function defaultBlockText() {
    return F.DEFAULT_BLOCK_LINES.join("\n");
  }

  function getElements() {
    return {
      enabled: document.getElementById("enabled"),
      matchChannel: document.getElementById("matchChannel"),
      showFloatingCounter: document.getElementById("showFloatingCounter"),
      mode: document.getElementById("mode"),
      skipBlockedOnPlayback: document.getElementById("skipBlockedOnPlayback"),
      blockPatterns: document.getElementById("blockPatterns"),
      allowPatterns: document.getElementById("allowPatterns"),
      save: document.getElementById("save"),
      status: document.getElementById("status"),
      exportBtn: document.getElementById("exportBtn"),
      importBtn: document.getElementById("importBtn"),
      importFile: document.getElementById("importFile"),
      resetBlockDefaults: document.getElementById("resetBlockDefaults"),
    };
  }

  function showStatus(el, msg, ok) {
    el.textContent = msg;
    el.style.color = ok ? "#7ad67a" : "#f0a0a0";
    if (msg) {
      clearTimeout(showStatus._t);
      showStatus._t = setTimeout(function () {
        el.textContent = "";
      }, 3500);
    }
  }

  function load() {
    var ui = getElements();
    chrome.storage.local.get(STORAGE_KEY, function (data) {
      var raw = data[STORAGE_KEY];
      var o = Object.assign({}, defaults(), raw || {});
      ui.enabled.checked = !!o.enabled;
      ui.matchChannel.checked = o.matchChannel !== false;
      ui.showFloatingCounter.checked = o.showFloatingCounter !== false;
      ui.skipBlockedOnPlayback.checked = o.skipBlockedOnPlayback !== false;
      ui.mode.value = o.mode === "test" || o.mode === "dim" ? "test" : "hide";
      if (raw && Object.prototype.hasOwnProperty.call(raw, "blockPatterns")) {
        ui.blockPatterns.value = o.blockPatterns;
      } else {
        ui.blockPatterns.value = defaultBlockText();
      }
      ui.allowPatterns.value = o.allowPatterns || "";
    });
  }

  function gather() {
    var ui = getElements();
    return {
      enabled: ui.enabled.checked,
      matchChannel: ui.matchChannel.checked,
      showFloatingCounter: ui.showFloatingCounter.checked,
      mode: ui.mode.value === "test" ? "test" : "hide",
      skipBlockedOnPlayback: ui.skipBlockedOnPlayback.checked,
      blockPatterns: ui.blockPatterns.value,
      allowPatterns: ui.allowPatterns.value,
    };
  }

  function save() {
    var ui = getElements();
    var payload = {};
    payload[STORAGE_KEY] = gather();
    chrome.storage.local.set(payload, function () {
      if (chrome.runtime.lastError) {
        showStatus(ui.status, chrome.runtime.lastError.message || "Save failed", false);
        return;
      }
      showStatus(ui.status, "Saved.", true);
    });
  }

  function exportJson() {
    var ui = getElements();
    var obj = gather();
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lazy-remix-filter-settings.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showStatus(ui.status, "Exported.", true);
  }

  function importFromFile(file) {
    var ui = getElements();
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid JSON");
        var o = Object.assign({}, defaults(), parsed);
        ui.enabled.checked = !!o.enabled;
        ui.matchChannel.checked = o.matchChannel !== false;
        ui.showFloatingCounter.checked = o.showFloatingCounter !== false;
        ui.skipBlockedOnPlayback.checked = o.skipBlockedOnPlayback !== false;
        ui.mode.value = o.mode === "test" || o.mode === "dim" ? "test" : "hide";
        ui.blockPatterns.value =
          typeof o.blockPatterns === "string" ? o.blockPatterns : defaultBlockText();
        ui.allowPatterns.value = typeof o.allowPatterns === "string" ? o.allowPatterns : "";
        var payload = {};
        payload[STORAGE_KEY] = gather();
        chrome.storage.local.set(payload, function () {
          if (chrome.runtime.lastError) {
            showStatus(ui.status, chrome.runtime.lastError.message || "Import failed", false);
            return;
          }
          showStatus(ui.status, "Imported and saved.", true);
        });
      } catch (e) {
        showStatus(ui.status, "Invalid file: " + (e && e.message ? e.message : "parse error"), false);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var ui = getElements();
    load();
    ui.save.addEventListener("click", save);
    ui.exportBtn.addEventListener("click", exportJson);
    ui.importBtn.addEventListener("click", function () {
      ui.importFile.click();
    });
    ui.importFile.addEventListener("change", function () {
      var f = ui.importFile.files && ui.importFile.files[0];
      ui.importFile.value = "";
      if (f) importFromFile(f);
    });
    if (ui.resetBlockDefaults) {
      ui.resetBlockDefaults.addEventListener("click", function () {
        ui.blockPatterns.value = defaultBlockText();
        var payload = {};
        payload[STORAGE_KEY] = gather();
        chrome.storage.local.set(payload, function () {
          if (chrome.runtime.lastError) {
            showStatus(ui.status, chrome.runtime.lastError.message || "Reset failed", false);
            return;
          }
          showStatus(ui.status, "Block list reset to defaults and saved.", true);
        });
      });
    }
  });
})();
