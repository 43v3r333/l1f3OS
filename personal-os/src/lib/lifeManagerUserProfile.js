/**
 * Canonical user profile + calibration block for Life Manager agents.
 * Update this file when major life/financial facts change (not every session).
 *
 * For day-to-day edits, prefer `public/user-profile-sheet.csv` (or `VITE_USER_PROFILE_SHEET_URL`).
 */

import { getProfileSheetAppendix } from "@/lib/userProfileSheet"

/** Full structured memory — suitable for export, Supabase seeding, or debugging */
export const USER_MEMORY_PROFILE_JSON = {
  version: 1,
  profile: {
    nameContext: "Factory IT engineer",
    career: "IT Engineer — factory / industrial environment",
    workDomains: ["Networking", "MES", "SCADA", "VMs", "Industrial systems"],
    education: ["IT Diploma", "Computer Engineering degree", "Advanced diplomas in progress (IT + Business Analysis)"],
    company: "43v3r Technology",
    locationContext: "South Africa (ZAR)",
  },
  workSchedule: {
    pattern: "12-hour shifts",
    cycle: "2 days ON → 2 nights ON → 2 OFF",
    dayShift: "06:00–18:00 (approx.)",
    nightShift: "18:00–06:00 (approx.)",
    implications: [
      "Rest vs productivity must be explicit on shift days",
      "Off days are primary build windows for startup work",
    ],
  },
  finances: {
    currency: "ZAR",
    monthlyIncome: 21000,
    fixedExpenses: {
      rent: 3000,
      wifi: 500,
      cigarettes: 400,
      carPayment: 5200,
      familySupport: 1000,
      shortTermLoan: 1200,
    },
    variableNotes: ["Lunch purchases", "Groceries"],
    approximateFixedTotal: 11300,
    discretionaryAfterFixedApprox: 9700,
    strategicNotes: [
      "High fixed load (car + rent + loan) — expense control and revenue focus both matter",
      "Cigarettes = leakage candidate for staged reduction if health/finance goals align",
    ],
  },
  tools: ["Replit AI", "Cursor", "Supabase", "FastAPI", "Vue.js", "PostgreSQL"],
  constraints: {
    hardware: "8GB RAM laptop, CPU-only (no GPU)",
    capital: "Limited — prefer low-cost validation and hosted free tiers",
    time: "Long shifts — limited deep-work windows outside job",
  },
  projects: {
    active: [
      "AI MES system (data refinement + analytics)",
      "AI trading bot",
      "AI hedge fund concept",
      "Football prediction AI app",
      "AI content / automation agency",
    ],
    risk: "Multiple parallel builds — overextension and context switching",
  },
  goals: {
    startup: "Scale 43v3r Technology",
    incomeTarget: "High monthly income (e.g. $100k/month aspirational target — calibrate to staged ZAR milestones)",
    life: ["Financial freedom", "Strong job performance", "Scalable AI systems"],
  },
  behavioral: {
    strengths: ["Strong technical base", "Clear vision", "High drive"],
    patterns: ["High ambition", "Many parallel initiatives"],
    weaknesses: ["Risk of scattered execution", "Context switching", "Burnout risk with shift work"],
  },
  risks: [
    "Too many revenue experiments at once — no single monetization spine",
    "Financial leakage vs aggressive savings targets",
    "CPU-only limits local LLM training — ship with APIs / small models / cloud selectively",
    "Burnout: shift work + side projects without recovery blocks",
  ],
  calibration: {
    lifePlanner: "Plans MUST respect 2d/2n/2off; never assume 9–5 availability",
    executionCoach: "Enforce max 1–2 core projects at a time; daily non-negotiables ≤ 3",
    financialStrategist: "Use stated ZAR figures; prioritize leakage reduction + emergency buffer + TFSA/ETF discipline where applicable",
    startupBuilder: "Fastest path to first paying customer; deprioritize hedge-fund-scale complexity before revenue",
    workMastery: "Practical on-shift debugging, SQL, MES — one skill action per session",
    synthesizer: "Resolve conflicts in favor of sleep, job performance, then one revenue thread",
  },
}

/** Priority matrix (ordered) */
export const PRIORITY_MATRIX = {
  life: ["Health/sleep stability on shift rotation", "Job performance (income base)", "Financial runway", "One revenue line for 43v3r"],
  projectsRanked: [
    "Single offer closest to first paying customer (pick one vertical)",
    "AI MES / industrial — aligns with day job credibility",
    "Automation agency — can monetize skills with less capital than fund/trading infra",
    "Trading / hedge / sports prediction — defer heavy infra until one offer pays",
  ],
  dailyFocus: ["One deep-work block on off days", "One job-relevant improvement on shift days", "One financial log line weekly"],
}

export const FOCUS_RECOMMENDATION = {
  primary:
    "Choose ONE monetization spine for 43v3r (e.g. industrial AI/MES-adjacent OR automation agency) and pause feature expansion on other repos until first paid invoice or deposit.",
  secondary:
    "Stabilize cash: track every ZAR for 14 days; target one fixed-cost reduction or income bump (overtime, certification, side invoice).",
}

export const IMMEDIATE_ACTIONS_7_DAYS = [
  { day: "1–2", action: "Name the single ‘first revenue’ offer in one sentence; list who pays and by when.", timeEstimate: "45 min" },
  { day: "3–4", action: "Archive or freeze 3 of 5 active project repos to read-only; only 2 remain in active development.", timeEstimate: "1 h" },
  { day: "5", action: "Write a monthly cash truth table: income vs all known fixes + average variable spend.", timeEstimate: "30 min" },
  { day: "6–7", action: "Ship one tiny billable or proof artifact (demo, audit, landing + Calendly) for the chosen offer.", timeEstimate: "3–6 h across off days" },
]

/** Rules for evolving memory (apply in reviews, not in every LLM call) */
export const CONTINUOUS_LEARNING_RULES = [
  "After major decisions, store a one-line outcome in Supabase life_manager_memory (what was tried, result).",
  "Weekly: compare planned vs actual hours on 43v3r vs job — adjust project count, not guilt.",
  "When a tactic fails twice, change mechanism (smaller offer, different channel, or pause project).",
  "Income target ($100k/mo) stays aspirational; track ZAR runway and first paid milestone separately.",
]

/** Compressed block injected into every Life Manager prompt */
export function getBaselineCalibrationBlock() {
  const p = USER_MEMORY_PROFILE_JSON
  const base = [
    `USER BASELINE (calibrate all agents; session fields may override):`,
    `- Work: ${p.profile.career}; ${p.profile.workDomains.join(", ")}.`,
    `- Schedule: ${p.workSchedule.cycle}; 12h shifts.`,
    `- Income: ${p.finances.monthlyIncome} ZAR/mo; fixed ~${p.finances.approximateFixedTotal} ZAR (rent ${p.finances.fixedExpenses.rent}, car ${p.finances.fixedExpenses.carPayment}, wifi ${p.finances.fixedExpenses.wifi}, cigarettes ${p.finances.fixedExpenses.cigarettes}, family ${p.finances.fixedExpenses.familySupport}, loan ${p.finances.fixedExpenses.shortTermLoan}).`,
    `- Constraints: ${p.constraints.hardware}; ${p.constraints.capital}.`,
    `- Startup: ${p.profile.company}; projects: ${p.projects.active.length} parallel — RISK overextension; prefer 1–2 active.`,
    `- Goals: ${p.goals.startup}; staged income vs one-shot $ targets.`,
    `- Coach rule: max 1–2 core projects; max 3 non-negotiables/day.`,
    `- Finance rule: real ZAR, flag leakage, no generic wealth tips.`,
    `- Startup rule: revenue before complexity; CPU-friendly stack.`,
  ].join("\n")

  const sheet = getProfileSheetAppendix().trim()
  if (!sheet) return base
  return `${base}\n\n---\n${sheet}`
}
