"use strict";
/**
 * workspace.js — file I/O and workspace indexing for the main process.
 */
const path = require("path");
const fs   = require("fs/promises");
const { existsSync } = require("fs");
const logger = require("./logger");

const IGNORED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next", ".nuxt",
  "coverage", ".turbo", ".cache", "__pycache__", ".venv", "venv",
]);

const TEXT_EXTS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".cjs", ".mjs",
  ".json", ".jsonc", ".md", ".txt",
  ".css", ".scss", ".less",
  ".html", ".htm", ".vue", ".svelte",
  ".yml", ".yaml", ".toml", ".xml", ".svg", ".ini", ".cfg", ".conf",
  ".env", ".sql", ".graphql", ".gql", ".proto",
  ".py", ".go", ".rs", ".java", ".kt", ".kts", ".cs", ".vb",
  ".php", ".rb", ".swift", ".dart", ".lua", ".r", ".scala", ".pl", ".pm",
  ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx",
  ".sh", ".bash", ".zsh", ".ps1", ".psm1", ".bat", ".cmd",
  ".gitignore", ".dockerignore", ".editorconfig", ".log",
]);

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp",
  ".pdf", ".zip", ".rar", ".7z", ".exe", ".dll", ".so", ".dylib",
  ".woff", ".woff2", ".ttf", ".eot",
  ".mp3", ".wav", ".mp4", ".mov", ".avi",
]);

const MAX_FILE_SIZE = 300_000;
const MAX_FILES     = 2_000;

function isTextLike(filePath) {
  const lower = String(filePath || "").toLowerCase();
  const base  = path.basename(lower);
  if (base === "dockerfile" || base === "makefile") return true;
  const ext = path.extname(lower);
  if (TEXT_EXTS.has(ext))   return true;
  if (BINARY_EXTS.has(ext)) return false;
  return !ext || ext.length <= 6;
}

async function readTextFile(abs) {
  const buf = await fs.readFile(abs);
  // Detect binary by checking for null bytes in the first 2 KB
  const sample = buf.subarray(0, Math.min(buf.length, 2000));
  if (sample.includes(0)) throw new Error("binary_file");
  return buf.toString("utf8");
}

/**
 * Build a lightweight index: only paths + stats, no content.
 * Content is fetched lazily via readFile IPC.
 */
async function buildIndex(rootDir) {
  if (!rootDir || !existsSync(rootDir)) return null;
  const index = {}; // rel -> { size, lines: null }
  const stats = { fileCount: 0, lineCount: 0 };
  let count = 0;

  async function walk(dir) {
    if (count >= MAX_FILES) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (count >= MAX_FILES) return;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
      if (!rel) continue;

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) await walk(abs);
        continue;
      }
      if (!entry.isFile() || !isTextLike(abs)) continue;

      try {
        const st = await fs.stat(abs);
        if (st.size > MAX_FILE_SIZE) continue;
        index[rel] = { size: st.size };
        stats.fileCount++;
        count++;
      } catch { /* skip */ }
    }
  }

  await walk(rootDir);
  return { rootDir, index, stats };
}

/**
 * Full snapshot (legacy / small projects) — reads all file content.
 * For large workspaces, prefer buildIndex + lazy reads.
 */
async function buildSnapshot(rootDir) {
  if (!rootDir || !existsSync(rootDir)) return null;
  const files = {};
  const stats = { fileCount: 0, lineCount: 0 };
  let count = 0;

  async function walk(dir) {
    if (count >= MAX_FILES) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (count >= MAX_FILES) return;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
      if (!rel) continue;

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) await walk(abs);
        continue;
      }
      if (!entry.isFile() || !isTextLike(abs)) continue;

      try {
        const st = await fs.stat(abs);
        if (st.size > MAX_FILE_SIZE) continue;
        const content = await readTextFile(abs);
        files[rel] = content;
        stats.fileCount++;
        stats.lineCount += content.split("\n").length;
        count++;
      } catch { /* skip unreadable files */ }
    }
  }

  await walk(rootDir);
  return { rootDir, files, stats };
}

function guardPath(rootDir, relativePath) {
  if (path.isAbsolute(String(relativePath || ""))) throw new Error("Path traversal detected");
  const abs  = path.resolve(path.join(rootDir, relativePath));
  const root = path.resolve(rootDir);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error("Path traversal detected");
  return abs;
}

async function readFile(rootDir, relativePath) {
  const abs = guardPath(rootDir, relativePath);
  return readTextFile(abs);
}

async function writeFile(rootDir, relativePath, content) {
  const abs = guardPath(rootDir, relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

async function createFile(rootDir, relativePath, content = "") {
  return writeFile(rootDir, relativePath, content);
}

async function createFolder(rootDir, relativePath) {
  const abs = guardPath(rootDir, relativePath);
  await fs.mkdir(abs, { recursive: true });
}

async function renamePath(rootDir, fromPath, toPath) {
  // Use guardPath for both sides — catches absolute paths and traversal attempts
  const fromAbs = guardPath(rootDir, fromPath);
  const toAbs   = guardPath(rootDir, toPath);
  await fs.mkdir(path.dirname(toAbs), { recursive: true });
  await fs.rename(fromAbs, toAbs);
}

async function deletePath(rootDir, relativePath) {
  const abs = guardPath(rootDir, relativePath);
  await fs.rm(abs, { recursive: true, force: true });
}

module.exports = { buildSnapshot, buildIndex, readFile, writeFile, createFile, createFolder, renamePath, deletePath };
