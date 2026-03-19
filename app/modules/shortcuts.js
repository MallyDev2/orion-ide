/**
 * shortcuts.js — Keyboard shortcut reference modal (Ctrl+Shift+K or ? button).
 */
"use strict";
import { esc } from "./utils.js";

const GROUPS = [
  {
    title: "Workspace",
    items: [
      ["Ctrl/Cmd+O",       "Open workspace"],
      ["Ctrl/Cmd+R",       "Refresh workspace"],
      ["Ctrl/Cmd+Enter",   "Run project"],
      ["Ctrl/Cmd+S",       "Save current file"],
      ["Ctrl/Cmd+P",       "Command palette"],
      ["Ctrl/Cmd+,",       "Settings"],
    ],
  },
  {
    title: "Navigation",
    items: [
      ["Ctrl/Cmd+B",       "Toggle Explorer"],
      ["Ctrl/Cmd+Shift+B", "Toggle Orion panel"],
      ["Ctrl/Cmd+J",       "Focus terminal"],
      ["Ctrl/Cmd+L",       "Focus Orion chat"],
      ["Ctrl/Cmd+Shift+K", "Shortcut reference"],
      ["Ctrl/Cmd+1",       "Explorer panel"],
      ["Ctrl/Cmd+2",       "Search panel"],
      ["Ctrl/Cmd+3",       "Changes panel"],
    ],
  },
  {
    title: "Tabs",
    items: [
      ["Ctrl/Cmd+W",       "Close current tab"],
      ["Ctrl/Cmd+Tab",     "Next tab"],
      ["Ctrl+Shift+Tab",   "Previous tab"],
      ["Middle-click",     "Close tab"],
      ["Right-click tab",  "Tab context menu"],
    ],
  },
  {
    title: "AI — Orion",
    items: [
      ["AI button (toolbar)", "Explain / Review / Patch"],
      ["Select + Explain",    "Explain selected code"],
      ["Patch",               "AI rewrites active file"],
      ["Review",              "Find bugs in active file"],
      ["Ctrl/Cmd+L",          "Open chat"],
      ["Esc (generating)",    "Stop generation"],
    ],
  },
  {
    title: "Git",
    items: [
      ["Changes tab",         "View staged/unstaged files"],
      ["Stage All button",    "Stage every change"],
      ["Commit button",       "Open commit dialog"],
      ["AI Generate",         "AI-written commit message"],
      ["Git badge (titlebar)","Switch branches"],
    ],
  },
  {
    title: "File Tree",
    items: [
      ["Click",              "Open file"],
      ["Right-click",        "Context menu (rename, delete…)"],
      ["Double-click splitter","Reset panel width"],
    ],
  },
  {
    title: "Terminal",
    items: [
      ["Enter",              "Run command"],
      ["\u2191 / \u2193",   "Command history"],
      ["Ctrl/Cmd+J",         "Open/focus terminal"],
      ["Drag folder",        "Open as workspace"],
    ],
  },
];

let _modal = null;

export function initShortcuts() {
  _modal = document.getElementById("shortcutsModal");
  if (!_modal) {
    _modal = document.createElement("div");
    _modal.className = "modal-backdrop";
    _modal.id = "shortcutsModal";
    _modal.setAttribute("aria-hidden", "true");
    document.body.appendChild(_modal);
  }
  _modal.innerHTML = `
    <div class="auth-card shortcuts-card">
      <div class="auth-copy">
        <span class="section-label">Keyboard Shortcuts</span>
        <h2>Quick reference</h2>
        <p>Everything you can do without reaching for the mouse.</p>
      </div>
      <div class="shortcuts-grid">
        ${GROUPS.map(g => `
          <div class="shortcuts-group">
            <strong class="shortcuts-group-title">${esc(g.title)}</strong>
            ${g.items.map(([key, label]) => `
              <div class="shortcut-row">
                <kbd class="shortcut-key">${esc(key)}</kbd>
                <span>${esc(label)}</span>
              </div>`).join("")}
          </div>`).join("")}
      </div>
      <div class="auth-actions">
        <button class="primary-btn" id="closeShortcutsBtn" type="button">Close</button>
      </div>
    </div>`;
  document.getElementById("closeShortcutsBtn")?.addEventListener("click", () => open(false));
  _modal.addEventListener("click", e => { if (e.target === _modal) open(false); });
}

export function openShortcuts(show) {
  _modal?.classList.toggle("open", !!show);
  _modal?.setAttribute("aria-hidden", show ? "false" : "true");
}

export const open = openShortcuts;
