/**
 * app.js — Orion IDE renderer (v0.3).
 *
 * v0.1→v0.2: Modules split, state management, streaming, git commit, autosave
 * v0.2→v0.3 improvements:
 *  - Token-by-token streaming with blinking cursor + Stop button
 *  - Top progress bar, retry bubble, connection status dot
 *  - Agent action log with per-action rollback
 *  - Per-file indent detection (tabs vs 2/4 spaces)
 *  - Line ending (LF/CRLF) + encoding display in meta-strip
 *  - Tab close button, dirty dot, middle-click, Ctrl+W, Ctrl+Tab
 *  - Right-click context menus on file tree and tabs
 *  - AI toolbar dropdown (Explain / Review / Patch)
 *  - Clickable git branch badge with branch switcher
 *  - Drag-and-drop folder onto window to open workspace
 *  - Skeleton loading animation during workspace indexing
 *  - Monaco JS/TS language workers (diagnostics, hover)
 *  - AI-generated commit messages with diff context
 *  - Splitter double-click to reset panel widths
 *  - Toggle theme via command palette
 */
"use strict";

import { esc, stamp, renderMD, baseName, ext, titleCase, normalizeRelPath,
         initials, debounce, inferLang, fileTypeLabel, loadJSON, saveJSON } from "./modules/utils.js";
import { state, DEFAULT_PREFS, STORAGE_KEYS, MIN_DOCK_SIZE, DEFAULT_DOCK_SIZE,
  persistLayout, persistPrefs, persistExpandedFolders, persistCommandHistory,
  persistRecentWorkspaces, persistChat, persistSession, persistCursorForFile,
  loadSessionTabs, loadSessionCursor,
  hasFile, currentFileContent, isDirty, hasDirtyFiles, insertFile,
  setFileContent, copyFiles, rememberRecentWorkspace, removeRecentWorkspace,
  clearRecentWorkspaces, rememberCommand } from "./modules/state.js";
import { initConsole, log, addTrace, render as renderConsole, renderTrace } from "./modules/console.js";
import { initUI, showToast, confirm } from "./modules/ui.js";
import { initGitCommit, openGitCommit } from "./modules/gitCommit.js";
import { getFileIcon } from "./modules/fileIcons.js";
import { shouldShowWelcome, showWelcomeWizard, startTour, shouldShowTour } from "./modules/onboarding.js";
import { buildMemoryPrompt, loadMemory, addMemoryEntry, renderMemoryPanel } from "./modules/memory.js";
import { computeHealth, renderHealthPanel } from "./modules/health.js";
import { initShortcuts, openShortcuts } from "./modules/shortcuts.js";
import { initAutoSave, scheduleAutoSave, setAutoSaveEnabled } from "./modules/autosave.js";
import { initCompletions, registerInlineCompletions, setCompletionsEnabled } from "./modules/completions.js";
import { initDiffEditor, showDiff, hideDiff, applyTheme as applyDiffTheme } from "./modules/diffEditor.js";
import { renderFeedbackButtons, submitFeedback, openBugReport } from "./modules/feedback.js";
import { initMentions, parseMentions, hideMentionPopup } from "./modules/mentions.js";
import { initContextMenu, showContextMenu, fileMenuItems, tabMenuItems, closeContextMenu } from "./modules/contextmenu.js";
import { initProgress, showProgress, hideProgress } from "./modules/progress.js";
import { initDragDrop } from "./modules/dragdrop.js";
import { CH, notify } from "./modules/store.js";
import { recordAgentAction, getActionLog, clearActionLog, renderActionLog } from "./modules/actionLog.js";

// â”€â”€ DOM cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const els = {};
function $(id) { return document.getElementById(id); }

function cacheDom() {
  [
    "missionLabel","missionHint","workspacePath","workspaceSummary",
    "quotaStat","openWorkspaceBtn","refreshWorkspaceBtn","authOpenBtn",
    "editorTerminalBtn","editorRunBtn","settingsOpenBtn",
    "fileCount","lineCount","languageCount","languageLead","languageBars",
    "openTabsStat","workspaceSyncStat","fileSearch","fileSearchMeta","fileTree","editorTitle",
    "editorPath","editorLanguage","editorMetrics","editorSelection","tabbar","editorMount","editorEmpty",
    "chatFeed","chatForm","chatInput","searchToggle","agentToggle","clearChatBtn","sessionStat","modelStat",
    "searchStat","clearConsoleBtn","openPathBtn","commandInput","runCommandBtn","terminalPane","tracePane",
    "sourcesPane","authModal","authForm","emailInput","passwordInput","authError","cancelAuthBtn",
    "newFileBtn","newFolderBtn","renameBtn","duplicateBtn","deleteBtn","saveFileBtn","emptyOpenBtn",
    "explainSelectionBtn","reviewFileBtn","patchFileBtn","settingsPanelBtn","openPreviewBtn",
    "emptyAuthBtn","accountAvatar","accountName","accountMeta","quotaLead","quotaPanelText","quotaPanelFill",
    "traceList","traceLead","composerContext","composerHint","activeFileName","focusLeadMirror",
    "composerContextMirror","fileSearchMetaMirror","leftPanelTitle","rightPanelTitle","consolePanel","editorColumn",
    "consoleCollapseBtn","workbench","actionModal",
    "leftSplitter","rightSplitter","dockResizeHandle","settingsModal","settingsForm","themeSelect",
    "fontSizeInput","wordWrapSelect","defaultSearchSelect","defaultAgentSelect","settingsError",
    "cancelSettingsBtn","saveSettingsBtn",
    "actionForm","actionLabel","actionTitle","actionDescription","actionInput","actionError","toastStack",
    "cancelActionBtn","submitActionBtn","recentWorkspacesPanel","emptyRecentWorkspaces","workspaceGitBadge",
    "workspaceRecentLead","gitBranchBadge","gitBranchLabel","commandPaletteBtn","commandPaletteModal",
    "commandPaletteInput","commandPaletteList","closeCommandPaletteBtn","projectTypeLead","projectInsightList",
    "gitSummaryLead","gitStatsPanel","workspaceNextLead","workspaceRecommendations","quickActionGrid",
    "emptyGuideGrid","patchPreviewModal","patchPreviewTitle",
    "patchPreviewSummary","patchPreviewList","closePatchPreviewBtn","discardPatchBtn","applyPatchBtn",
    "changesSummary","changesLead","changesGroups","stageAllBtn","unstageAllBtn","gitCommitBtn",
    "thinkingIndicator","promptSuggestions","breadcrumbNav","breadcrumbEmpty",
    "activityBar","healthPanel","memoryPanel","shortcutsBtn",
    "autosaveIndicator","autoSaveSelect","autoSaveSettingSelect","editorEncoding","editorLineEnding","editorLanguagePill",
    "healthStatusItem","healthStatusScore",
    "globalSearch","globalSearchResults","globalSearchMeta",
    "tabSizeSelect","minimapSelect","gitChangeBadge",
    "openTerminalBtn","runWorkspaceBtn",
    "statusBarGit","statusBarBranch","statusBarDirtyDot",
    "statusBarErrors","statusBarErrorCount","statusBarWarnCount",
    "statusBarLanguage","statusBarLang","statusBarCursor","statusBarLnCol",
    "completionsIndicator","completionsDot","completionsLabel",
  ].forEach(id => { els[id] = $(id); });
  els.sidebar        = document.querySelector(".sidebar");
  els.assistantPanel = document.querySelector(".assistant-panel");
}

// â”€â”€ Error reporter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ── Connection status ─────────────────────────────────────────────────────
let _abortController = null;

function setOnlineStatus(status) {
  const dot = document.getElementById("connectionDot");
  if (dot) dot.className = "status-dot " + status;
}

// ── AI dropdown (Explain / Review / Patch) ───────────────────────────────
function buildAIDropdown() {
  const existing = document.getElementById("aiDropdown");
  if (existing) return existing;
  const dd = document.createElement("div");
  dd.className = "ai-dropdown";
  dd.id = "aiDropdown";
  dd.innerHTML = `
    <button type="button" data-ai-action="explain"><span class="ai-icon">⊙</span>Explain selection</button>
    <button type="button" data-ai-action="review"><span class="ai-icon">⊛</span>Review for bugs</button>
    <button type="button" data-ai-action="patch"><span class="ai-icon">✦</span>Patch & improve</button>
  `;
  dd.addEventListener("click", e => {
    const btn = e.target.closest("[data-ai-action]");
    if (btn) {
      dd.classList.remove("open");
      runAction(btn.dataset.aiAction + " failed", "editor", () => triggerWorkflowPrompt(btn.dataset.aiAction));
    }
  });
  document.body.appendChild(dd);
  return dd;
}

function toggleAIDropdown(anchorEl) {
  const dd = buildAIDropdown();
  const isOpen = dd.classList.contains("open");
  dd.classList.toggle("open", !isOpen);
  if (!isOpen && anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    dd.style.top  = (rect.bottom + 4) + "px";
    dd.style.left = rect.left + "px";
    const close = e => {
      if (!dd.contains(e.target) && e.target !== anchorEl) {
        dd.classList.remove("open");
        window.removeEventListener("click", close, true);
      }
    };
    window.addEventListener("click", close, true);
  }
}

// ── Branch switcher dropdown ─────────────────────────────────────────────
async function openBranchSwitcher(anchorEl) {
  const existing = document.getElementById("branchDropdown");
  if (existing) { existing.remove(); return; }
  const dd = document.createElement("div");
  dd.className = "branch-dropdown";
  dd.id = "branchDropdown";
  let branches = [];
  try { branches = (await window.orionDesktop?.getBranches?.(state.workspace?.rootDir)) || []; } catch {}
  const current = state.gitStatus?.branch || "";
  if (branches.length) {
    dd.innerHTML = branches.map(b =>
      "<button class=\"branch-item " + (b === current ? "active" : "") + "\" type=\"button\" data-branch=\"" + esc(b) + "\">" +
      "<span class=\"branch-icon\">" + (b === current ? "✓" : "⎇") + "</span>" + esc(b) + "</button>"
    ).join("");
  } else {
    dd.innerHTML = "<div style=\"padding:10px 14px;font-size:12px;color:var(--muted)\">No branches found</div>";
  }
  const newRow = document.createElement("div");
  newRow.className = "branch-new-row";
  newRow.innerHTML = "<input type=\"text\" placeholder=\"New branch name...\" id=\"newBranchInput\" /><button class=\"ghost-btn tiny\" type=\"button\" id=\"createBranchBtn\">Create</button>";
  dd.appendChild(newRow);
  document.body.appendChild(dd);
  const rect = anchorEl.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 4) + "px";
  dd.style.left = rect.left + "px";
  dd.addEventListener("click", async e => {
    const btn = e.target.closest("[data-branch]");
    if (btn) {
      dd.remove();
      if (btn.dataset.branch === current) return;
      try {
        await window.orionDesktop?.checkoutBranch?.(state.workspace?.rootDir, btn.dataset.branch);
        await refreshGitStatus();
        showToast("Switched to " + btn.dataset.branch);
      } catch (err) { showToast("Branch switch failed: " + err.message, "error"); }
    }
    if (e.target.id === "createBranchBtn") {
      const name = document.getElementById("newBranchInput")?.value.trim();
      if (!name) return;
      dd.remove();
      try {
        await window.orionDesktop?.createBranch?.(state.workspace?.rootDir, name);
        await refreshGitStatus();
        showToast("Created branch " + name);
      } catch (err) { showToast("Create branch failed: " + err.message, "error"); }
    }
  });
  const close = e => { if (!dd.contains(e.target)) { dd.remove(); window.removeEventListener("click", close, true); } };
  setTimeout(() => window.addEventListener("click", close, true), 0);
}

function reportError(context, err) {
  const msg = err?.message || String(err || "Unknown error");
  log("error", `${context}: ${msg}`, "terminal");
  addTrace("error", context, msg, { scope: "error" });
  try { window.orionDesktop?.logError?.({ message: `[${context}] ${msg}` }); } catch { /* ignore */ }
}

async function runAction(title, scope, fn) {
  try { return await fn(); }
  catch (err) { reportError(title, err); throw err; }
}

// â”€â”€ Auth helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function authHeaders() {
  return {
    "Content-Type": "application/json",
    ...(state.session?.access_token  ? { Authorization:  `Bearer ${state.session.access_token}` } : {}),
    ...(state.session?.user?.id      ? { "X-User-Id":     state.session.user.id }  : {}),
    ...(state.profile?.username      ? { "X-Username":    state.profile.username } : {}),
    ...(state.session?.user?.email   ? { "X-User-Email":  state.session.user.email } : {}),
    "X-User-Role": state.profile?.role || "free",
  };
}

// â”€â”€ Layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setLeftView(v)   { state.leftView  = v; persistLayout(); renderLayout(); }
function setRightView(v)  {
  state.rightView = v;
  persistLayout();
  renderLayout();
  if (v === "log") {
    const panel = document.getElementById("actionLogPanel");
    if (panel) renderActionLog(panel, async act => {
      if (!state.workspace?.rootDir) return;
      for (const f of act.files) {
        await window.orionDesktop.writeFile({ rootDir: state.workspace.rootDir, relativePath: f.path, content: f.before });
        setFileContent(f.path, f.before);
      }
      await refreshGitStatus();
      updateWorkspacePanels();
      renderTree();
      renderTabs();
      syncEditor();
    });
  }
}

/** Set the active activity bar item and show its panel */
function setActivity(name) {
  state.activeActivity = name;
  localStorage.setItem("orion_activity_v2", name);
  // Update activity bar buttons
  document.querySelectorAll(".activity-btn[data-activity]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.activity === name);
  });
  // Show matching panel
  document.querySelectorAll(".panel-view[data-panel]").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.panel === name);
  });
  if (els.leftPanelTitle) {
    const titles = { explorer:"Explorer", search:"Search", changes:"Changes",
                     project:"Project", health:"Health", memory:"Memory",
                     account:"Account", symbols:"Symbols" };
    els.leftPanelTitle.textContent = titles[name] || name;
  }
  // Render symbol outline when switching to symbols panel
  if (name === "symbols") renderSymbolOutline();
  // Ensure sidebar is visible
  if (state.leftCollapsed) setLeftCollapsed(false);
}

function openAccountPanel(opts = {}) {
  const { openAuthIfGuest = false } = opts;
  setActivity("account");
  if (state.leftCollapsed) setLeftCollapsed(false);
  if (openAuthIfGuest && !state.session) openAuthModal(true);
}

function setLeftCollapsed(c)  { state.leftCollapsed  = !!c; persistLayout(); renderLayout(); if (state.editor) setTimeout(() => state.editor.layout(), 30); }
function setRightCollapsed(c) { state.rightCollapsed = !!c; persistLayout(); renderLayout(); if (state.editor) setTimeout(() => state.editor.layout(), 30); }

function setConsoleCollapsed(c) {
  state.consoleCollapsed = !!c;
  persistLayout();
  renderLayout();
  if (state.editor) setTimeout(() => state.editor.layout(), 30);
}

function ensureVisibleDockSize() {
  if (state.dockSize < MIN_DOCK_SIZE) state.dockSize = DEFAULT_DOCK_SIZE;
}

function openConsolePane(pane = "terminal", focusCmd = false) {
  state.consolePane = pane;
  ensureVisibleDockSize();
  setConsoleCollapsed(false);
  renderConsole();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (state.editor) state.editor.layout();
      if (focusCmd) els.commandInput?.focus();
    });
  });
}

function renderLayout() {
  const leftTrack   = state.leftCollapsed  ? "0px" : `${state.leftSize}px`;
  const rightTrack  = state.rightCollapsed ? "0px" : `${state.rightSize}px`;

  // Right panel tabs (chat / trace)
  document.querySelectorAll("[data-right-view-target]").forEach(n => n.classList.toggle("active", n.dataset.rightViewTarget === state.rightView));
  document.querySelectorAll("[data-right-view]").forEach(n       => n.classList.toggle("active", n.dataset.rightView       === state.rightView));

  const rightTitles2 = { chat:"Chat", trace:"Trace", log:"Action Log" };
  if (els.rightPanelTitle) els.rightPanelTitle.textContent = rightTitles2[state.rightView] || "Chat";
  if (els.consolePanel)    els.consolePanel.classList.toggle("collapsed", state.consoleCollapsed);

  if (els.workbench) {
    els.workbench.style.setProperty("--left-size",  leftTrack);
    els.workbench.style.setProperty("--right-size", rightTrack);
    els.workbench.style.setProperty("--dock-size",  `${state.consoleCollapsed ? 0 : Math.max(MIN_DOCK_SIZE, state.dockSize)}px`);
    // Activity bar (48px) always present, then left panel, splitter, editor, splitter, right panel
    els.workbench.style.gridTemplateColumns = `48px ${leftTrack} ${state.leftCollapsed?"0px":"6px"} minmax(0,1fr) ${state.rightCollapsed?"0px":"6px"} ${rightTrack}`;
    els.workbench.classList.toggle("console-collapsed", state.consoleCollapsed);
    els.workbench.classList.toggle("left-collapsed",    state.leftCollapsed);
    els.workbench.classList.toggle("right-collapsed",   state.rightCollapsed);
  }

  const dockCol = window.innerWidth <= 1280 ? "4 / -1" : (state.rightCollapsed ? "4 / -1" : "4 / 5");
  if (els.dockResizeHandle) els.dockResizeHandle.style.gridColumn = dockCol;
  if (els.consolePanel)     els.consolePanel.style.gridColumn     = dockCol;
  if (els.consoleCollapseBtn) els.consoleCollapseBtn.textContent  = state.consoleCollapsed ? "Open Terminal" : "Hide Terminal";
  if (els.consolePanel)     els.consolePanel.hidden = state.consoleCollapsed;
  if (els.dockResizeHandle) els.dockResizeHandle.hidden = state.consoleCollapsed;

  if (els.sidebar)         els.sidebar.hidden        = state.leftCollapsed;
  if (els.leftSplitter)    els.leftSplitter.hidden    = state.leftCollapsed;
  if (els.assistantPanel)  els.assistantPanel.hidden  = state.rightCollapsed;
  if (els.rightSplitter)   els.rightSplitter.hidden   = state.rightCollapsed;
}

// â”€â”€ Splitter resize â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function beginHResize(side) {
  return e => {
    e.preventDefault();
    const startX  = e.clientX;
    const initial = side === "left" ? state.leftSize : state.rightSize;
    const onMove  = me => {
      const delta = me.clientX - startX;
      if (side === "left") state.leftSize  = Math.min(420, Math.max(180, initial + delta));
      else                 state.rightSize = Math.min(520, Math.max(260, initial - delta));
      renderLayout();
    };
    const onUp = () => {
      persistLayout();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
      if (state.editor) state.editor.layout();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
  };
}

function beginDockResize(e) {
  e.preventDefault();
  const startY  = e.clientY;
  const initial = state.dockSize;
  const onMove  = me => { state.dockSize = Math.min(420, Math.max(MIN_DOCK_SIZE, initial + (startY - me.clientY))); renderLayout(); };
  const onUp    = () => { persistLayout(); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); if (state.editor) state.editor.layout(); };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup",   onUp);
}

// â”€â”€ File tree â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildTree(files) {
  const root = { files:[], folders:new Map() };
  for (const fp of files) {
    const parts = fp.split("/"); const fileName = parts.pop();
    let cursor = root;
    for (const seg of parts) {
      if (!cursor.folders.has(seg)) cursor.folders.set(seg, { files:[], folders:new Map() });
      cursor = cursor.folders.get(seg);
    }
    cursor.files.push(fp);
  }
  return root;
}

function renderTreeNode(node, prefix = "") {
  const folders = Array.from(node.folders.entries())
    .sort((a,b) => a[0].localeCompare(b[0], undefined, {numeric:true, sensitivity:"base"}))
    .map(([name, child]) => {
      const full = prefix ? `${prefix}/${name}` : name;
      const open = state.expandedFolders.has(full);
      return `<div class="tree-folder ${open?"expanded":""}">
        <button class="tree-folder-row" type="button" data-folder="${esc(full)}">
          <span class="tree-caret">${open?"v":">"}</span>
          <span class="tree-folder-name">${esc(name)}</span>
        </button>
        <div class="tree-children">${open ? renderTreeNode(child, full) : ""}</div>
      </div>`;
    }).join("");

  const files = node.files
    .sort((a,b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}))
    .map(fp => {
      const name  = fp.split("/").pop();
      const dirty = isDirty(fp) ? ' <span class="tree-dirty" aria-hidden="true"></span>' : "";
      const lang = inferLang(fp);
      return `<button class="tree-row ${fp===state.activeFile?"active":""}" type="button" data-path="${esc(fp)}">
        <span class="tree-icon" data-lang="${esc(lang)}">${getFileIcon(fp)}</span>
        <span class="tree-copy"><strong>${esc(name)}</strong>${dirty}<span>${esc(fileTypeLabel(fp))}</span></span>
      </button>`;
    }).join("");

  return folders + files;
}

function filteredFiles() {
  const raw = String(els.fileSearch?.value || "").trim();
  if (!raw) return Object.keys(state.workspace?.files || {}).sort();
  const mode  = raw.startsWith("#") ? "content" : "path";
  const query = (mode === "content" ? raw.slice(1) : raw).toLowerCase();
  return Object.keys(state.workspace?.files || {}).filter(fp => {
    if (mode === "content") return String(state.workspace.files[fp]||"").toLowerCase().includes(query);
    return fp.toLowerCase().includes(query);
  }).sort();
}

function showTreeSkeleton() {
  if (!els.fileTree) return;
  els.fileTree.innerHTML = `<div class="tree-skeleton">
    <div class="skeleton-line long"></div>
    <div class="skeleton-line medium"></div>
    <div class="skeleton-line short"></div>
    <div class="skeleton-line long" style="margin-left:18px"></div>
    <div class="skeleton-line medium" style="margin-left:18px"></div>
    <div class="skeleton-line long"></div>
    <div class="skeleton-line short"></div>
    <div class="skeleton-line medium" style="margin-left:18px"></div>
  </div>`;
}

function renderTree() {
  const files = filteredFiles();
  if (!els.fileTree) return;
  els.fileTree.innerHTML = renderTreeNode(buildTree(files)) || `<div class="tree-copy"><strong>No files</strong><span>Open a local workspace to begin.</span></div>`;
  const raw   = String(els.fileSearch?.value || "").trim();
  const label = raw ? `${files.length} ${raw.startsWith("#")?"content matches":"matches"}` : `${files.length} indexed`;
  if (els.fileSearchMeta)       els.fileSearchMeta.textContent       = label;
  if (els.fileSearchMetaMirror) els.fileSearchMetaMirror.textContent = label;
}

const debouncedRenderTree = debounce(renderTree, 150);

function toggleFolder(fp) {
  const p = normalizeRelPath(fp);
  if (!p) return;
  if (state.expandedFolders.has(p)) state.expandedFolders.delete(p);
  else state.expandedFolders.add(p);
  persistExpandedFolders();
  renderTree();
}

// â”€â”€ Editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function countLines(text) { return text ? String(text).split("\n").length : 0; }

function getOrCreateModel(fp) {
  if (!hasFile(fp) || !window.monaco) return null;
  const existing = state.models.get(fp);
  const value    = state.workspace.files[fp];
  const lang     = inferLang(fp);
  if (existing) {
    window.monaco.editor.setModelLanguage(existing, lang);
    if (existing.getValue() !== value) existing.setValue(value);
    return existing;
  }
  const uri   = window.monaco.Uri.parse(`inmemory://orion/${encodeURIComponent(fp)}`);
  const model = window.monaco.editor.createModel(value, lang, uri);
  state.models.set(fp, model);
  return model;
}

function clearModels() {
  for (const m of state.models.values()) { try { m.dispose(); } catch {} }
  state.models.clear();
  state.model = null;
}

function syncEditor() {
  if (!state.editor) return;
  if (!state.activeFile || !hasFile(state.activeFile)) {
    els.editorEmpty?.classList.remove("hidden");
    state.editor.setModel(null);
    state.model = null;
    updateEditorMeta();
    return;
  }
  els.editorEmpty?.classList.add("hidden");
  const model = getOrCreateModel(state.activeFile);
  if (!model) return;
  state.model = model;
  const isNewModel = state.editor.getModel() !== model;
  if (isNewModel) state.editor.setModel(model);

  // Restore saved cursor position when switching to a file
  if (isNewModel) {
    const saved = loadSessionCursor(state.activeFile);
    if (saved) {
      requestAnimationFrame(() => {
        try {
          state.editor.setPosition({ lineNumber: saved.lineNumber, column: saved.column });
          state.editor.revealLineInCenter(saved.lineNumber);
        } catch {}
      });
    }
  }

  // Per-file indent detection: detect from content, override editor
  try {
    const fileContent = currentFileContent();
    if (fileContent && state.editor) {
      const lines = fileContent.split("\n").slice(0, 40).filter(l => /^[ \t]/.test(l));
      const tabLines   = lines.filter(l => l.startsWith("\t")).length;
      const spaceLines = lines.filter(l => l.startsWith(" ")).length;
      const useTab = tabLines > spaceLines;
      // Detect space count (2 or 4)
      const spaceCounts = lines.filter(l => l.startsWith(" ")).map(l => {
        const m = l.match(/^ +/);
        return m ? m[0].length : 0;
      }).filter(n => n > 0);
      const spaceSize = spaceCounts.length
        ? (spaceCounts.filter(n => n % 4 === 0).length > spaceCounts.filter(n => n % 2 === 0 && n % 4 !== 0).length ? 4 : 2)
        : Number(state.preferences.tabSize || 2);
      state.editor.updateOptions({
        insertSpaces: !useTab,
        tabSize:      useTab ? 4 : spaceSize,
        detectIndentation: false,
      });
    }
  } catch {}

  updateEditorMeta();
  renderBreadcrumb();
  state.editor.layout();
  state.editor.focus();
}

function applyPrefs() {
  document.body.dataset.theme = state.preferences.theme || "light";
  applyDiffTheme(state.preferences.theme);
  if (els.searchToggle)    els.searchToggle.checked    = !!state.preferences.defaultSearch;
  if (els.agentToggle)     els.agentToggle.checked     = !!state.preferences.defaultAgent;
  if (els.autoSaveSelect)  els.autoSaveSelect.value    = state.preferences.autoSave ? "on" : "off";
  if (els.autosaveIndicator) els.autosaveIndicator.hidden = !state.preferences.autoSave;

  // Sync auto-save module
  setAutoSaveEnabled(!!state.preferences.autoSave);
  setCompletionsEnabled(state.preferences.completions !== false);

  if (state.editor) {
    if (window.monaco?.editor) {
      window.monaco.editor.setTheme(state.preferences.theme === "dark" ? "orion-local-dark" : "orion-local");
    }
    const tabSize = Number(state.preferences.tabSize || DEFAULT_PREFS.tabSize);
    const fontSize = Number(state.preferences.fontSize || DEFAULT_PREFS.fontSize);
    state.editor.updateOptions({
      fontFamily: "Consolas, 'Cascadia Mono', 'IBM Plex Mono', monospace",
      fontSize,
      lineHeight:  Math.round(fontSize * 1.7),
      cursorWidth: 2,
      cursorStyle: "line",
      fontLigatures: false,
      letterSpacing: 0,
      fontWeight: "400",
      wordWrap:    state.preferences.wordWrap  || DEFAULT_PREFS.wordWrap,
      tabSize:     tabSize,
      insertSpaces: state.preferences.tabSize !== "tab",
      minimap:     { enabled: !!state.preferences.minimap },
    });
    state.editor.layout();
  }
}

async function initMonaco() {
  return new Promise((resolve, reject) => {
    if (!window.require) return reject(new Error("Monaco loader missing"));
    window.require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" } });
    window.require.onError = err => reject(new Error("Monaco load failed: " + (err?.requireType || err?.message || err)));
    window.require(["vs/editor/editor.main"], async () => {
      window.monaco.editor.defineTheme("orion-local", {
        base:"vs", inherit:true,
        rules:[
          {token:"",               foreground:"1d2733", background:"ffffff"},
          {token:"comment",        foreground:"8b95a1", fontStyle:"italic"},
          {token:"keyword",        foreground:"8f6a33"},
          {token:"string",         foreground:"2f7d62"},
          {token:"number",         foreground:"a05a4f"},
          {token:"type.identifier",foreground:"364250"},
          {token:"delimiter",      foreground:"7d8794"},
        ],
        colors:{
          "editor.background":"#ffffff","editor.lineHighlightBackground":"#f7f9fc",
          "editor.selectionBackground":"#e8eef7","editorCursor.foreground":"#8f6a33",
          "editorLineNumber.foreground":"#a8b0ba","editorLineNumber.activeForeground":"#495463",
        },
      });
      window.monaco.editor.defineTheme("orion-local-dark", {
        base:"vs-dark", inherit:true,
        rules:[
          {token:"",               foreground:"e7edf4", background:"11161d"},
          {token:"comment",        foreground:"7f8a97", fontStyle:"italic"},
          {token:"keyword",        foreground:"efcf9a"},
          {token:"string",         foreground:"8fd8ba"},
          {token:"number",         foreground:"ffbe8a"},
          {token:"type.identifier",foreground:"dbe3ec"},
          {token:"delimiter",      foreground:"95a1af"},
        ],
        colors:{
          "editor.background":"#11161d","editor.lineHighlightBackground":"#19212b",
          "editor.selectionBackground":"#233040","editorCursor.foreground":"#efcf9a",
          "editorLineNumber.foreground":"#6b7682","editorLineNumber.activeForeground":"#d5dde6",
        },
      });

      try {
        if (document.fonts?.load) {
          await document.fonts.load(`${Number(state.preferences.fontSize || DEFAULT_PREFS.fontSize)}px "IBM Plex Mono"`);
          await document.fonts.ready;
        }
      } catch {}

      state.editor = window.monaco.editor.create(els.editorMount, {
        value:"", language:"markdown",
        theme: state.preferences.theme === "dark" ? "orion-local-dark" : "orion-local",
        fontFamily:"Consolas, 'Cascadia Mono', 'IBM Plex Mono', monospace",
        fontSize: Number(state.preferences.fontSize || DEFAULT_PREFS.fontSize),
        lineHeight: Math.round(Number(state.preferences.fontSize || DEFAULT_PREFS.fontSize) * 1.7),
        cursorWidth: 2,
        cursorStyle: "line",
        fontLigatures: false,
        letterSpacing: 0,
        fontWeight: "400",
        automaticLayout: true,
        minimap:{ enabled:false },
        smoothScrolling: true,
        wordWrap: state.preferences.wordWrap || DEFAULT_PREFS.wordWrap,
        scrollBeyondLastLine: false,
        padding:{ top:14, bottom:18 },
      });

      state.editor.onDidChangeModelContent(() => {
        const m = state.editor.getModel();
        if (!state.activeFile || !m || !state.workspace) return;
        state.workspace.files[state.activeFile] = m.getValue();
        if (els.workspaceSyncStat) els.workspaceSyncStat.textContent = "Unsaved edits";
        updateEditorMeta();
        scheduleAutoSave();
      });
      state.editor.onDidChangeCursorSelection(ev => {
        const ln  = ev.selection?.positionLineNumber || 1;
        const col = ev.selection?.positionColumn    || 1;
        if (els.editorSelection) els.editorSelection.textContent = `Ln ${ln}, Col ${col}`;
        if (els.statusBarLnCol)  els.statusBarLnCol.textContent  = `Ln ${ln}, Col ${col}`;
        // Persist cursor position for session restore (throttled — only save on idle)
        if (state.activeFile) {
          clearTimeout(state._cursorSaveTimer);
          state._cursorSaveTimer = setTimeout(() => {
            persistCursorForFile(state.activeFile, { lineNumber: ln, column: col });
          }, 800);
        }
      });

      // Register inline completions (ghost-text)
      registerInlineCompletions();

      // Activate built-in Monaco language workers for diagnostics + hover
      try {
        window.monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        });
        window.monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        });
        window.monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
          target: window.monaco.languages.typescript.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution: window.monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: window.monaco.languages.typescript.ModuleKind.CommonJS,
          allowJs: true,
          checkJs: true,
        });
      } catch {}

      syncEditor();
      applyPrefs();
      requestAnimationFrame(() => {
        if (state.editor) {
          state.editor.updateOptions({
            fontFamily: "Consolas, 'Cascadia Mono', 'IBM Plex Mono', monospace",
          });
          state.editor.layout();
        }
      });
      // Init diff editor
      initDiffEditor();
      // Fade out splash screen now that Monaco is ready
      const splash = document.getElementById("orion-splash");
      if (splash) {
        splash.classList.add("fade-out");
        setTimeout(() => { splash.remove(); }, 320);
      }
      resolve();
    });
  });
}

function getSelectedText() {
  if (!state.editor) return "";
  const sel = state.editor.getSelection();
  if (!sel || sel.isEmpty()) return "";
  return state.editor.getModel()?.getValueInRange(sel) || "";
}

function revealLine(lineNum) {
  if (!state.editor || !state.model || !Number(lineNum)) return;
  const safe = Math.max(1, Math.min(Number(lineNum), state.model.getLineCount()));
  state.editor.revealLineInCenter(safe);
  state.editor.setPosition({ lineNumber:safe, column:1 });
  state.editor.focus();
}

// â”€â”€ Panel updates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function quotaPercent(q) {
  if (!q) return 8;
  if (q.unlimited) return 100;
  return Math.min(100, Math.round((Number(q.used||0) / Math.max(1, Number(q.limit||0))) * 100));
}

function updateMission() {
  const signedIn    = !!state.session;
  const hasWorkspace = !!state.workspace?.rootDir;
  const label = !signedIn && !hasWorkspace ? "Sign in and open a workspace"
              : !signedIn  ? "Connect your Orion account"
              : !hasWorkspace ? "Choose your first project"
              : "Workspace online and Orion-ready";
  const hint  = !signedIn && !hasWorkspace ? "No workspace loaded"
              : !signedIn  ? (state.workspace?.rootDir || "Workspace loaded")
              : !hasWorkspace ? (state.profile?.username || state.session.user.email)
              : (state.activeFile || state.workspace.rootDir);
  if (els.missionLabel) els.missionLabel.textContent = label;
  if (els.missionHint)  els.missionHint.textContent  = hint;
}

function computeInsight(ws) {
  if (!ws?.files) return {
    languageCount:0, topLanguages:[], dominantLanguage:"No workspace",
    frameworks:[], packageManager:"", scripts:[], entryPoints:[],
    workspaceKind:"No workspace", recommendationLead:"Open a workspace", recommendations:[],
    hasReadme:false,
  };
  const counts = new Map();
  const paths  = Object.keys(ws.files);
  for (const fp of paths) {
    const l = titleCase(inferLang(fp));
    counts.set(l, (counts.get(l)||0)+1);
  }
  const topLanguages = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([label,count])=>({label,count}));

  let scripts=[], packageManager="", packageName="";
  if (ws.files["package.json"]) {
    try {
      const pkg  = JSON.parse(ws.files["package.json"]);
      scripts    = Object.keys(pkg?.scripts||{});
      packageName = pkg?.name || "";
      const f    = ws.files;
      packageManager = f["pnpm-lock.yaml"]?"pnpm":f["yarn.lock"]?"yarn":(f["bun.lock"]||f["bun.lockb"])?"bun":"npm";
    } catch {}
  }

  const frameworks = [];
  const af = (name, cond) => { if (cond && !frameworks.includes(name)) frameworks.push(name); };
  af("Electron", !!ws.files["main.js"] && !!ws.files["preload.js"]);
  af("Next.js",  !!ws.files["next.config.js"]||!!ws.files["next.config.mjs"]||!!ws.files["app/layout.tsx"]);
  af("React",    paths.some(p=>p.endsWith(".jsx")||p.endsWith(".tsx"))||/react/i.test(ws.files["package.json"]||""));
  af("Vite",     !!ws.files["vite.config.js"]||!!ws.files["vite.config.ts"]);
  af("Vue",      paths.some(p=>p.endsWith(".vue")));
  af("Svelte",   paths.some(p=>p.endsWith(".svelte")));
  af("Express",  /express/i.test(ws.files["package.json"]||""));
  af("Python",   paths.some(p=>p.endsWith(".py")));
  af("Rust",     !!ws.files["Cargo.toml"]);
  af("Go",       !!ws.files["go.mod"]);

  const entryPoints = ["src/main.ts","src/main.tsx","src/main.jsx","src/main.js","src/index.tsx","src/index.jsx","src/index.js","app/index.html","index.html","main.js","main.py","app.py","server.py"].filter(p=>Object.prototype.hasOwnProperty.call(ws.files,p));

  let workspaceKind = "General workspace";
  if (frameworks.includes("Electron"))     workspaceKind = "Electron desktop app";
  else if (frameworks.includes("Next.js")) workspaceKind = "Next.js web app";
  else if (frameworks.includes("React")||frameworks.includes("Vite")) workspaceKind = "Frontend web app";
  else if (frameworks.includes("Express")) workspaceKind = "Node backend service";
  else if (frameworks.includes("Python"))  workspaceKind = "Python application";
  else if (ws.files["index.html"])         workspaceKind = "Static website";

  const recommendations = [
    { title:"Understand the repo", detail:`Ask Orion for a walkthrough of this ${workspaceKind.toLowerCase()}.`, prompt:`Walk me through this ${workspaceKind.toLowerCase()} and explain the architecture, key files, and next risks.` },
    scripts.length ? { title:"Review execution flow", detail:`Inspect scripts: ${scripts.slice(0,3).join(", ")}.`, prompt:`Review the project scripts (${scripts.join(", ")}) and tell me the most important run paths and weak spots.` } : null,
    { title:"Improve the product", detail:"Push the UI toward a premium experience.", prompt:"Review the current UI and propose the strongest upgrades to make it feel launch-ready." },
  ].filter(Boolean);

  return { languageCount:counts.size, topLanguages, dominantLanguage:topLanguages[0]?.label||"Mixed",
    frameworks, packageManager, packageName, scripts:scripts.slice(0,6), entryPoints:entryPoints.slice(0,4),
    workspaceKind, recommendationLead:recommendations[0]?.title||"Open a workspace",
    recommendations, hasReadme:paths.some(p=>/^readme/i.test(baseName(p))) };
}

function updateWorkspacePanels() {
  state.workspaceInsight = computeInsight(state.workspace);
  const root = state.workspace?.rootDir || "No folder open";
  const git  = state.gitStatus || {};
  const gitLabel = !state.workspace ? "Git not connected"
                 : !git.available   ? "No git repo"
                 : git.dirty        ? `${git.branch} - ${git.changed} changed`
                 : `${git.branch} - clean`;

  if (els.workspacePath)    els.workspacePath.textContent    = root;
  if (els.workspaceSummary) els.workspaceSummary.textContent = state.workspace ? `${state.workspace.stats.fileCount} files indexed.` : "Waiting for a local project.";
  if (els.fileCount)        els.fileCount.textContent        = String(state.workspace?.stats?.fileCount||0);
  if (els.lineCount)        els.lineCount.textContent        = String(state.workspace?.stats?.lineCount||0);
  if (els.languageCount)    els.languageCount.textContent    = String(state.workspaceInsight.languageCount||0);
  if (els.workspaceHealth)  els.workspaceHealth.textContent  = state.workspace ? "Workspace ready" : "Waiting for workspace";
  if (els.workspaceHealthHint) els.workspaceHealthHint.textContent = state.workspace ? `${state.workspaceInsight.dominantLanguage} is the main language.` : "Open a local folder to map the codebase.";
  if (els.languageLead)     els.languageLead.textContent     = state.workspaceInsight.topLanguages[0]?.label || "No workspace";
  if (els.languageBars) {
    const total = Math.max(1, state.workspace?.stats?.fileCount||1);
    els.languageBars.innerHTML = state.workspaceInsight.topLanguages.map(e => {
      const w = Math.max(8, Math.round((e.count/total)*100));
      return `<div class="metric-row"><div class="metric-head"><span class="metric-label">${esc(e.label)}</span><span>${e.count} files</span></div><div class="metric-bar"><span class="metric-fill" style="width:${w}%"></span></div></div>`;
    }).join("") || `<div class="microcopy">Language distribution appears once a workspace is open.</div>`;
  }
  if (els.focusLead)        els.focusLead.textContent        = state.activeFile ? "Current editing context" : "No active context";
  if (els.focusLeadMirror)  els.focusLeadMirror.textContent  = els.focusLead?.textContent || "";
  if (els.currentFileStat)  els.currentFileStat.textContent  = state.activeFile || "None";
  if (els.openTabsStat)     els.openTabsStat.textContent     = String(state.openTabs.filter(f=>hasFile(f)).length);
  if (els.workspaceSyncStat) els.workspaceSyncStat.textContent = !state.workspace ? "Offline" : hasDirtyFiles() ? "Unsaved changes" : "Local disk";
  if (els.composerContext)  els.composerContext.textContent  = state.workspace ? `${state.workspace.stats.fileCount} files | ${root}` : "No workspace loaded";
  if (els.composerContextMirror) els.composerContextMirror.textContent = els.composerContext?.textContent || "";
  if (els.gitBranchLabel)   els.gitBranchLabel.textContent   = gitLabel;
  if (els.workspaceGitBadge) els.workspaceGitBadge.textContent = gitLabel;

  renderProjectInsights();
  renderQuickActions();
  renderChangesView();
  renderPromptSuggestions();
  updateMission();

  // Health score in status bar
  if (state.workspace) {
    const { score, grade } = computeHealth(state.workspace, state.gitStatus);
    if (els.healthStatusItem) els.healthStatusItem.style.display = "";
    if (els.healthStatusScore) {
      els.healthStatusScore.textContent = `${score} ${grade}`;
      const col = score >= 80 ? "#4ec986" : score >= 60 ? "#efcf9a" : "#f47174";
      els.healthStatusScore.style.color = col;
    }
    // Render health panel if visible
    renderHealthPanel(els.healthPanel, state.workspace, state.gitStatus);
    // Render memory panel if visible
    renderMemoryPanel(els.memoryPanel, state.workspace?.rootDir, renderPromptSuggestions);
  } else {
    if (els.healthStatusItem) els.healthStatusItem.style.display = "none";
  }

  // Git activity badge
  const changed = state.gitStatus?.changed || 0;
  if (els.gitChangeBadge) {
    els.gitChangeBadge.hidden  = changed === 0;
    els.gitChangeBadge.textContent = changed > 9 ? "9+" : String(changed);
  }
}

function detectLineEnding(text) {
  if (!text) return "LF";
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf   = (text.match(/(?<!\r)\n/g) || []).length;
  const cr   = (text.match(/\r(?!\n)/g) || []).length;
  if (crlf > lf && crlf > cr) return "CRLF";
  if (cr > lf)                 return "CR";
  return "LF";
}

function updateEditorMeta() {
  const fp      = state.activeFile || "No file selected";
  const content = currentFileContent();
  const lines   = state.activeFile ? countLines(content) : 0;
  const le      = state.activeFile ? detectLineEnding(content) : "LF";
  const lang    = state.activeFile ? titleCase(inferLang(fp)) : "Plain Text";

  if (els.activeFileName)    els.activeFileName.textContent    = state.activeFile || "None";
  if (els.editorTitle)       els.editorTitle.textContent       = state.activeFile && isDirty(state.activeFile) ? `${fp} *` : fp;
  if (els.editorPath)        els.editorPath.textContent        = fp;
  if (els.editorLanguage)    els.editorLanguage.textContent    = lang;
  if (els.editorMetrics)     els.editorMetrics.textContent     = state.activeFile ? `${lines}` : "0";
  if (els.editorEncoding)    els.editorEncoding.textContent    = "UTF-8";
  if (els.editorLineEnding)  els.editorLineEnding.textContent  = le;
  if (els.modelStat)         els.modelStat.textContent         = state.profile?.user_prefs?.desktop_model || "Auto";

  // ── Status bar updates ──────────────────────────────────────────────────────
  if (els.statusBarLang)  els.statusBarLang.textContent  = lang;

  // Git branch + dirty indicator
  const branch = state.gitStatus?.branch;
  if (els.statusBarGit) {
    els.statusBarGit.style.display = branch ? "" : "none";
    if (branch && els.statusBarBranch) els.statusBarBranch.textContent = branch;
  }
  if (els.statusBarDirtyDot) {
    els.statusBarDirtyDot.style.display = state.gitStatus?.dirty ? "" : "none";
  }

  // Monaco marker counts (errors/warnings) for active file
  if (state.editor && state.activeFile && window.monaco) {
    try {
      const model = state.editor.getModel();
      if (model) {
        const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
        const errors  = markers.filter(m => m.severity === window.monaco.MarkerSeverity.Error).length;
        const warns   = markers.filter(m => m.severity === window.monaco.MarkerSeverity.Warning).length;
        if (els.statusBarErrors)     els.statusBarErrors.style.display     = (errors + warns) > 0 ? "" : "none";
        if (els.statusBarErrorCount) els.statusBarErrorCount.textContent   = String(errors);
        if (els.statusBarWarnCount)  els.statusBarWarnCount.textContent    = String(warns);
      }
    } catch {}
  }

  updateWorkspacePanels();
}

function updateAccountPanels() {
  const name     = state.profile?.username || state.session?.user?.email || "Guest Operator";
  const role     = titleCase(state.profile?.role || "guest");
  const qText    = !state.session ? "Waiting for sign-in" : state.quota?.unlimited ? "Unlimited" : `${Number(state.quota?.used||0)} / ${Number(state.quota?.limit||0)} used`;
  const pct      = quotaPercent(state.quota);
  if (els.roleStat)       els.roleStat.textContent       = role;
  if (els.accountAvatar)  els.accountAvatar.textContent  = initials(name);
  if (els.accountName)    els.accountName.textContent    = name;
  if (els.accountMeta)    els.accountMeta.textContent    = state.session ? `${role} role.` : "Sign in to sync your Orion role.";
  if (els.quotaPanelText) els.quotaPanelText.textContent = qText;
  if (els.quotaLead)      els.quotaLead.textContent      = state.quota?.unlimited ? "Unlimited" : state.session ? "Tracked" : "Awaiting account";
  if (els.quotaPanelFill) els.quotaPanelFill.style.width = `${pct}%`;
  if (els.modelStat)      els.modelStat.textContent      = state.profile?.user_prefs?.desktop_model || "Auto";
  syncAuthBtns();
  updateMission();
}

function syncAuthBtns() {
  const in_ = !!state.session;
  if (els.authOpenBtn)  { els.authOpenBtn.textContent = in_ ? "Sign Out" : "Sign In"; els.authOpenBtn.disabled = false; }
  if (els.emptyAuthBtn) { els.emptyAuthBtn.textContent = in_ ? "Connected" : "Sign In"; els.emptyAuthBtn.disabled = in_; }
}

// â”€â”€ Global Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderGlobalSearch(query) {
  if (!els.globalSearchResults || !els.globalSearchMeta) return;
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 3) {
    els.globalSearchMeta.textContent = "Enter at least 3 characters";
    els.globalSearchResults.innerHTML = "";
    return;
  }
  const hits = [];
  const files = state.workspace?.files || {};
  for (const [fp, content] of Object.entries(files)) {
    const lines = String(content || "").split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (hits.length >= 40) return;
      const lower = line.toLowerCase();
      const pos   = lower.indexOf(q);
      if (pos === -1) return;
      // Highlight the match
      const before  = esc(line.slice(0, pos));
      const match   = esc(line.slice(pos, pos + q.length));
      const after   = esc(line.slice(pos + q.length));
      hits.push({ fp, lineNum: idx + 1, html: `${before}<mark>${match}</mark>${after}`, raw: line });
    });
  }
  els.globalSearchMeta.textContent = hits.length ? `${hits.length} result${hits.length === 1 ? "" : "s"}${hits.length === 40 ? " (capped)" : ""}` : "No results";
  els.globalSearchResults.innerHTML = hits.map(h => `
    <button class="search-hit" type="button" data-path="${esc(h.fp)}" data-line="${h.lineNum}">
      <span class="search-hit-file">${esc(baseName(h.fp))} <span style="font-weight:400;color:var(--muted-2)">:${h.lineNum}</span></span>
      <span class="search-hit-line">${h.html}</span>
    </button>`).join("");
}

const debouncedGlobalSearch = debounce(query => renderGlobalSearch(query), 200);

// â”€â”€ Git panels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function changedFileCard(file, compact=false) {
  const btns = [];
  if (file.untracked||file.unstaged) btns.push(`<button class="ghost-btn tiny" type="button" data-git-action="stage"   data-git-path="${esc(file.path)}">Stage</button>`);
  if (file.staged&&!file.untracked)  btns.push(`<button class="ghost-btn tiny" type="button" data-git-action="unstage" data-git-path="${esc(file.path)}">Unstage</button>`);
  if (file.unstaged||file.untracked) btns.push(`<button class="ghost-btn tiny danger" type="button" data-git-action="discard" data-git-path="${esc(file.path)}">Discard</button>`);
  return `<div class="changed-file ${compact?"compact":""}">
    <strong>${esc(file.path)}</strong><span>${esc(file.label)}</span>
    <div class="changed-file-actions">
      <button class="ghost-btn tiny" type="button" data-path="${esc(file.path)}">Open</button>
      <button class="ghost-btn tiny" type="button" data-diff-path="${esc(file.path)}">Diff</button>
      ${btns.join("")}
    </div>
  </div>`;
}

async function renderGitLog() {
  const pane = document.getElementById("gitLogPane");
  if (!pane || !state.workspace?.rootDir) {
    if (pane) pane.innerHTML = '<div class="microcopy" style="padding:12px">Open a git workspace to see commit history.</div>';
    return;
  }
  pane.innerHTML = '<div class="microcopy" style="padding:12px">Loading...</div>';
  try {
    const result = await window.orionDesktop.getGitLog({ rootDir: state.workspace.rootDir, limit: 40 });
    if (!result?.ok || !result.commits?.length) {
      pane.innerHTML = '<div class="microcopy" style="padding:12px">No commits found.</div>';
      return;
    }
    pane.innerHTML = result.commits.map(c => `
      <div class="git-log-entry">
        <span class="git-log-hash">${esc(c.short)}</span>
        <span class="git-log-msg">${esc(c.message)}</span>
        <span class="git-log-author">${esc(c.author)}</span>
        <span class="git-log-date">${esc(c.date)}</span>
      </div>`).join("");
  } catch (err) {
    pane.innerHTML = '<div class="microcopy" style="padding:12px">Could not load git log: ' + esc(err.message) + '</div>';
  }
}

async function renderSymbolOutline() {
  const panel   = document.getElementById("symbolsPanel");
  const nameEl  = document.getElementById("symbolsFilename");
  if (!panel) return;

  if (!state.activeFile || !window.monaco) {
    panel.innerHTML = '<div class="microcopy" style="padding:12px">Open a file to see its symbols.</div>';
    if (nameEl) nameEl.textContent = "No file open";
    return;
  }

  if (nameEl) nameEl.textContent = baseName(state.activeFile);

  try {
    const model = state.editor?.getModel();
    if (!model) { panel.innerHTML = '<div class="microcopy" style="padding:12px">No editor model.</div>'; return; }

    // getDocumentSymbols is provided by Monaco language workers (TS/JS/JSON/etc.)
    const symbols = await window.monaco.languages.getDocumentSymbols?.call(null, model, new window.monaco.CancellationTokenSource().token)
      ?? await window.monaco.editor.getModel(model.uri)?._commandService
        ?.executeCommand("vscode.executeDocumentSymbolProvider", model.uri)
        .catch(() => null);

    // Fallback: use Monaco's built-in action to get symbols via worker tokens
    let syms = null;
    if (!syms) {
      // Use the language worker directly
      const worker = await window.monaco.languages.typescript?.getJavaScriptWorker?.()
        .then(w => w(model.uri)).catch(() => null);
      const ts = worker && await worker.getNavigationTree?.(String(model.uri)).catch(() => null);
      if (ts) {
        syms = flattenTsNavTree(ts, model);
      }
    }

    // Ultimate fallback: regex-scan for common patterns
    if (!syms || !syms.length) {
      syms = scanSymbolsFromText(model.getValue(), state.activeFile);
    }

    if (!syms || !syms.length) {
      panel.innerHTML = '<div class="microcopy" style="padding:12px">No symbols found.</div>';
      return;
    }

    panel.innerHTML = syms.map(s => `
      <button class="symbol-row" data-line="${s.line}" type="button" title="${esc(s.name)} · line ${s.line}">
        <span class="symbol-kind-badge symbol-kind-${(s.kind||'').toLowerCase()}">${kindIcon(s.kind)}</span>
        <span class="symbol-name">${esc(s.name)}</span>
        <span class="symbol-line">${s.line}</span>
      </button>`).join("");

    panel.querySelectorAll(".symbol-row").forEach(btn => {
      btn.addEventListener("click", () => {
        const ln = Number(btn.dataset.line);
        if (ln) revealLine(ln);
        setActivity("explorer"); // switch back to file view after jump
      });
    });
  } catch {
    panel.innerHTML = '<div class="microcopy" style="padding:12px">Could not load symbols.</div>';
  }
}

function flattenTsNavTree(node, model, out = [], depth = 0) {
  if (!node) return out;
  if (depth > 0 && node.text && node.kind) {
    const spans = node.spans || [];
    const pos   = spans[0] ? model.getPositionAt(spans[0].start) : null;
    out.push({ name: node.text, kind: mapTsKind(node.kind), line: pos?.lineNumber || 1 });
  }
  (node.childItems || []).forEach(c => flattenTsNavTree(c, model, out, depth + 1));
  return out;
}

function mapTsKind(kind) {
  const m = { "function":"function", "method":"method", "class":"class", "interface":"interface",
               "module":"module", "const":"const", "let":"const", "var":"const",
               "property":"property", "enum":"enum", "alias":"type" };
  return m[kind] || kind || "symbol";
}

function scanSymbolsFromText(text, filePath) {
  const lines  = text.split("\n");
  const lang   = inferLang(filePath || "");
  const out    = [];
  const seen   = new Set();

  const patterns = [
    // JS/TS
    { re: /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,        kind: "function" },
    { re: /^\s*(?:export\s+)?(?:default\s+)?class\s+(\w+)/,          kind: "class" },
    { re: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/, kind: "function" },
    { re: /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/, kind: "function" },
    { re: /^\s*(?:export\s+)?interface\s+(\w+)/,                     kind: "interface" },
    { re: /^\s*(?:export\s+)?type\s+(\w+)\s*=/,                      kind: "type" },
    { re: /^\s*(?:export\s+)?enum\s+(\w+)/,                          kind: "enum" },
    { re: /^\s*(?:(?:public|private|protected|static|async)\s+)*(\w+)\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{/, kind: "method" },
    // Python
    { re: /^(?:async\s+)?def\s+(\w+)\s*\(/,                          kind: "function" },
    { re: /^class\s+(\w+)/,                                           kind: "class" },
    // CSS/SCSS
    { re: /^([.#][\w-]+(?:\s*,\s*[.#][\w-]+)*)\s*\{/,               kind: "selector" },
  ];

  lines.forEach((line, i) => {
    for (const { re, kind } of patterns) {
      const m = line.match(re);
      if (m && m[1] && !seen.has(m[1])) {
        seen.add(m[1]);
        out.push({ name: m[1], kind, line: i + 1 });
        break;
      }
    }
  });

  return out;
}

function kindIcon(kind) {
  const icons = { function:"ƒ", method:"m", class:"C", interface:"I", type:"T",
                  enum:"E", const:"k", property:"p", selector:".", symbol:"◆", module:"M" };
  return icons[(kind||"").toLowerCase()] || "◆";
}

function renderChangesView() {
  const git = state.gitStatus || {};
  if (els.changesSummary) els.changesSummary.textContent = !state.workspace ? "Open a git-backed workspace."
    : !git.available ? "This workspace is not a git repository."
    : git.dirty ? `${git.changed} change${git.changed===1?"":"s"} on ${git.branch}.`
    : `${git.branch} is clean.`;
  if (els.changesLead) els.changesLead.textContent = !state.workspace ? "No repo" : !git.available ? "No git repo" : git.dirty ? `${git.branch} has changes` : `${git.branch} - clean`;

  if (!els.changesGroups) return;
  if (!state.workspace||!git.available) { els.changesGroups.innerHTML = `<div class="microcopy">Open a git repository to inspect changes.</div>`; return; }

  const groups = [
    { title:"Staged",    items:(git.files||[]).filter(f=>f.staged&&!f.untracked) },
    { title:"Unstaged",  items:(git.files||[]).filter(f=>f.unstaged) },
    { title:"Untracked", items:(git.files||[]).filter(f=>f.untracked) },
  ].filter(g=>g.items.length);

  els.changesGroups.innerHTML = groups.length
    ? groups.map(g=>`<section class="changes-group">
        <div class="changes-group-header"><strong>${esc(g.title)}</strong><span>${g.items.length} file${g.items.length===1?"":"s"}</span></div>
        <div class="changes-list">${g.items.map(f=>changedFileCard(f,true)).join("")}</div>
      </section>`).join("")
    : `<div class="microcopy">No changed files. Working tree is clean.</div>`;

  // Show commit button if there are staged files
  const stagedCount = (git.files||[]).filter(f=>f.staged&&!f.untracked).length;
  if (els.gitCommitBtn) {
    els.gitCommitBtn.hidden = stagedCount === 0;
    els.gitCommitBtn.textContent = `Commit ${stagedCount} staged file${stagedCount===1?"":"s"}`;
  }
}

function renderProjectInsights() {
  const insight = state.workspaceInsight || {};
  const git     = state.gitStatus        || {};
  if (els.projectTypeLead) els.projectTypeLead.textContent = insight.workspaceKind || "No workspace";
  if (els.projectInsightList) {
    const rows = [
      { title:"Primary stack", detail: insight.frameworks?.length ? insight.frameworks.join(" | ") : (insight.dominantLanguage||"No workspace") },
      { title:"Run strategy",  detail: insight.scripts?.length ? `${insight.packageManager||"pkg"} scripts: ${insight.scripts.join(", ")}` : "No package scripts" },
      { title:"Entry points",  detail: insight.entryPoints?.length ? insight.entryPoints.join(", ") : "None detected" },
      { title:"Docs",          detail: insight.hasReadme ? "README present" : "No README at root" },
    ];
    els.projectInsightList.innerHTML = rows.map(r=>`<div class="insight-row"><strong>${esc(r.title)}</strong><span>${esc(r.detail)}</span></div>`).join("");
  }
  if (els.gitSummaryLead) els.gitSummaryLead.textContent = !state.workspace ? "No repo" : !git.available ? "No git repo" : git.dirty ? `${git.branch} needs review` : `${git.branch} - clean`;
  if (els.gitStatsPanel) {
    const rows = !state.workspace||!git.available
      ? [["Branch","None"],["Changed","0"],["Ahead/Behind","0 / 0"]]
      : [["Branch",git.branch||"unknown"],["Changed",String(git.changed||0)],["Staged",String(git.staged||0)],["Unstaged",String(git.unstaged||0)],["Untracked",String(git.untracked||0)],["Ahead/Behind",`${git.ahead||0} / ${git.behind||0}`]];
    els.gitStatsPanel.innerHTML = rows.map(([l,v])=>`<div class="info-row"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join("");
  }
  if (els.gitFilesLead) els.gitFilesLead.textContent = !state.workspace ? "No repo" : !git.available ? "No git repo" : git.files?.length ? `${git.files.length} change${git.files.length===1?"":"s"}` : "Working tree clean";
  if (els.gitChangedFiles) {
    els.gitChangedFiles.innerHTML = !state.workspace||!git.available
      ? `<div class="microcopy">Open a git-backed workspace to inspect changed files.</div>`
      : git.files?.length ? git.files.slice(0,12).map(f=>changedFileCard(f)).join("") : `<div class="microcopy">No changed files.</div>`;
  }
  if (els.workspaceNextLead) els.workspaceNextLead.textContent = insight.recommendationLead||"Open a workspace";
  if (els.workspaceRecommendations) {
    els.workspaceRecommendations.innerHTML = (insight.recommendations||[]).map(r=>`<button class="recommendation-card" type="button" data-recommendation-prompt="${esc(r.prompt)}"><strong>${esc(r.title)}</strong><span>${esc(r.detail)}</span></button>`).join("") || `<div class="microcopy">Open a workspace to see recommendations.</div>`;
  }
}

function renderQuickActions() {
  if (!els.quickActionGrid) return;
  const k  = state.workspaceInsight?.workspaceKind || "project";
  const af = state.activeFile || "the current file";
  const actions = [
    { title:"Review code",       detail:"Find bugs and missing tests.", prompt:`Review this ${k.toLowerCase()} for bugs, regressions, and missing tests. Findings first.` },
    { title:"Debug active file", detail:`Trace the issue in ${af}.`,    prompt:`Debug ${af} and tell me the root cause first, then patch it.` },
    { title:"Plan next build",   detail:"Turn the repo state into steps.", prompt:`Plan the next implementation steps for this ${k.toLowerCase()}.` },
    { title:"Explain architecture", detail:"Break down how the repo works.", prompt:`Explain the architecture of this ${k.toLowerCase()}, including key files and flows.` },
  ];
  els.quickActionGrid.innerHTML = actions.map(a=>`<button class="quick-action" type="button" data-prompt="${esc(a.prompt)}"><strong>${esc(a.title)}</strong><span>${esc(a.detail)}</span></button>`).join("");
}

function renderEmptyGuide() {
  if (!els.emptyGuideGrid) return;
  const cards = [
    { title:"Understand a repo", detail:"Open a workspace, then let Orion map the architecture.", action:"choose-workspace", label:"Open project" },
    { title:"Patch code safely", detail:"Open the file, then use Patch or Review.", action:"focus-chat", label:"Open Orion" },
    { title:"Ship faster",       detail:"Use the command palette for everything.", action:"open-command-palette", label:"Open commands" },
    { title:"Take a tour",       detail:"Step-by-step introduction to Orion IDE.", action:"start-tour", label:"Start tour" },
  ];
  els.emptyGuideGrid.innerHTML = cards.map(c=>`<div class="empty-guide-card"><strong>${esc(c.title)}</strong><span>${esc(c.detail)}</span><button class="ghost-btn tiny" type="button" data-empty-action="${esc(c.action)}">${esc(c.label)}</button></div>`).join("");
}

// â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderTabs() {
  if (!els.tabbar) return;
  els.tabbar.innerHTML = state.openTabs.filter(f=>hasFile(f)).map(f=>`
    <button class="tab ${f===state.activeFile?"active":""}" type="button" data-tab="${esc(f)}">
      <span class="tab-label">${esc(f.split("/").pop())}</span>
      ${isDirty(f)?'<span class="tab-dirty" aria-hidden="true"></span>':""}
      <span class="tab-close" role="button" tabindex="-1" data-close-tab="${esc(f)}">&times;</span>
    </button>`).join("");
}

// â”€â”€ Breadcrumb â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderBreadcrumb() {
  if (!els.breadcrumbNav || !els.breadcrumbEmpty) return;
  if (!state.activeFile) {
    els.breadcrumbEmpty.hidden = false;
    els.breadcrumbNav.hidden   = true;
    return;
  }
  els.breadcrumbEmpty.hidden = true;
  els.breadcrumbNav.hidden   = false;
  const parts = state.activeFile.split("/");
  els.breadcrumbNav.innerHTML = parts.map((seg, i) => {
    const isLast = i === parts.length - 1;
    const pathTo = parts.slice(0, i + 1).join("/");
    return [
      `<button class="breadcrumb-seg${isLast ? " active" : ""}" type="button" data-breadcrumb-path="${esc(pathTo)}">${esc(seg)}</button>`,
      isLast ? "" : `<span class="breadcrumb-sep" aria-hidden="true"> / </span>`,
    ].join("");
  }).join("");
}

function closeTab(fp) {
  const p = normalizeRelPath(fp);
  state.openTabs = state.openTabs.filter(t=>t!==p);
  if (state.activeFile===p) state.activeFile = state.openTabs[state.openTabs.length-1] || "";
  persistSession();
  renderTabs(); renderTree(); syncEditor();
}

// â”€â”€ Recent workspaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderRecentWorkspaceList(targetId, emptyMsg) {
  const target = els[targetId];
  if (!target) return;
  if (!state.recentWorkspaces.length) {
    target.innerHTML = targetId === "recentWorkspacesPanel"
      ? `<div class="microcopy">${esc(emptyMsg)}</div>`
      : "";
    return;
  }
  const isPanel = targetId === "recentWorkspacesPanel";
  const fmt = v => {
    if (!v) return "Opened before";
    const d = new Date(v);
    return isNaN(d) ? "Opened before" : `Opened ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  };
  const lead = isPanel
    ? `<div class="recent-header">
        <strong>Recent Workspaces</strong>
        <span class="microcopy">Jump back into active projects</span>
        <button class="ghost-btn tiny recent-clear-all-btn" type="button" title="Remove all recent workspaces">Clear all</button>
       </div>`
    : `<div class="recent-header"><strong>Pick up where you left off</strong></div>`;
  const items = state.recentWorkspaces.map(e => `
    <div class="recent-item-wrap" data-rootdir="${esc(e.rootDir)}">
      <button class="recent-item" type="button" data-recent-workspace="${esc(e.rootDir)}">
        <strong>${esc(e.label || baseName(e.rootDir))}</strong>
        <span class="recent-path">${esc(e.rootDir)}</span>
        <span class="recent-date">${esc(fmt(e.openedAt))}</span>
      </button>
      <button class="recent-remove-btn" type="button" data-remove-workspace="${esc(e.rootDir)}" title="Remove from recent workspaces" aria-label="Remove ${esc(e.label || baseName(e.rootDir))}">&#215;</button>
    </div>`).join("");
  target.innerHTML = `${lead}<div class="recent-list">${items}</div>`;
}

function renderRecentWorkspaces() {
  renderRecentWorkspaceList("recentWorkspacesPanel","Open a project and it will appear here.");
  renderRecentWorkspaceList("emptyRecentWorkspaces","");
  if (els.workspaceRecentLead) els.workspaceRecentLead.textContent = state.recentWorkspaces.length ? `${state.recentWorkspaces.length} recent workspace${state.recentWorkspaces.length===1?"":"s"}` : "No recent workspaces yet";
}

function handleRecentRemove(rootDir) {
  if (!rootDir) return;
  // Animate all matching cards out before removing from state
  const wraps = document.querySelectorAll(`[data-rootdir="${CSS.escape(rootDir)}"]`);
  wraps.forEach(wrap => {
    const h = wrap.offsetHeight;
    wrap.style.maxHeight   = h + "px";
    wrap.style.overflow    = "hidden";
    // Force reflow so transition fires
    void wrap.offsetHeight;
    wrap.style.transition  = "opacity 140ms ease, transform 140ms ease, max-height 200ms ease 80ms, margin 200ms ease 80ms";
    wrap.style.opacity     = "0";
    wrap.style.transform   = "translateX(-10px)";
    wrap.style.maxHeight   = "0";
    wrap.style.marginTop   = "0";
    wrap.style.marginBottom = "0";
  });
  setTimeout(() => {
    removeRecentWorkspace(rootDir);
    renderRecentWorkspaces();
  }, 260);
}

// â”€â”€ Smart Prompt Suggestions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildSmartSuggestions() {
  const fp   = state.activeFile || "";
  const kind = state.workspaceInsight?.workspaceKind || "";
  const hasPatch = !!state.pendingPatch?.entries?.length;

  const suggestions = [];

  if (hasPatch) {
    suggestions.push({ icon:"ðŸ§ª", text:`Write tests for the changes Orion just made` });
  }

  if (fp) {
    const e = ext(fp);
    if (["js","ts","jsx","tsx","py","go","rs"].includes(e)) {
      suggestions.push({ icon:"RV", text:`Review ${baseName(fp)} for bugs and security issues` });
      suggestions.push({ icon:"EX", text:`Explain how ${baseName(fp)} works` });
    } else if (["json"].includes(e) && fp.includes("package")) {
      suggestions.push({ icon:"PK", text:`Are any dependencies in package.json outdated or vulnerable?` });
    } else if (["md"].includes(e)) {
      suggestions.push({ icon:"RD", text:`Improve the clarity and completeness of this README` });
    } else if (["css","scss"].includes(e)) {
      suggestions.push({ icon:"UI", text:`Review ${baseName(fp)} for redundancy and improvements` });
    } else if (["sql"].includes(e)) {
      suggestions.push({ icon:"DB", text:`Optimize the queries in ${baseName(fp)}` });
    }
  }

  if (!fp && state.workspace) {
    suggestions.push({ icon:"AR", text:`Walk me through this ${kind.toLowerCase()} and explain the architecture` });
    suggestions.push({ icon:"NX", text:`What are the most important improvements I should make next?` });
  }

  if (state.gitStatus?.dirty) {
    suggestions.push({ icon:"ðŸ“", text:`Generate a commit message for my staged changes` });
  }

  return suggestions.slice(0, 3);
}

function renderPromptSuggestions() {
  if (!els.promptSuggestions) return;
  const suggestions = buildSmartSuggestions();
  if (!suggestions.length || !state.workspace) {
    els.promptSuggestions.innerHTML = "";
    return;
  }
  els.promptSuggestions.innerHTML = suggestions.map(s => `
    <button class="prompt-chip" type="button" data-suggestion-prompt="${esc(s.text)}">
      <span class="prompt-chip-icon">${s.icon}</span>
      <span>${esc(s.text)}</span>
    </button>`).join("");
}

// â”€â”€ Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderChat() {
  if (!els.chatFeed) return;
  els.chatFeed.innerHTML = state.chat.map(m => {
    const view = getChatMessageView(m);
    const feedbackHtml = m.sender === "assistant" && !m.pending
      ? renderFeedbackButtons(m.id || "")
      : "";
    return `
    <article class="chat-message ${m.sender}${m.pending ? " pending" : ""}" data-msg-id="${m.id || ""}">
      <div class="chat-meta">
        <strong>${view.label}</strong>
        <span>${esc(m.ts)}</span>
      </div>
      ${view.kicker ? `<div class="chat-kicker">${esc(view.kicker)}</div>` : ""}
      <div class="chat-body">${renderMD(view.body)}</div>
      ${view.notes.length ? `<div class="chat-notes">${view.notes.map(note => `<span class="chat-note">${esc(note)}</span>`).join("")}</div>` : ""}
      ${feedbackHtml}
      ${Array.isArray(m.sources)&&m.sources.length?`<div class="sources">${m.sources.slice(0,5).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title||s.url)}</a>`).join("")}</div>`:""}
    </article>`;
  }).join("");
  els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
  syncThinkingIndicator();
}

function pushChat(sender, text, extra={}) {
  state.chat.push({
    id:`m_${Date.now()}_${Math.random().toString(16).slice(2,8)}`,
    sender,
    text,
    ts:stamp(),
    sources:extra.sources||[],
    pending: !!extra.pending,
    filesPrepared: extra.filesPrepared || 0,
    codeHidden: !!extra.codeHidden,
  });
  state.chat = state.chat.slice(-80);
  persistChat();
  renderChat();
}

function clearChatHistory() {
  state.chat = [];
  state.pendingRequests = 0;
  persistChat();
  if (els.chatInput) els.chatInput.value = "";
  if (els.sessionStat) els.sessionStat.textContent = "Idle";
  setRightView("chat");
  renderChat();
  showToast("Started a fresh Orion chat");
  addTrace("warn","New chat started","Cleared conversation history.",{scope:"chat"});
  log("info","Started a fresh Orion chat session.","terminal");
}

function stripCodeBlocks(text) {
  return String(text || "").replace(/```[\s\S]*?```/g, "\n");
}

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildAssistantOverview(text, m = {}) {
  const raw = String(text || "");
  const withoutCode = normalizeWhitespace(stripCodeBlocks(raw));
  const hasCodeBlocks = /```/.test(raw);
  const fileCount = Number(m.filesPrepared || 0);
  const pendingPatchCount = state.pendingPatch?.entries?.length || 0;

  let body = withoutCode;

  if (m.pending && !body) {
    body = "Working on your request...";
  }

  if (!body) {
    const total = fileCount || pendingPatchCount;
    if (total > 0) {
      const names = (state.pendingPatch?.entries || []).map(e => e.filePath).join(", ");
      body = total === 1
        ? `Generated ${names || "1 file"} — review in the patch panel.`
        : `Generated ${total} files${names ? ` (${names})` : ""} — review in the patch panel.`;
    } else if (hasCodeBlocks) {
      body = "Code generated. Check the patch panel to apply changes.";
    } else {
      body = "Done.";
    }
  }

  // Append file list summary if files were prepared and not mentioned in body
  const patchEntries = state.pendingPatch?.entries || [];
  const fileListNote = patchEntries.length > 0 && !withoutCode.includes(patchEntries[0].filePath)
    ? `

Files ready to apply: ${patchEntries.map(e => `\`${e.filePath}\``).join(", ")}`
    : "";

  const notes = [];
  if (fileCount > 0 || pendingPatchCount > 0) {
    const total = fileCount || pendingPatchCount;
    notes.push(`${total} file${total === 1 ? "" : "s"} ready`);
  }
  if (m.pending) notes.push("Generating...");

  return {
    label: "Orion",
    kicker: m.pending ? "Working..." : (fileCount > 0 || pendingPatchCount > 0 ? "Files ready to apply" : "Response"),
    body: body + fileListNote,
    notes,
    codeHidden: hasCodeBlocks,
  };
}

function getChatMessageView(m) {
  if (m.sender !== "assistant") {
    return {
      label: "You",
      kicker: "",
      body: String(m.text || ""),
      notes: [],
    };
  }
  return buildAssistantOverview(m.text, m);
}

// â”€â”€ Thinking indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateLogBadge() {
  const btn = document.querySelector('[data-right-view="log"]');
  if (!btn) return;
  const count = getActionLog().length;
  // Remove existing badge
  btn.querySelector(".log-badge")?.remove();
  if (count > 0) {
    const badge = document.createElement("span");
    badge.className = "log-badge";
    badge.textContent = count > 9 ? "9+" : String(count);
    btn.appendChild(badge);
  }
}

function syncThinkingIndicator() {
  if (!els.thinkingIndicator) return;
  const hasPendingMessage = state.chat.some(m => m.sender === "assistant" && m.pending);
  const active = state.pendingRequests > 0 || hasPendingMessage;
  els.thinkingIndicator.hidden = !active;
}

function setThinking(active) {
  state.pendingRequests = Math.max(0, state.pendingRequests + (active ? 1 : -1));
  syncThinkingIndicator();
}

// â”€â”€ Workspace file operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function refreshGitStatus(rootDir = state.workspace?.rootDir) {
  if (!rootDir) { state.gitStatus = { ok:true, available:false, branch:"", changed:0, dirty:false, ahead:0, behind:0 }; updateWorkspacePanels(); return; }
  try {
    const r = await window.orionDesktop.getWorkspaceGitStatus(rootDir);
    state.gitStatus = r || { ok:true, available:false, branch:"", changed:0, dirty:false, ahead:0, behind:0 };
  } catch (err) {
    state.gitStatus = { ok:false, available:false, branch:"", changed:0, dirty:false, ahead:0, behind:0, error:err?.message };
  }
  updateWorkspacePanels();
}

async function writeCurrentFile() {
  if (!state.workspace||!state.activeFile) return;
  await window.orionDesktop.writeFile({ rootDir:state.workspace.rootDir, relativePath:normalizeRelPath(state.activeFile), content:currentFileContent() });
  state.diskFiles[normalizeRelPath(state.activeFile)] = currentFileContent();
  if (els.workspaceSyncStat) els.workspaceSyncStat.textContent = "Saved";
  log("success",`Saved \`${state.activeFile}\` to disk.`,"terminal");
  addTrace("success","File saved",`${state.activeFile} written to workspace.`,{scope:"editor"});
  renderTabs(); renderTree();
  await refreshGitStatus();
  updateWorkspacePanels();
  showToast(`Saved ${state.activeFile}`);
}

function setActiveFile(fp) {
  const p = normalizeRelPath(fp);
  if (!hasFile(p)) return;
  const parts = p.split("/").slice(0,-1);
  let cur = "";
  for (const seg of parts) { cur = cur ? `${cur}/${seg}` : seg; state.expandedFolders.add(cur); }
  persistExpandedFolders();
  state.activeFile = p;
  if (!state.openTabs.includes(p)) state.openTabs.push(p);
  persistSession();
  renderTree(); renderTabs(); syncEditor();
  renderBreadcrumb();
  renderPromptSuggestions();
  // Refresh symbol outline if it's the active panel
  if (state.activeActivity === "symbols") renderSymbolOutline();
  addTrace("info","File focused",`Editor moved to ${p}.`,{scope:"editor"});
}

async function loadWorkspaceSnapshot(snapshot, opts={}) {
  if (!snapshot) return;
  const { preserveTabs=false, preferredFile="", announce="Opened workspace" } = opts;
  showTreeSkeleton();
  clearModels();
  state.workspace = snapshot;
  state.diskFiles = copyFiles(snapshot.files);
  state.expandedFolders = new Set(["src","app","public","assets",...Array.from(state.expandedFolders)]);
  persistExpandedFolders();

  if (!preserveTabs) {
    // Attempt to restore the previous session (tabs + active file) for this workspace
    const session = loadSessionTabs();
    const sameWorkspace = session && state.workspace?.rootDir === localStorage.getItem(STORAGE_KEYS.workspacePath);
    if (sameWorkspace && session.openTabs?.length) {
      const validTabs = session.openTabs.map(normalizeRelPath).filter(f => hasFile(f));
      const validActive = normalizeRelPath(session.activeFile || "");
      state.openTabs   = validTabs.length ? validTabs : [Object.keys(snapshot.files)[0] || ""].filter(Boolean);
      state.activeFile = (validActive && hasFile(validActive)) ? validActive : (state.openTabs[0] || "");
    } else {
      state.activeFile = Object.keys(snapshot.files)[0] || "";
      state.openTabs   = state.activeFile ? [state.activeFile] : [];
    }
  } else {
    state.openTabs  = state.openTabs.map(normalizeRelPath).filter(f=>hasFile(f));
    const pref      = normalizeRelPath(preferredFile);
    state.activeFile = normalizeRelPath(state.activeFile);
    if (pref && hasFile(pref)) { state.activeFile = pref; if (!state.openTabs.includes(pref)) state.openTabs.push(pref); }
    else if (!hasFile(state.activeFile)) state.activeFile = Object.keys(snapshot.files)[0]||"";
  }

  localStorage.setItem(STORAGE_KEYS.workspacePath, snapshot.rootDir);
  rememberRecentWorkspace(snapshot.rootDir);
  loadMemory(snapshot.rootDir);
  await refreshGitStatus(snapshot.rootDir);
  updateWorkspacePanels();
  renderTree(); renderTabs(); syncEditor();
  if (announce) { log("success",`${announce} \`${snapshot.rootDir}\`.`,"terminal"); addTrace("success","Workspace opened",`${snapshot.stats.fileCount} files indexed.`,{scope:"workspace"}); }
  renderRecentWorkspaces();
}

async function chooseWorkspace() {
  const snap = await window.orionDesktop.chooseWorkspace();
  // null = user cancelled; {ok:false} = error from IPC handler
  if (!snap || snap.ok === false) {
    if (snap?.error) showToast(`Could not open workspace: ${snap.error}`, "error");
    return;
  }
  await loadWorkspaceSnapshot(snap, { announce:"Opened workspace" });
}

async function openRecentWorkspace(rootDir) {
  if (!rootDir) return;
  const snap = await window.orionDesktop.reloadWorkspace(rootDir);
  if (!snap || snap.ok === false) { showToast("Could not reopen that workspace", "error"); return; }
  await loadWorkspaceSnapshot(snap, { announce:"Reopened workspace" });
}

async function reloadWorkspace(rootOverride="", preferredFile="") {
  const d = rootOverride || state.workspace?.rootDir || localStorage.getItem(STORAGE_KEYS.workspacePath);
  if (!d) return;
  const snap = await window.orionDesktop.reloadWorkspace(d);
  if (!snap || snap.ok === false) return;
  await loadWorkspaceSnapshot(snap, { preserveTabs:true, preferredFile, announce:"" });
  log("info","Workspace reloaded from disk.","terminal");
  addTrace("info","Workspace refreshed","Re-indexed from disk.",{scope:"workspace"});
}

// â”€â”€ Action modal (path/text input) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openActionModal(config) {
  state.actionRequest = config;
  if (els.actionLabel)      els.actionLabel.textContent      = config.label||"Action";
  if (els.actionTitle)      els.actionTitle.textContent      = config.title||"Enter a path";
  if (els.actionDescription) els.actionDescription.textContent = config.description||"";
  if (els.actionInput)      { els.actionInput.placeholder    = config.placeholder||""; els.actionInput.value = config.initialValue||""; }
  if (els.submitActionBtn)  els.submitActionBtn.textContent  = config.submitLabel||"Save";
  if (els.actionError)      els.actionError.textContent      = "";
  els.actionModal?.classList.add("open");
  els.actionModal?.setAttribute("aria-hidden","false");
  setTimeout(()=>{ els.actionInput?.focus(); els.actionInput?.select(); }, 20);
}

function closeActionModal() {
  els.actionModal?.classList.remove("open");
  els.actionModal?.setAttribute("aria-hidden","true");
  if (els.actionError) els.actionError.textContent = "";
  if (els.actionInput) els.actionInput.value = "";
}

function requestPathInput(config) { return new Promise(res => openActionModal({...config, resolve:res})); }
function requestTextInput(config) { return new Promise(res => openActionModal({...config, resolve:res, preserveInput:true})); }

// â”€â”€ File management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function createNewFile() {
  if (!state.workspace) return;
  const rp = normalizeRelPath(await requestPathInput({ label:"New File", title:"Create a file", description:"Enter the path inside the workspace.", placeholder:"src/new-file.js", initialValue:state.activeFile?state.activeFile.replace(/[^/]+$/,"new-file.js"):"src/new-file.js", submitLabel:"Create" }));
  if (!rp) return;
  if (rp.startsWith("..") || rp.includes("/../")) { showToast("Invalid path", "error"); return; }
  if (hasFile(rp)) { setActiveFile(rp); showToast(`${rp} already exists`); return; }
  await window.orionDesktop.createFile({ rootDir:state.workspace.rootDir, relativePath:rp, content:"" });
  setFileContent(rp,"");
  const parts = rp.split("/").slice(0,-1); let cur="";
  for (const seg of parts) { cur=cur?`${cur}/${seg}`:seg; state.expandedFolders.add(cur); }
  persistExpandedFolders();
  if (!state.openTabs.includes(rp)) state.openTabs.push(rp);
  await refreshGitStatus(); updateWorkspacePanels(); setActiveFile(rp);
  log("success",`Created \`${rp}\`.`,"terminal"); addTrace("success","File created",rp,{scope:"editor"}); showToast(`Created ${rp}`);
}

async function createNewFolder() {
  if (!state.workspace) return;
  const rp = normalizeRelPath(await requestPathInput({ label:"New Folder", title:"Create a folder", description:"Enter the folder path inside the workspace.", placeholder:"src/components", initialValue:state.activeFile?state.activeFile.split("/").slice(0,-1).join("/")||"src":"src/components", submitLabel:"Create" }));
  if (!rp) return;
  await window.orionDesktop.createFolder({ rootDir:state.workspace.rootDir, relativePath:rp });
  state.expandedFolders.add(rp); persistExpandedFolders();
  await refreshGitStatus(); await reloadWorkspace();
}

async function renameCurrentPath() {
  if (!state.workspace||!state.activeFile) return;
  const next = normalizeRelPath(await requestPathInput({ label:"Rename", title:"Rename the current file", description:"Enter the new path.", placeholder:state.activeFile, initialValue:state.activeFile, submitLabel:"Rename" }));
  if (!next||next===normalizeRelPath(state.activeFile)) return;
  const prev = normalizeRelPath(state.activeFile);
  await window.orionDesktop.renamePath({ rootDir:state.workspace.rootDir, fromPath:prev, toPath:next });
  const prevContent = state.workspace.files[prev];
  delete state.workspace.files[prev]; delete state.diskFiles[prev];
  insertFile(next, prevContent); state.diskFiles[next] = prevContent;
  state.openTabs    = state.openTabs.map(f=>f===prev?next:f);
  state.activeFile  = next;
  await reloadWorkspace("", next);
  setActiveFile(next);
}

async function duplicateCurrentFile() {
  if (!state.workspace||!state.activeFile) return;
  const e = ext(state.activeFile);
  const base = e ? state.activeFile.slice(0,-(e.length+1)) : state.activeFile;
  const next = normalizeRelPath(`${base}-copy.${e||"txt"}`);
  await window.orionDesktop.createFile({ rootDir:state.workspace.rootDir, relativePath:next, content:currentFileContent() });
  insertFile(next, currentFileContent()); state.diskFiles[next] = currentFileContent();
  await reloadWorkspace("", next);
  setActiveFile(next);
}

async function deleteCurrentPath() {
  if (!state.workspace||!state.activeFile) return;
  const ok = await confirm(`Delete ${state.activeFile}?`, "This cannot be undone.");
  if (!ok) return;
  const toDelete = state.activeFile;
  await window.orionDesktop.deletePath({ rootDir:state.workspace.rootDir, relativePath:normalizeRelPath(toDelete) });
  delete state.diskFiles[normalizeRelPath(toDelete)];
  state.openTabs   = state.openTabs.filter(f => f !== normalizeRelPath(toDelete));
  state.activeFile = state.openTabs[state.openTabs.length - 1] || "";
  await reloadWorkspace();
  addTrace("warn", "File deleted", `${toDelete} removed.`, { scope: "editor" });
  showToast(`Deleted ${toDelete}`);
}

// â”€â”€ Git actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function runGitAction(action, relativePath="") {
  if (!state.workspace?.rootDir) return;
  const p = normalizeRelPath(relativePath);
  if (action==="discard"&&p) {
    const ok = await confirm(`Discard changes for ${p}?`, "Local changes will be permanently lost.");
    if (!ok) return;
  }
  const r = await window.orionDesktop.runWorkspaceGitAction({ rootDir:state.workspace.rootDir, action, relativePath:p });
  if (!r?.ok) throw new Error(r?.error||"Git action failed");
  await reloadWorkspace();
  const msgs = { stage:`Staged ${p}`, unstage:`Unstaged ${p}`, discard:`Discarded ${p}`, "stage-all":"Staged all changes", "unstage-all":"Unstaged all changes" };
  const msg = msgs[action]||"Git action completed";
  log("success",msg,"terminal"); addTrace("success","Git action",msg,{scope:"git"}); showToast(msg);
}

async function previewGitDiff(relPath) {
  if (!state.workspace?.rootDir||!relPath) return;
  const r = await window.orionDesktop.getWorkspaceGitDiff({ rootDir:state.workspace.rootDir, relativePath:normalizeRelPath(relPath) });
  if (!r?.ok) { log("error",`Git diff failed: ${r?.error||""}`,  "sources"); openConsolePane("sources"); return; }
  const body = (r.diff||"").trim() ? `### Git diff: ${relPath}\n\n\`\`\`diff\n${r.diff}\n\`\`\`` : `### Git diff: ${relPath}\n\nNo changes.`;
  log("info",body,"sources"); openConsolePane("sources");
  addTrace("info","Git diff opened",`Diff for ${relPath}`,{scope:"git"});
}

// â”€â”€ Preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function previewWorkspaceFile(fp) {
  if (!state.workspace?.rootDir||!fp) return;
  await writeCurrentFile();
  const r = await window.orionDesktop.openPreview({ rootDir:state.workspace.rootDir, relativePath:normalizeRelPath(fp) });
  if (!r?.ok) throw new Error(r?.error||"Preview failed");
  openConsolePane("terminal");
  log("info",`Opened preview: ${r.url}`,"terminal");
  addTrace("success","Preview opened",`Opened ${fp} in browser.`,{scope:"preview"});
  showToast(`Previewed ${fp}`);
}

function detectRunCommand() {
  const files = state.workspace?.files || {};
  if (!Object.keys(files).length) return null;
  if (files["package.json"]) {
    try {
      const pkg = JSON.parse(files["package.json"]);
      const scripts = pkg?.scripts||{};
      const mgr = (files["pnpm-lock.yaml"]?"pnpm":files["yarn.lock"]?"yarn":(files["bun.lock"]||files["bun.lockb"])?"bun":"npm");
      const sel = ["dev","start","preview","serve"].find(n=>typeof scripts[n]==="string"&&scripts[n].trim());
      if (sel) return { command:`${mgr} run ${sel}`, reason:`Detected \`${sel}\` in package.json` };
    } catch {}
  }
  if (files["Cargo.toml"]) return { command:"cargo run",  reason:"Detected Rust workspace" };
  if (files["go.mod"])     return { command:"go run .",   reason:"Detected Go module" };
  const pyFile = state.activeFile&&ext(state.activeFile)==="py"?state.activeFile:"";
  if (pyFile&&hasFile(pyFile)) return { command:pyFile.endsWith("manage.py")?`python ${pyFile} runserver`:`python ${pyFile}`, reason:`Using active Python file \`${pyFile}\`` };
  const pyEntry = ["main.py","app.py","server.py","manage.py"].find(n=>hasFile(n));
  if (pyEntry) return { command:pyEntry==="manage.py"?"python manage.py runserver":`python ${pyEntry}`, reason:`Detected \`${pyEntry}\`` };
  if (files["index.html"]) return { type:"preview", filePath:"index.html", reason:"Detected static web project" };
  return null;
}

async function triggerRunWorkspace() {
  if (!state.workspace?.rootDir) { log("warn","Open a workspace before running.","terminal"); return; }
  const d = detectRunCommand();
  if (d?.type==="preview"&&d.filePath) { log("info",`${d.reason}. Opening preview.`,"terminal"); await previewWorkspaceFile(d.filePath); return; }
  if (d?.command) { log("info",`${d.reason}. Running \`${d.command}\`.`,"terminal"); await runWorkspaceCommand(d.command); return; }
  const cmd = await requestTextInput({ label:"Run Workspace", title:"Run this project", description:"Orion could not infer a startup command.", placeholder:"npm run dev", submitLabel:"Run" });
  if (!String(cmd||"").trim()) return;
  await runWorkspaceCommand(cmd);
}

// â”€â”€ Terminal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function runCommand() {
  const command = els.commandInput?.value.trim();
  if (!command) return;
  if (!state.workspace?.rootDir) {
    showToast("Open a workspace first", "error");
    return;
  }
  openConsolePane("terminal");
  if (els.commandInput) els.commandInput.value = "";
  rememberCommand(command);
  log("command",`${state.workspace.rootDir}> ${command}`,"terminal");
  addTrace("info","Command launched",command,{scope:"terminal"});
  const r = await window.orionDesktop.runCommand({ cwd:state.workspace.rootDir, command });
  if (r.stdout) log("stdout",r.stdout.slice(0,8000),"terminal");
  if (r.stderr) log("stderr",r.stderr.slice(0,8000),"terminal");
  addTrace(r.ok?"success":"error","Command finished",`Exited with code ${r.code}.`,{scope:"terminal"});
}

async function runWorkspaceCommand(command) {
  const c = String(command||"").trim();
  if (!c) return;
  await writeCurrentFile();
  if (els.commandInput) els.commandInput.value = c;
  await runCommand();
}

// â”€â”€ Patch system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildPatchPlan(files, opts={}) {
  const entries = Object.entries(files||{})
    .map(([fp,content])=>[normalizeRelPath(fp),String(content)])
    .filter(([fp])=>!!fp)
    .map(([fp,next]) => {
      const prev = String(state.workspace?.files?.[fp]||"");
      return { filePath:fp, previousContent:prev, nextContent:next, status:hasFile(fp)?"Update":"Create",
               language:inferLang(fp), beforeLines:countLines(prev), afterLines:countLines(next) };
    });
  if (!entries.length) return null;
  const pref = normalizeRelPath(opts.preferredFile||entries[0].filePath);
  return { preferredFile:pref, entries, selectedFile:pref||entries[0].filePath };
}

function renderPatchPreview() {
  const patch = state.pendingPatch;
  if (!patch||!els.patchPreviewList) { if (els.patchPreviewList) els.patchPreviewList.innerHTML=`<div class="microcopy">No changes waiting for review.</div>`; return; }
  if (els.patchPreviewTitle) els.patchPreviewTitle.textContent = patch.entries.length===1?"Review change":"Review changes";
  if (els.patchPreviewSummary) els.patchPreviewSummary.textContent = `${patch.entries.length} file ${patch.entries.length===1?"update":"updates"} ready.`;
  els.patchPreviewList.innerHTML = patch.entries.map(e=>`<button class="patch-entry ${e.filePath===patch.selectedFile?"active":""}" type="button" data-patch-file="${esc(e.filePath)}"><strong>${esc(e.filePath)}</strong><span>${esc(e.status)} | ${e.beforeLines} -> ${e.afterLines} lines</span><span>${esc(titleCase(e.language))}</span></button>`).join("");
}

function openPatchPreview(open) {
  const isOpen = !!open;
  els.patchPreviewModal?.classList.toggle("open",isOpen);
  els.patchPreviewModal?.setAttribute("aria-hidden",isOpen?"false":"true");
  if (isOpen) renderPatchPreview();
}

function previewPatchFile(fp) {
  const patch = state.pendingPatch;
  if (!patch) return;
  const entry = patch.entries.find(e=>e.filePath===fp)||patch.entries[0];
  if (!entry) return;
  patch.selectedFile = entry.filePath;
  renderPatchPreview();
  const fence = entry.language==="plaintext"?"":entry.language;
  const before = entry.previousContent.trim()||"(new file)";
  log("info",`### Orion patch preview: ${entry.filePath}\n\n#### Before\n\`\`\`${fence}\n${before.slice(0,8000)}\n\`\`\`\n\n#### After\n\`\`\`${fence}\n${entry.nextContent.slice(0,8000)}\n\`\`\``,"sources");
  openConsolePane("sources");
}

function discardPatch() {
  if (!state.pendingPatch) return;
  const count = state.pendingPatch.entries.length;
  state.pendingPatch = null;
  renderPatchPreview(); openPatchPreview(false);
  showToast(count===1?"Discarded change":`Discarded ${count} changes`,"error");
  addTrace("warn","Patch discarded","Dismissed Orion-generated patch.",{scope:"patch"});
}

async function applyPendingPatch() {
  const patch = state.pendingPatch;
  if (!patch||!state.workspace?.rootDir) return [];
  const applied = [];
  const rollback = [];
  try {
    for (const entry of patch.entries) {
      const existed = hasFile(entry.filePath);
      rollback.push({
        filePath: entry.filePath,
        existed,
        previousContent: existed ? String(state.workspace.files[entry.filePath] || "") : "",
      });
      await window.orionDesktop.writeFile({ rootDir:state.workspace.rootDir, relativePath:entry.filePath, content:entry.nextContent });
      setFileContent(entry.filePath, entry.nextContent);
      if (!state.openTabs.includes(entry.filePath)) state.openTabs.push(entry.filePath);
      applied.push(entry.filePath);
    }
    // Record for agent action log with rollback capability
    recordAgentAction(
      applied.length === 1 ? `Applied patch to ${applied[0]}` : `Applied patch to ${applied.length} files`,
      rollback.map(r => ({ path: r.filePath, before: r.previousContent, after: state.workspace?.files?.[r.filePath] || "" }))
    );
  } catch (err) {
    for (const entry of rollback.reverse()) {
      try {
        if (entry.existed) {
          await window.orionDesktop.writeFile({ rootDir:state.workspace.rootDir, relativePath:entry.filePath, content:entry.previousContent });
          setFileContent(entry.filePath, entry.previousContent);
        } else {
          await window.orionDesktop.deletePath({ rootDir:state.workspace.rootDir, relativePath:entry.filePath });
          delete state.workspace.files[entry.filePath];
          delete state.diskFiles[entry.filePath];
          state.openTabs = state.openTabs.filter(fp => fp !== entry.filePath);
          if (state.activeFile === entry.filePath) state.activeFile = state.openTabs[0] || "";
        }
      } catch { /* best effort rollback */ }
    }
    renderTree();
    renderTabs();
    updateWorkspacePanels();
    throw err;
  }
  state.pendingPatch = null;
  renderPatchPreview(); await refreshGitStatus(); updateWorkspacePanels(); renderTree(); renderTabs();
  if (patch.preferredFile) setActiveFile(patch.preferredFile);
  openPatchPreview(false);
  log("success",`Applied ${applied.length} file update${applied.length===1?"":"s"}.`,"terminal");
  addTrace("success","Patch applied",applied.join(", "),{scope:"patch"});
  showToast(applied.length===1?`Applied ${patch.preferredFile}`:`Applied ${applied.length} files`);
  // Update Log tab badge
  updateLogBadge();
  // Refresh action log if visible
  const _logPanel = document.getElementById("actionLogPanel");
  if (_logPanel && state.rightView === "log") renderActionLog(_logPanel, async act => {
    if (!state.workspace?.rootDir) return;
    for (const f of act.files) {
      await window.orionDesktop.writeFile({ rootDir: state.workspace.rootDir, relativePath: f.path, content: f.before });
      setFileContent(f.path, f.before);
    }
    await refreshGitStatus(); updateWorkspacePanels(); renderTree(); renderTabs(); syncEditor();
  });
  return applied;
}

async function applyGeneratedFiles(files, opts={}) {
  const plan = buildPatchPlan(files, opts);
  if (!plan) return [];
  state.pendingPatch = plan;
  renderPatchPreview(); openPatchPreview(true);
  previewPatchFile(plan.selectedFile||plan.entries[0]?.filePath||"");
  log("info",`Orion prepared ${plan.entries.length} file update${plan.entries.length===1?"":"s"} for review.`,"terminal");
  addTrace("info","Patch prepared",plan.entries.map(e=>e.filePath).join(", "),{scope:"patch"});
  showToast(plan.entries.length===1?`Review change for ${plan.entries[0].filePath}`:`Review ${plan.entries.length} Orion changes`);
  return plan.entries.map(e=>e.filePath);
}

// â”€â”€ AI request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function extractCodeBlocks(text) {
  const blocks = [];
  const src = String(text || "");
  const pat = /```([^\n`]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = pat.exec(src))) {
    const info = String(m[1] || "").trim();
    blocks.push({
      info,
      language: info.split(/\s+/)[0]?.toLowerCase() || "",
      content:  String(m[2] || ""),
      index:    m.index,
      end:      m.index + m[0].length,
    });
  }
  return blocks;
}

/**
 * Extract a file path from a fence info string, e.g. ```js app/app.js
 * Handles: "js app/app.js", "app/app.js", "path:app/app.js", "file=app/app.js"
 */
function extractPathFromInfo(info) {
  const raw = String(info || "").trim();
  if (!raw) return "";
  for (const part of raw.split(/\s+/).filter(Boolean)) {
    const c = part.replace(/^path[:=]/i, "").replace(/^file[:=]/i, "").replace(/^`|`$/g, "").trim();
    if (!c) continue;
    if (/[\/\\]/.test(c) || /\.[A-Za-z0-9._-]+$/.test(c)) return normalizeRelPath(c);
  }
  return "";
}

/**
 * Scan a text window for a file path using many common patterns.
 * Returns the first match or "".
 */
function extractFilePathHint(text) {
  const patterns = [
    // "### app/app.js" or "## style.css"
    /(?:^|\n)\s*#{1,6}\s+([\w./-]+\.[A-Za-z0-9._-]+)\s*(?:\n|$)/m,
    // "**app/app.js**" or "*app/app.js*"
    /\*{1,2}([\w./-]+\.[A-Za-z0-9._-]+)\*{1,2}/,
    // "`app/app.js`" backtick inline code
    /`([\w./-]+\.[A-Za-z0-9._-]+)`/,
    // "File: app/app.js" or "Path: app/app.js" or "Filename: app/app.js"
    /(?:^|\n)\s*(?:File|Path|Filename|file|path)\s*[:=]\s*([\w./-]+\.[A-Za-z0-9._-]+)/im,
    // "Create app/app.js" / "Update style.css"
    /(?:^|\n)\s*(?:create|update|write|add|replace|edit)\s+`?([\w./-]+\.[A-Za-z0-9._-]+)`?/im,
    // Numbered list: "1. `app/app.js`" or "1. app/app.js -"
    /(?:^|\n)\s*\d+\.\s+`?([\w./-]+\.[A-Za-z0-9._-]+)`?/m,
    // Bullet: "- app/app.js" or "* app/app.js"
    /(?:^|\n)\s*[-*]\s+`?([\w./-]+\.[A-Za-z0-9._-]+)`?/m,
    // Plain word that looks like a path with extension on its own line
    /(?:^|\n)([\w][\w./-]*\/[\w./-]+\.[A-Za-z0-9]{1,8})\s*(?:\n|$)/m,
  ];
  for (const p of patterns) {
    const m = String(text || "").match(p);
    if (m?.[1]) {
      const candidate = m[1].trim().replace(/^`|`$/g, "").replace(/[*_]/g, "");
      // Must have an extension and no suspicious chars
      if (/\.[A-Za-z0-9]{1,8}$/.test(candidate) && !/[<>"'\\s]/.test(candidate)) {
        return normalizeRelPath(candidate);
      }
    }
  }
  return "";
}

/**
 * Try to detect a file path from the first line of a code block.
 * Handles: // app/app.js  |  # style.css  |  <!-- index.html -->
 */
function extractPathFromComment(content) {
  const first = String(content || "").split("\n")[0].trim();
  // // path, # path, <!-- path -->, /* path */
  const m = first.match(/^(?:\/\/|#|<!--|\/\*)\s*([\w./-]+\.[A-Za-z0-9._-]{1,8})/);
  if (m?.[1] && !/\s/.test(m[1])) return normalizeRelPath(m[1]);
  return "";
}

/**
 * Infer a {path: content} map from raw AI response text.
 *
 * Strategy (in priority order per block):
 *  1. Path in fence info string:     ```js app/app.js
 *  2. Path in first line of block:   // app/app.js
 *  3. Nearest heading above block:   ### app/app.js
 *  4. Bold/backtick label above:     **app/app.js** or `app/app.js`
 *  5. Scan trailing window for path
 *  6. If only one block, use targetFile
 *
 * The key insight: scan in a large window (500 chars) but use the NEAREST
 * match (last match before the block), not the first.
 */
function inferFilesFromText(text, targetFile = "", prompt = "") {
  const blocks = extractCodeBlocks(text);
  if (!blocks.length) return {};

  const map = {};

  for (const block of blocks) {
    let fp = "";

    // 1. Fence info string
    fp = extractPathFromInfo(block.info);

    // 2. First line of code block
    if (!fp) fp = extractPathFromComment(block.content);

    // 3 & 4. Scan text leading up to this block (up to 500 chars)
    if (!fp) {
      const leadStart = Math.max(0, block.index - 500);
      const leadText  = text.slice(leadStart, block.index);
      // Find the LAST path match in the leading window (nearest to block)
      const patterns = [
        /(?:^|\n)\s*#{1,6}\s+([\w./-]+\.[A-Za-z0-9._-]+)\s*(?:\n|$)/gm,
        /\*{1,2}([\w./-]+\.[A-Za-z0-9._-]+)\*{1,2}/g,
        /`([\w./-]+\.[A-Za-z0-9._-]+)`/g,
        /(?:^|\n)\s*(?:File|Path|Filename)\s*[:=]\s*([\w./-]+\.[A-Za-z0-9._-]+)/gim,
        /(?:^|\n)\s*\d+\.\s+`?([\w./-]+\.[A-Za-z0-9._-]+)`?/gm,
        /(?:^|\n)\s*[-*]\s+`?([\w./-]+\.[A-Za-z0-9._-]+)`?/gm,
      ];
      for (const pat of patterns) {
        let last = null, m;
        pat.lastIndex = 0;
        while ((m = pat.exec(leadText))) last = m;
        if (last?.[1]) {
          const c = last[1].trim().replace(/^`|`$/g, "");
          if (/\.[A-Za-z0-9]{1,8}$/.test(c) && !/[<>"'\s]/.test(c)) {
            fp = normalizeRelPath(c);
            break;
          }
        }
      }
    }

    // 5. Scan text trailing this block (up to 300 chars)
    if (!fp) {
      const trailEnd  = Math.min(text.length, block.end + 300);
      const trailText = text.slice(block.end, trailEnd);
      fp = extractFilePathHint(trailText);
    }

    if (fp) {
      map[fp] = block.content.replace(/\s+$/, "");
    }
  }

  // 6. Fall back: one block, no path found → use targetFile
  if (!Object.keys(map).length) {
    const tp = normalizeRelPath(targetFile || "");
    if (tp && blocks.length === 1) map[tp] = blocks[0].content.replace(/\s+$/, "");
  }

  // Debug trace — visible in the Trace panel
  const found = Object.keys(map);
  try {
    addTrace(
      found.length ? "info" : "warn",
      found.length ? `Extracted ${found.length} file${found.length === 1 ? "" : "s"}` : "No files extracted",
      found.length
        ? found.map(f => `• ${f}`).join("\n")
        : `${blocks.length} code block${blocks.length === 1 ? "" : "s"} found but no file paths detected. Check the Trace for the raw response.`,
      { scope: "patch" }
    );
  } catch {}

  return map;
}

function shouldAutoApply(prompt, files, opts={}) {
  const fps = Object.keys(files || {});
  if (!fps.length) return false;
  if (opts.workflowKind === "patch") return true;
  if (fps.length > 1) return true;                            // always apply multi-file
  const pref = normalizeRelPath(opts.preferredFile || "");
  if (pref && fps.includes(pref)) return true;               // matches requested file
  if (fps.some(f => hasFile(f))) return true;                // modifying an existing file
  // Broad action verbs — split/separate/extract also covered
  return /\b(build|create|make|generate|scaffold|write|update|edit|fix|implement|split|separate|extract|refactor|move|rename|reorganize|restructure|break\s+out|break\s+into|divide|convert|migrate)\b/i.test(String(prompt || ""));
}

/**
 * Build payload â€” sends only active file content, not the whole workspace.
 * This is a major performance improvement over v0.1.
 */
function buildPayload(prompt, pinnedFiles = []) {
  const insight = state.workspaceInsight;
  const summary = insight ? [
    `Workspace: ${insight.workspaceKind||"Unknown"}`,
    insight.frameworks?.length ? `Frameworks: ${insight.frameworks.join(", ")}` : "",
    insight.entryPoints?.length ? `Entry points: ${insight.entryPoints.join(", ")}` : "",
    insight.scripts?.length ? `Scripts: ${insight.scripts.join(", ")}` : "",
  ].filter(Boolean).join("\n") : "";

  // Send active file content in full + small files for context
  // Large files are truncated to avoid token bloat
  const activeContent = currentFileContent().slice(0, 10000);
  const fileList = Object.keys(state.workspace?.files || {}).slice(0, 300).join("\n");

  // Smart context: score files by relevance to the prompt, prioritise them
  const condensedFiles = {};
  let totalChars = 0;
  const MAX_TOTAL = 40000;
  const MAX_FILE  = 4000;

  // Score each file by how many prompt words appear in its content
  const promptWords = prompt.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const allFiles = Object.entries(state.workspace?.files || {});
  const scored = allFiles.map(([fp, content]) => {
    if (!content) return { fp, content, score: 0 };
    const lower = content.toLowerCase();
    const score = promptWords.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0)
                + (fp === state.activeFile ? 10 : 0)  // active file always top
                + (fp.endsWith(".ts") || fp.endsWith(".js") ? 1 : 0); // prefer source
    return { fp, content, score };
  }).sort((a, b) => b.score - a.score);

  for (const { fp, content } of scored) {
    if (totalChars >= MAX_TOTAL) break;
    const snippet = String(content || "").slice(0, MAX_FILE);
    condensedFiles[fp] = snippet;
    totalChars += snippet.length;
  }

  const memoryPrompt = buildMemoryPrompt(state.workspace?.rootDir);

  const system = [
    "You are Orion IDE, a local coding agent with full access to the user's workspace.",
    summary,
    memoryPrompt,
    state.activeFile ? `Active file: ${state.activeFile}` : "",
    state.activeFile ? activeContent : "",
    `Workspace file paths:\n${fileList}`,
    `CRITICAL FILE OUTPUT FORMAT — follow exactly:
When generating or modifying files, you MUST use this exact format for EVERY file:

### path/to/filename.ext
\`\`\`language
file contents here
\`\`\`

Rules:
- Put the filename as a ### heading IMMEDIATELY before each code block, on its own line
- The heading must be just the relative file path, nothing else (no "File:", no bold, no extra words)
- Use the correct language identifier in the fence (js, html, css, py, etc.)
- For multi-file tasks, repeat this pattern for EVERY file — do not skip any file
- Do NOT put all files in one block — each file gets its own heading + block
- Do NOT add explanatory text between the heading and the code block

EXAMPLE for splitting index.html into 3 files:

### index.html
\`\`\`html
<!DOCTYPE html>...
\`\`\`

### app/app.js
\`\`\`js
console.log('app');
\`\`\`

### app/style.css
\`\`\`css
body { margin: 0; }
\`\`\`

Explain your changes AFTER all the file blocks, never before or between them.`,
  ].filter(Boolean).join("\n\n");

  return {
    stream:         true,
    mode:           els.agentToggle?.checked ? "agentic" : "chat",
    model:          document.getElementById("modelPicker")?.value || state.profile?.user_prefs?.desktop_model || "auto",
    enable_search:  els.searchToggle?.checked,
    role:           state.profile?.role || "free",
    user_id:        state.session?.user?.id || null,
    username:       state.profile?.username || null,
    email:          state.session?.user?.email || null,
    chat_id:        state.workspace?.rootDir ? `desktop-${btoa(state.workspace.rootDir).replace(/=+/g,"")}` : "desktop-orion",
    workspace_files: condensedFiles,
    system,
    messages: [
      ...state.chat.filter(m=>m.sender==="assistant"||m.sender==="user").map(m=>({ role:m.sender==="assistant"?"assistant":"user", content:m.text })),
      { role:"user", content:prompt },
    ],
  };
}

async function sendToOrion(prompt, opts={}) {
  if (!state.workspace) {
    log("warn", "Open a local workspace before asking Orion.", "terminal");
    addTrace("warn", "Workspace required", "Open a project first.", { scope: "request" });
    showToast("Open a workspace first", "error");
    return;
  }

  // Abort any in-progress request
  if (_abortController) { _abortController.abort(); }
  _abortController = new AbortController();
  const signal = _abortController.signal;

  setRightView("chat");

  // Parse @file mentions — inject mentioned files into context
  const { cleanPrompt, mentionedFiles } = parseMentions(prompt);
  const effectivePrompt = mentionedFiles.length ? cleanPrompt : prompt;
  if (mentionedFiles.length) {
    state._pinnedFiles = mentionedFiles;
  }

  pushChat("user", prompt);
  if (els.sessionStat) {
    els.sessionStat.textContent = "Thinking";
    els.sessionStat.className = "";
  }
  if (els.searchStat)  els.searchStat.textContent  = els.searchToggle?.checked ? "On" : "Off";
  setThinking(true);
  showProgress();
  setOnlineStatus("working");
  showStopButton(true);

  log("info", `Sending request for **${state.workspace.rootDir}**.`, "terminal");
  addTrace("info", "Request launched", prompt.slice(0, 120), { mode: els.agentToggle?.checked ? "agentic" : "chat" });

  const assistant = { id: `m_${Date.now()}`, sender: "assistant", text: "", ts: stamp(), sources: [], pending: true, filesPrepared: 0, codeHidden: false };
  state.chat.push(assistant);
  state._lastPrompt = prompt; // for retry
  renderChat();
  let appliedFiles = [];

  try {
    let res;
    try {
      res = await fetch(state.config.backendUrl, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(buildPayload(effectivePrompt || prompt, mentionedFiles || [])),
        signal,
      });
    } catch (fetchErr) {
      if (fetchErr.name === "AbortError") throw fetchErr;
      setOnlineStatus("offline");
      throw new Error("Network error — check your connection");
    }
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached — please wait a moment");
      if (res.status === 401) throw new Error("Auth error — please sign in again");
      throw new Error(`HTTP ${res.status}`);
    }
    setOnlineStatus("online");

    const ct = (res.headers.get("content-type") || "").toLowerCase();

    if (ct.includes("application/json")) {
      const data = await res.json();
      assistant.text    = data.reply || data.text || data.message || "(no reply)";
      assistant.sources = Array.isArray(data.sources) ? data.sources : [];
      if (data.files && typeof data.files === "object") appliedFiles = await applyGeneratedFiles(data.files, { preferredFile: opts.preferredFile });
      if (data.quota) state.quota = data.quota;
    } else {
      // Token-by-token streaming
      const reader  = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let si;
        while ((si = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, si); buffer = buffer.slice(si + 2);
          const dl = chunk.split("\n").find(l => l.startsWith("data:"));
          if (!dl) continue;
          let evt; try { evt = JSON.parse(dl.slice(5).trim()); } catch { continue; }
          if (evt.type === "delta") {
            assistant.text += evt.text || "";
            renderChatStreaming(assistant); // lightweight update — no full re-render
          } else if (evt.type === "status") {
            log("info", `**${evt.text || "Status"}** ${evt.detail || ""}`.trim(), "trace");
            addTrace("info", evt.text || "Status", evt.detail || "Working.", { scope: "stream" });
          } else if (evt.type === "done") {
            if (!assistant.text.trim() && evt.reply) assistant.text = evt.reply;
            assistant.sources = Array.isArray(evt.sources) ? evt.sources : [];
            if (evt.files && typeof evt.files === "object") appliedFiles = await applyGeneratedFiles(evt.files, { preferredFile: opts.preferredFile });
            if (evt.quota) state.quota = evt.quota;
          } else if (evt.type === "error") {
            throw new Error(evt.message || "Streaming failed");
          }
        }
      }
    }

    if (!assistant.text.trim()) assistant.text = "Orion completed without visible output.";
    if (!appliedFiles.length) {
      const inferred = inferFilesFromText(assistant.text, opts.preferredFile || state.activeFile, prompt);
      if (Object.keys(inferred).length > 0) {
        // Files were extracted — auto-apply if conditions met, otherwise open patch review
        if (shouldAutoApply(prompt, inferred, opts)) {
          appliedFiles = await applyGeneratedFiles(inferred, { preferredFile: opts.preferredFile || state.activeFile });
        } else {
          // Offer them via patch preview so user isn't left staring at empty chat
          appliedFiles = await applyGeneratedFiles(inferred, { preferredFile: opts.preferredFile || state.activeFile });
        }
      } else if (extractCodeBlocks(assistant.text).length > 0) {
        // Code blocks exist but no paths found — warn the user
        addTrace("warn", "Files not extracted",
          "Orion generated code blocks but couldn't determine file paths. Check Trace panel and try again with more explicit file names in your prompt.",
          { scope: "patch" });
        showToast("Generated code found — check Trace panel for details", "info");
      }
    }
    assistant.pending      = false;
    assistant.filesPrepared = appliedFiles.length || state.pendingPatch?.entries?.length || 0;
    assistant.codeHidden   = /```/.test(assistant.text);
    assistant.sources.forEach(s => log("info", `[${s.title || s.url}](${s.url})`, "sources"));
    persistChat(); renderChat(); updateAccountPanels();
    log("success", "Orion finished the request.", "terminal");
    addTrace("success", "Request completed", buildAssistantOverview(assistant.text, assistant).body.slice(0, 120) || "Done.", { scope: "request" });
    if (els.sessionStat) {
      els.sessionStat.textContent = "Ready";
      els.sessionStat.className = "session-stat-ready";
    }

  } catch (err) {
    if (err.name === "AbortError") {
      // User cancelled — clean up gracefully
      assistant.text = (assistant.text?.trim() || "") + "\n\n*Generation stopped.*";
      assistant.pending = false;
      persistChat(); renderChat();
      if (els.sessionStat) els.sessionStat.textContent = "Stopped";
      setOnlineStatus("online");
    } else {
      const partial = assistant.text?.trim();
      assistant.text = partial
        ? partial + "\n\n---\n*Request failed: " + err.message + "*"
        : "Orion hit an error: " + err.message;
      assistant.pending      = false;
      assistant.filesPrepared = appliedFiles.length || 0;
      assistant.codeHidden   = /```/.test(assistant.text);
      persistChat(); renderChat();
      reportError("Orion request failed", err);
      if (els.sessionStat) {
      els.sessionStat.textContent = "Issue";
      els.sessionStat.className = "session-stat-issue";
    }
      setOnlineStatus("offline");
      // Show retry option in chat
      showChatError(err.message, prompt, opts);
    }
  } finally {
    setThinking(false);
    hideProgress();
    showStopButton(false);
    _abortController = null;
  }
}

/** Lightweight streaming update — only updates the last assistant bubble body */
function renderChatStreaming(assistantMsg) {
  // Find the last assistant article in the feed
  const feed = els.chatFeed;
  if (!feed) return;
  const articles = feed.querySelectorAll("article.assistant");
  if (!articles.length) { renderChat(); return; }
  const last = articles[articles.length - 1];
  const body = last.querySelector(".chat-body");
  if (body) {
    const view = buildAssistantOverview(assistantMsg.text, assistantMsg);
    body.innerHTML = renderMD(view.body) + "<span class=\"stream-cursor\"></span>";
  }
  feed.scrollTop = feed.scrollHeight;
}

/** Show/hide the Stop Generation button */
function showStopButton(show) {
  let wrap = document.getElementById("stopBtnWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "stop-btn-wrap";
    wrap.id = "stopBtnWrap";
    const btn = document.createElement("button");
    btn.className = "stop-btn";
    btn.type = "button";
    btn.id = "stopGenerationBtn";
    btn.innerHTML = "&#9632; Stop generation";
    btn.addEventListener("click", () => {
      if (_abortController) { _abortController.abort(); }
    });
    wrap.appendChild(btn);
    els.thinkingIndicator?.parentNode?.insertBefore(wrap, els.thinkingIndicator);
  }
  wrap.style.display = show ? "flex" : "none";
}

/** Show an error bubble with retry option at the bottom of chat */
function showChatError(message, prompt, opts) {
  const feed = els.chatFeed;
  if (!feed) return;
  const errDiv = document.createElement("div");
  errDiv.className = "chat-error-bubble";
  errDiv.innerHTML = `
    <span class="err-icon">⚠</span>
    <div class="err-body">
      <p class="err-msg">Request failed: ${esc(message)}</p>
      <button class="retry-btn" type="button">Retry</button>
    </div>
  `;
  errDiv.querySelector(".retry-btn").addEventListener("click", () => {
    errDiv.remove();
    sendToOrion(prompt, opts);
  });
  feed.appendChild(errDiv);
  feed.scrollTop = feed.scrollHeight;
}

async function triggerWorkflowPrompt(kind) {
  if (!state.workspace) return;
  const sel = getSelectedText().trim();
  const fp  = state.activeFile||"the current file";
  const map = {
    explain: sel ? `Explain this code from ${fp}:\n\n${sel}` : `Explain ${fp}, including what it does, how it fits, and any risks.`,
    review:  `Review ${fp} for bugs, regressions, and missing tests. Findings first.`,
    patch:   sel ? `Patch this code in ${fp}. Return the final code in a single fenced block.\n\n${sel}` : `Patch ${fp} for correctness and code quality. Return final contents in a fenced block.`,
  };
  const prompt = map[kind]; if (!prompt) return;
  await writeCurrentFile();
  await sendToOrion(prompt,{ workflowKind:kind, preferredFile:state.activeFile });
}

async function generateTestsForCurrentFile() {
  if (!state.workspace || !state.activeFile) { showToast("Open a file first", "warn"); return; }
  await writeCurrentFile();
  const content  = currentFileContent();
  const lang     = inferLang(state.activeFile);
  // Determine a sensible test file name
  const ext      = state.activeFile.includes(".") ? state.activeFile.split(".").pop() : "js";
  const base     = state.activeFile.replace(/\.[^.]+$/, "");
  const testPath = base + ".test." + ext;

  const prompt = [
    `Generate a complete test file for the following ${lang} source file: ${state.activeFile}`,
    "Requirements:",
    "- Use the most appropriate test framework for the language/stack detected (Jest for JS/TS, pytest for Python, etc.)",
    "- Cover all exported functions and classes with at least one happy-path and one edge-case test each",
    "- Include realistic test data — no placeholder comments",
    "- Return ONLY the test file content in a single fenced code block",
    `- The test file will be saved as: ${testPath}`,
    "",
    "Source file content:",
    "```" + lang,
    content.slice(0, 6000), // cap to avoid overlong prompts
    "```",
  ].join("\n");

  showToast(`Generating tests for ${baseName(state.activeFile)}…`);
  await sendToOrion(prompt, { workflowKind: "code", preferredFile: testPath });
}

// â”€â”€ Command palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function searchContent(query) {
  const q=String(query||"").trim().toLowerCase(); if (!q||q.length<3) return [];
  const hits=[]; const files=state.workspace?.files||{};
  for (const [fp,content] of Object.entries(files)) {
    const lower=String(content||"").toLowerCase(); const idx=lower.indexOf(q); if (idx===-1) continue;
    const before=String(content||"").slice(0,idx); const ln=before.split(/\r?\n/).length;
    const lineText=String(content||"").split(/\r?\n/)[ln-1]||"";
    hits.push({ filePath:fp, lineNumber:ln, lineText:lineText.trim().slice(0,140) });
    if (hits.length>=18) break;
  }
  return hits;
}

function extractSymbols(query) {
  const q=String(query||"").trim().replace(/^@+/,"").toLowerCase(); if (!q||q.length<3) return [];
  const patterns=[
    {kind:"function", regex:/\bfunction\s+([A-Za-z_$][\w$]*)/g},
    {kind:"class",    regex:/\bclass\s+([A-Za-z_$][\w$]*)/g},
    {kind:"const",    regex:/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g},
    {kind:"export",   regex:/\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g},
    {kind:"py-def",   regex:/^\s*def\s+([A-Za-z_][\w]*)/gm},
    {kind:"py-class", regex:/^\s*class\s+([A-Za-z_][\w]*)/gm},
  ];
  const hits=[]; const files=state.workspace?.files||{};
  for (const [fp,content] of Object.entries(files)) {
    const text=String(content||"");
    for (const pat of patterns) {
      pat.regex.lastIndex=0; let m;
      while ((m=pat.regex.exec(text))) {
        const name=String(m[1]||""); if (!name.toLowerCase().includes(q)) continue;
        const ln=text.slice(0,m.index).split(/\r?\n/).length;
        hits.push({filePath:fp,name,lineNumber:ln,kind:pat.kind});
        if (hits.length>=24) return hits;
      }
    }
  }
  return hits;
}

function getPaletteItems(query="") {
  const q=String(query||"").trim();
  const items = [
    {id:"ws-open",    title:"Open workspace",       hint:"Choose a local project.", shortcut:"Ctrl/Cmd+O", run:()=>chooseWorkspace()},
    {id:"ws-refresh", title:"Refresh workspace",     hint:"Reload from disk.",       shortcut:"Ctrl/Cmd+R", run:()=>reloadWorkspace()},
    {id:"ws-run",     title:"Run workspace",          hint:"Launch the dev command.", shortcut:"Ctrl/Cmd+Enter", run:()=>triggerRunWorkspace()},
    {id:"ws-terminal",title:"Focus terminal",         hint:"Open command runner.",    shortcut:"Ctrl/Cmd+J", run:()=>openConsolePane("terminal",true)},
    {id:"ws-settings",title:"Open settings",          hint:"Theme, font, word wrap.", shortcut:"Ctrl/Cmd+,", run:()=>openSettingsModal(true)},
    {id:"layout-explorer",title:state.leftCollapsed?"Show explorer":"Hide explorer",  hint:"Toggle left sidebar.", shortcut:"Ctrl/Cmd+B", run:()=>setLeftCollapsed(!state.leftCollapsed)},
    {id:"layout-orion",   title:state.rightCollapsed?"Show Orion panel":"Hide Orion panel", hint:"Toggle right panel.", shortcut:"Ctrl/Cmd+Shift+B", run:()=>setRightCollapsed(!state.rightCollapsed)},
    {id:"editor-save",    title:"Save current file",  hint:state.activeFile?`Write ${state.activeFile} to disk.`:"Save active file.", shortcut:"Ctrl/Cmd+S", run:()=>writeCurrentFile()},
    {id:"editor-new-file",   title:"Create file",    hint:"Add a new file.", run:()=>createNewFile()},
    {id:"editor-new-folder", title:"Create folder",  hint:"Add a new folder.", run:()=>createNewFolder()},
    {id:"orion-chat",   title:"Focus Orion chat",     hint:"Jump to the assistant.", shortcut:"Ctrl/Cmd+L", run:()=>{ setRightView("chat"); setRightCollapsed(false); requestAnimationFrame(()=>els.chatInput?.focus()); }},
    {id:"orion-review", title:"Review current file",  hint:"Bugs and missing tests.", run:()=>triggerWorkflowPrompt("review")},
    {id:"orion-explain",title:"Explain selection",    hint:"Explain active selection.", run:()=>triggerWorkflowPrompt("explain")},
    {id:"orion-patch",  title:"Patch current file",   hint:"Improve correctness.",  run:()=>triggerWorkflowPrompt("patch")},
    {id:"chat-new",     title:"Start new Orion chat",    hint:"Clear conversation.",       run:()=>clearChatHistory()},
    {id:"editor-close-tab", title:"Close current tab",      hint:"Close active editor tab.",  shortcut:"Ctrl/Cmd+W", run:()=>{ if(state.activeFile) closeTab(state.activeFile); }},
    {id:"tour-start",       title:"Start onboarding tour",  hint:"Interactive Orion walkthrough.", run:()=>showWelcomeWizard(()=>{})},
    {id:"toggle-theme",     title:"Toggle theme",           hint:"Switch light / dark mode.",     run:()=>{ state.preferences.theme = state.preferences.theme==="dark"?"light":"dark"; persistPrefs(); applyPrefs(); showToast("Theme: " + state.preferences.theme); }},
  ];

  if (state.gitStatus?.available) {
    items.push({id:"git-stage-all",   title:"Git stage all",   hint:"Stage every changed file.", shortcut:"git", run:()=>runGitAction("stage-all")});
    items.push({id:"git-unstage-all", title:"Git unstage all", hint:"Move staged to working tree.", shortcut:"git", run:()=>runGitAction("unstage-all")});
    const staged = (state.gitStatus.files||[]).filter(f=>f.staged&&!f.untracked).length;
    if (staged>0) items.push({id:"git-commit", title:`Git commit ${staged} staged files`, hint:"Open commit dialog.", shortcut:"git", run:()=>openGitCommit(staged)});
  }

  if (state.pendingPatch?.entries?.length) {
    items.push({id:"patch-review",title:"Review pending patch",hint:`${state.pendingPatch.entries.length} files waiting.`,shortcut:"patch",run:()=>openPatchPreview(true)});
    items.push({id:"patch-apply", title:"Apply pending patch", hint:"Write Orion changes to workspace.",shortcut:"patch",run:()=>applyPendingPatch()});
  }

  const searchHits = searchContent(q);
  searchHits.forEach(h=>items.push({id:`search-${h.filePath}-${h.lineNumber}`,title:`${baseName(h.filePath)}:${h.lineNumber}`,hint:`${h.filePath} | ${h.lineText||"Match"}`,shortcut:"content",run:()=>{ setActiveFile(h.filePath); requestAnimationFrame(()=>revealLine(h.lineNumber)); }}));

  const symHits = extractSymbols(q);
  symHits.forEach(h=>items.push({id:`sym-${h.filePath}-${h.name}-${h.lineNumber}`,title:`Symbol: ${h.name}`,hint:`${h.kind} | ${h.filePath}:${h.lineNumber}`,shortcut:"@symbol",run:()=>{ setActiveFile(h.filePath); requestAnimationFrame(()=>revealLine(h.lineNumber)); }}));

  Object.keys(state.workspace?.files||{}).sort().slice(0,30).forEach(fp=>items.push({id:`file-${fp}`,title:`Open: ${baseName(fp)}`,hint:fp,shortcut:inferLang(fp),run:()=>setActiveFile(fp)}));

  (state.gitStatus?.files||[]).slice(0,20).forEach(f=>{
    items.push({id:`changed-${f.path}`,title:`Open changed: ${baseName(f.path)}`,hint:`${f.label} | ${f.path}`,shortcut:"git",run:()=>setActiveFile(f.path)});
    items.push({id:`diff-${f.path}`,title:`Preview diff: ${baseName(f.path)}`,hint:f.path,shortcut:"diff",run:()=>previewGitDiff(f.path)});
  });

  state.recentWorkspaces.forEach((e,i)=>items.push({id:`recent-${i}`,title:`Open recent: ${e.label||baseName(e.rootDir)}`,hint:e.rootDir,run:()=>openRecentWorkspace(e.rootDir)}));

  return items;
}

function renderCommandPalette() {
  const raw=String(state.commandPaletteQuery||"").trim().toLowerCase();
  const fq=raw.replace(/^[@#]+/,"");
  const items=getPaletteItems(raw).filter(item=>{
    if (!fq) return true;
    return [item.title,item.hint,item.shortcut].some(v=>String(v||"").toLowerCase().includes(fq));
  });
  state.commandPaletteItems=items;
  state.commandPaletteSelection=Math.min(Math.max(0,state.commandPaletteSelection),Math.max(0,items.length-1));
  if (!els.commandPaletteList) return;
  els.commandPaletteList.innerHTML=items.length
    ?items.map((item,i)=>`<button class="command-entry ${i===state.commandPaletteSelection?"active":""}" type="button" data-command-index="${i}"><strong>${esc(item.title)}</strong><span>${esc(item.hint||"")}</span><span>${esc(item.shortcut||"")}</span></button>`).join("")
    :`<div class="microcopy">No commands match that search.</div>`;
}

function openCommandPalette(open) {
  state.commandPaletteOpen=!!open;
  els.commandPaletteModal?.classList.toggle("open",!!open);
  els.commandPaletteModal?.setAttribute("aria-hidden",open?"false":"true");
  if (!open) { state.commandPaletteQuery=""; state.commandPaletteSelection=0; if(els.commandPaletteInput) els.commandPaletteInput.value=""; return; }
  state.commandPaletteSelection=0;
  renderCommandPalette();
  setTimeout(()=>{ els.commandPaletteInput?.focus(); els.commandPaletteInput?.select(); },20);
}

async function runPaletteSelection(idx=state.commandPaletteSelection) {
  const item=state.commandPaletteItems[idx]; if (!item) return;
  openCommandPalette(false);
  await runAction(`${item.title} failed`,"palette",item.run);
}

// â”€â”€ Settings modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openSettingsModal(open) {
  if (!els.settingsModal) return;
  els.settingsModal.classList.toggle("open",!!open);
  els.settingsModal.setAttribute("aria-hidden",open?"false":"true");
  if (!open) { if(els.settingsError) els.settingsError.textContent=""; return; }
  if (els.themeSelect)         els.themeSelect.value         = state.preferences.theme || DEFAULT_PREFS.theme;
  if (els.fontSizeInput)       els.fontSizeInput.value       = String(state.preferences.fontSize || DEFAULT_PREFS.fontSize);
  if (els.tabSizeSelect)       els.tabSizeSelect.value       = String(state.preferences.tabSize ?? DEFAULT_PREFS.tabSize);
  if (els.wordWrapSelect)      els.wordWrapSelect.value      = state.preferences.wordWrap || DEFAULT_PREFS.wordWrap;
  if (els.minimapSelect)       els.minimapSelect.value       = state.preferences.minimap ? "on" : "off";
  if (els.autoSaveSettingSelect) els.autoSaveSettingSelect.value = state.preferences.autoSave ? "on" : "off";
  if (els.defaultSearchSelect) els.defaultSearchSelect.value = state.preferences.defaultSearch ? "on" : "off";
  if (els.defaultAgentSelect)  els.defaultAgentSelect.value  = state.preferences.defaultAgent ? "agent" : "chat";
  const compSel = document.getElementById("completionsSelect");
  if (compSel) compSel.value = state.preferences.completions !== false ? "on" : "off";
  if (els.settingsError)       els.settingsError.textContent = "";
}

function saveSettingsFromForm() {
  const fs = Math.min(22, Math.max(11, Number(els.fontSizeInput?.value || DEFAULT_PREFS.fontSize)));
  state.preferences = {
    theme:         els.themeSelect?.value === "dark" ? "dark" : "light",
    fontSize:      fs,
    tabSize:       ["2","4","tab"].includes(els.tabSizeSelect?.value) ? (els.tabSizeSelect.value === "tab" ? "tab" : Number(els.tabSizeSelect.value)) : DEFAULT_PREFS.tabSize,
    wordWrap:      ["on","off","bounded"].includes(els.wordWrapSelect?.value) ? els.wordWrapSelect.value : DEFAULT_PREFS.wordWrap,
    minimap:       els.minimapSelect?.value === "on",
    autoSave:      els.autoSaveSettingSelect?.value !== "off",
    defaultSearch: els.defaultSearchSelect?.value !== "off",
    defaultAgent:  els.defaultAgentSelect?.value !== "chat",
    completions:   document.getElementById("completionsSelect")?.value !== "off",
  };
  persistPrefs();
  applyPrefs();
  openSettingsModal(false);
  showToast("Settings saved");
}

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchQuota() {
  if (!state.session?.access_token||!state.config?.backendUrl) return;
  const base=state.config.backendUrl.replace(/\/ask$/,"");
  try {
    const res=await fetch(`${base}/api/quota`,{headers:{Authorization:`Bearer ${state.session.access_token}`},cache:"no-store"});
    if (!res.ok) return;
    const data=await res.json();
    state.quota=data.quota||null;
    updateAccountPanels();
  } catch { log("warn","Could not load quota.","trace"); }
}

async function ensureProfile() {
  const {data,error}=await state.sb.from("profiles").select("id,username,email,role,user_prefs").eq("id",state.session.user.id).maybeSingle();
  if (data) return data;
  if (error&&error.code!=="PGRST116") throw error;
  const username=(state.session.user.email||"orion").split("@")[0].slice(0,24);
  await state.sb.from("profiles").upsert({id:state.session.user.id,username,email:state.session.user.email,role:"free"},{onConflict:"id"});
  const retry=await state.sb.from("profiles").select("id,username,email,role,user_prefs").eq("id",state.session.user.id).maybeSingle();
  return retry.data||null;
}

function openAuthModal(open) {
  els.authModal?.classList.toggle("open",!!open);
  els.authModal?.setAttribute("aria-hidden",open?"false":"true");
  if (els.authError) els.authError.textContent="";
}

async function applySession(session) {
  state.session=session||null; state.profile=null; state.quota=null;
  if (state.session) {
    try {
      state.profile = await ensureProfile();
    } catch (err) {
      // Profile fetch failed (DB issue) â€” continue in basic auth mode
      log("warn", `Profile fetch failed: ${err?.message || err}. Continuing without profile.`, "terminal");
      state.profile = null;
    }
    await fetchQuota();
    openAuthModal(false);
    if (els.authForm) els.authForm.reset();
    log("success", `Signed in as **${state.profile?.username || state.session.user.email}**.`, "terminal");
    addTrace("success", "Account connected", "Linked to Supabase profile.", { scope: "auth" });
  } else {
    openAuthModal(false);
    if (els.authForm) els.authForm.reset();
    addTrace("info","Guest mode active","Sign in to unlock quota and personalization.",{scope:"auth"});
  }
  syncAuthBtns(); updateAccountPanels(); updateMission();
}

async function initAuth() {
  state.sb=window.supabase.createClient(state.config.supabaseUrl,state.config.supabaseAnonKey);
  const {data}=await state.sb.auth.getSession();
  await applySession(data.session);
  state.sb.auth.onAuthStateChange(async(_,session)=>await applySession(session));
}

async function signOutCurrentUser() {
  if (!state.sb||!state.session) return;
  if (els.authOpenBtn) { els.authOpenBtn.disabled=true; els.authOpenBtn.textContent="Signing Out..."; }
  try {
    const {error}=await state.sb.auth.signOut();
    if (error) throw error;
    openAuthModal(false); showToast("Signed out");
    log("info","Signed out of Orion IDE.","terminal");
    addTrace("info","Signed out","Session cleared.",{scope:"auth"});
  } finally { if(!state.session) syncAuthBtns(); }
}

// â”€â”€ isTextInputTarget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isTextInput(el) {
  if (!el) return false;
  const tag=String(el.tagName||"").toLowerCase();
  return tag==="input"||tag==="textarea"||el.isContentEditable;
}

// â”€â”€ Event binding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function bindEvents() {
  // Workspace
  els.openWorkspaceBtn?.addEventListener("click",chooseWorkspace);
  els.emptyOpenBtn?.addEventListener("click",chooseWorkspace);
  els.emptyAuthBtn?.addEventListener("click",()=>openAuthModal(true));
  els.refreshWorkspaceBtn?.addEventListener("click",()=>runAction("Workspace refresh failed","workspace",reloadWorkspace));
  els.openTerminalBtn?.addEventListener("click",()=>{ if(!state.consoleCollapsed && state.consolePane==="terminal") setConsoleCollapsed(true); else openConsolePane("terminal",true); });
  els.editorTerminalBtn?.addEventListener("click",()=>{ if(!state.consoleCollapsed && state.consolePane==="terminal") setConsoleCollapsed(true); else openConsolePane("terminal",true); });
  els.runWorkspaceBtn?.addEventListener("click",()=>runAction("Run failed","terminal",triggerRunWorkspace));
  els.editorRunBtn?.addEventListener("click",()=>runAction("Run failed","terminal",triggerRunWorkspace));
  els.openPreviewBtn?.addEventListener("click",()=>runAction("Preview failed","preview",async()=>{
    const target=state.activeFile&&["html","htm"].includes(ext(state.activeFile))?state.activeFile:"index.html";
    await previewWorkspaceFile(target);
  }));

  // Editor toolbar
  // AI dropdown button
  document.getElementById("aiActionsBtn")?.addEventListener("click", e => toggleAIDropdown(e.currentTarget));
  els.explainSelectionBtn?.addEventListener("click",()=>runAction("Explain failed","editor",()=>triggerWorkflowPrompt("explain")));
  els.reviewFileBtn?.addEventListener("click",()=>runAction("Review failed","editor",()=>triggerWorkflowPrompt("review")));
  els.patchFileBtn?.addEventListener("click",()=>runAction("Patch failed","editor",()=>triggerWorkflowPrompt("patch")));
  document.getElementById("generateTestsBtn")?.addEventListener("click", () => runAction("Generate tests failed","editor", generateTestsForCurrentFile));
  els.saveFileBtn?.addEventListener("click",()=>runAction("Save failed","editor",writeCurrentFile));
  els.renameBtn?.addEventListener("click",()=>runAction("Rename failed","editor",renameCurrentPath));
  els.duplicateBtn?.addEventListener("click",()=>runAction("Duplicate failed","editor",duplicateCurrentFile));
  els.deleteBtn?.addEventListener("click",()=>runAction("Delete failed","editor",deleteCurrentPath));

  // File tree
  els.fileSearch?.addEventListener("input",debouncedRenderTree);
  els.newFileBtn?.addEventListener("click",()=>runAction("Create file failed","editor",createNewFile));
  els.newFolderBtn?.addEventListener("click",()=>runAction("Create folder failed","editor",createNewFolder));
  els.fileTree?.addEventListener("click",e=>{
    const folder=e.target.closest("[data-folder]");
    if (folder) { toggleFolder(folder.dataset.folder); return; }
    const row=e.target.closest("[data-path]");
    if (row) setActiveFile(row.dataset.path);
  });
  // Right-click context menu on file tree items
  els.fileTree?.addEventListener("contextmenu", e => {
    const row = e.target.closest("[data-path]");
    if (!row) return;
    e.preventDefault();
    showContextMenu(e, fileMenuItems(row.dataset.path));
  });

  // Recent workspaces — open, inline remove button, clear-all, right-click menu
  [els.recentWorkspacesPanel, els.emptyRecentWorkspaces].forEach(node => {
    if (!node) return;

    // Left-click: open workspace or remove via inline × button
    node.addEventListener("click", e => {
      // Inline remove button
      const removeBtn = e.target.closest("[data-remove-workspace]");
      if (removeBtn) { e.stopPropagation(); handleRecentRemove(removeBtn.dataset.removeWorkspace); return; }
      // Clear all
      if (e.target.closest(".recent-clear-all-btn")) {
        clearRecentWorkspaces();
        renderRecentWorkspaces();
        showToast("Cleared all recent workspaces");
        return;
      }
      // Open workspace
      const btn = e.target.closest("[data-recent-workspace]");
      if (btn) runAction("Open recent failed", "workspace", () => openRecentWorkspace(btn.dataset.recentWorkspace));
    });

    // Right-click context menu on a recent item
    node.addEventListener("contextmenu", e => {
      const item = e.target.closest("[data-rootdir]");
      if (!item) return;
      e.preventDefault();
      const rootDir = item.dataset.rootdir;
      const label   = item.querySelector("strong")?.textContent || baseName(rootDir);
      showContextMenu(e, [
        { icon: "↩", label: "Open workspace",  action: "open-recent",   data: rootDir },
        "sep",
        { icon: "✕", label: `Remove "${label}"`, action: "remove-recent", data: rootDir, danger: true },
        { icon: "✕", label: "Clear all recent", action: "clear-recent",  data: rootDir, danger: true },
      ]);
    });
  });

  // Git panels
  const gitClickHandler = container => container?.addEventListener("click",e=>{
    const ga=e.target.closest("[data-git-action]");
    if (ga) { runAction("Git action failed","git",()=>runGitAction(ga.dataset.gitAction,ga.dataset.gitPath)); return; }
    const dp=e.target.closest("[data-diff-path]");
    if (dp) { runAction("Git diff failed","git",()=>previewGitDiff(dp.dataset.diffPath)); return; }
    const cf=e.target.closest("[data-path]");
    if (cf) setActiveFile(cf.dataset.path);
  });
  gitClickHandler(els.gitChangedFiles);
  gitClickHandler(els.changesGroups);

  // Git commit button
  els.gitCommitBtn?.addEventListener("click",()=>{
    const staged=(state.gitStatus?.files||[]).filter(f=>f.staged&&!f.untracked).length;
    runAction("Git commit failed","git",()=>openGitCommit(staged));
  });

  els.stageAllBtn?.addEventListener("click",()=>runAction("Stage all failed","git",()=>runGitAction("stage-all")));
  els.unstageAllBtn?.addEventListener("click",()=>runAction("Unstage all failed","git",()=>runGitAction("unstage-all")));

  // Tabs
  els.tabbar?.addEventListener("click",e=>{
    const close=e.target.closest("[data-close-tab]");
    if (close) { e.stopPropagation(); closeTab(close.dataset.closeTab); return; }
    const tab=e.target.closest("[data-tab]");
    if (tab) setActiveFile(tab.dataset.tab);
  });
  // Right-click context menu on tabs
  els.tabbar?.addEventListener("contextmenu", e => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    e.preventDefault();
    showContextMenu(e, tabMenuItems(tab.dataset.tab));
  });
  // Middle-click closes tab
  els.tabbar?.addEventListener("auxclick", e => {
    if (e.button !== 1) return;
    const tab = e.target.closest("[data-tab]");
    if (tab) closeTab(tab.dataset.tab);
  });

  // Console
  els.clearConsoleBtn?.addEventListener("click",()=>{ state.consoleEntries=[]; renderConsole(); });
  document.getElementById("clearActionLogBtn")?.addEventListener("click", () => {
    clearActionLog();
    const panel = document.getElementById("actionLogPanel");
    if (panel) renderActionLog(panel, async act => {
      if (!state.workspace?.rootDir) return;
      for (const f of act.files) {
        await window.orionDesktop.writeFile({ rootDir: state.workspace.rootDir, relativePath: f.path, content: f.before });
        setFileContent(f.path, f.before);
      }
      await refreshGitStatus();
      updateWorkspacePanels();
      renderTree();
      renderTabs();
      syncEditor();
    });
  });
  document.querySelectorAll(".console-tab").forEach(btn=>btn.addEventListener("click",()=>openConsolePane(btn.dataset.pane || "terminal")));
  els.consoleCollapseBtn?.addEventListener("click",()=>{ if(state.consoleCollapsed) openConsolePane(state.consolePane||"terminal",true); else setConsoleCollapsed(true); });
  els.openPathBtn?.addEventListener("click",()=>{ if(state.workspace?.rootDir) window.orionDesktop.openPath(state.workspace.rootDir); });
  els.commandInput?.addEventListener("keydown",e=>{
    if (e.key==="Enter") { e.preventDefault(); runCommand(); }
    else if (e.key==="ArrowUp") { if(!state.commandHistory.length) return; e.preventDefault(); state.commandHistoryIndex=Math.max(0,state.commandHistoryIndex-1); if(els.commandInput) els.commandInput.value=state.commandHistory[state.commandHistoryIndex]||""; }
    else if (e.key==="ArrowDown") { if(!state.commandHistory.length) return; e.preventDefault(); state.commandHistoryIndex=Math.min(state.commandHistory.length,state.commandHistoryIndex+1); if(els.commandInput) els.commandInput.value=state.commandHistory[state.commandHistoryIndex]||""; }
  });
  els.runCommandBtn?.addEventListener("click",runCommand);

  // Chat
  els.chatForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const p = els.chatInput?.value.trim();
    if (!p) return;
    if (els.chatInput) els.chatInput.value = "";
    try {
      await writeCurrentFile();
      await sendToOrion(p);
    } catch (err) {
      reportError("Chat submit failed", err);
    }
  });
  els.clearChatBtn?.addEventListener("click",clearChatHistory);

  // Feedback button clicks (thumbs up/down)
  els.chatFeed?.addEventListener("click", async e => {
    const fb = e.target.closest("[data-feedback]");
    if (!fb) return;
    const row   = fb.closest(".feedback-row");
    const msgId = row?.dataset.msgId || "";
    const rating = fb.dataset.feedback;
    // Visual — mark selected
    row.querySelectorAll(".feedback-btn").forEach(b => b.classList.remove("active"));
    fb.classList.add("active");
    await submitFeedback(msgId, rating, state.config?.backendUrl, authHeaders);
  });

  const runPrompt = async p => { if (!p) return; setRightView("chat"); setRightCollapsed(false); if(els.chatInput) els.chatInput.value=""; await writeCurrentFile(); await sendToOrion(p); };
  [els.quickActionGrid,els.workspaceRecommendations].forEach(node=>node?.addEventListener("click",e=>{
    const btn=e.target.closest("[data-prompt],[data-recommendation-prompt]");
    if (btn) runAction("Orion shortcut failed","chat",()=>runPrompt(btn.dataset.prompt||btn.dataset.recommendationPrompt||""));
  }));
  els.emptyGuideGrid?.addEventListener("click",e=>{
    const btn=e.target.closest("[data-empty-action]"); if (!btn) return;
    const a=btn.dataset.emptyAction;
    if (a==="choose-workspace")    runAction("Open failed","workspace",chooseWorkspace);
    else if (a==="focus-chat")     { setRightCollapsed(false); setRightView("chat"); requestAnimationFrame(()=>els.chatInput?.focus()); }
    else if (a==="open-command-palette") openCommandPalette(true);
    else if (a==="start-tour")     { showWelcomeWizard(() => { if(state.workspace) startTour(() => {}); }); }
  });

  // Layout
  document.querySelectorAll("[data-right-view]").forEach(btn => btn.addEventListener("click", () => setRightView(btn.dataset.rightView)));
  els.commandPaletteBtn?.addEventListener("click",()=>openCommandPalette(true));
  els.settingsOpenBtn?.addEventListener("click",()=>openSettingsModal(true));
  els.settingsPanelBtn?.addEventListener("click",()=>openSettingsModal(true));

  // Splitters
  // Branch switcher on git badge click
  document.getElementById("gitBranchBadge")?.addEventListener("click", e => {
    if (state.gitStatus?.available) openBranchSwitcher(e.currentTarget);
  });
  els.leftSplitter?.addEventListener("pointerdown",beginHResize("left"));
  els.leftSplitter?.addEventListener("dblclick", () => { state.leftSize = 248; persistLayout(); renderLayout(); if(state.editor) state.editor.layout(); });
  els.rightSplitter?.addEventListener("dblclick", () => { state.rightSize = 340; persistLayout(); renderLayout(); if(state.editor) state.editor.layout(); });
  els.rightSplitter?.addEventListener("pointerdown",beginHResize("right"));
  els.dockResizeHandle?.addEventListener("pointerdown",beginDockResize);

  // Auth
  els.authOpenBtn?.addEventListener("click",async()=>{
    if (state.session) { try { await signOutCurrentUser(); } catch(err) { syncAuthBtns(); showToast("Sign out failed","error"); } return; }
    openAuthModal(true);
  });
  els.cancelAuthBtn?.addEventListener("click",()=>openAuthModal(false));
  // Auth mode state
  let _authMode = "signin";

  function setAuthMode(mode) {
    _authMode = mode;
    const title = document.getElementById("authTitle");
    const sub   = document.getElementById("authSubtitle");
    const submitBtn = document.getElementById("authSubmitBtn");
    const pwdField  = els.passwordInput;
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.toggle("active", t.id === "authTab" + mode.charAt(0).toUpperCase() + mode.slice(1)));
    if (mode === "signin")  { if(title) title.textContent="Sign in to Orion IDE"; if(submitBtn) submitBtn.textContent="Sign In"; if(pwdField) pwdField.style.display=""; }
    if (mode === "signup")  { if(title) title.textContent="Create your account";  if(submitBtn) submitBtn.textContent="Create account"; if(pwdField) pwdField.style.display=""; }
    if (mode === "reset")   { if(title) title.textContent="Reset your password";  if(submitBtn) submitBtn.textContent="Send reset email"; if(pwdField) pwdField.style.display="none"; }
    if (sub) sub.textContent = mode === "reset" ? "Enter your email and we'll send a reset link." : "Unlock your quota, role, and personalised backend access.";
    if (els.authError) els.authError.textContent = "";
  }

  document.getElementById("authTabSignIn")?.addEventListener("click", () => setAuthMode("signin"));
  document.getElementById("authTabSignUp")?.addEventListener("click", () => setAuthMode("signup"));
  document.getElementById("authTabReset")?.addEventListener("click",  () => setAuthMode("reset"));

  // GitHub OAuth
  document.getElementById("githubOAuthBtn")?.addEventListener("click", async () => {
    if (!state.sb) { if(els.authError) els.authError.textContent = "Auth not configured."; return; }
    try {
      const { error } = await state.sb.auth.signInWithOAuth({ provider: "github", options: { skipBrowserRedirect: false } });
      if (error) throw error;
    } catch (err) { if(els.authError) els.authError.textContent = err.message || "GitHub sign-in failed."; }
  });

  els.authForm?.addEventListener("submit", async e => {
    e.preventDefault();
    if (els.authError) els.authError.textContent = "";
    const email    = els.emailInput?.value.trim();
    const password = els.passwordInput?.value;
    try {
      if (!state.sb) throw new Error("Supabase auth is not configured.");
      if (_authMode === "signin") {
        const { error } = await state.sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        openAuthModal(false);
      } else if (_authMode === "signup") {
        const { error } = await state.sb.auth.signUp({ email, password });
        if (error) throw error;
        if (els.authError) { els.authError.style.color = "var(--accent)"; els.authError.textContent = "Check your email to confirm your account."; }
      } else if (_authMode === "reset") {
        const { error } = await state.sb.auth.resetPasswordForEmail(email);
        if (error) throw error;
        if (els.authError) { els.authError.style.color = "var(--accent)"; els.authError.textContent = "Reset email sent! Check your inbox."; }
      }
    } catch (err) { if(els.authError) { els.authError.style.color = ""; els.authError.textContent = err.message || "Auth failed."; } }
  });

  // Settings
  els.cancelSettingsBtn?.addEventListener("click",()=>openSettingsModal(false));
  els.settingsForm?.addEventListener("submit",e=>{ e.preventDefault(); saveSettingsFromForm(); });

  // Action modal
  els.cancelActionBtn?.addEventListener("click",()=>{ const r=state.actionRequest?.resolve; state.actionRequest=null; closeActionModal(); if(r) r(""); });
  els.actionForm?.addEventListener("submit",e=>{
    e.preventDefault(); if (!state.actionRequest?.resolve) return;
    const val=state.actionRequest?.preserveInput?String(els.actionInput?.value||"").trim():normalizeRelPath(els.actionInput?.value||"");
    if (!val) { if(els.actionError) els.actionError.textContent=state.actionRequest?.preserveInput?"Enter a command.":"Enter a valid path."; return; }
    const r=state.actionRequest.resolve; state.actionRequest=null; closeActionModal(); r(val);
  });

  // Command palette
  els.closeCommandPaletteBtn?.addEventListener("click",()=>openCommandPalette(false));
  els.commandPaletteInput?.addEventListener("input",()=>{ state.commandPaletteQuery=els.commandPaletteInput.value||""; state.commandPaletteSelection=0; renderCommandPalette(); });
  els.commandPaletteInput?.addEventListener("keydown",async e=>{
    if (e.key==="ArrowDown")  { e.preventDefault(); state.commandPaletteSelection=Math.min(state.commandPaletteItems.length-1,state.commandPaletteSelection+1); renderCommandPalette(); }
    else if (e.key==="ArrowUp") { e.preventDefault(); state.commandPaletteSelection=Math.max(0,state.commandPaletteSelection-1); renderCommandPalette(); }
    else if (e.key==="Enter")   { e.preventDefault(); await runPaletteSelection(); }
    else if (e.key==="Escape")  { e.preventDefault(); openCommandPalette(false); }
  });
  els.commandPaletteList?.addEventListener("click",e=>{ const btn=e.target.closest("[data-command-index]"); if(btn) runPaletteSelection(Number(btn.dataset.commandIndex)); });

  // Patch preview
  els.closePatchPreviewBtn?.addEventListener("click",()=>openPatchPreview(false));
  els.discardPatchBtn?.addEventListener("click",discardPatch);
  els.applyPatchBtn?.addEventListener("click",()=>runAction("Apply patch failed","patch",applyPendingPatch));
  els.patchPreviewList?.addEventListener("click",e=>{ const btn=e.target.closest("[data-patch-file]"); if(btn) previewPatchFile(btn.dataset.patchFile); });

  // Activity bar
  document.querySelectorAll(".activity-btn[data-activity]").forEach(btn => {
    btn.addEventListener("click", () => setActivity(btn.dataset.activity));
  });
  document.querySelector('.activity-btn[data-activity="account"]')?.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    openAccountPanel({ openAuthIfGuest: true });
  });

  // Breadcrumb clicks
  document.getElementById("breadcrumbNav")?.addEventListener("click", e => {
    const seg = e.target.closest("[data-breadcrumb-path]");
    if (!seg) return;
    const path = seg.dataset.breadcrumbPath;
    if (hasFile(path)) setActiveFile(path);
    // If it's a folder segment, switch to explorer and show that folder
  });

  // Global search
  els.globalSearch?.addEventListener("input", () => {
    debouncedGlobalSearch(els.globalSearch.value);
  });
  document.getElementById("globalSearchResults")?.addEventListener("click", e => {
    const hit = e.target.closest("[data-path][data-line]");
    if (!hit) return;
    setActiveFile(hit.dataset.path);
    requestAnimationFrame(() => revealLine(Number(hit.dataset.line)));
  });

  // Prompt suggestion chips
  els.promptSuggestions?.addEventListener("click", e => {
    const chip = e.target.closest("[data-suggestion-prompt]");
    if (!chip) return;
    const prompt = chip.dataset.suggestionPrompt;
    if (!prompt) return;
    setRightView("chat");
    setRightCollapsed(false);
    if (els.chatInput) els.chatInput.value = prompt;
    els.chatInput?.focus();
  });

  // Shortcuts button
  els.shortcutsBtn?.addEventListener("click", () => openShortcuts(true));

  // Health status bar item â†’ open health panel
  els.healthStatusItem?.addEventListener("click", () => setActivity("health"));

  // Auto-save toggle in account panel
  els.autoSaveSelect?.addEventListener("change", () => {
    state.preferences.autoSave = els.autoSaveSelect.value !== "off";
    persistPrefs();
    applyPrefs();
  });

  // Bug report button
  document.getElementById("bugReportTriggerBtn")?.addEventListener("click", openBugReport);

  // Voice input
  document.getElementById("voiceInputBtn")?.addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast("Voice input not supported in this environment", "error"); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    const btn = document.getElementById("voiceInputBtn");
    if (btn) { btn.textContent = "\uD83D\uDD34"; btn.title = "Listening..."; }
    rec.start();
    rec.onresult = e => {
      const transcript = e.results[0][0].transcript;
      if (els.chatInput) {
        els.chatInput.value = (els.chatInput.value + " " + transcript).trim();
        els.chatInput.focus();
      }
      if (btn) { btn.textContent = "\uD83C\uDFA8"; btn.title = "Voice input"; }
    };
    rec.onerror = () => { if (btn) { btn.textContent = "\uD83C\uDFA8"; btn.title = "Voice input"; } };
    rec.onend   = () => { if (btn) { btn.textContent = "\uD83C\uDFA8"; btn.title = "Voice input (click to speak)"; } };
  });

  // Diff editor close button
  document.getElementById("closeDiffBtn")?.addEventListener("click", hideDiff);

  // Wire patch list clicks to show diff
  els.patchPreviewList?.addEventListener("click", e => {
    const btn = e.target.closest("[data-patch-file]");
    if (!btn) return;
    previewPatchFile(btn.dataset.patchFile);
    // Also show Monaco diff
    const patch = state.pendingPatch;
    const entry = patch?.entries.find(en => en.filePath === btn.dataset.patchFile);
    if (entry) {
      showDiff({
        original: entry.previousContent,
        modified: entry.nextContent,
        language: entry.language,
        title: entry.filePath,
      });
    }
  });

  // Git log tab — load when pane activated
  document.querySelectorAll(".console-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.pane === "gitlog") renderGitLog();
    });
  });

  // Git log — click a commit hash to view its diff in the Monaco diff editor
  document.addEventListener("click", async (e) => {
    const hashEl = e.target.closest(".git-log-hash");
    if (!hashEl || !state.workspace?.rootDir) return;
    const hash = hashEl.textContent?.trim();
    if (!hash) return;
    hashEl.style.opacity = "0.5";
    try {
      const result = await window.orionDesktop.getCommitDiff({ rootDir: state.workspace.rootDir, hash });
      if (!result?.ok || !result.diff) {
        showToast("Could not load commit diff", "error");
        return;
      }
      showDiff({
        original: "",
        modified: result.diff,
        language: "diff",
        title: `Commit ${hash}`,
      });
      // Switch to the diff view in the dock
      const diffPane = document.querySelector('.console-tab[data-pane="diff"]');
      if (diffPane) diffPane.click();
    } catch (err) {
      showToast("Error loading commit: " + err.message, "error");
    } finally {
      hashEl.style.opacity = "";
    }
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", async e => {
    const meta=e.ctrlKey||e.metaKey;
    if (state.commandPaletteOpen) { if (e.key==="Escape") { e.preventDefault(); openCommandPalette(false); } return; }
    if (els.patchPreviewModal?.classList.contains("open")) { if (e.key==="Escape") { e.preventDefault(); openPatchPreview(false); } return; }
    if (!meta) return;
    const key=String(e.key||"").toLowerCase();
    if (key==="p") { e.preventDefault(); openCommandPalette(true); }
    else if (key==="f" && !isTextInput(e.target)) { e.preventDefault(); state.editor?.getAction("actions.find")?.run(); }
    else if (key==="h" && !isTextInput(e.target)) { e.preventDefault(); state.editor?.getAction("editor.action.startFindReplaceAction")?.run(); }
    else if (key==="g" && !isTextInput(e.target)) { e.preventDefault(); state.editor?.getAction("editor.action.revealDefinition")?.run(); }
    else if (key==="o") { e.preventDefault(); await runAction("Open failed","workspace",chooseWorkspace); }
    else if (key==="b"&&e.shiftKey) { e.preventDefault(); setRightCollapsed(!state.rightCollapsed); }
    else if (key==="b") { e.preventDefault(); setLeftCollapsed(!state.leftCollapsed); }
    else if (key==="j") { e.preventDefault(); openConsolePane("terminal",true); }
    else if (key==="s"&&!isTextInput(e.target)) { e.preventDefault(); await runAction("Save failed","editor",writeCurrentFile); }
    else if (key==="r"&&!isTextInput(e.target)) { e.preventDefault(); await runAction("Workspace refresh failed","workspace",reloadWorkspace); }
    else if (key===","&&!isTextInput(e.target)) { e.preventDefault(); openSettingsModal(true); }
    else if (key==="l") { e.preventDefault(); setRightView("chat"); setRightCollapsed(false); requestAnimationFrame(()=>els.chatInput?.focus()); }
    else if (key==="enter"&&!isTextInput(e.target)) { e.preventDefault(); await runAction("Run failed","terminal",triggerRunWorkspace); }
    else if (key==="k"&&e.shiftKey) { e.preventDefault(); openShortcuts(true); }
    else if (key==="w"&&!isTextInput(e.target)) { e.preventDefault(); if(state.activeFile) closeTab(state.activeFile); }
    else if (key==="1") { e.preventDefault(); setLeftCollapsed(false); setActivity("explorer"); }
    else if (key==="2") { e.preventDefault(); setLeftCollapsed(false); setActivity("search"); }
    else if (key==="3") { e.preventDefault(); setLeftCollapsed(false); setActivity("changes"); }
  });
  // Ctrl+Tab to cycle tabs
  window.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Tab") {
      e.preventDefault();
      const tabs = state.openTabs.filter(f => hasFile(f));
      if (tabs.length < 2) return;
      const cur = tabs.indexOf(state.activeFile);
      const next = e.shiftKey
        ? tabs[(cur - 1 + tabs.length) % tabs.length]
        : tabs[(cur + 1) % tabs.length];
      setActiveFile(next);
    }
  });
}

// â”€â”€ Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function boot() {
  cacheDom();
  state.pendingRequests = 0;
  state.chat = state.chat.map(m => ({ ...m, pending: false }));
  persistChat();
  if (els.thinkingIndicator) els.thinkingIndicator.hidden = true;

  // Init sub-modules
  // Init new modules
  initProgress();
  initCompletions(state.config?.backendUrl || "", authHeaders);
  initMentions(els.chatInput, fp => {
    // Show pinned file pill
    renderPinnedFiles();
  });
  initContextMenu(async (action, data) => {
    const fp = data;
    if (action === "open")                setActiveFile(fp);
    else if (action === "rename")         await runAction("Rename failed","editor",renameCurrentPath);
    else if (action === "duplicate")      await runAction("Duplicate failed","editor",duplicateCurrentFile);
    else if (action === "delete")         await runAction("Delete failed","editor",deleteCurrentPath);
    else if (action === "close-tab")      closeTab(fp);
    else if (action === "close-other-tabs") { state.openTabs = [fp]; state.activeFile = fp; renderTabs(); syncEditor(); }
    else if (action === "close-all-tabs") { state.openTabs = []; state.activeFile = ""; renderTabs(); syncEditor(); }
    else if (action === "copy-path")      { try { await navigator.clipboard.writeText(fp); showToast("Path copied"); } catch {} }
    // Recent workspace actions
    else if (action === "open-recent")    runAction("Open recent failed","workspace",()=>openRecentWorkspace(fp));
    else if (action === "remove-recent")  handleRecentRemove(fp);
    else if (action === "clear-recent")   { clearRecentWorkspaces(); renderRecentWorkspaces(); showToast("Cleared all recent workspaces"); }
  });
  initDragDrop(async folderPath => {
    const snap = await window.orionDesktop?.openFolderPath?.(folderPath);
    if (snap && snap.ok !== false) await loadWorkspaceSnapshot(snap, { announce: "Opened workspace" });
    else showToast("Could not open that folder", "error");
  });

  initConsole({ terminalPane:els.terminalPane, tracePane:els.tracePane, sourcesPane:els.sourcesPane, traceList:els.traceList, traceLead:els.traceLead });
  initUI();
  initGitCommit();
  initShortcuts();
  initAutoSave(writeCurrentFile, state.preferences.autoSave ?? true, 1500);

  // Restore active activity panel
  setActivity(state.activeActivity || "explorer");
  bindEvents();

  state.config = await window.orionDesktop.getConfig();
  applyPrefs();
  // Re-init completions now that config is available
  initCompletions(state.config?.backendUrl || "", authHeaders);
  renderLayout();
  updateWorkspacePanels();
  updateAccountPanels();
  updateEditorMeta();
  renderTree();
  renderTabs();
  renderChat();
  renderConsole();
  renderTrace();
  renderRecentWorkspaces();
  renderCommandPalette();
  renderQuickActions();
  renderEmptyGuide();
  renderProjectInsights();

  try {
    await initMonaco();
  } catch (err) {
    reportError("Monaco init failed", err);
    showToast("Editor failed to initialize", "error");
  }

  try {
    await initAuth();
  } catch (err) {
    reportError("Auth init failed", err);
    showToast("Auth failed to initialize", "error");
  }

  if (localStorage.getItem(STORAGE_KEYS.workspacePath)) {
    try {
      await reloadWorkspace();
    } catch (err) {
      reportError("Workspace restore failed", err);
      showToast("Workspace restore failed", "error");
    }
  }

  // Debounced focus reload â€” prevents rapid re-indexing on each window focus
  const debouncedReload = debounce(()=>{ if (state.workspace?.rootDir) reloadWorkspace().catch(()=>{}); }, 2000);
  window.addEventListener("resize", ()=>{ renderLayout(); if(state.editor) state.editor.layout(); });
  window.addEventListener("focus", debouncedReload);

  setOnlineStatus("online");
  // Apply system theme if no explicit preference has been saved yet
  window.orionDesktop?.onSystemTheme?.(sysTheme => {
    const saved = state.preferences?.theme;
    if (!saved || saved === "light" || saved === "dark") {
      // Only auto-switch if user hasn't customised
      const stored = localStorage.getItem("orion_preferences_v2");
      if (!stored) {
        state.preferences.theme = sysTheme;
        persistPrefs();
        applyPrefs();
      }
    }
  });

  // Auto-updater notifications
  function showUpdateBanner(isReady) {
    const banner = document.getElementById("updateBanner");
    const restartBtn = document.getElementById("updateRestartBtn");
    if (!banner) return;
    banner.classList.add("visible");
    if (isReady && restartBtn) {
      restartBtn.textContent = "Restart now";
      restartBtn.style.fontWeight = "600";
    }
  }

  window.orionDesktop?.onUpdateAvailable?.(() => showUpdateBanner(false));
  window.orionDesktop?.onUpdateDownloaded?.(() => showUpdateBanner(true));

  document.getElementById("updateRestartBtn")?.addEventListener("click", () => {
    window.orionDesktop?.quitAndInstall?.();
  });
  document.getElementById("updateDismissBtn")?.addEventListener("click", () => {
    const b = document.getElementById("updateBanner");
    if (b) b.classList.remove("visible");
  });

  log("info", "Orion IDE v0.4 booted.", "terminal");
  addTrace("info", "Desktop booted", "Orion IDE v2 initialized.", { scope: "boot" });

  // Disabled auto-onboarding for now so overlays never block the IDE shell.
}

document.addEventListener("DOMContentLoaded",()=>{
  boot().catch(err=>{
    console.error("[OrionIDE] boot error",err);
    try { showToast(`Startup error: ${err.message}`, "error"); } catch { /* ignore */ }
  });
});


