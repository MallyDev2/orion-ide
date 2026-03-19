/**
 * console.js — manages terminal / trace / sources pane rendering.
 */
"use strict";
import { state } from "./state.js";
import { esc, stamp, renderMD } from "./utils.js";

const els = {};
let _ready = false;

export function initConsole(elements) {
  Object.assign(els, elements);
  _ready = true;
}

export function log(kind, message, pane = "terminal") {
  state.consoleEntries.push({ kind, message, pane, ts: stamp() });
  state.consoleEntries = state.consoleEntries.slice(-400);
  // Only render if DOM elements are wired up
  if (_ready) render();
}

export function addTrace(kind, title, detail, meta = {}) {
  state.traceEvents.unshift({
    id: `t_${Date.now()}_${Math.random().toString(16).slice(2,8)}`,
    kind, title, detail, ts: stamp(), meta,
  });
  state.traceEvents = state.traceEvents.slice(0, 24);
  renderTrace();
}

function formatNote(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
}

function terminalEntry(entry) {
  const raw = String(entry.message || "");
  if (entry.kind === "command") return `<div class="console-entry command"><div class="console-line prompt">${esc(raw)}</div></div>`;
  if (entry.kind === "stdout" || entry.kind === "stderr") return `<div class="console-entry ${entry.kind}"><pre class="console-block">${esc(raw)}</pre></div>`;
  return `<div class="console-entry ${entry.kind}"><div class="console-line">${esc(formatNote(raw))}</div></div>`;
}

export function render() {
  [["terminal", els.terminalPane], ["trace", els.tracePane], ["sources", els.sourcesPane]].forEach(([pane, el]) => {
    if (!el) return;
    const entries = state.consoleEntries.filter(e => e.pane === pane);
    if (pane === "terminal") {
      el.innerHTML = entries.map(terminalEntry).join("") || `<div class="console-entry info"><div class="console-line"><span class="stamp">${stamp()}</span>No terminal output yet.</div></div>`;
    } else {
      el.innerHTML = entries.map(e => `<div class="console-entry ${e.kind}"><span class="stamp">${esc(e.ts)}</span>${renderMD(e.message)}</div>`).join("")
        || `<div class="console-entry info"><span class="stamp">${stamp()}</span>No ${pane} output yet.</div>`;
    }
    el.scrollTop = el.scrollHeight;
  });

  document.querySelectorAll("[data-pane]").forEach(node => {
    if (node.classList.contains("console-tab") || node.classList.contains("console-pane")) {
      node.classList.toggle("active", node.dataset.pane === state.consolePane);
    }
  });
}

export function renderTrace() {
  if (!els.traceList) return;
  els.traceList.innerHTML = state.traceEvents.map(e => `
    <article class="trace-item ${e.kind}">
      <strong>${esc(e.title)}</strong>
      <p>${esc(e.detail)}</p>
      <div class="trace-meta"><span>${esc(e.ts)}</span><span>${esc(e.meta.mode || e.meta.scope || "")}</span></div>
    </article>`).join("")
    || `<article class="trace-item info"><strong>Orion is standing by</strong><p>Workspace actions and AI requests will show here.</p><div class="trace-meta"><span>${stamp()}</span><span>idle</span></div></article>`;
  if (els.traceLead) els.traceLead.textContent = state.traceEvents[0]?.title || "Waiting for Orion activity";
}
