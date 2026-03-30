/**
 * Run: node tests/filter.test.mjs
 */
import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, "../lib/filter.js"), "utf8");
const sandbox = { globalThis: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const F = sandbox.LazyRemixFilter;

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

const base = { blockPatterns: "slowed", allowPatterns: "", matchChannel: true };
assert(F.shouldBlock("Song slowed", "", base) === true);
assert(F.shouldBlock("Clean title", "", base) === false);

const allow = { blockPatterns: "slowed", allowPatterns: "official", matchChannel: true };
assert(F.shouldBlock("Song slowed official", "", allow) === false);

const ch = { blockPatterns: "bad", allowPatterns: "", matchChannel: true };
assert(F.shouldBlock("x", "bad channel", ch) === true);

const chOff = { blockPatterns: "bad", allowPatterns: "good", matchChannel: true };
assert(F.shouldBlock("x", "good vibes", chOff) === false);

const noCh = { blockPatterns: "bad", allowPatterns: "", matchChannel: false };
assert(F.shouldBlock("x", "bad channel", noCh) === false);

const emptyUsesDefault = { blockPatterns: "", allowPatterns: "", matchChannel: true };
assert(F.shouldBlock("nightcore mix", "", emptyUsesDefault) === true);

const regexLine = { blockPatterns: "regex:^slowed$", allowPatterns: "", matchChannel: true };
assert(F.shouldBlock("slowed", "", regexLine) === true);
assert(F.shouldBlock("slowed remix", "", regexLine) === false);

const meme = { blockPatterns: "best part\nwhat not", allowPatterns: "", matchChannel: true };
assert(F.shouldBlock("Song (best part)", "", meme) === true);
assert(F.shouldBlock("and what not edit", "", meme) === true);
assert(F.shouldBlock("Clean", "", meme) === false);

console.log("filter.test.mjs: all passed");
