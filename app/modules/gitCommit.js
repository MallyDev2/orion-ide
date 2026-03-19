/**
 * gitCommit.js — in-app git commit modal with AI message via backend proxy.
 * The direct Anthropic call is replaced with a backend-proxied endpoint.
 */
"use strict";
import { esc } from "./utils.js";
import { showToast } from "./ui.js";
import { log, addTrace } from "./console.js";
import { state } from "./state.js";

let modal, msgInput, errorEl, submitBtn, aiBtn, resolve;

export function initGitCommit() {
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.id = "gitCommitModal";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="auth-card">
      <div class="auth-copy">
        <span class="section-label">Git</span>
        <h2>Commit staged changes</h2>
        <p id="gitCommitSummary">Summarize what changed.</p>
      </div>
      <form id="gitCommitForm" class="auth-form">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <label style="font-size:12px;color:var(--muted);flex:1">Commit message</label>
          <button class="git-ai-msg-btn" id="gitAiMsgBtn" type="button">&#10022; Generate with AI</button>
        </div>
        <textarea id="gitCommitMsg" class="compact-input" rows="3" placeholder="feat: describe the change..." style="resize:vertical"></textarea>
        <p class="auth-error" id="gitCommitError"></p>
        <div class="auth-actions">
          <button class="ghost-btn" id="gitCommitCancelBtn" type="button">Cancel</button>
          <button class="primary-btn" id="gitCommitSubmitBtn" type="submit">Commit</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(el);

  modal     = el;
  msgInput  = document.getElementById("gitCommitMsg");
  errorEl   = document.getElementById("gitCommitError");
  submitBtn = document.getElementById("gitCommitSubmitBtn");
  aiBtn     = document.getElementById("gitAiMsgBtn");

  document.getElementById("gitCommitCancelBtn").addEventListener("click", () => close(false));

  document.getElementById("gitCommitForm").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = msgInput.value.trim();
    if (!msg) { errorEl.textContent = "Enter a commit message."; return; }
    submitBtn.disabled = true;
    submitBtn.textContent = "Committing...";
    try {
      const result = await window.orionDesktop.gitCommit({ rootDir: state.workspace?.rootDir, message: msg });
      if (!result?.ok) throw new Error(result?.error || "Commit failed");
      close(true);
      showToast("Committed: " + msg.slice(0, 48));
      log("success", "git commit: \"" + msg + "\"", "terminal");
      addTrace("success", "Git commit", msg, { scope: "git" });
    } catch (err) {
      errorEl.textContent = err.message || "Commit failed";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Commit";
    }
  });

  // AI-generated commit message — routed through backend proxy
  aiBtn?.addEventListener("click", async () => {
    if (!state.workspace?.rootDir) return;
    aiBtn.disabled = true;
    aiBtn.textContent = "Generating...";
    if (errorEl) errorEl.textContent = "";
    try {
      let diffContext = "";
      const git    = state.gitStatus;
      const staged = (git?.files || []).filter(f => f.staged && !f.untracked).slice(0, 6);
      for (const f of staged) {
        try {
          const r = await window.orionDesktop?.getWorkspaceGitDiff?.({ rootDir: state.workspace.rootDir, relativePath: f.path });
          if (r?.ok && r.diff) diffContext += "\n\n--- " + f.path + " ---\n" + r.diff.slice(0, 1000);
        } catch {}
      }
      const stagedPaths = staged.map(f => f.path).join(", ");
      // Route through the backend — no API key in the renderer
      const backendBase = (state.config?.backendUrl || "").replace(/\/ask$/, "");
      const res = await fetch(backendBase + "/api/commit-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(state.session?.access_token ? { "Authorization": "Bearer " + state.session.access_token } : {}),
        },
        body: JSON.stringify({ staged: stagedPaths, diff: diffContext }),
      });
      if (!res.ok) throw new Error("Backend error " + res.status);
      const data = await res.json();
      const msg  = (data.message || data.text || "").trim();
      if (msg && msgInput) {
        msgInput.value = msg;
        msgInput.focus();
        msgInput.setSelectionRange(msg.length, msg.length);
      }
    } catch (err) {
      if (errorEl) errorEl.textContent = "AI message failed: " + err.message;
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = "&#10022; Generate with AI";
    }
  });

  modal.addEventListener("click", e => { if (e.target === modal) close(false); });
}

function close(result) {
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (msgInput) msgInput.value = "";
  if (errorEl)  errorEl.textContent = "";
  if (resolve) { resolve(result); resolve = null; }
}

export function openGitCommit(stagedCount = 0) {
  if (!modal || !state.workspace) return Promise.resolve(false);
  const summary = document.getElementById("gitCommitSummary");
  if (summary) summary.textContent = stagedCount + " staged file" + (stagedCount === 1 ? "" : "s") + " ready to commit.";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => msgInput?.focus(), 20);
  return new Promise(res => { resolve = res; });
}
