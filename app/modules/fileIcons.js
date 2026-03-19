/**
 * fileIcons.js — SVG file-type icon system.
 * Returns a coloured SVG string for any file extension.
 * Self-contained — no external dependencies.
 */
"use strict";

const ICONS = {
  // JavaScript family
  js:   { color: "#f7df1e", bg: "#1a1a00", label: "JS" },
  jsx:  { color: "#61dafb", bg: "#001a1f", label: "JSX" },
  cjs:  { color: "#f7df1e", bg: "#1a1a00", label: "CJS" },
  mjs:  { color: "#f7df1e", bg: "#1a1a00", label: "MJS" },

  // TypeScript family
  ts:   { color: "#3178c6", bg: "#001226", label: "TS" },
  tsx:  { color: "#3178c6", bg: "#001226", label: "TSX" },

  // Web
  html: { color: "#e44d26", bg: "#200a00", label: "HTML" },
  htm:  { color: "#e44d26", bg: "#200a00", label: "HTM" },
  css:  { color: "#2965f1", bg: "#000f2e", label: "CSS" },
  scss: { color: "#cc6699", bg: "#1a0011", label: "SCSS" },
  less: { color: "#1d365d", bg: "#000814", label: "LESS" },
  vue:  { color: "#42b883", bg: "#001a10", label: "VUE" },
  svelte:{ color: "#ff3e00", bg: "#1a0800", label: "SVE" },

  // Data / config
  json: { color: "#89d185", bg: "#071a06", label: "JSON" },
  jsonc:{ color: "#89d185", bg: "#071a06", label: "JSON" },
  yaml: { color: "#cb171e", bg: "#1a0000", label: "YAML" },
  yml:  { color: "#cb171e", bg: "#1a0000", label: "YML" },
  toml: { color: "#9c4121", bg: "#160800", label: "TOML" },
  xml:  { color: "#f1802b", bg: "#1a0800", label: "XML" },
  svg:  { color: "#ffb13b", bg: "#1a0e00", label: "SVG" },
  env:  { color: "#ecd53f", bg: "#1a1500", label: "ENV" },
  ini:  { color: "#6d8086", bg: "#050e10", label: "INI" },
  cfg:  { color: "#6d8086", bg: "#050e10", label: "CFG" },

  // Docs
  md:   { color: "#519aba", bg: "#00141a", label: "MD" },
  txt:  { color: "#9b9b9b", bg: "#111", label: "TXT" },

  // Python
  py:   { color: "#3572a5", bg: "#00091a", label: "PY" },

  // Systems / compiled
  go:   { color: "#00add8", bg: "#001a20", label: "GO" },
  rs:   { color: "#dea584", bg: "#1a0e06", label: "RS" },
  c:    { color: "#555599", bg: "#07071a", label: "C" },
  h:    { color: "#555599", bg: "#07071a", label: "H" },
  cpp:  { color: "#f34b7d", bg: "#1a0012", label: "C++" },
  cc:   { color: "#f34b7d", bg: "#1a0012", label: "C++" },
  cs:   { color: "#239120", bg: "#001a00", label: "C#" },

  // JVM
  java: { color: "#b07219", bg: "#1a0e00", label: "JAVA" },
  kt:   { color: "#7f52ff", bg: "#0e001a", label: "KT" },
  kts:  { color: "#7f52ff", bg: "#0e001a", label: "KTS" },
  scala:{ color: "#dc322f", bg: "#1a0000", label: "SCA" },

  // Other languages
  rb:   { color: "#cc342d", bg: "#1a0000", label: "RB" },
  php:  { color: "#4f5d95", bg: "#070914", label: "PHP" },
  swift:{ color: "#fa7343", bg: "#1a0800", label: "SWF" },
  dart: { color: "#0175c2", bg: "#001426", label: "DART" },
  lua:  { color: "#000080", bg: "#000010", label: "LUA" },
  r:    { color: "#198ce7", bg: "#001626", label: "R" },
  pl:   { color: "#0298c3", bg: "#001a20", label: "PL" },

  // Shell
  sh:   { color: "#89e051", bg: "#071a00", label: "SH" },
  bash: { color: "#89e051", bg: "#071a00", label: "BASH" },
  zsh:  { color: "#89e051", bg: "#071a00", label: "ZSH" },
  ps1:  { color: "#012456", bg: "#000510", label: "PS1" },
  bat:  { color: "#c1f12e", bg: "#0e1300", label: "BAT" },

  // DB / Query
  sql:  { color: "#e38c00", bg: "#1a0e00", label: "SQL" },
  graphql: { color: "#e10098", bg: "#1a0011", label: "GQL" },
  gql:  { color: "#e10098", bg: "#1a0011", label: "GQL" },
  proto:{ color: "#4285f4", bg: "#001026", label: "PB" },

  // Special files
  dockerfile:{ color: "#2496ed", bg: "#000f1a", label: "🐳" },
  makefile:  { color: "#427819", bg: "#071000", label: "MAKE" },
  gitignore: { color: "#f05032", bg: "#1a0500", label: ".GIT" },
  dockerignore: { color: "#2496ed", bg: "#000f1a", label: ".DCK" },
  log:  { color: "#af9040", bg: "#0e0a00", label: "LOG" },
};

const FALLBACK = { color: "#9b9b9b", bg: "#111", label: "FILE" };

/**
 * Returns an SVG string for the given file path.
 * @param {string} filePath
 * @returns {string} Raw SVG markup
 */
export function getFileIcon(filePath) {
  const lower  = String(filePath || "").toLowerCase();
  const base   = lower.split("/").pop() || "";
  const dotExt = base.includes(".") ? base.split(".").pop() : "";

  // Special filenames
  const specialMap = {
    "dockerfile":    "dockerfile",
    "makefile":      "makefile",
    ".gitignore":    "gitignore",
    ".dockerignore": "dockerignore",
  };
  const iconKey = specialMap[base] || dotExt;
  const icon    = ICONS[iconKey] || FALLBACK;

  const label = icon.label.length > 4 ? icon.label.slice(0, 4) : icon.label;
  const fontSize = label.length > 3 ? "7.5" : "8.5";

  return `<svg viewBox="0 0 28 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="28" height="22" rx="5" fill="${icon.bg}"/>
    <rect width="28" height="22" rx="5" fill="${icon.color}" opacity="0.13"/>
    <text x="14" y="15" text-anchor="middle" font-family="'IBM Plex Mono',monospace" font-weight="600"
      font-size="${fontSize}" fill="${icon.color}" letter-spacing="-0.3">${label}</text>
  </svg>`;
}

/**
 * Returns the accent colour for a given file path (for highlights etc.)
 */
export function getFileColor(filePath) {
  const lower  = String(filePath || "").toLowerCase();
  const base   = lower.split("/").pop() || "";
  const dotExt = base.includes(".") ? base.split(".").pop() : "";
  return (ICONS[dotExt] || FALLBACK).color;
}
