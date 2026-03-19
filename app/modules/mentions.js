/**
 * mentions.js — @file mention autocomplete in the chat composer.
 * Allows users to type @filename to pin a file to AI context.
 */
"use strict";
import { esc, baseName } from "./utils.js";
import { state } from "./state.js";

let _popup    = null;
let _input    = null;
let _selected = 0;
let _matches  = [];
let _onSelect = null;

export function initMentions(chatInputEl, onSelectFile) {
  _input    = chatInputEl;
  _onSelect = onSelectFile;
  if (!_input) return;

  _popup = document.createElement("div");
  _popup.className = "mention-popup";
  _popup.id = "mentionPopup";
  _input.parentNode.insertBefore(_popup, _input);

  _input.addEventListener("input",   handleInput);
  _input.addEventListener("keydown",  handleKeydown);
  document.addEventListener("click",  e => { if (!_popup.contains(e.target) && e.target !== _input) hideMentionPopup(); });
}

function handleInput() {
  const val    = _input.value;
  const cursor = _input.selectionStart;
  const before = val.slice(0, cursor);
  const m      = before.match(/@([\w./\-]*)$/);
  if (!m) { hideMentionPopup(); return; }

  const query  = m[1].toLowerCase();
  const files  = Object.keys(state.workspace?.files || {});
  _matches = query.length === 0
    ? files.slice(0, 8)
    : files.filter(f => f.toLowerCase().includes(query)).slice(0, 8);

  if (!_matches.length) { hideMentionPopup(); return; }
  _selected = 0;
  renderMentionPopup();
}

function handleKeydown(e) {
  if (!_popup.style.display || _popup.style.display === "none") return;
  if (e.key === "ArrowDown") { e.preventDefault(); _selected = (_selected + 1) % _matches.length; renderMentionPopup(); }
  if (e.key === "ArrowUp")   { e.preventDefault(); _selected = (_selected - 1 + _matches.length) % _matches.length; renderMentionPopup(); }
  if (e.key === "Enter" || e.key === "Tab") {
    if (_matches[_selected]) { e.preventDefault(); selectMention(_matches[_selected]); }
  }
  if (e.key === "Escape") hideMentionPopup();
}

function renderMentionPopup() {
  _popup.innerHTML = _matches.map((fp, i) => `
    <button class="mention-item ${i === _selected ? "active" : ""}" type="button" data-mention-path="${esc(fp)}">
      <span class="mention-filename">${esc(baseName(fp))}</span>
      <span class="mention-path">${esc(fp)}</span>
    </button>`).join("");
  _popup.style.display = "block";
  _popup.querySelectorAll("[data-mention-path]").forEach(btn => {
    btn.addEventListener("click", () => selectMention(btn.dataset.mentionPath));
    btn.addEventListener("mouseenter", () => {
      _selected = _matches.indexOf(btn.dataset.mentionPath);
      renderMentionPopup();
    });
  });
}

function selectMention(fp) {
  const val    = _input.value;
  const cursor = _input.selectionStart;
  const before = val.slice(0, cursor);
  const after  = val.slice(cursor);
  const newBefore = before.replace(/@[\w./\-]*$/, "@" + fp + " ");
  _input.value = newBefore + after;
  _input.setSelectionRange(newBefore.length, newBefore.length);
  hideMentionPopup();
  if (_onSelect) _onSelect(fp);
  _input.focus();
}

export function hideMentionPopup() {
  if (_popup) _popup.style.display = "none";
}

/**
 * Parse @mentions from a prompt string and return { cleanPrompt, mentionedFiles }
 */
export function parseMentions(prompt) {
  const mentionedFiles = [];
  const cleanPrompt = prompt.replace(/@([\w./\-]+)/g, (match, fp) => {
    if (state.workspace?.files && Object.prototype.hasOwnProperty.call(state.workspace.files, fp)) {
      if (!mentionedFiles.includes(fp)) mentionedFiles.push(fp);
      return "[" + fp + "]";
    }
    return match;
  });
  return { cleanPrompt, mentionedFiles };
}
