/**
 * memory.js — Persistent per-workspace AI memory.
 *
 * Writes orion-memory.json into the workspace root.
 * Entries are injected into every AI prompt automatically.
 * Users can view, add, and delete entries from the Memory tab.
 */
"use strict";
import { esc, stamp } from "./utils.js";
import { state } from "./state.js";
import { showToast } from "./ui.js";

// In-memory cache keyed by rootDir
const _cache = {};

export function getMemoryKey(rootDir) {
  return rootDir ? `orion_memory_${btoa(rootDir).replace(/=+$/, "").slice(0, 32)}` : null;
}

/** Load memory for current workspace from localStorage */
export function loadMemory(rootDir) {
  if (!rootDir) return [];
  const key = getMemoryKey(rootDir);
  try {
    const raw = localStorage.getItem(key);
    _cache[rootDir] = raw ? JSON.parse(raw) : [];
  } catch {
    _cache[rootDir] = [];
  }
  return _cache[rootDir];
}

export function getMemory(rootDir) {
  return _cache[rootDir] || loadMemory(rootDir);
}

function saveMemory(rootDir) {
  const key = getMemoryKey(rootDir);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(_cache[rootDir] || []));
  } catch { /* storage full */ }
}

export function addMemoryEntry(rootDir, text) {
  if (!rootDir || !text?.trim()) return;
  const entries = getMemory(rootDir);
  entries.unshift({
    id: `mem_${Date.now()}`,
    text: text.trim(),
    ts: stamp(),
    addedAt: new Date().toISOString(),
  });
  // Cap at 40 entries
  _cache[rootDir] = entries.slice(0, 40);
  saveMemory(rootDir);
  showToast("Memory saved");
}

export function deleteMemoryEntry(rootDir, id) {
  if (!rootDir) return;
  _cache[rootDir] = (getMemory(rootDir)).filter(e => e.id !== id);
  saveMemory(rootDir);
}

export function clearMemory(rootDir) {
  if (!rootDir) return;
  _cache[rootDir] = [];
  saveMemory(rootDir);
  showToast("Memory cleared");
}

/**
 * Build the memory injection string for the AI system prompt.
 */
export function buildMemoryPrompt(rootDir) {
  const entries = getMemory(rootDir);
  if (!entries.length) return "";
  return [
    "== Orion Workspace Memory (established decisions — always respect these) ==",
    ...entries.map((e, i) => `${i + 1}. ${e.text}`),
    "== End of memory ==",
  ].join("\n");
}

/** Render the memory panel into a container element */
export function renderMemoryPanel(container, rootDir, onUpdate) {
  if (!container) return;
  const entries = getMemory(rootDir);

  container.innerHTML = `
    <div class="memory-panel">
      <div class="memory-add-row">
        <textarea class="compact-input memory-input" rows="2"
          placeholder="e.g. We use Zod for all validation, prefer async/await over callbacks…"></textarea>
        <button class="primary-btn tiny memory-save-btn" type="button">Save</button>
      </div>
      ${entries.length === 0 ? `<div class="microcopy memory-empty">No memories yet. Add decisions and conventions Orion should always remember.</div>` : ""}
      <div class="memory-list">
        ${entries.map(e => `
          <div class="memory-entry" data-mem-id="${esc(e.id)}">
            <p class="memory-text">${esc(e.text)}</p>
            <div class="memory-meta">
              <span>${esc(e.ts)}</span>
              <button class="ghost-btn tiny danger memory-delete" type="button" data-mem-id="${esc(e.id)}">Remove</button>
            </div>
          </div>`).join("")}
      </div>
      ${entries.length > 0 ? `<button class="ghost-btn tiny memory-clear-btn" type="button">Clear all memory</button>` : ""}
    </div>`;

  container.querySelector(".memory-save-btn")?.addEventListener("click", () => {
    const input = container.querySelector(".memory-input");
    const text = input?.value.trim();
    if (!text) return;
    addMemoryEntry(rootDir, text);
    if (input) input.value = "";
    renderMemoryPanel(container, rootDir, onUpdate);
    if (onUpdate) onUpdate();
  });

  container.querySelectorAll(".memory-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      deleteMemoryEntry(rootDir, btn.dataset.memId);
      renderMemoryPanel(container, rootDir, onUpdate);
      if (onUpdate) onUpdate();
    });
  });

  container.querySelector(".memory-clear-btn")?.addEventListener("click", () => {
    clearMemory(rootDir);
    renderMemoryPanel(container, rootDir, onUpdate);
    if (onUpdate) onUpdate();
  });
}
