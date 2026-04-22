import { getAiProxyOrigin } from "@/lib/aiProxyOrigin"
import { getShiftScheduleAnchorForPrompt } from "@/lib/lifeManagerUserProfile"
import { fetchShiftCalendarExcerptForCopilot, SHIFT_CALENDAR_PDF_PUBLIC_PATH } from "@/lib/shiftCalendarForAi"
import { getLocalDateISO } from "@/lib/utils"
import { useStore } from "@/store/useStore"
import {
  validateSystemActionPlan,
  MAX_SYSTEM_ACTIONS,
  LINKED_MODULES,
  SAAS_LANES,
  LIFE_MANAGER_MEMORY_KEYS,
} from "@/lib/systemActionSchema"
import { LIFE_MANAGER_AI_DIGEST_KEY } from "@/lib/lifeManagerMemoryForPrompt"
import { parseDelimitedTable, rowsToObjects } from "@/lib/userProfileSheet"
import { fetchLifeManagerMemory } from "@/services/supabase"
import { fetchProfileSheetFromServer } from "@/services/profileSheetApi"

const PROFILE_CONTEXT_MAX_ROWS = 80
const PROFILE_CONTEXT_MAX_CHARS = 12_000
const SAAS_CONTEXT_LIMIT = 12
const REMINDER_CONTEXT_LIMIT = 10

function stripCodeFences(text) {
  let t = String(text ?? "").trim()
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()
  }
  return t
}

function buildProfileSummaryForContext(profileRows) {
  if (!profileRows.length) {
    return { rows: [], note: "No profile rows parsed." }
  }
  const out = []
  let approx = 2
  for (const r of profileRows) {
    if (out.length >= PROFILE_CONTEXT_MAX_ROWS) break
    const item = {
      section: String(r.section ?? "").slice(0, 200),
      key: String(r.key ?? "").slice(0, 200),
      value: String(r.value ?? "").slice(0, 500),
    }
    const piece = JSON.stringify(item)
    if (approx + piece.length > PROFILE_CONTEXT_MAX_CHARS) break
    out.push(item)
    approx += piece.length + 1
  }
  const truncated = out.length < profileRows.length || approx >= PROFILE_CONTEXT_MAX_CHARS
  return {
    rows: out,
    note: truncated ? `Truncated; total rows in sheet: ${profileRows.length}.` : `All ${out.length} rows included.`,
  }
}

/**
 * Async snapshot for the copilot (bounded size). Fetches local profile CSV via proxy when possible.
 */
export async function buildSystemCopilotContextBundle() {
  const s = useStore.getState()
  const today = getLocalDateISO()

  let profile_block = {
    source: "unavailable",
    summary_text: "Profile CSV could not be loaded.",
    rows_sample: [],
  }

  try {
    const data = await fetchProfileSheetFromServer()
    if (data.formatWarning || data.isBinaryExcel) {
      profile_block = {
        source: "local_file_invalid",
        summary_text: data.formatWarning || "Profile file is not valid CSV text.",
        rows_sample: [],
      }
    } else {
      const text = data.content ?? ""
      if (!String(text).trim()) {
        profile_block = {
          source: "local_empty",
          summary_text: "Local profile CSV is empty.",
          rows_sample: [],
        }
      } else {
        const { headers, rows: rawRows } = parseDelimitedTable(text)
        const objs = rowsToObjects(headers, rawRows)
        const { rows, note } = buildProfileSummaryForContext(objs)
        profile_block = {
          source: "local_csv",
          summary_text: note,
          rows_sample: rows,
        }
      }
    }
  } catch (e) {
    profile_block = {
      source: "error",
      summary_text: `Profile fetch failed: ${e?.message || String(e)}`,
      rows_sample: [],
    }
  }

  const saas_open_tasks = (s.saasTasks ?? [])
    .filter((t) => t.lane === "todo" || t.lane === "doing")
    .slice(0, SAAS_CONTEXT_LIMIT)
    .map((t) => ({
      title: String(t.title ?? "").slice(0, 160),
      lane: t.lane,
    }))

  const reminders_open = (s.reminders ?? [])
    .filter((r) => !r.done)
    .slice(0, REMINDER_CONTEXT_LIMIT)
    .map((r) => ({
      title: String(r.title ?? "").slice(0, 160),
    }))

  const logRow = (s.weeklyLogs ?? []).find((log) => String(log.date).slice(0, 10) === today)
  const today_log = logRow
    ? {
        main_task: String(logRow.main_task ?? "").slice(0, 240),
        money_spent: logRow.money_spent,
        deep_work_hours: logRow.deep_work_hours,
        study_hours: logRow.study_hours,
        task_completed: logRow.task_completed,
      }
    : null

  /** Bounded slice of Supabase Life Manager memory for copilot routing. */
  let life_manager = {
    available: false,
    digest_summary: "",
    digest_themes: [],
    digest_avoid: [],
    digest_repeat: [],
    goals_priority: "",
    goals_plan_snippet: "",
    finance_settings_note: "",
    load_error: "",
  }
  try {
    const { map } = await fetchLifeManagerMemory()
    const digest = map[LIFE_MANAGER_AI_DIGEST_KEY]
    const goals = map.life_manager_goals_current
    const fin = map.life_manager_finance_settings
    if (digest && typeof digest === "object") {
      life_manager.available = true
      life_manager.digest_summary = String(digest.summary ?? "").slice(0, 1800)
      life_manager.digest_themes = Array.isArray(digest.themes)
        ? digest.themes.map((t) => String(t).slice(0, 160)).filter(Boolean).slice(0, 8)
        : []
      life_manager.digest_avoid = Array.isArray(digest.avoid)
        ? digest.avoid.map((t) => String(t).slice(0, 160)).filter(Boolean).slice(0, 8)
        : []
      life_manager.digest_repeat = Array.isArray(digest.repeat)
        ? digest.repeat.map((t) => String(t).slice(0, 160)).filter(Boolean).slice(0, 8)
        : []
    }
    if (goals && typeof goals === "object") {
      life_manager.available = true
      life_manager.goals_priority = String(goals.current_priority ?? "").slice(0, 280)
      life_manager.goals_plan_snippet = String(goals.latest_plan_summary ?? "").slice(0, 450)
    }
    if (fin && typeof fin === "object") {
      life_manager.available = true
      life_manager.finance_settings_note = JSON.stringify(fin).slice(0, 700)
    }
  } catch (e) {
    life_manager.load_error = String(e?.message || e).slice(0, 200)
  }

  let shift_calendar_excerpt = ""
  try {
    shift_calendar_excerpt = await fetchShiftCalendarExcerptForCopilot()
  } catch {
    shift_calendar_excerpt = ""
  }

  return {
    local_date: today,
    today_task_preview: (s.todayTask || "").slice(0, 200),
    counts: {
      notes: s.notes?.length ?? 0,
      saas_tasks: s.saasTasks?.length ?? 0,
      reminders: s.reminders?.length ?? 0,
    },
    profile: profile_block,
    saas_open_tasks,
    reminders_open,
    today_log,
    life_manager,
    shift_designation: "C shift",
    shift_calendar_pdf_url: SHIFT_CALENDAR_PDF_PUBLIC_PATH,
    shift_schedule_anchor_note: getShiftScheduleAnchorForPrompt(),
    shift_calendar_excerpt,
  }
}

function buildSystemPrompt() {
  const modules = LINKED_MODULES.join(", ")
  const lanes = SAAS_LANES.join(", ")
  const lmKeys = LIFE_MANAGER_MEMORY_KEYS.join(", ")

  return `You are a routing assistant for a personal productivity app (personal-os).
The user message is followed by a JSON "Context" object with their local date, Today task draft, counts, a sample of their profile CSV rows (section/key/value), open SaaS tasks, open reminders, today's daily log row if it exists, \`life_manager\` (rolling AI digest + goals/finance snippets from Supabase when available), \`shift_designation\` (user is C shift), \`shift_calendar_pdf_url\` (app path to the official 2026 shift PDF), \`shift_schedule_anchor_note\` (human-updated operational block: night vs off vs day — use for reminders and timing when non-empty), and \`shift_calendar_excerpt\` (bounded plain text from that PDF via the local AI proxy when running — may be empty; reconcile anchor with excerpt when both exist).

Use that context to choose the right operations: prefer append_profile_row when the user clearly wants a durable calibration field; prefer add_note for narrative capture; use existing profile keys as reference so you do not invent conflicting keys unless the user asks for a new one.

You MUST respond with a single JSON object only — no markdown, no prose, no code fences.

Required shape:
{"feedback":"<1-3 short sentences explaining what you will do and any assumptions>","actions":[...]}

The "feedback" field is shown to the user before actions run: write plain English, friendly and specific.

The "actions" array:
- At most ${MAX_SYSTEM_ACTIONS} actions.
- Use only these op values: add_note, add_saas_task, add_reminder, set_today_task, append_profile_row, upsert_life_manager_memory, patch_today_daily_log.
- If the request is ambiguous, pick the single best op (usually add_note) and explain in feedback.
- Strings must be plain text (no newlines in append_profile_row fields).

Op reference:
1) add_note — fields: title (optional), body, tags (optional array of short strings), linked_module (optional, one of: ${modules}; default notes).
2) add_saas_task — fields: title, lane (optional: ${lanes}; default todo).
3) add_reminder — fields: title, body (optional), remind_at (optional ISO-8601 datetime string).
4) set_today_task — fields: text (main task for Today page).
5) append_profile_row — fields: section, key, value (adds one row to user profile CSV for Life Manager calibration).
6) upsert_life_manager_memory — fields: key (must be one of: ${lmKeys}), value (JSON object only).
7) patch_today_daily_log — fields: any of main_task, deep_work_hours, study_hours, money_spent, saas_progress, task_completed (boolean). Only include keys you need. Applies to today's calendar date in the user's locale.

Examples:
- "add buy milk to reminders" → {"feedback":"I'll add an open reminder titled Buy milk.","actions":[{"op":"add_reminder","title":"Buy milk"}]}
- "put Deploy v2 in SaaS doing" → {"feedback":"Adding a SaaS board task in Doing.","actions":[{"op":"add_saas_task","title":"Deploy v2","lane":"doing"}]}
- "remember idea: try webhook" → {"feedback":"Capturing as a SaaS-linked note.","actions":[{"op":"add_note","title":"Idea","body":"Try webhook","tags":["idea"],"linked_module":"saas"}]}
- "set my main task to deep work on auth" → {"feedback":"Setting your Today main task line.","actions":[{"op":"set_today_task","text":"Deep work on auth"}]}
- "add to profile work,job_title,Senior Engineer" → {"feedback":"Appending one row to your profile sheet under work.","actions":[{"op":"append_profile_row","section":"work","key":"job_title","value":"Senior Engineer"}]}`
}

/**
 * Calls the AI proxy and returns validated actions or an error (no writes).
 * @param {string} userMessage
 * @returns {Promise<{ ok: true, actions: object[], feedback?: string } | { ok: false, error: string, raw?: string }>}
 */
export async function planSystemActions(userMessage) {
  const text = String(userMessage ?? "").trim()
  if (!text) {
    return { ok: false, error: "Message is empty." }
  }

  const system = buildSystemPrompt()
  const ctx = await buildSystemCopilotContextBundle()
  const user = `Context (JSON):\n${JSON.stringify(ctx)}\n\nUser request:\n${text}`

  const maxAttempts = 3
  let lastErr = "AI request failed."
  let raw = ""

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(`${getAiProxyOrigin()}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          user,
          temperature: 0.2,
          maxTokens: 1400,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        raw = stripCodeFences(json?.content ?? "")
        let parsed
        try {
          parsed = JSON.parse(raw)
        } catch {
          return { ok: false, error: "Model did not return valid JSON.", raw: raw.slice(0, 500) }
        }
        const v = validateSystemActionPlan(parsed)
        if (!v.ok) {
          return { ok: false, error: v.errors.join(" "), raw: raw.slice(0, 500) }
        }
        return v.feedback ? { ok: true, actions: v.actions, feedback: v.feedback } : { ok: true, actions: v.actions }
      }

      if (attempt < maxAttempts && (res.status === 504 || res.status === 503 || res.status === 500)) {
        await new Promise((r) => setTimeout(r, 400 * attempt * attempt))
        lastErr = `HTTP ${res.status}`
        continue
      }
      const errBody = await res.text().catch(() => "")
      return { ok: false, error: `AI proxy error: ${res.status} ${errBody}`.slice(0, 400) }
    } catch (e) {
      lastErr = e?.message || String(e)
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt * attempt))
      }
    }
  }

  return { ok: false, error: lastErr }
}
