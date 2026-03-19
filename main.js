"use strict";
/**
 * main.js — Orion IDE v0.4 main process.
 * Security: CSP, safeStorage for secrets, no keys in renderer, signed updater.
 */
const path      = require("path");
const { execFile } = require("child_process");
const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, safeStorage, session } = require("electron");

try { require("dotenv").config(); } catch {}

const logger    = require("./main/logger");
const git       = require("./main/git");
const workspace = require("./main/workspace");
const preview   = require("./main/preview");
const { IPC }   = require("./shared/constants");

// Auto-updater (graceful — not fatal if electron-updater not installed yet)
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
} catch {}

const RUNTIME_CONFIG = {
  backendUrl:      process.env.ORION_BACKEND_URL    || "https://ai.mallydev.xyz/ask",
  healthUrl:       process.env.ORION_HEALTH_URL     || "https://ai.mallydev.xyz/health",
  supabaseUrl:     process.env.SUPABASE_URL         || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY    || "",
  appVersion:      app.getVersion(),
};

if (!RUNTIME_CONFIG.supabaseUrl) {
  logger.warn("SUPABASE_URL not set — copy .env.example to .env");
}

async function createWindow() {
  // Detect system dark/light preference for first launch
  const prefersDark = nativeTheme.shouldUseDarkColors;

  const win = new BrowserWindow({
    width: 1700, height: 1020, minWidth: 980, minHeight: 640,
    backgroundColor: prefersDark ? "#11161d" : "#f5f6f8",
    title: "Orion IDE",
    // Custom frameless window for polished look
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Content Security Policy — restrict what can load in the renderer
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self';" +
          "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;" +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;" +
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;" +
          "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net;" +
          "img-src 'self' data: blob: https:;" +
          "worker-src 'self' blob:;" +
          "connect-src 'self' https://ai.mallydev.xyz https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;"
        ],
      },
    });
  });

  win.loadFile(path.join(__dirname, "app", "index.html"));

  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) { e.preventDefault(); logger.warn("Blocked nav to:", url); }
  });

  // Pass system theme preference to renderer on first load
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("system-theme", prefersDark ? "dark" : "light");
  });

  // Listen for system theme changes and forward them
  nativeTheme.on("updated", () => {
    win.webContents.send("system-theme", nativeTheme.shouldUseDarkColors ? "dark" : "light");
  });

  return win;
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...args);
    } catch (err) {
      const msg = err?.message || String(err || "Unknown error");
      logger.error("[IPC] " + channel + ": " + msg);
      return { ok: false, error: msg };
    }
  });
}

function runTerminalCommand(cwd, command) {
  return new Promise((resolve) => {
    const sh   = process.platform === "win32" ? "cmd"   : "/bin/sh";
    const flag = process.platform === "win32" ? "/c"    : "-c";
    execFile(sh, [flag, command], { cwd, windowsHide: true, maxBuffer: 1024 * 1024 * 4 },
      (err, stdout, stderr) => resolve({
        ok: !err, code: err?.code ?? 0,
        stdout: stdout || "",
        stderr: stderr || (err?.message || ""),
      })
    );
  });
}

// Core IPC handlers
handle(IPC.CONFIG_GET,           () => RUNTIME_CONFIG);
handle(IPC.APP_VERSION,          () => ({ version: app.getVersion() }));

handle(IPC.WORKSPACE_CHOOSE, async () => {
  const r = await dialog.showOpenDialog({ title: "Choose workspace", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return null;
  return workspace.buildSnapshot(r.filePaths[0]);
});

handle(IPC.WORKSPACE_RELOAD,     async (_e, d)  => d ? workspace.buildSnapshot(d) : null);
handle(IPC.WORKSPACE_GIT_STATUS, async (_e, d)  => git.getStatus(d));
handle(IPC.WORKSPACE_GIT_DIFF,   async (_e, p)  => git.getDiff(p?.rootDir, p?.relativePath));
handle(IPC.WORKSPACE_GIT_ACTION, async (_e, p)  => git.runAction(p?.rootDir, p?.action, p?.relativePath));
handle(IPC.WORKSPACE_GIT_COMMIT, async (_e, p)  => git.commit(p?.rootDir, p?.message));
handle(IPC.WORKSPACE_GIT_LOG,    async (_e, p)  => git.getLog(p?.rootDir, p?.limit || 30));
handle(IPC.WORKSPACE_GIT_BRANCHES, async (_e, p) => git.getBranches(p?.rootDir));
handle(IPC.WORKSPACE_GIT_CHECKOUT, async (_e, p) => git.checkout(p?.rootDir, p?.branch));
handle(IPC.WORKSPACE_GIT_CREATE_BRANCH, async (_e, p) => git.createBranch(p?.rootDir, p?.branch));
handle("workspace:git-show", async (_e, p) => git.getCommitDiff(p?.rootDir, p?.hash));

handle(IPC.WORKSPACE_WRITE,  async (_e, { rootDir, relativePath, content }) => {
  await workspace.writeFile(rootDir, relativePath, content); return { ok: true };
});
handle(IPC.WORKSPACE_CREATE, async (_e, { rootDir, relativePath, content = "" }) => {
  await workspace.createFile(rootDir, relativePath, content); return { ok: true };
});
handle(IPC.WORKSPACE_MKDIR,  async (_e, { rootDir, relativePath }) => {
  await workspace.createFolder(rootDir, relativePath); return { ok: true };
});
handle(IPC.WORKSPACE_RENAME, async (_e, { rootDir, fromPath, toPath }) => {
  await workspace.renamePath(rootDir, fromPath, toPath); return { ok: true };
});
handle(IPC.WORKSPACE_DELETE, async (_e, { rootDir, relativePath }) => {
  await workspace.deletePath(rootDir, relativePath); return { ok: true };
});
handle(IPC.WORKSPACE_OPEN_FOLDER, async (_e, folderPath) => {
  if (!folderPath) return { ok: false, error: "No path" };
  return workspace.buildSnapshot(folderPath);
});

handle(IPC.TERMINAL_RUN, async (_e, { cwd, command }) => {
  if (!command || String(command).length > 2000) return { ok: false, error: "Invalid command" };
  return runTerminalCommand(cwd, command);
});
handle(IPC.SHELL_OPEN_PATH, async (_e, p) => { if (!p) return { ok: false }; await shell.openPath(p); return { ok: true }; });

handle(IPC.PREVIEW_OPEN, async (_e, { rootDir, relativePath }) => {
  if (!rootDir) return { ok: false, error: "Missing rootDir" };
  const { url } = await preview.ensureServer(rootDir);
  const target = new URL("/" + String(relativePath || "index.html").replace(/\\/g, "/").replace(/^\/+/, ""), url).toString();
  await shell.openExternal(target);
  return { ok: true, url: target };
});

handle(IPC.LOG_ERROR, async (_e, p) => { logger.error("[renderer]", p?.message || JSON.stringify(p)); return { ok: true }; });

// Quit and install pending update
ipcMain.handle("app:quit-and-install", () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall(false, true);
  } else {
    app.relaunch();
    app.quit();
  }
});

// Safe storage for API key persistence (future use — keys stay in OS keychain)
handle("storage:set", async (_e, { key, value }) => {
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: "Encryption unavailable" };
  const encrypted = safeStorage.encryptString(String(value));
  // Store as base64 in app userData
  const fs = require("fs");
  const storePath = path.join(app.getPath("userData"), "secure.json");
  let store = {};
  try { store = JSON.parse(fs.readFileSync(storePath, "utf8")); } catch {}
  store[key] = encrypted.toString("base64");
  fs.writeFileSync(storePath, JSON.stringify(store));
  return { ok: true };
});

handle("storage:get", async (_e, { key }) => {
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, value: null };
  const fs = require("fs");
  const storePath = path.join(app.getPath("userData"), "secure.json");
  try {
    const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
    if (!store[key]) return { ok: true, value: null };
    const buf = Buffer.from(store[key], "base64");
    return { ok: true, value: safeStorage.decryptString(buf) };
  } catch { return { ok: true, value: null }; }
});

app.whenReady().then(async () => {
  logger.info("Orion IDE starting, version:", app.getVersion());
  await createWindow();

  // Check for updates silently after launch
  if (autoUpdater) {
    try {
      autoUpdater.on("update-available", () => {
        BrowserWindow.getAllWindows()[0]?.webContents.send("update-available");
      });
      autoUpdater.on("update-downloaded", () => {
        // Install immediately and relaunch — no prompt needed
        autoUpdater.quitAndInstall(true, true);
      });
      setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
    } catch {}
  }

  app.on("activate", async () => { if (BrowserWindow.getAllWindows().length === 0) await createWindow(); });
});

app.on("window-all-closed", () => {
  preview.closeAll();
  if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException",  e => logger.error("uncaughtException:",  e.message));
process.on("unhandledRejection", e => logger.error("unhandledRejection:", e));
