/**
 * utils.js — pure helpers shared across renderer modules.
 */
"use strict";

export function esc(text) {
  return String(text || "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  }[ch]));
}

export function stamp() {
  return new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}

export function ext(filePath) {
  return (String(filePath || "").split(".").pop() || "").toLowerCase();
}

export function baseName(p) {
  return String(p || "").replace(/\\/g, "/").split("/").filter(Boolean).pop() || String(p || "");
}

export function titleCase(v) {
  return String(v || "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeRelPath(p) {
  return String(p || "").trim().replace(/\\/g, "/").replace(/^\.?\//, "").replace(/^\/+/, "");
}

export function initials(text) {
  const parts = String(text || "Orion").split(/[\s@._-]+/).filter(Boolean).slice(0, 2);
  return parts.map(p => p[0].toUpperCase()).join("") || "O";
}

export function debounce(fn, ms = 200) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export function renderMD(text) {
  const raw = String(text || "");
  if (window.marked && window.DOMPurify) {
    return window.DOMPurify.sanitize(window.marked.parse(raw), { USE_PROFILES: { html: true } });
  }
  return `<pre>${esc(raw)}</pre>`;
}

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore quota */ }
}

export function inferLang(filePath) {
  const lower = String(filePath || "").toLowerCase();
  const file  = lower.split("/").pop() || "";
  if (file === "dockerfile") return "dockerfile";
  if (file === "makefile")   return "makefile";
  const map = {
    js:"javascript", cjs:"javascript", mjs:"javascript", jsx:"javascript",
    ts:"typescript", tsx:"typescript",
    json:"json", css:"css", scss:"scss", less:"less",
    html:"html", htm:"html", md:"markdown",
    py:"python", go:"go", rs:"rust", java:"java",
    kt:"kotlin", kts:"kotlin", cs:"csharp", vb:"vb",
    php:"php", rb:"ruby", swift:"swift", dart:"dart",
    lua:"lua", r:"r", scala:"scala", pl:"perl", pm:"perl",
    sql:"sql", yml:"yaml", yaml:"yaml", xml:"xml", svg:"xml",
    toml:"ini", ini:"ini", cfg:"ini", conf:"ini",
    sh:"shell", bash:"shell", zsh:"shell",
    ps1:"powershell", psm1:"powershell",
    bat:"bat", cmd:"bat", env:"plaintext", txt:"plaintext",
    c:"c", h:"cpp", cpp:"cpp", cc:"cpp", cxx:"cpp",
    hpp:"cpp", hh:"cpp", hxx:"cpp",
    vue:"html", svelte:"html", graphql:"graphql", gql:"graphql", proto:"protobuf",
  };
  return map[ext(filePath)] || "plaintext";
}

export function fileTypeLabel(filePath) {
  const e    = ext(filePath);
  const file = String(filePath || "").split("/").pop()?.toLowerCase() || "";
  if (["js","cjs","mjs","ts","jsx","tsx","py","go","rs","java","kt","kts","cs","vb","php","rb","swift","dart","lua","r","scala","pl","pm","c","h","cpp","cc","cxx","hpp","hh","hxx","graphql","gql","proto"].includes(e)) return "Code";
  if (["css","scss","less","html","htm","vue","svelte"].includes(e)) return "UI";
  if (["json","yml","yaml","env","sql","xml","toml","ini","cfg","conf","ps1","psm1","sh","bash","zsh","bat","cmd"].includes(e) || ["dockerfile","makefile",".gitignore",".dockerignore"].includes(file)) return "Config";
  if (["md","txt"].includes(e)) return "Docs";
  return "File";
}
