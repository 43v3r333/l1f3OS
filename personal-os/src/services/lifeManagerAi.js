/**
 * AI Life Manager — multi-agent orchestration (Life Planner, Finance, Startup, Work, Coach, Synthesizer).
 * Uses local AI proxy that routes to Ollama.
 */

import { getAiProxyOrigin } from "@/lib/aiProxyOrigin"
import { getBaselineCalibrationBlock } from "@/lib/lifeManagerUserProfile"
const lifeManagerFastMode = String(import.meta.env.VITE_LIFEMANAGER_FAST_MODE || "true") === "true"
const lifeManagerFastConcurrencyRaw = Number.parseInt(
  String(import.meta.env.VITE_LIFEMANAGER_FAST_CONCURRENCY || "2"),
  10,
)
const lifeManagerFastConcurrency = Number.isFinite(lifeManagerFastConcurrencyRaw)
  ? Math.max(1, Math.min(5, lifeManagerFastConcurrencyRaw))
  : 2

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Runs async tasks in fixed order for results[], with at most `limit` in flight. */
async function runWithConcurrency(taskFns, limit) {
  if (taskFns.length === 0) return []
  const results = new Array(taskFns.length)
  let nextIndex = 0
  const workers = Math.max(1, Math.min(limit, taskFns.length))

  async function worker() {
    for (;;) {
      let i
      if (nextIndex >= taskFns.length) return
      i = nextIndex
      nextIndex += 1
      results[i] = await taskFns[i]()
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

async function chatCompletion({
  system,
  user,
  temperature = 0.4,
  maxTokens = 2000,
  onTransientError,
}) {
  const cappedMaxTokens = lifeManagerFastMode ? Math.min(maxTokens, 420) : maxTokens
  let lastError = null
  const maxAttempts = 4

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(`${getAiProxyOrigin()}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system,
        user,
        temperature,
        maxTokens: cappedMaxTokens,
      }),
    })

    if (res.ok) {
      const json = await res.json()
      return json?.content ?? ""
    }

    const err = await res.text()
    lastError = new Error(`AI proxy error: ${res.status} ${err}`)
    const retryable = res.status === 504 || res.status === 503 || res.status === 500
    if (retryable && attempt < maxAttempts) {
      const delayMs = 600 * attempt * attempt
      onTransientError?.(
        res.status === 504
          ? `AI timed out or overloaded, retrying (${attempt}/${maxAttempts - 1})...`
          : `AI busy, retrying (${attempt}/${maxAttempts - 1})...`,
      )
      await wait(delayMs)
      continue
    }

    throw lastError
  }

  throw lastError || new Error("AI proxy error: unknown failure")
}

export function assembleContext({
  sessionType,
  shiftStatus,
  energyLevel,
  topPriority,
  whatsHappening,
  financialUpdate,
  startupUpdate,
  additionalContext,
  memoryData,
  memoryFound,
  liveSnapshotText = "",
}) {
  let memorySummary = "No previous session data found. This appears to be a first session."
  if (memoryFound && memoryData && Object.keys(memoryData).length > 0) {
    const parts = []
    for (const [k, val] of Object.entries(memoryData)) {
      const cleanKey = k.replace(/^life_manager_/, "")
      if (typeof val === "object" && val !== null) {
        parts.push(`[${cleanKey}]: ${JSON.stringify(val, null, 2)}`)
      } else {
        parts.push(`[${cleanKey}]: ${String(val)}`)
      }
    }
    memorySummary = parts.join("\n")
  }

  const fullContext = `${getBaselineCalibrationBlock()}

---

SESSION TYPE: ${sessionType}
SHIFT STATUS: ${shiftStatus}
ENERGY LEVEL: ${energyLevel}/10
TOP PRIORITY: ${topPriority}

CURRENT SITUATION:
${whatsHappening}

FINANCIAL UPDATE:
${financialUpdate?.trim() ? financialUpdate : "No update this session"}

STARTUP UPDATE:
${startupUpdate?.trim() ? startupUpdate : "No update this session"}

ADDITIONAL CONTEXT:
${additionalContext?.trim() ? additionalContext : "None"}

LIVE APP SNAPSHOT (from personal-os — logs, tasks, reminders; reconcile with the check-in above):
${liveSnapshotText?.trim() ? liveSnapshotText.trim() : "(none — open Dashboard once so data syncs, then generate again.)"}

STORED MEMORY & HISTORY:
${memorySummary}
`

  return { fullContext, memorySummary }
}

const LIFE_PLANNER_SYSTEM = `You are a Life Planner for a factory IT engineer on 12h rotations (2 days / 2 nights / 2 off) building 43v3r Technology on the side.

Your job: Time-blocked plans that fit REAL shift fatigue — not fantasy founder schedules.

RULES:
- Never assume 9–5; anchor blocks to day vs night vs off explicitly
- After night shifts, schedule recovery before heavy build work
- Off days: protect ONE primary deep-work block for revenue work + one health block
- Day on-shift: job excellence + micro learning; minimal startup except urgent
- Include: sleep boundary, job block, one startup/revenue block (when realistic), movement, food
- Energy ≤4: cut scope to 1–2 moves only
- Format: concrete times + durations; no vague “work on startup”`

const FINANCE_SYSTEM = `You are a Financial Strategist Agent calibrated to this user:
- Income: ~21,000 ZAR/month (verify in context)
- Known fixed outflows include: rent ~3,000; WiFi ~500; cigarettes ~400; car ~5,200; family support ~1,000; short-term loan ~1,200 ZAR (plus groceries, lunch — variable)
- Approximate fixed load ~11,300 ZAR before food; discretionary is tight — treat runway as precious

Your job: Track spending, cut leakage, build a realistic roadmap (not generic wealth theory).

RULES:
- Always anchor to ZAR numbers from context; flag impossible advice
- Prioritize: expense truth → small repeatable savings → emergency buffer → TFSA/ETFs/money market (ZA)
- Call out high-drag lines (car, loan, discretionary) with specific % or ZAR impact
- Startup spend: only if tied to next revenue milestone; no vanity tooling
- If session financial update is empty, still give one sharp diagnostic using baseline + history
- Be direct. No sugarcoating.`

const STARTUP_SYSTEM = `You are a Startup Builder for 43v3r Technology — building while on 12h rotating shifts, limited capital, CPU-only laptop.

CONTEXT: IT/MES/SCADA/SQL strength; tools: Cursor, Supabase, FastAPI, Vue, Postgres, Replit. Multiple project ideas exist (MES AI, trading bot, hedge fund concept, football app, agency) — HIGH RISK of overextension.

Your job: Fastest path to FIRST PAYING CUSTOMER — not portfolio breadth.

RULES:
- Default stance: pick ONE offer; park or freeze others until revenue
- Deprioritize hedge-fund/trading-complexity until one invoice exists
- Favor: industrial/MES-adjacent OR automation agency (credibility + lower capex than prop trading infra)
- Max 3 concrete next steps; each must be shippable in < one off-day block
- CPU/GPU: assume local inference is limited — design for APIs, small models, hosted DB
- Pricing: ZAR-first, optional USD; name a number and who pays
- Be blunt about scope creep and “science projects”`

const WORK_SYSTEM = `You are Work Mastery for factory IT: networking, MES, SCADA, VMs, SQL — performance on the job funds everything else.

Your job: One sharp improvement per session that pays off on the next shift.

RULES:
- ONE task (15–30 min) with a workplace scenario (line down, tag bad, query slow, VM snapshot, etc.)
- On shift: troubleshooting discipline, documentation, handoff quality
- Off shift: deeper SQL or architecture only if energy allows
- Tie to measurable job outcome (MTTR, fewer repeats, fewer tickets)
- Certifications only when they unlock pay or responsibility the user wants
- No generic study lists — one drill, one application`

const COACH_SYSTEM = `You are an Execution Coach for someone on 2d/2n/2off 12h shifts with many parallel AI projects.

You are direct, not cruel. You optimize for follow-through, not motivation posters.

RULES:
- HARD CAP: at most 1–2 CORE projects in “active”; everything else is backlog or frozen
- Maximum 3 non-negotiable actions for the next 24–48h (not 5)
- Each action: verb + deliverable + time box + done definition
- If multiple projects appear in context, NAME which one to starve this week
- Burnout guard: after night shifts, protect sleep before “hero” startup work
- Enforce one “revenue lever” action per week minimum when building 43v3r
- Reference baseline risks: context switching, overcommitment
- No fluff.`

const SYNTHESIZER_SYSTEM = `You are the Master Synthesizer for an AI Life Manager system. You receive outputs from 5 specialist agents and must combine them into ONE unified, non-redundant action plan.

Your job: Resolve conflicts between agents, eliminate redundancy, and produce a clear execution document.

OUTPUT FORMAT:
## TODAY'S MISSION
[One sentence: the overarching focus]

## TOP 3 PRIORITIES (in order)
1. [Specific action] - [time estimate] - [why it matters]
2. ...
3. ...

## TIME-BLOCKED SCHEDULE
[Actual schedule with times]

## FINANCIAL NOTE
[Brief financial insight or action if relevant]

## STARTUP ACTION
[One specific startup task for today]

## WORK GROWTH
[Today's learning/improvement task]

## INSIGHTS
[Patterns noticed, recommendations, warnings]

RULES:
- No repetition between sections
- Resolve conflicts: sleep and job performance beat side-project ego; then ONE revenue thread for 43v3r
- Keep commitments realistic for shift workers (not 12h of deep work after a night shift)
- Call out overextension if specialists disagree — unify to fewer tasks
- Bold the single most important action of the day`

export async function runLifePlannerAgent({ fullContext, shiftStatus, energyLevel, onTransientError }) {
  const user = `SHIFT STATUS: ${shiftStatus}
ENERGY: ${energyLevel}/10

FULL CONTEXT:
${fullContext}

Generate my optimized plan for this session. Be specific with time blocks and actions.`
  return chatCompletion({
    system: LIFE_PLANNER_SYSTEM,
    user,
    temperature: 0.2,
    maxTokens: 700,
    onTransientError,
  })
}

export async function runFinancialStrategist({ fullContext, financialUpdate, onTransientError }) {
  const user = `FINANCIAL UPDATE: ${financialUpdate || "None provided"}

FULL CONTEXT:
${fullContext}

Analyze my financial position and provide actionable recommendations.`
  return chatCompletion({
    system: FINANCE_SYSTEM,
    user,
    temperature: 0.2,
    maxTokens: 520,
    onTransientError,
  })
}

export async function runStartupBuilder({ fullContext, startupUpdate, onTransientError }) {
  const user = `STARTUP UPDATE: ${startupUpdate || "None provided"}

FULL CONTEXT:
${fullContext}

What should I focus on next for the startup? Give me 3 specific action items.`
  return chatCompletion({
    system: STARTUP_SYSTEM,
    user,
    temperature: 0.3,
    maxTokens: 520,
    onTransientError,
  })
}

export async function runWorkMastery({ fullContext, shiftStatus, onTransientError }) {
  const user = `SHIFT STATUS: ${shiftStatus}

FULL CONTEXT:
${fullContext}

Give me today's work improvement task and learning exercise.`
  return chatCompletion({
    system: WORK_SYSTEM,
    user,
    temperature: 0.2,
    maxTokens: 420,
    onTransientError,
  })
}

export async function runExecutionCoach({ fullContext, energyLevel, topPriority, onTransientError }) {
  const user = `ENERGY: ${energyLevel}/10
TOP PRIORITY: ${topPriority}

FULL CONTEXT:
${fullContext}

Give me my execution orders. What exactly am I doing and when?`
  return chatCompletion({
    system: COACH_SYSTEM,
    user,
    temperature: 0.3,
    maxTokens: 420,
    onTransientError,
  })
}

export async function runMasterSynthesizer({
  lifePlan,
  finance,
  startup,
  work,
  coaching,
}) {
  const user = `LIFE PLANNER OUTPUT:
${lifePlan}

FINANCIAL STRATEGIST OUTPUT:
${finance}

STARTUP BUILDER OUTPUT:
${startup}

WORK MASTERY OUTPUT:
${work}

EXECUTION COACH OUTPUT:
${coaching}

Synthesize these into one unified action plan. Resolve any conflicts. Eliminate redundancy.`
  return chatCompletion({
    system: SYNTHESIZER_SYSTEM,
    user,
    temperature: 0.2,
    maxTokens: 700,
  })
}

/**
 * Runs all five specialist agents in parallel, then the synthesizer.
 */
export async function runFullLifeManagerPipeline(
  checkIn,
  memoryMap,
  memoryFound,
  onProgress,
  liveSnapshotText = "",
) {
  const { fullContext } = assembleContext({
    sessionType: checkIn.sessionType,
    shiftStatus: checkIn.shiftStatus,
    energyLevel: checkIn.energyLevel,
    topPriority: checkIn.topPriority,
    whatsHappening: checkIn.whatsHappening,
    financialUpdate: checkIn.financialUpdate,
    startupUpdate: checkIn.startupUpdate,
    additionalContext: checkIn.additionalContext,
    memoryData: memoryMap,
    memoryFound,
    liveSnapshotText,
  })

  onProgress?.("Running Life Planner...")

  const withBusyRetryNotice = (label, run) => async () =>
    run(() => onProgress?.(`${label} AI busy, retrying once...`))

  const specialistRuns = [
    withBusyRetryNotice("Life Planner:", (onTransientError) =>
      runLifePlannerAgent({
        fullContext,
        shiftStatus: checkIn.shiftStatus,
        energyLevel: checkIn.energyLevel,
        onTransientError,
      }),
    ),
    withBusyRetryNotice("Financial Strategist:", (onTransientError) =>
      runFinancialStrategist({
        fullContext,
        financialUpdate: checkIn.financialUpdate,
        onTransientError,
      }),
    ),
    withBusyRetryNotice("Startup Builder:", (onTransientError) =>
      runStartupBuilder({
        fullContext,
        startupUpdate: checkIn.startupUpdate,
        onTransientError,
      }),
    ),
    withBusyRetryNotice("Work Mastery:", (onTransientError) =>
      runWorkMastery({
        fullContext,
        shiftStatus: checkIn.shiftStatus,
        onTransientError,
      }),
    ),
    withBusyRetryNotice("Execution Coach:", (onTransientError) =>
      runExecutionCoach({
        fullContext,
        energyLevel: checkIn.energyLevel,
        topPriority: checkIn.topPriority,
        onTransientError,
      }),
    ),
  ]

  const specialistOutputs = []
  if (lifeManagerFastMode) {
    // Bounded concurrency: faster than strictly serial on multi-core CPUs, gentler than 5× parallel.
    const labels = [
      "Running Life Planner...",
      "Running Financial Strategist...",
      "Running Startup Builder...",
      "Running Work Mastery...",
      "Running Execution Coach...",
    ]
    const tasks = specialistRuns.map((run, i) => async () => {
      onProgress?.(labels[i])
      return run()
    })
    specialistOutputs.push(...(await runWithConcurrency(tasks, lifeManagerFastConcurrency)))
  } else {
    onProgress?.("Running specialist agents in parallel...")
    specialistOutputs.push(...(await Promise.all(specialistRuns.map((run) => run()))))
  }

  const [lifePlan, financeAnalysis, startupGuidance, workTasks, coaching] = specialistOutputs

  onProgress?.("Synthesizing final plan...")
  const unifiedPlan = await runMasterSynthesizer({
    lifePlan,
    finance: financeAnalysis,
    startup: startupGuidance,
    work: workTasks,
    coaching,
  })

  return {
    fullContext,
    lifePlan,
    financeAnalysis,
    startupGuidance,
    workTasks,
    coaching,
    unifiedPlan,
  }
}
