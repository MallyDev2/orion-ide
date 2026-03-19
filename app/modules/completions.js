/**
 * completions.js — Inline ghost-text completions (Copilot-style).
 * Registers a Monaco InlineCompletionsProvider that calls the backend.
 *
 * Changes vs original:
 *  - Context window expanded from 10 → 50 lines above cursor + 10 below
 *  - Completions indicator dot pulses while a fetch is in flight
 *  - Alt+\ manually triggers a completion (matches Copilot muscle memory)
 */
"use strict";
import { state } from "./state.js";
import { inferLang } from "./utils.js";

let _enabled     = true;
let _authHeaders = () => ({});
let _backendUrl  = "";
let _providerDisposable = null;
let _commandBound = false;

// DOM refs — set lazily so this module works before the DOM is ready
function _dot()       { return document.getElementById("completionsDot"); }
function _indicator() { return document.getElementById("completionsIndicator"); }
function _label()     { return document.getElementById("completionsLabel"); }

function _setFetching(on) {
  const dot = _dot();
  if (!dot) return;
  dot.classList.toggle("active",   !on);  // steady green when idle+enabled
  dot.classList.toggle("fetching", on);   // pulsing amber while fetching
}

function _syncIndicator() {
  const el = _indicator();
  if (!el) return;
  el.style.display = _enabled ? "" : "none";
  const lbl = _label();
  if (lbl) lbl.textContent = "AI";
  const dot = _dot();
  if (dot) { dot.classList.toggle("active", true); dot.classList.remove("fetching"); }
}

export function initCompletions(backendUrl, getAuthHeaders) {
  _backendUrl  = backendUrl;
  _authHeaders = getAuthHeaders;
  _syncIndicator();
}

export function setCompletionsEnabled(v) {
  _enabled = !!v;
  _syncIndicator();
}
export function getCompletionsEnabled() { return _enabled; }

export function registerInlineCompletions() {
  if (!window.monaco || !state.editor) return;

  // Alt+\ — manual trigger (same as GitHub Copilot)
  if (!_commandBound) {
    state.editor.addCommand(
      window.monaco.KeyMod.Alt | window.monaco.KeyCode.Backslash,
      () => {
        if (!_enabled || !state.editor) return;
        state.editor.trigger("keyboard", "editor.action.inlineSuggest.trigger", {});
      }
    );
    _commandBound = true;
  }

  _providerDisposable?.dispose?.();
  _providerDisposable = window.monaco.languages.registerInlineCompletionsProvider({ pattern: "**" }, {
    provideInlineCompletions: debounceProvider(async (model, position) => {
      if (!_enabled || !state.workspace || !_backendUrl) return { items: [] };

      const linePrefix = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Don't complete on empty or very short lines
      if (!linePrefix.trim() || linePrefix.trim().length < 2) return { items: [] };

      // 50 lines of prefix context + 10 lines of suffix context
      const contextStart = Math.max(1, position.lineNumber - 50);
      const prefix = model.getValueInRange({
        startLineNumber: contextStart, startColumn: 1,
        endLineNumber: position.lineNumber, endColumn: position.column,
      });

      const suffix = model.getValueInRange({
        startLineNumber: position.lineNumber, startColumn: position.column,
        endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 10), endColumn: 9999,
      });

      _setFetching(true);
      try {
        const baseUrl = _backendUrl.replace(/\/ask$/, "");
        const res = await fetch(baseUrl + "/api/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json", ..._authHeaders() },
          body: JSON.stringify({
            prefix,
            suffix,
            language: inferLang(state.activeFile || ""),
            filePath: state.activeFile || "",
            maxTokens: 80,
          }),
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return { items: [] };
        const data = await res.json();
        const text = (data.completion || data.text || "").trimEnd();
        if (!text) return { items: [] };

        return {
          items: [{
            insertText: text,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
          }],
        };
      } catch {
        return { items: [] };
      } finally {
        _setFetching(false);
      }
    }, 420),
    freeInlineCompletions() {},
  });
}

function debounceProvider(fn, ms) {
  let timer;
  return (...args) => new Promise(resolve => {
    clearTimeout(timer);
    timer = setTimeout(() => resolve(fn(...args)), ms);
  });
}
