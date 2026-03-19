/**
 * dragdrop.js — Drag-and-drop workspace opening.
 * Listens for folder drops on the main window.
 */
"use strict";

let _overlay = null;
let _onDrop = null;
let _dragDepth = 0;

export function initDragDrop(onDropFolder) {
  _onDrop = onDropFolder;

  _overlay = document.createElement("div");
  _overlay.className = "drop-overlay";
  _overlay.innerHTML = `
    <div class="drop-overlay-icon">📂</div>
    <div class="drop-overlay-label">Drop folder to open workspace</div>
  `;
  document.body.appendChild(_overlay);

  window.addEventListener("dragenter", onDragEnter, false);
  window.addEventListener("dragleave", onDragLeave, false);
  window.addEventListener("dragover",  onDragOver,  false);
  window.addEventListener("drop",      onDrop,      false);
}

function onDragEnter(e) {
  e.preventDefault();
  _dragDepth++;
  _overlay?.classList.add("active");
}

function onDragLeave(e) {
  e.preventDefault();
  _dragDepth--;
  if (_dragDepth <= 0) {
    _dragDepth = 0;
    _overlay?.classList.remove("active");
  }
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
}

function onDrop(e) {
  e.preventDefault();
  _dragDepth = 0;
  _overlay?.classList.remove("active");

  // In Electron, dropped files come via e.dataTransfer.files
  const files = Array.from(e.dataTransfer?.files || []);
  if (!files.length) return;

  // Try to get folder path — Electron exposes .path on File objects
  const first = files[0];
  const path = first?.path;
  if (path && _onDrop) {
    _onDrop(path);
  }
}
