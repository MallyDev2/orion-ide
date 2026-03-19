/**
 * progress.js — Top progress bar for AI generation and long operations.
 */
"use strict";

let _bar = null;
let _fill = null;
let _timer = null;

export function initProgress() {
  _bar = document.createElement("div");
  _bar.className = "progress-bar-wrap";
  _bar.innerHTML = `<div class="progress-bar-fill indeterminate" id="progressFill"></div>`;
  document.body.appendChild(_bar);
  _fill = _bar.querySelector(".progress-bar-fill");
}

export function showProgress() {
  if (!_bar) return;
  _bar.classList.add("active");
  if (_fill) { _fill.classList.add("indeterminate"); _fill.style.width = ""; }
  clearTimeout(_timer);
}

export function hideProgress() {
  if (!_bar) return;
  if (_fill) { _fill.classList.remove("indeterminate"); _fill.style.width = "100%"; }
  _timer = setTimeout(() => {
    _bar.classList.remove("active");
    if (_fill) _fill.style.width = "0%";
  }, 300);
}
