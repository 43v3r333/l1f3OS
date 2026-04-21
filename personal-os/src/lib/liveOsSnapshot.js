import { buildMemorySnapshot, generateInsights } from "@/lib/memory"
import { getLocalDateISO } from "@/lib/utils"

const MAX_CHARS = 3800

function take(str, max) {
  const s = String(str ?? "").trim()
  if (s.length <= max) return s
  return `${s.slice(0, max - 20)}… [truncated]`
}

/**
 * Compact, human-readable block for Life Manager / AI: what the app knows about recent behaviour and “right now”.
 * Keep under ~4k chars so CPU/cloud prompts stay bounded.
 */
export function buildLiveOsSnapshotForAi(state) {
  const {
    weeklyLogs = [],
    saasTasks = [],
    reminders = [],
    notes = [],
    automationEvents = [],
    todayTask = "",
    metrics = {},
    skills = {},
    taskCompleted = false,
  } = state ?? {}

  const todayISO = getLocalDateISO()
  const lines = []
  lines.push(`Snapshot time (local): ${new Date().toISOString()}`)
  lines.push(`Calendar today: ${todayISO}`)
  lines.push("")

  lines.push("— Today screen (draft / not yet saved unless logged)")
  lines.push(`Main task field: ${take(todayTask, 200) || "(empty)"}`)
  lines.push(
    `Metrics draft: deep_work_hours=${metrics.deepWorkHours ?? ""}, money_spent=${metrics.moneySpent ?? ""}; task_completed checkbox=${Boolean(taskCompleted)}`,
  )
  lines.push(
    `Skills draft (Today): coding=${skills.coding ?? ""}, work=${skills.work ?? ""}, study=${skills.study ?? ""}`,
  )
  lines.push("")

  const sortedLogs = [...weeklyLogs].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const last7 = sortedLogs.slice(0, 7)
  lines.push(`— Last ${last7.length} daily_logs rows (newest first)`)
  if (last7.length === 0) {
    lines.push("(none in store)")
  } else {
    for (const log of last7) {
      const d = String(log.date).slice(0, 10)
      lines.push(
        `• ${d} | task: ${take(log.main_task, 120)} | DW ${Number(log.deep_work_hours) || 0}h | spend R${Number(log.money_spent) || 0} | done=${Boolean(log.task_completed)}`,
      )
    }
  }
  lines.push("")

  const byLane = (lane) => saasTasks.filter((t) => t.lane === lane)
  lines.push("— SaaS tasks")
  lines.push(`Counts: todo=${byLane("todo").length}, doing=${byLane("doing").length}, done=${byLane("done").length}`)
  for (const lane of ["doing", "todo"]) {
    const titles = byLane(lane)
      .slice(0, 4)
      .map((t) => take(t.title, 80))
    if (titles.length) lines.push(`${lane}: ${titles.join(" | ")}`)
  }
  lines.push("")

  const openReminders = [...reminders]
    .filter((r) => !r.done)
    .sort((a, b) => String(a.remind_at || "").localeCompare(String(b.remind_at || "")))
    .slice(0, 6)
  lines.push(`— Open reminders (next ${openReminders.length})`)
  if (!openReminders.length) {
    lines.push("(none)")
  } else {
    for (const r of openReminders) {
      lines.push(`• ${take(r.title, 100)} @ ${r.remind_at ?? "no time"}`)
    }
  }
  lines.push("")

  const recentNotes = [...notes].slice(0, 4)
  lines.push(`— Recent notes (${recentNotes.length})`)
  for (const n of recentNotes) {
    const tags = Array.isArray(n.tags) && n.tags.length ? ` [${n.tags.slice(0, 4).join(", ")}]` : ""
    lines.push(`• ${take(n.title, 80)}${tags}`)
  }
  lines.push("")

  const events = [...automationEvents].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8)
  lines.push(`— Recent automation_events (${events.length})`)
  if (!events.length) {
    lines.push("(none)")
  } else {
    for (const ev of events) {
      lines.push(`• ${ev.event_type} @ ${String(ev.created_at).slice(0, 19)}`)
    }
  }
  lines.push("")

  try {
    const mem = buildMemorySnapshot({ weeklyLogs, saasTasks, skills })
    const ins = generateInsights(mem)
    lines.push("— Derived signals (from logs + tasks)")
    lines.push(
      `Deep work (30d window in store): ${mem.performance.deepWorkTotal.toFixed(1)}h | SaaS done ratio: ${mem.performance.saasProgress}% | Insight: ${take(ins[0]?.message, 220)}`,
    )
  } catch {
    lines.push("— Derived signals: (could not compute)")
  }

  let text = lines.join("\n")
  if (text.length > MAX_CHARS) {
    text = `${text.slice(0, MAX_CHARS)}\n… [snapshot capped at ${MAX_CHARS} chars]`
  }
  return text
}
