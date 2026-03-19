/**
 * contextmenu.js — Unified right-click context menu for file tree and tabs.
 */
"use strict";
import { esc } from "./utils.js";

let _menu = null;
let _onAction = null;

export function initContextMenu(onAction) {
  _onAction = onAction;
  document.addEventListener("click", closeContextMenu);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeContextMenu(); });
}

export function closeContextMenu() {
  if (_menu) { _menu.remove(); _menu = null; }
}

/**
 * Show context menu at pointer position.
 * @param {MouseEvent} e
 * @param {Array<{label:string, icon:string, action:string, danger?:boolean, shortcut?:string}|"sep">} items
 */
export function showContextMenu(e, items) {
  closeContextMenu();
  e.preventDefault();
  e.stopPropagation();

  _menu = document.createElement("div");
  _menu.className = "context-menu";

  for (const item of items) {
    if (item === "sep") {
      const sep = document.createElement("div");
      sep.className = "context-menu-sep";
      _menu.appendChild(sep);
      continue;
    }
    const btn = document.createElement("button");
    btn.className = "context-menu-item" + (item.danger ? " danger" : "");
    btn.type = "button";
    btn.innerHTML = `
      <span class="ctx-icon">${esc(item.icon || "")}</span>
      <span>${esc(item.label)}</span>
      ${item.shortcut ? `<span class="context-menu-shortcut">${esc(item.shortcut)}</span>` : ""}
    `;
    btn.addEventListener("click", () => {
      closeContextMenu();
      if (_onAction) _onAction(item.action, item.data);
    });
    _menu.appendChild(btn);
  }

  document.body.appendChild(_menu);

  // Position — keep on screen
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = 200, mh = items.length * 36;
  let x = e.clientX, y = e.clientY;
  if (x + mw > vw) x = vw - mw - 8;
  if (y + mh > vh) y = vh - mh - 8;
  _menu.style.left = `${x}px`;
  _menu.style.top  = `${y}px`;
}

/** Context menu items for a file in the tree */
export function fileMenuItems(fp) {
  return [
    { icon: "↩", label: "Open file",      action: "open",      data: fp },
    { icon: "✎", label: "Rename",          action: "rename",    data: fp, shortcut: "F2" },
    { icon: "⎘", label: "Duplicate",       action: "duplicate", data: fp },
    "sep",
    { icon: "⊡", label: "Copy path",       action: "copy-path", data: fp },
    "sep",
    { icon: "✕", label: "Delete",          action: "delete",    data: fp, danger: true },
  ];
}

/** Context menu items for a tab */
export function tabMenuItems(fp) {
  return [
    { icon: "✕", label: "Close tab",         action: "close-tab",        data: fp, shortcut: "Ctrl+W" },
    { icon: "✕", label: "Close other tabs",  action: "close-other-tabs", data: fp },
    { icon: "✕", label: "Close all tabs",    action: "close-all-tabs",   data: fp },
    "sep",
    { icon: "⎘", label: "Duplicate file",    action: "duplicate",        data: fp },
    { icon: "✎", label: "Rename",            action: "rename",           data: fp },
  ];
}
