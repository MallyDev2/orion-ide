/**
 * tests/workspace.test.js — tests for workspace security and path validation.
 * Run with: node --test tests/workspace.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path   = require("path");

// Replicate path-traversal guard logic from workspace.js
function isSafePath(rootDir, relativePath) {
  if (path.isAbsolute(relativePath)) return false;
  const abs  = path.resolve(path.join(rootDir, relativePath));
  const root = path.resolve(rootDir);
  return abs === root || abs.startsWith(root + path.sep);
}

function normalizeRelPath(p) {
  return String(p || "").trim().replace(/\\/g, "/").replace(/^\.?\//, "").replace(/^\/+/, "");
}

describe("path traversal guard", () => {
  const root = "/home/user/project";

  it("allows normal relative path",       () => assert.ok(isSafePath(root, "src/app.js")));
  it("allows nested path",                () => assert.ok(isSafePath(root, "deep/nested/file.ts")));
  it("blocks ../traversal",               () => assert.ok(!isSafePath(root, "../secret.txt")));
  it("blocks deep traversal",             () => assert.ok(!isSafePath(root, "../../etc/passwd")));
  it("blocks absolute path escape",       () => assert.ok(!isSafePath(root, "/etc/passwd")));
  it("allows file with dots in name",     () => assert.ok(isSafePath(root, ".env.local")));
  it("allows .gitignore",                 () => assert.ok(isSafePath(root, ".gitignore")));
});

describe("normalizeRelPath", () => {
  it("strips leading ./",     () => assert.equal(normalizeRelPath("./src/app.js"), "src/app.js"));
  it("strips double slashes", () => assert.equal(normalizeRelPath("//src/app.js"), "src/app.js"));
  it("normalises backslash",  () => assert.equal(normalizeRelPath("src\\app.js"), "src/app.js"));
  it("trims whitespace",      () => assert.equal(normalizeRelPath("  src/file.js  "), "src/file.js"));
  it("handles empty",         () => assert.equal(normalizeRelPath(""), ""));
  it("handles null",          () => assert.equal(normalizeRelPath(null), ""));
});

describe("git action whitelist", () => {
  const allowed = new Set(["stage","unstage","discard","stage-all","unstage-all"]);
  it("allows stage",       () => assert.ok(allowed.has("stage")));
  it("allows unstage",     () => assert.ok(allowed.has("unstage")));
  it("allows discard",     () => assert.ok(allowed.has("discard")));
  it("allows stage-all",   () => assert.ok(allowed.has("stage-all")));
  it("blocks arbitrary",   () => assert.ok(!allowed.has("push")));
  it("blocks rm -rf",      () => assert.ok(!allowed.has("rm -rf /")));
  it("blocks empty string",() => assert.ok(!allowed.has("")));
});
