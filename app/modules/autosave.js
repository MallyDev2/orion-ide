/**
 * autosave.js — Auto-save active file after N ms of inactivity.
 * Triggered by Monaco's onDidChangeModelContent.
 */
"use strict";

let _timer    = null;
let _enabled  = true;
let _delay    = 1500; // ms
let _saveFn   = null;

export function initAutoSave(saveFn, enabled = true, delay = 1500) {
  _saveFn  = saveFn;
  _enabled = enabled;
  _delay   = delay;
}

export function setAutoSaveEnabled(enabled) {
  _enabled = !!enabled;
  if (!enabled) clearTimeout(_timer);
}

export function setAutoSaveDelay(ms) {
  _delay = Number(ms) || 1500;
}

/** Call this on every editor content-change event */
export function scheduleAutoSave() {
  if (!_enabled || !_saveFn) return;
  clearTimeout(_timer);
  _timer = setTimeout(async () => {
    try { await _saveFn(); } catch { /* ignore — user will see dirty indicator */ }
  }, _delay);
}

export function cancelAutoSave() {
  clearTimeout(_timer);
}
