"use strict";
/**
 * git.js — all git operations for the main process.
 * Uses execFile (not exec) to avoid shell injection.
 */
const { execFile } = require("child_process");
const { existsSync } = require("fs");
const logger = require("./logger");

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile("git", args, {
      cwd,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 4,
    }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout || "";
        err.stderr = stderr || "";
        reject(err);
        return;
      }
      resolve({ stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

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
    const filePath = (raw.includes(" -> ") ? raw.split(" -> ").pop() : raw).replace(/\\/g, "/");
    if (!filePath) continue;

    const isUntracked = x === "?" && y === "?";
    const isStaged    = x !== " " && !isUntracked;
    const isUnstaged  = y !== " ";

    files.push({
      path: filePath,
      x, y,
      staged:    isStaged,
      unstaged:  isUnstaged,
      untracked: isUntracked,
      label: isUntracked ? "Untracked"
           : isStaged && isUnstaged ? "Staged + modified"
           : isStaged   ? "Staged"
           : isUnstaged ? "Modified"
           : "Changed",
    });

    if (isUntracked) { untracked++; continue; }
    if (isStaged)   staged++;
    if (isUnstaged) unstaged++;
  }

  return { branch, ahead, behind, staged, unstaged, untracked,
           changed: staged + unstaged + untracked,
           dirty: staged + unstaged + untracked > 0, files };
}

async function getStatus(rootDir) {
  if (!rootDir || !existsSync(rootDir)) return { ok: false, available: false };
  try {
    const check = await run(["-C", rootDir, "rev-parse", "--is-inside-work-tree"]);
    if (!check.stdout.trim().toLowerCase().includes("true")) {
      return { ok: true, available: false };
    }
    const status = await run(["-C", rootDir, "status", "--porcelain=1", "--branch"]);
    return { ok: true, available: true, ...parseStatus(status.stdout) };
  } catch (err) {
    const msg = String(err?.stderr || err?.message || "").toLowerCase();
    if (msg.includes("not a git repository")) return { ok: true, available: false };
    logger.warn("git getStatus failed:", err?.message);
    return { ok: false, available: false, error: err?.stderr || err?.message };
  }
}

async function getDiff(rootDir, relativePath) {
  if (!rootDir || !relativePath || !existsSync(rootDir)) {
    return { ok: false, diff: "", error: "Missing workspace or file path" };
  }
  try {
    const [staged, unstaged] = await Promise.all([
      run(["-C", rootDir, "diff", "--cached", "--", relativePath]),
      run(["-C", rootDir, "diff", "--", relativePath]),
    ]);
    const parts = [];
    if (staged.stdout) parts.push(`--- Staged ---\n${staged.stdout}`);
    if (unstaged.stdout) parts.push(`--- Unstaged ---\n${unstaged.stdout}`);
    return { ok: true, diff: parts.join("\n\n") };
  } catch (err) {
    logger.warn("git getDiff failed:", err?.message);
    return { ok: false, diff: "", error: err?.stderr || err?.message };
  }
}

async function runAction(rootDir, action, relativePath = "") {
  if (!rootDir || !existsSync(rootDir)) return { ok: false, error: "Missing workspace root" };
  const p = String(relativePath || "").replace(/\\/g, "/");

  // Validate action whitelist — prevents arbitrary git command injection
  const allowed = ["stage", "unstage", "discard", "stage-all", "unstage-all"];
  if (!allowed.includes(action)) return { ok: false, error: "Unsupported git action" };

  try {
    switch (action) {
      case "stage":       await run(["-C", rootDir, "add",     "--", p]); break;
      case "unstage":     await run(["-C", rootDir, "reset",   "HEAD", "--", p]); break;
      case "discard":
        try { await run(["-C", rootDir, "restore", "--", p]); }
        catch (e) {
          if (String(e?.stderr || "").toLowerCase().includes("did not match")) {
            await run(["-C", rootDir, "clean", "-f", "--", p]);
          } else throw e;
        }
        break;
      case "stage-all":   await run(["-C", rootDir, "add",   "-A"]); break;
      case "unstage-all": await run(["-C", rootDir, "reset", "HEAD", "--", "."]); break;
    }
    return { ok: true };
  } catch (err) {
    logger.warn(`git runAction(${action}) failed:`, err?.message);
    return { ok: false, error: err?.stderr || err?.message };
  }
}

async function commit(rootDir, message) {
  if (!rootDir || !message?.trim()) return { ok: false, error: "Missing rootDir or commit message" };
  try {
    await run(["-C", rootDir, "commit", "-m", message.trim()]);
    return { ok: true };
  } catch (err) {
    logger.warn("git commit failed:", err?.message);
    return { ok: false, error: err?.stderr || err?.message };
  }
}



async function getLog(rootDir, limit = 30) {
  if (!rootDir || !existsSync(rootDir)) return { ok: false, commits: [] };
  try {
    const { stdout } = await run(["-C", rootDir, "log",
      "--pretty=format:%H|||%h|||%an|||%ae|||%ar|||%s",
      "-n", String(Number(limit) || 30)]);
    const commits = stdout.trim().split("\n").filter(Boolean).map(line => {
      const [hash, short, author, email, date, ...msgParts] = line.split("|||");
      return { hash, short, author, email, date, message: msgParts.join("|||") };
    });
    return { ok: true, commits };
  } catch (err) {
    logger.warn("git getLog failed:", err?.message);
    return { ok: false, commits: [], error: err?.message };
  }
}

async function getBranches(rootDir) {
  if (!rootDir || !existsSync(rootDir)) return { ok: false, branches: [] };
  try {
    const { stdout } = await run(["-C", rootDir, "branch", "--format=%(refname:short)"]);
    const branches = stdout.trim().split("\n").filter(Boolean);
    return { ok: true, branches };
  } catch (err) {
    return { ok: false, branches: [], error: err?.message };
  }
}

async function checkout(rootDir, branch) {
  if (!rootDir || !branch) return { ok: false, error: "Missing rootDir or branch" };
  try {
    await run(["-C", rootDir, "checkout", branch]);
    return { ok: true };
  } catch (err) {
    logger.warn("git checkout failed:", err?.message);
    return { ok: false, error: err?.stderr || err?.message };
  }
}

async function createBranch(rootDir, branch) {
  if (!rootDir || !branch) return { ok: false, error: "Missing rootDir or branch" };
  try {
    await run(["-C", rootDir, "checkout", "-b", branch]);
    return { ok: true };
  } catch (err) {
    logger.warn("git createBranch failed:", err?.message);
    return { ok: false, error: err?.stderr || err?.message };
  }
}

async function getCommitDiff(rootDir, hash) {
  if (!rootDir || !hash || !existsSync(rootDir)) return { ok: false, diff: "" };
  // Sanitise hash — only allow hex chars (prevent shell injection via IPC)
  const safeHash = String(hash || "").replace(/[^0-9a-fA-F]/g, "").slice(0, 40);
  if (!safeHash) return { ok: false, diff: "", error: "Invalid commit hash" };
  try {
    const { stdout } = await run(["-C", rootDir, "show", "--stat", "--patch", safeHash]);
    return { ok: true, diff: stdout };
  } catch (err) {
    logger.warn("git getCommitDiff failed:", err?.message);
    return { ok: false, diff: "", error: err?.stderr || err?.message };
  }
}

module.exports = { getStatus, getDiff, runAction, commit, getLog, getBranches, checkout, createBranch, getCommitDiff };
