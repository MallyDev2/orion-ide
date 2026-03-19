/**
 * actionLog.js — Agent action log with per-session rollback.
 * Records every file write Orion makes so the user can undo any agent change.
 */
"use strict";
import { esc } from "./utils.js";
import { showToast } from "./ui.js";
import { log, addTrace } from "./console.js";

/** @type {Array<{id:string, ts:string, label:string, files:{path:string, before:string, after:string}[]}>} */
let _log = [];

/**
 * Record a batch of file writes as one agent action.
 * @param {string} label  - Short description (e.g. "Patch applied to auth.js")
 * @param {Array<{path:string, before:string, after:string}>} files
 */
export function recordAgentAction(label, files) {
  _log.push({
    id:    `act_${Date.now()}`,
    ts:    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    label: String(label || "Agent action"),
    files: files.map(f => ({ path: f.path, before: String(f.before || ""), after: String(f.after || "") })),
  });
  // Keep last 40 actions
  if (_log.length > 40) _log = _log.slice(-40);
}

/** Get all logged actions (newest first). */
export function getActionLog() {
  return [..._log].reverse();
}

/** Clear the log */
export function clearActionLog() {
  _log = [];
}

/**
 * Render the action log into a container element.
 * @param {HTMLElement} container
 * @param {Function} onRollback  - async (action) => void — called with the action to roll back
 */
export function renderActionLog(container, onRollback) {
  if (!container) return;
  const actions = getActionLog();

  if (!actions.length) {
    container.innerHTML = `<div class="action-log-empty">No agent actions this session.<br>Actions appear here when Orion writes files.</div>`;
    return;
  }

  container.innerHTML = actions.map(a => `
    <div class="action-log-item" data-action-id="${esc(a.id)}">
      <div class="action-log-header">
        <span class="action-log-ts">${esc(a.ts)}</span>
        <strong class="action-log-label">${esc(a.label)}</strong>
        <button class="ghost-btn tiny action-rollback-btn" type="button" data-action-id="${esc(a.id)}" title="Undo this action">↩ Undo</button>
      </div>
      <div class="action-log-files">
        ${a.files.map(f => `<span class="action-log-file">${esc(f.path)}</span>`).join("")}
      </div>
    </div>`).join("");

  container.querySelectorAll(".action-rollback-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id  = btn.dataset.actionId;
      const act = _log.find(a => a.id === id);
      if (!act) return;
      btn.disabled = true;
      btn.textContent = "Rolling back…";
      try {
        await onRollback(act);
        // Remove from log after rollback
        _log = _log.filter(a => a.id !== id);
        showToast(`Rolled back: ${act.label}`);
        addTrace("warn", "Agent action rolled back", act.label, { scope: "rollback" });
        log("info", `Rolled back agent action: ${act.label}`, "terminal");
        renderActionLog(container, onRollback);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "↩ Undo";
        showToast(`Rollback failed: ${err.message}`, "error");
      }
    });
  });
}
