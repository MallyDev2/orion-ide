/**
 * health.js — Codebase Health Score (0–100).
 *
 * Computed from static workspace analysis. Gives users a goal
 * and makes Orion feel like it's actively watching the project.
 */
"use strict";
import { esc } from "./utils.js";

const CHECKS = [
  {
    id:    "readme",
    label: "README present",
    desc:  "A README.md at the root explains the project.",
    weight: 15,
    check: (ws) => Object.keys(ws.files || {}).some(p => /^readme(\.|$)/i.test(p.split("/").pop())),
  },
  {
    id:    "gitrepo",
    label: "Git repository connected",
    desc:  "Project is tracked with git.",
    weight: 10,
    check: (ws, git) => !!git?.available,
  },
  {
    id:    "envexample",
    label: ".env.example committed",
    desc:  "Secrets are documented without being exposed.",
    weight: 10,
    check: (ws) => !!ws.files?.[".env.example"] || !!ws.files?.["env.example"],
  },
  {
    id:    "tests",
    label: "Test files found",
    desc:  "At least one test file exists in the project.",
    weight: 20,
    check: (ws) => Object.keys(ws.files || {}).some(p =>
      p.includes(".test.") || p.includes(".spec.") || p.includes("__tests__")
    ),
  },
  {
    id:    "packagescripts",
    label: "Run scripts defined",
    desc:  "package.json has at least a start or dev script.",
    weight: 10,
    check: (ws) => {
      try {
        const pkg = JSON.parse(ws.files?.["package.json"] || "{}");
        return Object.keys(pkg.scripts || {}).some(s => ["dev","start","build","test"].includes(s));
      } catch { return false; }
    },
  },
  {
    id:    "fewtodos",
    label: "Low TODO debt",
    desc:  "Fewer than 20 TODO/FIXME comments in the codebase.",
    weight: 10,
    check: (ws) => {
      const count = Object.values(ws.files || {}).reduce((n, content) => {
        const matches = String(content).match(/\bTODO\b|\bFIXME\b/g);
        return n + (matches?.length || 0);
      }, 0);
      return count < 20;
    },
  },
  {
    id:    "smallfiles",
    label: "No giant files",
    desc:  "No single file exceeds 500 lines.",
    weight: 10,
    check: (ws) => Object.values(ws.files || {}).every(c => String(c).split("\n").length <= 500),
  },
  {
    id:    "gitignore",
    label: ".gitignore present",
    desc:  "Sensitive files are excluded from version control.",
    weight: 5,
    check: (ws) => !!ws.files?.[".gitignore"],
  },
  {
    id:    "nodedeps",
    label: "Lockfile committed",
    desc:  "Dependency versions are pinned.",
    weight: 5,
    check: (ws) => !!(ws.files?.["package-lock.json"] || ws.files?.["yarn.lock"] || ws.files?.["pnpm-lock.yaml"]),
  },
  {
    id:    "cleanworktree",
    label: "Clean working tree",
    desc:  "No uncommitted changes sitting in the working tree.",
    weight: 5,
    check: (ws, git) => git?.available && !git?.dirty,
  },
];

/**
 * Compute health score for the current workspace.
 * @returns {{ score: number, checks: Array, grade: string }}
 */
export function computeHealth(workspace, gitStatus) {
  if (!workspace) return { score: 0, checks: [], grade: "–" };

  const results = CHECKS.map(c => {
    let passed = false;
    try { passed = !!c.check(workspace, gitStatus); } catch { passed = false; }
    return { ...c, passed };
  });

  const maxScore = CHECKS.reduce((s, c) => s + c.weight, 0);
  const earned   = results.filter(c => c.passed).reduce((s, c) => s + c.weight, 0);
  const score    = Math.round((earned / maxScore) * 100);

  let grade = "D";
  if (score >= 90) grade = "A+";
  else if (score >= 80) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 60) grade = "C";

  return { score, checks: results, grade };
}

/**
 * Render the health panel into a container element.
 */
export function renderHealthPanel(container, workspace, gitStatus) {
  if (!container) return;
  const { score, checks, grade } = computeHealth(workspace, gitStatus);

  const colour = score >= 80 ? "#4ec986" : score >= 60 ? "#efcf9a" : "#f47174";
  const passing = checks.filter(c => c.passed).length;

  container.innerHTML = `
    <div class="health-panel">
      <div class="health-score-row">
        <div class="health-dial">
          <svg viewBox="0 0 80 80" class="health-svg">
            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--line)" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none" stroke="${colour}" stroke-width="6"
              stroke-dasharray="${Math.round(score * 2.01)} 201"
              stroke-linecap="round"
              transform="rotate(-90 40 40)"/>
          </svg>
          <div class="health-dial-text">
            <strong style="color:${colour}">${score}</strong>
            <span>${grade}</span>
          </div>
        </div>
        <div class="health-summary">
          <strong>${passing} / ${checks.length} checks passing</strong>
          <span>${score >= 80 ? "Great shape — keep it up." : score >= 60 ? "Room for improvement." : "Needs attention."}</span>
        </div>
      </div>
      <div class="health-checks">
        ${checks.map(c => `
          <div class="health-check ${c.passed ? "pass" : "fail"}">
            <span class="health-check-icon">${c.passed ? "✓" : "✗"}</span>
            <div class="health-check-copy">
              <strong>${esc(c.label)}</strong>
              <span>${esc(c.desc)}</span>
            </div>
          </div>`).join("")}
      </div>
    </div>`;
}
