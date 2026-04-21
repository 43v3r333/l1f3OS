/** NL system copilot — allowlisted ops and validation (reject-all on any invalid action). */

export const MAX_SYSTEM_ACTIONS = 5
export const MAX_ACTION_TEXT = 8000
export const MAX_TAGS = 12
export const MAX_TAG_LEN = 64
export const MAX_PROFILE_JSON = 12_000
/** Max length for optional model `feedback` string (copilot UX). */
export const MAX_FEEDBACK_TEXT = 800

export const SAAS_LANES = ["todo", "doing", "done"]

export const LINKED_MODULES = ["notes", "saas", "finance", "life", "inbox"]

/** Keys the copilot may upsert (avoid keys that would clobber dashboard AI state). */
export const LIFE_MANAGER_MEMORY_KEYS = [
  "life_manager_goals_current",
  "life_manager_finance_settings",
  "life_manager_user_notes",
  "life_manager_ai_digest",
]

export const SYSTEM_ACTION_OPS = new Set([
  "add_note",
  "add_saas_task",
  "add_reminder",
  "set_today_task",
  "append_profile_row",
  "upsert_life_manager_memory",
  "patch_today_daily_log",
])

function clip(s, max) {
  const t = String(s ?? "")
  return t.length > max ? t.slice(0, max) : t
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
}

function normalizeTags(raw) {
  if (raw == null) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  const out = []
  for (const t of arr) {
    if (out.length >= MAX_TAGS) break
    const s = clip(String(t).trim(), MAX_TAG_LEN)
    if (s) out.push(s)
  }
  return out
}

function err(msg) {
  return { ok: false, errors: [msg] }
}

/**
 * @param {unknown} raw — parsed JSON root (expect `{ actions: [...] }`, optional `feedback`).
 * @returns {{ ok: true, actions: object[], feedback?: string } | { ok: false, errors: string[] }}
 */
export function validateSystemActionPlan(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return err("Root must be a JSON object.")
  }

  let feedback
  if (raw.feedback !== undefined && raw.feedback !== null) {
    if (typeof raw.feedback !== "string") {
      return err('"feedback" must be a string when present.')
    }
    const f = clip(String(raw.feedback).trim(), MAX_FEEDBACK_TEXT)
    feedback = f || undefined
  }

  const actions = raw.actions
  if (!Array.isArray(actions)) {
    return err('Missing "actions" array.')
  }
  if (actions.length === 0) {
    return err("At least one action is required.")
  }
  if (actions.length > MAX_SYSTEM_ACTIONS) {
    return err(`At most ${MAX_SYSTEM_ACTIONS} actions allowed.`)
  }

  const normalized = []
  for (let i = 0; i < actions.length; i += 1) {
    const a = actions[i]
    if (!a || typeof a !== "object" || Array.isArray(a)) {
      return err(`Action ${i + 1}: must be an object.`)
    }
    const op = a.op
    if (typeof op !== "string" || !SYSTEM_ACTION_OPS.has(op)) {
      return err(`Action ${i + 1}: invalid or missing "op".`)
    }

    switch (op) {
      case "add_note": {
        const title = a.title != null ? clip(String(a.title).trim(), 500) : ""
        const body = clip(String(a.body ?? "").trim(), MAX_ACTION_TEXT)
        if (!title && !body) {
          return err(`Action ${i + 1} (add_note): need title or body.`)
        }
        const linked =
          typeof a.linked_module === "string" && LINKED_MODULES.includes(a.linked_module)
            ? a.linked_module
            : "notes"
        const tags = normalizeTags(a.tags)
        normalized.push({ op, title: title || "Note", body, tags, linked_module: linked })
        break
      }
      case "add_saas_task": {
        const title = clip(String(a.title ?? "").trim(), 500)
        if (!title) {
          return err(`Action ${i + 1} (add_saas_task): "title" required.`)
        }
        const lane = typeof a.lane === "string" && SAAS_LANES.includes(a.lane) ? a.lane : "todo"
        normalized.push({ op, title, lane })
        break
      }
      case "add_reminder": {
        const title = clip(String(a.title ?? "").trim(), 500)
        if (!title) {
          return err(`Action ${i + 1} (add_reminder): "title" required.`)
        }
        const body = clip(String(a.body ?? "").trim(), MAX_ACTION_TEXT)
        let remindAt = null
        if (a.remind_at != null && String(a.remind_at).trim()) {
          const d = new Date(String(a.remind_at).trim())
          if (!Number.isFinite(d.getTime())) {
            return err(`Action ${i + 1} (add_reminder): invalid remind_at.`)
          }
          remindAt = d.toISOString()
        }
        normalized.push({ op, title, body, remind_at: remindAt })
        break
      }
      case "set_today_task": {
        const text = clip(String(a.text ?? a.task ?? "").trim(), MAX_ACTION_TEXT)
        if (!text) {
          return err(`Action ${i + 1} (set_today_task): "text" required.`)
        }
        normalized.push({ op, text })
        break
      }
      case "append_profile_row": {
        const section = clip(String(a.section ?? "").trim(), 200)
        const key = clip(String(a.key ?? "").trim(), 200)
        const value = clip(String(a.value ?? "").trim(), MAX_ACTION_TEXT)
        if (!section || !key) {
          return err(`Action ${i + 1} (append_profile_row): "section" and "key" required.`)
        }
        if (/[\r\n]/.test(section) || /[\r\n]/.test(key) || /[\r\n]/.test(value)) {
          return err(`Action ${i + 1} (append_profile_row): no newlines in fields.`)
        }
        normalized.push({ op, section, key, value })
        break
      }
      case "upsert_life_manager_memory": {
        const key = String(a.key ?? "").trim()
        if (!LIFE_MANAGER_MEMORY_KEYS.includes(key)) {
          return err(`Action ${i + 1} (upsert_life_manager_memory): key not allowlisted.`)
        }
        const value = a.value
        if (!isPlainObject(value)) {
          return err(`Action ${i + 1} (upsert_life_manager_memory): "value" must be a JSON object.`)
        }
        let encoded
        try {
          encoded = JSON.stringify(value)
        } catch {
          return err(`Action ${i + 1} (upsert_life_manager_memory): value not serializable.`)
        }
        if (encoded.length > MAX_PROFILE_JSON) {
          return err(`Action ${i + 1} (upsert_life_manager_memory): value too large.`)
        }
        normalized.push({ op, key, value })
        break
      }
      case "patch_today_daily_log": {
        const patch = {}
        if (a.main_task !== undefined) patch.main_task = clip(String(a.main_task).trim(), MAX_ACTION_TEXT)
        if (a.deep_work_hours !== undefined) {
          const n = Number(a.deep_work_hours)
          if (!Number.isFinite(n) || n < 0) {
            return err(`Action ${i + 1} (patch_today_daily_log): invalid deep_work_hours.`)
          }
          patch.deep_work_hours = n
        }
        if (a.study_hours !== undefined) {
          const n = Number(a.study_hours)
          if (!Number.isFinite(n) || n < 0) {
            return err(`Action ${i + 1} (patch_today_daily_log): invalid study_hours.`)
          }
          patch.study_hours = n
        }
        if (a.money_spent !== undefined) {
          const n = Number(a.money_spent)
          if (!Number.isFinite(n) || n < 0) {
            return err(`Action ${i + 1} (patch_today_daily_log): invalid money_spent.`)
          }
          patch.money_spent = n
        }
        if (a.saas_progress !== undefined) {
          patch.saas_progress = clip(String(a.saas_progress), MAX_ACTION_TEXT)
        }
        if (a.task_completed !== undefined) {
          patch.task_completed = Boolean(a.task_completed)
        }
        if (Object.keys(patch).length === 0) {
          return err(`Action ${i + 1} (patch_today_daily_log): at least one field required.`)
        }
        normalized.push({ op, patch })
        break
      }
      default:
        return err(`Action ${i + 1}: unhandled op "${op}".`)
    }
  }

  return feedback ? { ok: true, actions: normalized, feedback } : { ok: true, actions: normalized }
}
