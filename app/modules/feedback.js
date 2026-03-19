/**
 * feedback.js — AI response feedback (thumbs up/down) + in-app bug report.
 */
"use strict";
import { esc } from "./utils.js";
import { showToast } from "./ui.js";
import { state } from "./state.js";

/**
 * Render thumbs up/down feedback buttons for a chat message.
 */
export function renderFeedbackButtons(msgId) {
  return `
    <div class="feedback-row" data-msg-id="${esc(msgId)}">
      <button class="feedback-btn" data-feedback="good"  title="Good response" type="button" aria-label="Good response">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 7h2v6H2V7zm3-1V12a1 1 0 001 1h5.5a1 1 0 00.97-.75l1.5-5A1 1 0 0013 6H9V3a1 1 0 00-1-1 1 1 0 00-1 1v3H5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
      </button>
      <button class="feedback-btn" data-feedback="bad"   title="Bad response" type="button" aria-label="Bad response">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M14 9h-2V3h2v6zm-3 1V4a1 1 0 00-1-1H4a1 1 0 00-.97.75l-1.5 5A1 1 0 003 10h4v3a1 1 0 001 1 1 1 0 001-1v-3h2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
      </button>
    </div>`;
}

/**
 * Submit feedback to backend.
 */
export async function submitFeedback(msgId, rating, backendUrl, getAuthHeaders) {
  try {
    const base = (backendUrl || "").replace(/\/ask$/, "");
    await fetch(base + "/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        msg_id:  msgId,
        rating,
        user_id: state.session?.user?.id || null,
        workspace_kind: state.workspaceInsight?.workspaceKind || null,
      }),
    });
    showToast(rating === "good" ? "Thanks for the feedback!" : "Noted — we'll improve.");
  } catch {
    showToast("Feedback noted");
  }
}

/**
 * Open the bug report modal.
 */
export function openBugReport() {
  const existing = document.getElementById("bugReportModal");
  if (existing) { existing.classList.add("open"); existing.setAttribute("aria-hidden", "false"); return; }

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "bugReportModal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="auth-card">
      <div class="auth-copy">
        <span class="section-label">Feedback</span>
        <h2>Report an issue</h2>
        <p>Tell us what went wrong and we'll fix it fast.</p>
      </div>
      <form id="bugReportForm" class="auth-form">
        <select id="bugCategory" class="compact-input">
          <option value="bug">Something broke</option>
          <option value="ai">AI gave a bad response</option>
          <option value="perf">Performance issue</option>
          <option value="ux">Hard to use</option>
          <option value="other">Other</option>
        </select>
        <textarea id="bugDesc" class="compact-input" rows="4" placeholder="Describe what happened..." style="resize:vertical;margin-top:8px"></textarea>
        <p class="auth-error" id="bugReportError"></p>
        <div class="auth-actions">
          <button class="ghost-btn" id="closeBugReportBtn" type="button">Cancel</button>
          <button class="primary-btn" type="submit">Send report</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector("#closeBugReportBtn").addEventListener("click", () => {
    modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
  });
  modal.addEventListener("click", e => {
    if (e.target === modal) { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
  });
  modal.querySelector("#bugReportForm").addEventListener("submit", async e => {
    e.preventDefault();
    const category = modal.querySelector("#bugCategory").value;
    const desc     = modal.querySelector("#bugDesc").value.trim();
    if (!desc) { modal.querySelector("#bugReportError").textContent = "Please describe the issue."; return; }
    modal.querySelector(".primary-btn").disabled = true;
    modal.querySelector(".primary-btn").textContent = "Sending...";
    try {
      const base = (state.config?.backendUrl || "").replace(/\/ask$/, "");
      await fetch(base + "/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, description: desc, version: state.config?.appVersion, user_id: state.session?.user?.id }),
      });
    } catch {}
    modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
    showToast("Report sent — thank you!");
    modal.querySelector("#bugDesc").value = "";
  });

  modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
}
