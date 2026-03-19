/**
 * tests/utils.test.js — unit tests for pure utility functions.
 * Run with: node --test tests/utils.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Inline the pure functions we want to test
// (no browser globals needed)

function normalizeRelPath(p) {
  return String(p || "").trim().replace(/\\/g, "/").replace(/^\.?\//, "").replace(/^\/+/, "");
}

function baseName(p) {
  return String(p || "").replace(/\\/g, "/").split("/").filter(Boolean).pop() || String(p || "");
}

function ext(fp) {
  return (String(fp || "").split(".").pop() || "").toLowerCase();
}

function inferLang(fp) {
  const lower = String(fp || "").toLowerCase();
  const file  = lower.split("/").pop() || "";
  if (file === "dockerfile") return "dockerfile";
  if (file === "makefile")   return "makefile";
  const map = {
    js:"javascript", ts:"typescript", jsx:"javascript", tsx:"typescript",
    py:"python", go:"go", rs:"rust", json:"json", css:"css", html:"html",
    md:"markdown", sh:"shell", yml:"yaml", yaml:"yaml",
  };
  return map[ext(fp)] || "plaintext";
}

function debounce(fn, ms = 200) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function countLines(text) { return text ? String(text).split("\n").length : 0; }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("normalizeRelPath", () => {
  it("strips leading ./", ()  => assert.equal(normalizeRelPath("./src/app.js"), "src/app.js"));
  it("strips leading /",  ()  => assert.equal(normalizeRelPath("/src/app.js"),  "src/app.js"));
  it("normalises backslash",  () => assert.equal(normalizeRelPath("src\\app.js"), "src/app.js"));
  it("handles empty string",  () => assert.equal(normalizeRelPath(""), ""));
  it("handles null",          () => assert.equal(normalizeRelPath(null), ""));
  it("trims whitespace",      () => assert.equal(normalizeRelPath("  src/app.js  "), "src/app.js"));
});

describe("baseName", () => {
  it("extracts filename",           () => assert.equal(baseName("src/app.js"),  "app.js"));
  it("handles windows path",        () => assert.equal(baseName("src\\app.js"), "app.js"));
  it("returns path if no slashes",  () => assert.equal(baseName("app.js"),      "app.js"));
  it("handles trailing slash",      () => assert.equal(baseName("src/"),        "src"));
});

describe("ext", () => {
  it("returns extension", () => assert.equal(ext("app.js"),      "js"));
  it("lowercases",        () => assert.equal(ext("App.TS"),       "ts"));
  it("handles no ext",    () => assert.equal(ext("makefile"),     "makefile"));
  it("handles empty",     () => assert.equal(ext(""),             ""));
});

describe("inferLang", () => {
  it("detects javascript",  () => assert.equal(inferLang("app.js"),       "javascript"));
  it("detects typescript",  () => assert.equal(inferLang("app.ts"),       "typescript"));
  it("detects python",      () => assert.equal(inferLang("main.py"),      "python"));
  it("detects dockerfile",  () => assert.equal(inferLang("Dockerfile"),   "dockerfile"));
  it("detects makefile",    () => assert.equal(inferLang("Makefile"),     "makefile"));
  it("detects yaml",        () => assert.equal(inferLang("config.yml"),   "yaml"));
  it("falls back to plain", () => assert.equal(inferLang("binary.blob"),  "plaintext"));
  it("handles path",        () => assert.equal(inferLang("src/index.tsx"),"typescript"));
});

describe("countLines", () => {
  it("counts single line",  () => assert.equal(countLines("hello"),      1));
  it("counts two lines",    () => assert.equal(countLines("a\nb"),       2));
  it("handles empty",       () => assert.equal(countLines(""),           0));
  it("handles null",        () => assert.equal(countLines(null),         0));
  it("counts trailing newline", () => assert.equal(countLines("a\n"),   2));
});

describe("debounce", () => {
  it("calls fn after delay", (_, done) => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 30);
    fn(); fn(); fn();
    setTimeout(() => {
      assert.equal(calls, 1);
      done();
    }, 60);
  });
});
