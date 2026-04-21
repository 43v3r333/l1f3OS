/**
 * Executes validated system copilot actions against the Zustand store + Supabase + profile CSV.
 */

import { useStore } from "@/store/useStore"
import { fetchDailyLogByDate, upsertDailyLogForDate, upsertLifeManagerMemory, createAssistantMessage } from "@/services/supabase"
import { fetchProfileSheetFromServer, saveProfileSheetToServer } from "@/services/profileSheetApi"
import { ensureUserProfileSheetLoaded, resetProfileSheetCacheForTests, validateProfileSheetCsv } from "@/lib/userProfileSheet"
import { getLocalDateISO } from "@/lib/utils"

function csvEscapeField(s) {
  const t = String(s ?? "")
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

function appendCsvDataRow(content, section, key, value) {
  const line = `${csvEscapeField(section)},${csvEscapeField(key)},${csvEscapeField(value)}`
  const trimmed = (content ?? "").replace(/\s+$/, "")
  if (!trimmed) return `${line}\n`
  return `${trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`}${line}\n`
}

function dbRowToLogInput(row) {
  return {
    date: String(row.date).slice(0, 10),
    mainTask: row.main_task ?? "",
    deepWorkHours: Number(row.deep_work_hours ?? 0),
    studyHours: Number(row.study_hours ?? 0),
    saasProgress: row.saas_progress ?? "",
    moneySpent: Number(row.money_spent ?? 0),
    taskCompleted: Boolean(row.task_completed ?? false),
  }
}

/**
 * @param {object[]} actions — output of validateSystemActionPlan
 * @param {{ audit?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, applied: string[], errors: string[], hydrates: string[] }>}
 */
export async function executeSystemActionPlan(actions, options = {}) {
  const audit = options.audit !== false
  const store = useStore.getState()
  const applied = []
  const errors = []
  /** @type {Set<string>} */
  const hydrateKeys = new Set()

  const remoteProfile = Boolean((import.meta.env.VITE_USER_PROFILE_SHEET_URL || "").trim())

  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i]
    const label = `${action.op}`

    try {
      switch (action.op) {
        case "add_note": {
          const r = await store.addNote({
            title: action.title,
            body: action.body,
            tags: action.tags,
            linked_module: action.linked_module,
          })
          if (!r.ok) {
            errors.push(`${label}: ${r.message}`)
            return { ok: false, applied, errors, hydrates: [...hydrateKeys] }
          }
          applied.push(`${label} → note`)
          hydrateKeys.add("notes")
          break
        }
        case "add_saas_task": {
          const r = await store.addSaasTask({ title: action.title, lane: action.lane })
          if (!r.ok) {
            errors.push(`${label}: ${r.message}`)
            return { ok: false, applied, errors, hydrates: [...hydrateKeys] }
          }
          applied.push(`${label} → SaaS`)
          hydrateKeys.add("saas")
          break
        }
        case "add_reminder": {
          const r = await store.addReminder({
            title: action.title,
            body: action.body,
            remindAt: action.remind_at,
          })
          if (!r.ok) {
            errors.push(`${label}: ${r.message}`)
            return { ok: false, applied, errors, hydrates: [...hydrateKeys] }
          }
          applied.push(`${label} → reminder`)
          hydrateKeys.add("reminders")
          break
        }
        case "set_today_task": {
          store.setTodayTask(action.text)
          applied.push(`${label} → Today`)
          break
        }
        case "append_profile_row": {
          if (remoteProfile) {
            errors.push(`${label}: VITE_USER_PROFILE_SHEET_URL is set; local CSV edits are disabled.`)
            return { ok: false, applied, errors, hydrates: [...hydrateKeys] }
          }
          const data = await fetchProfileSheetFromServer()
          const next = appendCsvDataRow(data.content ?? "", action.section, action.key, action.value)
          if (!validateProfileSheetCsv(next)) {
            errors.push(`${label}: merged CSV failed validation.`)
            return { ok: false, applied, errors, hydrates: [...hydrateKeys] }
          }
          await saveProfileSheetToServer(next)
          resetProfileSheetCacheForTests()
          await ensureUserProfileSheetLoaded({ force: true })
          applied.push(`${label} → profile CSV`)
          break
        }
        case "upsert_life_manager_memory": {
          await upsertLifeManagerMemory(action.key, action.value)
          applied.push(`${label} → ${action.key}`)
          break
        }
        case "patch_today_daily_log": {
          const today = getLocalDateISO()
          const existing = await fetchDailyLogByDate(today)
          const base = existing
            ? dbRowToLogInput(existing)
            : {
                date: today,
                mainTask: "(copilot)",
                deepWorkHours: 0,
                studyHours: 0,
                saasProgress: "",
                moneySpent: 0,
                taskCompleted: false,
              }
          const p = action.patch
          if (p.main_task !== undefined) base.mainTask = p.main_task
          if (p.deep_work_hours !== undefined) base.deepWorkHours = p.deep_work_hours
          if (p.study_hours !== undefined) base.studyHours = p.study_hours
          if (p.money_spent !== undefined) base.moneySpent = p.money_spent
          if (p.saas_progress !== undefined) base.saasProgress = p.saas_progress
          if (p.task_completed !== undefined) base.taskCompleted = p.task_completed
          await upsertDailyLogForDate(base)
          applied.push(`${label} → daily_logs`)
          hydrateKeys.add("weekly")
          break
        }
        default:
          errors.push(`Unknown op: ${action.op}`)
          return { ok: false, applied, errors, hydrates: [...hydrateKeys] }
      }
    } catch (e) {
      const msg = e?.message || String(e)
      errors.push(`${label}: ${msg}`)
      return { ok: false, applied, errors, hydrates: [...hydrateKeys] }
    }
  }

  const hydrates = [...hydrateKeys]
  for (const key of hydrates) {
    if (key === "notes") await store.hydrateNotes()
    if (key === "saas") await store.hydrateSaasTasks()
    if (key === "reminders") await store.hydrateReminders()
    if (key === "weekly") await store.hydrateWeeklyLogs()
  }

  if (audit && applied.length) {
    try {
      const body = `**Ops**\n${applied.map((l) => `- ${l}`).join("\n")}`
      const saved = await createAssistantMessage({
        kind: "note",
        title: "System copilot",
        body,
        source: "system_copilot",
      })
      useStore.setState((s) => ({
        assistantMessages: [saved, ...s.assistantMessages],
      }))
    } catch {
      /* non-fatal */
    }
  }

  return { ok: errors.length === 0, applied, errors, hydrates }
}
