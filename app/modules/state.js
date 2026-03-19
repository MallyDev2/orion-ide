/**
 * state.js — single source of truth for renderer state.
 * All mutations go through this module so the shape stays predictable.
 */
"use strict";
import { loadJSON, saveJSON, normalizeRelPath, baseName } from "./utils.js";

const STORAGE = {
  sessionChat:      "orion_chat_v2",
  workspacePath:    "orion_workspace_v2",
  leftView:         "orion_left_view_v2",
  rightView:        "orion_right_view_v2",
  consoleCollapsed: "orion_console_collapsed_v2",
  preferences:      "orion_preferences_v2",
  leftSize:         "orion_left_size_v2",
  rightSize:        "orion_right_size_v2",
  dockSize:         "orion_dock_size_v2",
  expandedFolders:  "orion_expanded_folders_v2",
  commandHistory:   "orion_cmd_history_v2",
  recentWorkspaces: "orion_recent_workspaces_v2",
  leftCollapsed:    "orion_left_collapsed_v2",
  rightCollapsed:   "orion_right_collapsed_v2",
  // Session restore — persists open tabs, active file, and per-file cursor positions
  sessionTabs:      "orion_session_tabs_v2",
  sessionCursors:   "orion_session_cursors_v2",
};

export const DEFAULT_PREFS = {
  theme:         "light",
  fontSize:      13,
  tabSize:       2,
  wordWrap:      "on",
  minimap:       false,
  autoSave:      true,
  defaultSearch: true,
  defaultAgent:  true,
};

export const STORAGE_KEYS = STORAGE;
export const MIN_DOCK_SIZE = 180;
export const DEFAULT_DOCK_SIZE = 260;

function clampNum(val, min, max, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

// The full app state object — mutate properties directly, call persist helpers after.
export const state = {
  // Auth / account
  config:   null,
  sb:       null,
  session:  null,
  profile:  null,
  quota:    null,

  // Workspace
  workspace:       null,  // { rootDir, files: {rel: content}, stats: { fileCount, lineCount } }
  diskFiles:       {},    // mirror of last-saved content per path
  workspaceInsight:null,
  gitStatus:       { ok:true, available:false, branch:"", changed:0, dirty:false, ahead:0, behind:0 },

  // Editor
  activeFile:  "",
  openTabs:    [],
  editor:      null,
  model:       null,
  models:      new Map(),

  // UI
  leftView:  localStorage.getItem(STORAGE.leftView)  || "explorer",
  rightView: localStorage.getItem(STORAGE.rightView) || "chat",
  activeActivity: localStorage.getItem("orion_activity_v2") || "explorer",
  consoleCollapsed: localStorage.getItem(STORAGE.consoleCollapsed) !== "false",
  consolePane: "terminal",
  leftSize:  clampNum(localStorage.getItem(STORAGE.leftSize),   180, 420, 248),
  rightSize: clampNum(localStorage.getItem(STORAGE.rightSize),  260, 520, 340),
  dockSize:  clampNum(localStorage.getItem(STORAGE.dockSize),    MIN_DOCK_SIZE, 420, DEFAULT_DOCK_SIZE),
  leftCollapsed:  localStorage.getItem(STORAGE.leftCollapsed)  === "true",
  rightCollapsed: localStorage.getItem(STORAGE.rightCollapsed) === "true",
  expandedFolders: new Set(loadJSON(STORAGE.expandedFolders, [])),

  // Chat
  chat: loadJSON(STORAGE.sessionChat, []),
  pendingRequests: 0,

  // Terminal
  consoleEntries: [],
  commandHistory: loadJSON(STORAGE.commandHistory, []),
  commandHistoryIndex: -1,

  // Trace
  traceEvents: [],

  // Command palette
  commandPaletteOpen:      false,
  commandPaletteQuery:     "",
  commandPaletteItems:     [],
  commandPaletteSelection: 0,

  // Search
  latestSearchHits:  [],
  latestSymbolHits:  [],

  // Patch
  pendingPatch: null,

  // Recent workspaces
  recentWorkspaces: loadJSON(STORAGE.recentWorkspaces, [])
    .map(e => typeof e === "string" ? { rootDir: e, label: baseName(e), openedAt: "" } : e)
    .filter(e => e?.rootDir),

  // Action modal
  actionRequest: null,

  // Preferences
  preferences: { ...DEFAULT_PREFS, ...loadJSON(STORAGE.preferences, {}) },
};

// ── Persist helpers ───────────────────────────────────────────────────────────
export function persistLayout() {
  localStorage.setItem(STORAGE.leftView,         state.leftView);
  localStorage.setItem(STORAGE.rightView,        state.rightView);
  localStorage.setItem(STORAGE.consoleCollapsed, String(state.consoleCollapsed));
  localStorage.setItem(STORAGE.leftSize,         String(state.leftSize));
  localStorage.setItem(STORAGE.rightSize,        String(state.rightSize));
  localStorage.setItem(STORAGE.dockSize,         String(state.dockSize));
  localStorage.setItem(STORAGE.leftCollapsed,    String(state.leftCollapsed));
  localStorage.setItem(STORAGE.rightCollapsed,   String(state.rightCollapsed));
}

export function persistPrefs() {
  saveJSON(STORAGE.preferences, state.preferences);
}

export function persistExpandedFolders() {
  saveJSON(STORAGE.expandedFolders, Array.from(state.expandedFolders));
}

export function persistCommandHistory() {
  saveJSON(STORAGE.commandHistory, state.commandHistory.slice(-60));
}

export function persistRecentWorkspaces() {
  saveJSON(STORAGE.recentWorkspaces, state.recentWorkspaces.slice(0, 8));
}

export function persistChat() {
  saveJSON(STORAGE.sessionChat, state.chat.slice(-80));
}

// ── Workspace helpers ─────────────────────────────────────────────────────────
export function hasFile(filePath) {
  return !!state.workspace?.files && Object.prototype.hasOwnProperty.call(state.workspace.files, filePath);
}

export function currentFileContent() {
  return state.workspace?.files?.[state.activeFile] || "";
}

export function isDirty(filePath) {
  if (!filePath || !hasFile(filePath)) return false;
  return String(state.workspace.files[filePath] || "") !== String(state.diskFiles?.[filePath] || "");
}

export function hasDirtyFiles() {
  return state.openTabs.some(f => isDirty(f)) ||
         Object.keys(state.workspace?.files || {}).some(f => isDirty(f));
}

export function insertFile(filePath, content = "") {
  if (!state.workspace) return;
  const p = normalizeRelPath(filePath);
  const existed = hasFile(p);
  state.workspace.files[p] = String(content);
  if (!existed) {
    state.workspace.stats = state.workspace.stats || { fileCount:0, lineCount:0 };
    state.workspace.stats.fileCount++;
    state.workspace.stats.lineCount += String(content).split("\n").length;
  }
}

export function setFileContent(filePath, content = "", markSaved = true) {
  if (!state.workspace) return;
  const p    = normalizeRelPath(filePath);
  const prev = hasFile(p) ? String(state.workspace.files[p] || "") : null;
  insertFile(p, content);
  if (prev !== null && state.workspace.stats) {
    state.workspace.stats.lineCount += String(content).split("\n").length - prev.split("\n").length;
  }
  if (markSaved) state.diskFiles[p] = String(content);
}

export function copyFiles(files) {
  return Object.fromEntries(Object.entries(files || {}).map(([k, v]) => [k, String(v)]));
}

export function rememberRecentWorkspace(rootDir) {
  if (!rootDir) return;
  const entry = { rootDir: String(rootDir), label: baseName(rootDir), openedAt: new Date().toISOString() };
  state.recentWorkspaces = [entry, ...state.recentWorkspaces.filter(e => e.rootDir !== rootDir)].slice(0, 8);
  persistRecentWorkspaces();
}

export function removeRecentWorkspace(rootDir) {
  if (!rootDir) return;
  state.recentWorkspaces = state.recentWorkspaces.filter(e => e.rootDir !== rootDir);
  persistRecentWorkspaces();
}

export function clearRecentWorkspaces() {
  state.recentWorkspaces = [];
  persistRecentWorkspaces();
}

export function rememberCommand(cmd) {
  const c = String(cmd || "").trim();
  if (!c) return;
  state.commandHistory = state.commandHistory.filter(e => e !== c);
  state.commandHistory.push(c);
  state.commandHistory = state.commandHistory.slice(-60);
  state.commandHistoryIndex = state.commandHistory.length;
  persistCommandHistory();
}

// ── Session restore helpers ───────────────────────────────────────────────────
// Saves open tabs + active file so they survive restarts. Cursor positions are
// stored per-file so the editor reopens exactly where you left off.

export function persistSession() {
  try {
    saveJSON(STORAGE.sessionTabs, {
      activeFile: state.activeFile,
      openTabs:   state.openTabs.slice(),
    });
  } catch {}
}

export function persistCursorForFile(filePath, position) {
  if (!filePath || !position) return;
  try {
    const all = loadJSON(STORAGE.sessionCursors, {});
    all[filePath] = { lineNumber: position.lineNumber, column: position.column };
    // Keep at most 50 entries to avoid unbounded growth
    const keys = Object.keys(all);
    if (keys.length > 50) {
      const trimmed = {};
      keys.slice(-50).forEach(k => { trimmed[k] = all[k]; });
      saveJSON(STORAGE.sessionCursors, trimmed);
    } else {
      saveJSON(STORAGE.sessionCursors, all);
    }
  } catch {}
}

export function loadSessionCursor(filePath) {
  if (!filePath) return null;
  try {
    const all = loadJSON(STORAGE.sessionCursors, {});
    return all[filePath] || null;
  } catch { return null; }
}

export function loadSessionTabs() {
  try {
    return loadJSON(STORAGE.sessionTabs, null);
  } catch { return null; }
}
