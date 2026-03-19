/**
 * tests/git.test.js — unit tests for git status parsing.
 * Run with: node --test tests/git.test.js
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Pull out the pure parseStatus function by re-implementing it here
// (or you could export it from git.js — see note below)
function parseStatus(output) {
  const lines = String(output || "").split(/\r?\n/).filter(Boolean);
  const branchLine = lines.find(l => l.startsWith("## ")) || "";
  let branch = "unknown", ahead = 0, behind = 0;

  if (branchLine) {
    const summary = branchLine.slice(3).trim();
    const bm = summary.match(/^([^.\s]+)(?:\.\.\.)?/);
    if (bm?.[1]) branch = bm[1];
    const am = summary.match(/ahead (\d+)/);
    const beh = summary.match(/behind (\d+)/);
    ahead  = am  ? Number(am[1])  : 0;
    behind = beh ? Number(beh[1]) : 0;
  }

  let staged = 0, unstaged = 0, untracked = 0;
  const files = [];
  for (const line of lines) {
    if (line.startsWith("## ")) continue;
    const x = line[0] || " ", y = line[1] || " ";
    const raw = line.slice(3).trim();
    const fp = (raw.includes(" -> ") ? raw.split(" -> ").pop() : raw).replace(/\\/g, "/");
    if (!fp) continue;
    const isUntracked = x === "?" && y === "?";
    const isStaged    = x !== " " && !isUntracked;
    const isUnstaged  = y !== " ";
    files.push({ path: fp, x, y, staged: isStaged, unstaged: isUnstaged, untracked: isUntracked });
    if (isUntracked) { untracked++; continue; }
    if (isStaged)   staged++;
    if (isUnstaged) unstaged++;
  }
  return { branch, ahead, behind, staged, unstaged, untracked,
           changed: staged + unstaged + untracked,
           dirty: staged + unstaged + untracked > 0, files };
}

describe("parseStatus", () => {
  it("parses a clean branch", () => {
    const out = "## main...origin/main\n";
    const r = parseStatus(out);
    assert.equal(r.branch, "main");
    assert.equal(r.dirty, false);
    assert.equal(r.changed, 0);
    assert.equal(r.files.length, 0);
  });

  it("parses ahead/behind", () => {
    const out = "## main...origin/main [ahead 2, behind 1]\n";
    const r = parseStatus(out);
    assert.equal(r.ahead,  2);
    assert.equal(r.behind, 1);
  });

  it("parses staged file", () => {
    const out = "## main\nM  src/app.js\n";
    const r = parseStatus(out);
    assert.equal(r.staged, 1);
    assert.equal(r.files[0].staged, true);
    assert.equal(r.files[0].path, "src/app.js");
  });

  it("parses unstaged file", () => {
    const out = "## main\n M src/app.js\n";
    const r = parseStatus(out);
    assert.equal(r.unstaged, 1);
    assert.equal(r.files[0].unstaged, true);
  });

  it("parses untracked file", () => {
    const out = "## main\n?? newfile.js\n";
    const r = parseStatus(out);
    assert.equal(r.untracked, 1);
    assert.equal(r.files[0].untracked, true);
  });

  it("parses rename with arrow", () => {
    const out = "## main\nR  old.js -> new.js\n";
    const r = parseStatus(out);
    assert.equal(r.files[0].path, "new.js");
  });

  it("normalises windows backslash paths", () => {
    const out = "## main\nM  src\\app.js\n";
    const r = parseStatus(out);
    assert.equal(r.files[0].path, "src/app.js");
  });

  it("counts dirty correctly with mixed types", () => {
    const out = "## main\nM  staged.js\n M unstaged.js\n?? untracked.js\n";
    const r = parseStatus(out);
    assert.equal(r.dirty, true);
    assert.equal(r.staged, 1);
    assert.equal(r.unstaged, 1);
    assert.equal(r.untracked, 1);
    assert.equal(r.changed, 3);
  });

  it("returns empty files on empty output", () => {
    const r = parseStatus("");
    assert.equal(r.files.length, 0);
    assert.equal(r.dirty, false);
  });
});
