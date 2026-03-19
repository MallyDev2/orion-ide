/**
 * onboarding.js — First-run welcome wizard + sequential tooltip tour.
 *
 * Welcome wizard: 3-slide modal fired once (key: orion_onboarded_v1).
 * Tooltip tour: 6 sequential spotlights after first workspace load.
 */
"use strict";
import { esc } from "./utils.js";

const ONBOARDED_KEY    = "orion_onboarded_v1";
const TOUR_DONE_KEY    = "orion_tour_done_v1";

let onResolveTour = null;

// ── Welcome wizard ────────────────────────────────────────────────────────────
const SLIDES = [
  {
    icon: `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="28" r="24" stroke="#efcf9a" stroke-width="2.5" stroke-dasharray="120 28"/>
      <circle cx="28" cy="28" r="6" fill="#efcf9a"/>
      <circle cx="10" cy="14" r="2" fill="#efcf9a" opacity="0.5"/>
      <circle cx="46" cy="12" r="1.5" fill="#efcf9a" opacity="0.4"/>
      <circle cx="48" cy="40" r="2" fill="#efcf9a" opacity="0.45"/>
      <circle cx="8"  cy="42" r="1.5" fill="#efcf9a" opacity="0.35"/>
    </svg>`,
    title:  "Orion knows your whole project",
    body:   "When you open a workspace, Orion indexes every file — not just the one you're editing. Ask it about any part of the codebase and it answers with full context.",
    cta:    "Next →",
  },
  {
    icon: `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="44" height="36" rx="8" stroke="#efcf9a" stroke-width="2"/>
      <rect x="14" y="20" width="28" height="3" rx="1.5" fill="#efcf9a" opacity="0.3"/>
      <rect x="14" y="27" width="20" height="3" rx="1.5" fill="#efcf9a" opacity="0.5"/>
      <rect x="14" y="34" width="16" height="3" rx="1.5" fill="#efcf9a" opacity="0.7"/>
      <circle cx="46" cy="42" r="7" fill="#efcf9a"/>
      <path d="M43 42l2 2 4-4" stroke="#1a1200" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    title:  "Ask it anything about your code",
    body:   "\"Find all places we validate tokens\", \"Explain this function\", \"Review this file for bugs\" — Orion searches, explains, and patches files directly.",
    cta:    "Next →",
  },
  {
    icon: `<svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="8" width="30" height="40" rx="6" stroke="#efcf9a" stroke-width="2" opacity="0.4"/>
      <rect x="20" y="14" width="30" height="28" rx="6" fill="#1a1200" stroke="#efcf9a" stroke-width="2"/>
      <rect x="26" y="22" width="18" height="2.5" rx="1.2" fill="#89d185" opacity="0.8"/>
      <rect x="26" y="28" width="14" height="2.5" rx="1.2" fill="#f47174" opacity="0.8"/>
      <rect x="26" y="34" width="16" height="2.5" rx="1.2" fill="#efcf9a" opacity="0.8"/>
    </svg>`,
    title:  "Review before anything saves",
    body:   "When Orion generates changes, you see a diff first. Apply only what you want — nothing touches disk until you click Apply.",
    cta:    "Open my first project",
  },
];

export function shouldShowWelcome() {
  return !localStorage.getItem(ONBOARDED_KEY);
}

export function shouldShowTour() {
  return !localStorage.getItem(TOUR_DONE_KEY);
}

export function markOnboarded() {
  localStorage.setItem(ONBOARDED_KEY, "1");
}

export function markTourDone() {
  localStorage.setItem(TOUR_DONE_KEY, "1");
}

export function showWelcomeWizard(onDone) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop onboarding-backdrop open";
  backdrop.setAttribute("aria-modal", "true");
  let onKey = null;

  let slide = 0;

  function render() {
    const s = SLIDES[slide];
    const isLast = slide === SLIDES.length - 1;
    backdrop.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-icon">${s.icon}</div>
        <div class="onboarding-dots">
          ${SLIDES.map((_, i) => `<span class="onboarding-dot ${i === slide ? "active" : ""}"></span>`).join("")}
        </div>
        <h2 class="onboarding-title">${esc(s.title)}</h2>
        <p class="onboarding-body">${esc(s.body)}</p>
        <div class="onboarding-actions">
          <button class="ghost-btn onboarding-skip" type="button">Skip intro</button>
          <button class="primary-btn onboarding-cta" type="button">${esc(s.cta)}</button>
        </div>
      </div>`;

    backdrop.querySelector(".onboarding-cta").addEventListener("click", () => {
      if (isLast) { finish(); } else { slide++; render(); }
    });
    backdrop.querySelector(".onboarding-skip").addEventListener("click", finish);
  }

  function finish() {
    backdrop.classList.remove("open");
    setTimeout(() => backdrop.remove(), 200);
    if (onKey) window.removeEventListener("keydown", onKey);
    markOnboarded();
    if (onDone) onDone();
  }

  render();
  backdrop.addEventListener("click", e => { if (e.target === backdrop) finish(); });
  onKey = e => {
    if (e.key === "Escape") {
      finish();
    }
  };
  window.addEventListener("keydown", onKey);
  document.body.appendChild(backdrop);
}

// ── Tooltip tour ──────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  { targetId: "fileTree",        title: "Your whole project is indexed", body: "Every file is searchable. Type in the search box above, or use #text to search file contents.", pos: "right" },
  { targetId: "chatFeed",        title: "This is Orion",                 body: "Ask it anything about the codebase. It knows all your files — not just the one you're editing.", pos: "left" },
  { targetId: "explainSelectionBtn", title: "Explain any code",          body: "Select lines in the editor, then click Explain. Orion breaks down exactly what they do.", pos: "bottom" },
  { targetId: "patchFileBtn",    title: "AI rewrites, you approve",      body: "Click Patch and Orion rewrites the active file. You review the diff before anything saves to disk.", pos: "bottom" },
  { targetId: "commandPaletteBtn", title: "The fastest way to do anything", body: "Ctrl+P opens the command palette. Search files, run git actions, toggle panels — all from one box.", pos: "bottom" },
  { targetId: "changesGroups",   title: "Stage, diff, and commit here",  body: "Switch to the Changes tab to stage files, view diffs, and commit — without leaving Orion.", pos: "right" },
];

let _tourStep = 0;
let _tourOverlay = null;
let _tourBox    = null;

export function startTour(onFinish) {
  if (!shouldShowTour()) { if (onFinish) onFinish(); return; }
  _tourStep = 0;
  onResolveTour = onFinish;
  _createTourOverlay();
  _showTourStep();
}

let _tourSpotlight = null;

function _createTourOverlay() {
  _tourOverlay = document.createElement("div");
  _tourOverlay.className = "tour-overlay";
  document.body.appendChild(_tourOverlay);

  _tourSpotlight = document.createElement("div");
  _tourSpotlight.className = "tour-spotlight";
  document.body.appendChild(_tourSpotlight);

  _tourBox = document.createElement("div");
  _tourBox.className = "tour-box";
  document.body.appendChild(_tourBox);
}

function _showTourStep() {
  const step = TOUR_STEPS[_tourStep];
  if (!step) { _endTour(); return; }

  const target = document.getElementById(step.targetId);
  if (!target) { _tourStep++; _showTourStep(); return; }

  const rect = target.getBoundingClientRect();

  // Spotlight cutout via clip-path on overlay (CSS does this via box-shadow trick)
  _tourOverlay.classList.add("active");
  // Position the spotlight cutout div over the target element
  _tourSpotlight.style.cssText = `
    top:    ${rect.top    - 6}px;
    left:   ${rect.left   - 6}px;
    width:  ${rect.width  + 12}px;
    height: ${rect.height + 12}px;
  `;

  // Position tooltip
  const isLast = _tourStep === TOUR_STEPS.length - 1;
  _tourBox.innerHTML = `
    <div class="tour-step">
      <div class="tour-step-header">
        <span class="tour-counter">${_tourStep + 1} / ${TOUR_STEPS.length}</span>
        <button class="ghost-btn tiny tour-close" type="button">✕ Skip tour</button>
      </div>
      <strong class="tour-title">${esc(step.title)}</strong>
      <p class="tour-body">${esc(step.body)}</p>
      <div class="tour-actions">
        <button class="primary-btn tour-next" type="button">${isLast ? "Done ✓" : "Next →"}</button>
      </div>
    </div>`;

  // Position the box
  let top, left;
  const boxW = 260, boxH = 140, margin = 16;
  if (step.pos === "right") {
    top  = Math.max(margin, rect.top + rect.height / 2 - boxH / 2);
    left = rect.right + margin;
  } else if (step.pos === "left") {
    top  = Math.max(margin, rect.top + rect.height / 2 - boxH / 2);
    left = rect.left - boxW - margin;
  } else { // bottom
    top  = rect.bottom + margin;
    left = Math.max(margin, rect.left + rect.width / 2 - boxW / 2);
  }
  // Clamp to viewport
  top  = Math.min(top,  window.innerHeight - boxH - margin);
  left = Math.min(left, window.innerWidth  - boxW - margin);
  _tourBox.style.cssText = `top:${top}px;left:${left}px;width:${boxW}px;`;
  _tourBox.classList.add("active");

  _tourBox.querySelector(".tour-next").addEventListener("click", () => {
    _tourStep++;
    _showTourStep();
  });
  _tourBox.querySelector(".tour-close").addEventListener("click", _endTour);
}

function _endTour() {
  markTourDone();
  _tourOverlay?.classList.remove("active");
  _tourBox?.classList.remove("active");
  if (_tourSpotlight) _tourSpotlight.style.cssText = "";
  setTimeout(() => {
    _tourOverlay?.remove();
    _tourSpotlight?.remove();
    _tourBox?.remove();
    _tourOverlay = null;
    _tourSpotlight = null;
    _tourBox = null;
  }, 300);
  if (onResolveTour) { onResolveTour(); onResolveTour = null; }
}
