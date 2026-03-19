"use strict";
/**
 * logger.js — structured rotating logger for the main process.
 *
 * FIX: app.getPath('userData') is only safe after app is ready.
 * We now lazily resolve the path and fall back to process.cwd()
 * if app hasn't initialised yet (e.g. during early require() time).
 */
const fs   = require("fs");
const path = require("path");

const MAX_LOG_BYTES = 2 * 1024 * 1024; // 2 MB

let _logPath = null;

function getLogPath() {
  if (_logPath) return _logPath;
  try {
    // Only call app.getPath after app module is initialised
    const { app } = require("electron");
    if (app && typeof app.getPath === "function") {
      // app.getPath throws if called before app is ready on some platforms
      const dir = app.getPath("userData");
      _logPath = path.join(dir, "orion-ide.log");
      return _logPath;
    }
  } catch { /* app not ready yet — fall through */ }
  // Safe fallback: write next to the binary / cwd during early boot
  _logPath = path.join(process.cwd(), "orion-ide.log");
  return _logPath;
}

function rotateIfNeeded(fp) {
  try {
    const stat = fs.statSync(fp);
    if (stat.size > MAX_LOG_BYTES) {
      const backup = fp + ".1";
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(fp, backup);
    }
  } catch { /* ignore */ }
}

function write(level, ...args) {
  const ts  = new Date().toISOString();
  const msg = args
    .map(a => (a instanceof Error ? a.stack || a.message : typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");
  const line = `[${ts}] [${level.toUpperCase().padEnd(5)}] ${msg}\n`;

  // Always print to console
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(line);

  // Write to file (best-effort — never crash because of logging)
  try {
    const fp = getLogPath();
    rotateIfNeeded(fp);
    fs.appendFileSync(fp, line, "utf8");
  } catch { /* ignore */ }
}

const logger = {
  info:  (...a) => write("info",  ...a),
  warn:  (...a) => write("warn",  ...a),
  error: (...a) => write("error", ...a),
  debug: (...a) => write("debug", ...a),
};

module.exports = logger;
