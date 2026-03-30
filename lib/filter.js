/**
 * Shared matching logic (no DOM). Exposed on globalThis for content scripts.
 */
(function () {
  "use strict";

  var DEFAULT_BLOCK_LINES = [
    "slowed",
    "reverb",
    "sped up",
    "speed up",
    "nightcore",
    "8d",
    "chipmunk",
    "bass boosted",
    "mashup",
    "tiktok version",
    "tik tok version",
    "best part",
    "what not",
  ];

  function trimLines(text) {
    if (!text || typeof text !== "string") return [];
    return text
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
  }

  /**
   * @param {string} line
   * @returns {{ type: 'substring', value: string } | { type: 'regex', re: RegExp } | null}
   */
  function parsePatternLine(line) {
    line = line.trim();
    if (!line) return null;
    if (line.toLowerCase().startsWith("regex:")) {
      var body = line.slice(6).trim();
      try {
        return { type: "regex", re: new RegExp(body, "i") };
      } catch (e) {
        return null;
      }
    }
    var m = line.match(/^\/(.+)\/([gimsuy]*)$/);
    if (m) {
      try {
        return { type: "regex", re: new RegExp(m[1], m[2] || "i") };
      } catch (e) {
        return null;
      }
    }
    return { type: "substring", value: line };
  }

  /**
   * @param {string[]} lines
   * @returns {Array<{ type: 'substring', value: string } | { type: 'regex', re: RegExp }>}
   */
  function compilePatterns(lines) {
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var p = parsePatternLine(lines[i]);
      if (p) out.push(p);
    }
    return out;
  }

  function normalizeText(s) {
    if (!s || typeof s !== "string") return s;
    return s.replace(/[\u200b-\u200f\ufeff\u200c\u200d]/g, "");
  }

  function matchPattern(pattern, haystack) {
    if (!haystack) return false;
    var hay = normalizeText(haystack);
    if (pattern.type === "substring") {
      return hay.toLowerCase().indexOf(pattern.value.toLowerCase()) !== -1;
    }
    pattern.re.lastIndex = 0;
    return pattern.re.test(hay);
  }

  /**
   * @param {string} title
   * @param {string} channel
   * @param {{ blockPatterns: string, allowPatterns: string, matchChannel: boolean }} settings
   * @returns {boolean} true if this item should be filtered (blocked)
   */
  function shouldBlock(title, channel, settings) {
    var blockText = settings.blockPatterns;
    var allowText = settings.allowPatterns;
    var matchChannel = settings.matchChannel !== false;

    var allowLines = trimLines(allowText);
    var allowCompiled = compilePatterns(allowLines);
    var hayTitle = normalizeText(title || "");
    var hayChannel = normalizeText(channel || "");
    var j;
    for (j = 0; j < allowCompiled.length; j++) {
      if (matchPattern(allowCompiled[j], hayTitle)) return false;
      if (matchChannel && matchPattern(allowCompiled[j], hayChannel)) return false;
    }

    var blockLines = trimLines(blockText);
    if (blockLines.length === 0) blockLines = DEFAULT_BLOCK_LINES.slice();
    var blockCompiled = compilePatterns(blockLines);
    var k;
    for (k = 0; k < blockCompiled.length; k++) {
      if (matchPattern(blockCompiled[k], hayTitle)) return true;
      if (matchChannel && matchPattern(blockCompiled[k], hayChannel)) return true;
    }
    return false;
  }

  globalThis.LazyRemixFilter = {
    DEFAULT_BLOCK_LINES: DEFAULT_BLOCK_LINES,
    trimLines: trimLines,
    parsePatternLine: parsePatternLine,
    compilePatterns: compilePatterns,
    shouldBlock: shouldBlock,
  };
})();
