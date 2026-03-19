/**
 * ui.js — toast notifications and in-app confirmation dialog.
 * Replaces window.confirm() with a proper modal.
 */
"use strict";
import { esc } from "./utils.js";

let toastStack = null;
let confirmModal = null;
let confirmResolve = null;

export function initUI() {
  toastStack = document.getElementById("toastStack");

  // Build the confirm modal dynamically (inserted once)
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.id = "confirmModal";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="auth-card confirm-card">
      <div class="auth-copy">
        <span class="section-label">Confirm</span>
        <h2 id="confirmTitle">Are you sure?</h2>
        <p id="confirmBody"></p>
      </div>
      <div class="auth-actions">
        <button class="ghost-btn" id="confirmCancelBtn" type="button">Cancel</button>
        <button class="primary-btn danger-btn" id="confirmOkBtn" type="button">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  confirmModal = el;

  document.getElementById("confirmCancelBtn").addEventListener("click", () => settle(false));
  document.getElementById("confirmOkBtn").addEventListener("click",    () => settle(true));
  confirmModal.addEventListener("click", e => { if (e.target === confirmModal) settle(false); });
}

function settle(result) {
  if (!confirmModal) return;
  confirmModal.classList.remove("open");
  confirmModal.setAttribute("aria-hidden", "true");
  if (confirmResolve) { confirmResolve(result); confirmResolve = null; }
}

/**
 * Async in-app confirmation dialog — use instead of window.confirm().
 * @returns {Promise<boolean>}
 */
export function confirm(title, body = "") {
  if (!confirmModal) {
    // initUI hasn't run yet — safe fallback (don't call window.confirm in Electron)
    return Promise.resolve(false);
  }
  const t = document.getElementById("confirmTitle");
  const b = document.getElementById("confirmBody");
  if (t) t.textContent = title;
  if (b) b.textContent = body;
  confirmModal.classList.add("open");
  confirmModal.setAttribute("aria-hidden", "false");
  return new Promise(res => { confirmResolve = res; });
}

/**
 * Show a brief toast notification.
 * @param {string} message
 * @param {"success"|"error"|"info"} kind
 */
export function showToast(message, kind = "success") {
  if (!toastStack) return;
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.textContent = message;
  toastStack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 160);
  }, 1800);
}
