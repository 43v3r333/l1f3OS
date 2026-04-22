/**
 * Canonical user profile + calibration block for Life Manager agents.
 * Update this file when major life/financial facts change (not every session).
 *
 * For day-to-day edits, prefer `public/user-profile-sheet.csv` (or `VITE_USER_PROFILE_SHEET_URL`).
 */

import { SHIFT_CALENDAR_PDF_PUBLIC_PATH } from "@/lib/shiftCalendarForAi"
import { getProfileSheetAppendix } from "@/lib/userProfileSheet"

/** Full structured memory — canonical; keep in sync with `public/user-profile-sheet.csv`. */
export const USER_MEMORY_PROFILE_JSON = {
  version: 2,
  profile: {
    name: "Ethan",
    nameContext: "Ethan — IT engineer, tyre manufacturing factory, Durban",
    career: "IT Engineer (tyre manufacturing factory)",
    workDomains: [
      "Networking (switches, connectivity, troubleshooting)",
      "Virtual machines (deployment, maintenance)",
      "MES (SQL, configs, downtime tracking)",
      "SCADA / PLC-connected plant systems",
      "HMIs, PCs, printers, industrial IT",
    ],
    education: [
      "IT Diploma",
      "Computer Engineering degree",
      "Advanced Diploma in IT (in progress)",
      "Advanced Diploma in Business Analysis (in progress)",
    ],
    company: "43v3r Technology",
    locationContext: "Durban, South Africa (ZAR)",
    brandVision: "43v3r as software company plus creative brand (music, fashion, tech)",
  },
  workSchedule: {
    pattern: "12-hour shifts",
    cycle: "2 days ON → 2 nights ON → 2 OFF",
    shiftDesignation: "C shift",
    calendarPdfUrl: SHIFT_CALENDAR_PDF_PUBLIC_PATH,
    /** Update when your block changes (operational truth for agents alongside calendar excerpt). */
    scheduleTimezone: "Africa/Johannesburg",
    scheduleAnchorUpdated: "2026-04-22",
    scheduleNote:
      "Africa/Johannesburg as of 2026-04-22: on C-shift NIGHT (18:00→06:00) ending 2026-04-23 06:00. Calendar dates 2026-04-23 and 2026-04-24 are OFF (two consecutive off days after this night). Do not plan factory on-shift blocks on those dates. After 06:00 when going off, prioritize sleep handoff and recovery before startup deep work. Cross-check the SHIFT CALENDAR 2026 excerpt when present so plans match official C-shift dates.",
    dayShift: "06:00–18:00 (approx.)",
    nightShift: "18:00–06:00 (approx.)",
    implications: [
      "Rest vs productivity must be explicit on shift days",
      "Off days are primary build windows for 43v3r",
      "Job performance improvement is an explicit priority alongside startup",
    ],
  },
  workChallenges: [
    "Stronger practical understanding of factory systems",
    "More efficient, reliable troubleshooting and system management",
  ],
  finances: {
    currency: "ZAR",
    monthlyIncome: 21000,
    fixedExpenses: {
      rent: 3000,
      groceries: 2000,
      wifi: 500,
      disneyPlus: 140,
      cigarettes: 400,
      familySupport: 1000,
    },
    variableNotes: ["Transport (cab to work)", "Regular lunch purchases"],
    approximateFixedTotal: 7040,
    discretionaryAfterFixedApprox: 13960,
    strategicNotes: [
      "Limited disposable income after variables — track cab + lunch + subscriptions",
      "Increase income aggressively; add structure and investment strategy in ZAR context",
      "Subscriptions (e.g. Disney+) and cigarettes are leakage candidates if cutting spend",
    ],
  },
  tools: [
    "Replit AI",
    "Cursor AI",
    "Lovable AI",
    "make.com",
    "Supabase",
    "PostgreSQL / pgAdmin",
    "VS Code",
    "Jupyter Notebooks",
  ],
  constraints: {
    hardware: "Laptop 8GB RAM, i5, no dedicated GPU",
    capital: "Limited — prefer low-cost validation and hosted free tiers",
    time: "12h shifts — balance job + business; avoid overcomplication",
  },
  projects: {
    active: [
      "AI MES System — PLCs/IoT, AI refinement, factory ops insights",
      "MES Refine — data collection and refinement layer",
      "AI MES Engine — visualization and insight system",
      "AI Trading Bot",
      "AI Hedge Fund concept (long-term)",
      "Football prediction web app (AI + statistics)",
      "AI Content Agency — HeyGen, ElevenLabs, make.com",
    ],
    risk: "Seven parallel initiatives — high context-switching; enforce 1–2 core revenue threads",
  },
  goals: {
    startup: "Build 43v3r Technology toward ~USD 100k/month (use staged ZAR milestones)",
    secondary: [
      "First paying customer as soon as possible",
      "Scalable SaaS and automated income",
      "Monetize AI tools and systems",
    ],
    life: [
      "Increase income",
      "Improve job performance",
      "Profitable AI systems",
      "Consistency across shift schedule",
      "Avoid burnout",
    ],
  },
  personalInterests: ["Music production (beats, collaborations)", "Fashion / futuristic branding", "AI, crypto, quantum computing"],
  behavioral: {
    strengths: ["Strong technical base", "High ambition", "Systems thinking"],
    patterns: ["Takes on multiple complex projects", "Needs prioritization toward revenue", "Needs structured daily execution"],
    weaknesses: ["Scattered execution risk", "Burnout risk with shifts + many builds"],
  },
  risks: [
    "No single monetization spine while many projects run",
    "Variable spend (cab, lunch) unmeasured — runway blind spots",
    "CPU-only — ship with APIs / small models / selective cloud",
    "Burnout: shift work + many parallel products",
  ],
  calibration: {
    lifePlanner:
      "User is C shift; honor workSchedule.scheduleNote (shift anchor) for the current block; when SHIFT CALENDAR excerpt is in context use it for date-level work/off/night and reconcile with anchor; else 2d/2n/2off 12h; Durban ZAR; never assume 9–5",
    executionCoach: "Max 1–2 core revenue projects; max 3 non-negotiables/day; first paying customer over new features",
    financialStrategist: "Stated ZAR only; flag leakage; TFSA/ETF discipline where applicable",
    startupBuilder: "Fastest path to first paying customer; leverage factory/MES credibility",
    workMastery: "Factory troubleshooting, MES, SQL, networking — one concrete on-shift or off-day action",
    synthesizer: "Resolve conflicts: sleep → job performance → one revenue thread",
  },
}

/** Priority matrix (ordered) */
export const PRIORITY_MATRIX = {
  life: [
    "Income increase (job + 43v3r)",
    "Job performance and factory-system mastery",
    "Financial structure and runway",
    "One primary revenue line for 43v3r",
    "Burnout guardrails",
  ],
  projectsRanked: [
    "Single offer closest to first paying customer (pick one vertical)",
    "AI MES / industrial stack — aligns with day job and differentiation",
    "AI Content Agency — lower capital path to invoices",
    "Trading / hedge / sports prediction — defer heavy infra until one offer pays",
  ],
  dailyFocus: [
    "One deep-work block on off days for 43v3r",
    "One job-relevant skill or troubleshooting improvement on shift days",
    "Track ZAR spend (especially cab + lunch) several times per week",
  ],
}

export const FOCUS_RECOMMENDATION = {
  primary:
    "Name ONE first-paying-customer offer (likely industrial AI/MES-adjacent OR content agency) and freeze or park the other five ideas to backlog until there is revenue or a signed pilot.",
  secondary:
    "Run a 14-day money log: every cab, lunch, subscription, and impulse buy — then one concrete change (route, packed lunch, or subscription trim) plus one income lever (overtime, cert, or small invoice).",
}

export const IMMEDIATE_ACTIONS_7_DAYS = [
  { day: "1–2", action: "Name the single ‘first revenue’ offer in one sentence; list who pays and by when.", timeEstimate: "45 min" },
  { day: "3–4", action: "Move 5 of 7 active concepts to backlog/read-only; only 2 remain in active development until first payment.", timeEstimate: "1 h" },
  { day: "5", action: "Write a monthly cash truth table: R21k in vs rent groceries wifi Disney+ cigarettes family + estimated cab + lunch.", timeEstimate: "30 min" },
  { day: "6–7", action: "Ship one tiny billable or proof artifact (demo, audit, landing + Calendly) for the chosen offer.", timeEstimate: "3–6 h across off days" },
]

/** Rules for evolving memory (apply in reviews, not in every LLM call) */
export const CONTINUOUS_LEARNING_RULES = [
  "After major decisions, store a one-line outcome in Supabase life_manager_memory (what was tried, result).",
  "Weekly: compare planned vs actual hours on 43v3r vs job — adjust project count, not guilt.",
  "When a tactic fails twice, change mechanism (smaller offer, different channel, or pause project).",
  "Income target ($100k/mo) stays aspirational; track ZAR runway and first paid milestone separately.",
]

/** One line for copilot / UI; empty if no anchor note configured. */
export function getShiftScheduleAnchorForPrompt() {
  const w = USER_MEMORY_PROFILE_JSON.workSchedule
  const note = typeof w.scheduleNote === "string" ? w.scheduleNote.trim() : ""
  if (!note) return ""
  const tz = w.scheduleTimezone || "Africa/Johannesburg"
  const u = w.scheduleAnchorUpdated || ""
  return u ? `[${tz}; anchor updated ${u}] ${note}` : `[${tz}] ${note}`
}

/** Compressed block injected into every Life Manager prompt */
export function getBaselineCalibrationBlock() {
  const p = USER_MEMORY_PROFILE_JSON
  const fe = p.finances.fixedExpenses
  const anchorLine =
    typeof p.workSchedule.scheduleNote === "string" && p.workSchedule.scheduleNote.trim()
      ? `- Shift anchor (${p.workSchedule.scheduleTimezone || "local"}; updated ${p.workSchedule.scheduleAnchorUpdated || "?"}): ${p.workSchedule.scheduleNote.trim()}`
      : ""
  const base = [
    `USER BASELINE (calibrate all agents; session fields may override):`,
    `- Identity: ${p.profile.name}; ${p.profile.locationContext}.`,
    `- Work: ${p.profile.career}; domains: ${p.profile.workDomains.join("; ")}.`,
    `- Schedule: ${p.workSchedule.shiftDesignation} (${p.workSchedule.cycle}); 12h shifts. Official calendar: ${p.workSchedule.calendarPdfUrl} — when an excerpt appears in this prompt, treat it as ground truth for which calendar days are work vs off vs night; otherwise use the generic cycle.`,
    ...(anchorLine ? [anchorLine] : []),
    `- Income: ${p.finances.monthlyIncome} ZAR/mo; known fixed ~${p.finances.approximateFixedTotal} ZAR (rent ${fe.rent}, groceries ${fe.groceries}, wifi ${fe.wifi}, Disney+ ${fe.disneyPlus}, cigarettes ${fe.cigarettes}, family ${fe.familySupport}); variable: ${p.finances.variableNotes.join("; ")}.`,
    `- Constraints: ${p.constraints.hardware}; ${p.constraints.capital}; ${p.constraints.time}.`,
    `- Startup: ${p.profile.company}; ${p.projects.active.length} active concepts — RISK overextension; enforce 1–2 revenue cores.`,
    `- Goals: ${p.goals.startup}; secondaries: ${p.goals.secondary.join("; ")}.`,
    `- Coach rule: max 1–2 core projects; max 3 non-negotiables/day.`,
    `- Finance rule: real ZAR, flag leakage (subscriptions, cab, lunch), no generic wealth tips.`,
    `- Startup rule: revenue before complexity; CPU-friendly stack.`,
  ].join("\n")

  const sheet = getProfileSheetAppendix().trim()
  if (!sheet) return base
  return `${base}\n\n---\n${sheet}`
}
