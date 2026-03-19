/**
 * diffEditor.js — Monaco DiffEditor for patch preview and git diff.
 * Replaces the plain-text diff dump with a real before/after view.
 */
"use strict";

let _diffEditor = null;
let _container  = null;

export function initDiffEditor() {
  _container = document.getElementById("diffEditorMount");
  if (!_container || !window.monaco) return;

  _diffEditor = window.monaco.editor.createDiffEditor(_container, {
    readOnly:           true,
    enableSplitViewResizing: true,
    renderSideBySide:   true,
    scrollBeyondLastLine: false,
    minimap:            { enabled: false },
    renderIndicators:   true,
    ignoreTrimWhitespace: false,
    originalEditable:   false,
  });
}

export function showDiff({ original = "", modified = "", language = "javascript", title = "" }) {
  if (!_diffEditor || !window.monaco) return;

  const origModel = window.monaco.editor.createModel(original, language);
  const modiModel = window.monaco.editor.createModel(modified, language);
  _diffEditor.setModel({ original: origModel, modified: modiModel });

  const titleEl = document.getElementById("diffEditorTitle");
  if (titleEl) titleEl.textContent = title || "Diff";

  const pane = document.getElementById("diffEditorPane");
  if (pane) { pane.hidden = false; pane.style.display = "flex"; }
}

export function hideDiff() {
  const pane = document.getElementById("diffEditorPane");
  if (pane) { pane.hidden = true; pane.style.display = "none"; }
  if (_diffEditor) _diffEditor.setModel(null);
}

export function applyTheme(theme) {
  if (!window.monaco) return;
  window.monaco.editor.setTheme(theme === "dark" ? "orion-local-dark" : "orion-local");
}
