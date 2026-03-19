"use strict";
/**
 * preload.js — v0.4. Exposes typed API to renderer. All AI calls proxied server-side.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orionDesktop", {
  // Config & version
  getConfig:             ()  => ipcRenderer.invoke("config:get"),
  getVersion:            ()  => ipcRenderer.invoke("app:version"),
  // Workspace
  chooseWorkspace:       ()  => ipcRenderer.invoke("workspace:choose"),
  reloadWorkspace:       (d) => ipcRenderer.invoke("workspace:reload", d),
  openFolderPath:        (p) => ipcRenderer.invoke("workspace:open-folder", p),
  // Git
  getWorkspaceGitStatus: (d) => ipcRenderer.invoke("workspace:git-status", d),
  getWorkspaceGitDiff:   (p) => ipcRenderer.invoke("workspace:git-diff", p),
  runWorkspaceGitAction: (p) => ipcRenderer.invoke("workspace:git-action", p),
  gitCommit:             (p) => ipcRenderer.invoke("workspace:git-commit", p),
  getGitLog:             (p) => ipcRenderer.invoke("workspace:git-log", p),
  getCommitDiff:         (p) => ipcRenderer.invoke("workspace:git-show", p),
  getBranches:           (d) => ipcRenderer.invoke("workspace:git-branches", { rootDir: d }),
  checkoutBranch:        (d, b) => ipcRenderer.invoke("workspace:git-checkout", { rootDir: d, branch: b }),
  createBranch:          (d, b) => ipcRenderer.invoke("workspace:git-create-branch", { rootDir: d, branch: b }),
  // File operations
  writeFile:             (p) => ipcRenderer.invoke("workspace:write-file", p),
  createFile:            (p) => ipcRenderer.invoke("workspace:create-file", p),
  createFolder:          (p) => ipcRenderer.invoke("workspace:create-folder", p),
  renamePath:            (p) => ipcRenderer.invoke("workspace:rename", p),
  deletePath:            (p) => ipcRenderer.invoke("workspace:delete", p),
  // Terminal & shell
  runCommand:            (p) => ipcRenderer.invoke("terminal:run", p),
  openPath:              (p) => ipcRenderer.invoke("shell:open-path", p),
  // Preview
  openPreview:           (p) => ipcRenderer.invoke("preview:open", p),
  // Logging
  logError:              (p) => ipcRenderer.invoke("log:error", p),
  // Safe storage
  secureSet:             (k, v) => ipcRenderer.invoke("storage:set", { key: k, value: v }),
  secureGet:             (k)    => ipcRenderer.invoke("storage:get", { key: k }),
  // System theme & updates
  onSystemTheme:         (fn) => ipcRenderer.on("system-theme", (_e, theme) => fn(theme)),
  onUpdateAvailable:     (fn) => ipcRenderer.on("update-available", fn),
  onUpdateDownloaded:    (fn) => ipcRenderer.on("update-downloaded", fn),
  quitAndInstall:        ()  => ipcRenderer.invoke("app:quit-and-install"),
});
