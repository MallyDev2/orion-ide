/**
 * store.js — Lightweight reactive store wrapping state.
 * Components subscribe to named channels; mutations call notify().
 */
"use strict";

const _listeners = new Map();

/**
 * Subscribe to a channel. Returns an unsubscribe function.
 * @param {string} channel
 * @param {Function} fn
 */
export function subscribe(channel, fn) {
  if (!_listeners.has(channel)) _listeners.set(channel, new Set());
  _listeners.get(channel).add(fn);
  return () => _listeners.get(channel)?.delete(fn);
}

/**
 * Notify all subscribers on a channel with optional payload.
 * @param {string} channel
 * @param {*} payload
 */
export function notify(channel, payload) {
  const fns = _listeners.get(channel);
  if (!fns) return;
  for (const fn of fns) {
    try { fn(payload); } catch (e) { console.error(`[store] ${channel} listener error`, e); }
  }
}

// Known channels
export const CH = {
  WORKSPACE:   "workspace",
  GIT:         "git",
  EDITOR:      "editor",
  TABS:        "tabs",
  CHAT:        "chat",
  LAYOUT:      "layout",
  ACCOUNT:     "account",
  HEALTH:      "health",
};
