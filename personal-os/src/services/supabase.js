import { createClient } from "@supabase/supabase-js"

import { getLocalDateISO } from "@/lib/utils"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

function requireClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
  }
}

function firstRowOrThrow(data, context) {
  const row = data?.[0]
  if (!row) {
    throw new Error(
      `${context} — no row returned. If you use RLS, ensure SELECT is allowed for rows you insert/update, and add an UPDATE policy for daily_logs (see src/services/README.md).`,
    )
  }
  return row
}

export async function insertDailyLog(log) {
  requireClient()

  const payload = {
    date: log.date,
    main_task: log.mainTask,
    deep_work_hours: Number(log.deepWorkHours ?? 0),
    study_hours: Number(log.studyHours ?? 0),
    saas_progress: log.saasProgress ?? "",
    money_spent: Number(log.moneySpent ?? 0),
    task_completed: Boolean(log.taskCompleted ?? false),
  }

  const { data, error } = await supabase.from("daily_logs").insert(payload).select()

  if (error) throw error
  return firstRowOrThrow(data, "Insert daily_logs")
}

/** First row for a calendar day, if any (duplicates should be avoided in DB). */
export async function fetchDailyLogByDate(dateISO) {
  requireClient()
  const d = String(dateISO).slice(0, 10)
  const { data, error } = await supabase.from("daily_logs").select("*").eq("date", d).limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

/** Rolling window of daily_logs (newest first). Default 7 days for legacy "weekly" views. */
export async function fetchDailyLogs({ endDate = new Date(), days = 7 } = {}) {
  requireClient()

  const end = new Date(endDate)
  const start = new Date(end)
  start.setDate(end.getDate() - (days - 1))

  // Must match how logs are saved (local calendar YYYY-MM-DD). UTC dates here drop "today" vs DB.
  const startISO = getLocalDateISO(start)
  const endISO = getLocalDateISO(end)

  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .gte("date", startISO)
    .lte("date", endISO)
    .order("date", { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchWeeklyLogs(endDate = new Date()) {
  return fetchDailyLogs({ endDate, days: 7 })
}

export async function updateDailyLog(id, patch) {
  requireClient()
  const row = {}
  if (patch.mainTask !== undefined) row.main_task = patch.mainTask
  if (patch.deepWorkHours !== undefined) row.deep_work_hours = Number(patch.deepWorkHours)
  if (patch.studyHours !== undefined) row.study_hours = Number(patch.studyHours)
  if (patch.saasProgress !== undefined) row.saas_progress = patch.saasProgress
  if (patch.moneySpent !== undefined) row.money_spent = Number(patch.moneySpent)
  if (patch.taskCompleted !== undefined) row.task_completed = Boolean(patch.taskCompleted)

  if (Object.keys(row).length === 0) {
    const { data, error } = await supabase.from("daily_logs").select("*").eq("id", id).limit(1)
    if (error) throw error
    return firstRowOrThrow(data, "Select daily_logs")
  }

  const { data, error } = await supabase.from("daily_logs").update(row).eq("id", id).select()

  if (error) throw error
  return firstRowOrThrow(data, "Update daily_logs")
}

/** One row per calendar day: update if a row exists for `log.date`, else insert. */
export async function upsertDailyLogForDate(log) {
  requireClient()
  const dateISO = String(log.date).slice(0, 10)

  const { data: existingRows, error: findError } = await supabase
    .from("daily_logs")
    .select("id")
    .eq("date", dateISO)
    .order("id", { ascending: false })
    .limit(1)

  if (findError) throw findError

  const existing = existingRows?.[0] ?? null

  if (existing?.id) {
    return updateDailyLog(existing.id, {
      mainTask: log.mainTask,
      deepWorkHours: log.deepWorkHours,
      studyHours: log.studyHours,
      saasProgress: log.saasProgress,
      moneySpent: log.moneySpent,
      taskCompleted: log.taskCompleted,
    })
  }

  return insertDailyLog(log)
}

export async function fetchSaasTasks() {
  requireClient()

  const { data, error } = await supabase
    .from("saas_tasks")
    .select("*")
    .order("created_at", { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createSaasTask({ title, lane = "todo" }) {
  requireClient()

  const { data, error } = await supabase
    .from("saas_tasks")
    .insert({
      title,
      lane,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSaasTaskLane({ id, lane }) {
  requireClient()

  const { data, error } = await supabase
    .from("saas_tasks")
    .update({ lane })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchNotes() {
  requireClient()
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createNote(note) {
  requireClient()
  const { data, error } = await supabase
    .from("notes")
    .insert({
      title: note.title,
      body: note.body,
      tags: note.tags ?? [],
      linked_module: note.linkedModule ?? "notes",
      pinned: Boolean(note.pinned ?? false),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateNote(id, patch) {
  requireClient()
  const { data, error } = await supabase
    .from("notes")
    .update({
      title: patch.title,
      body: patch.body,
      tags: patch.tags,
      linked_module: patch.linkedModule,
      pinned: patch.pinned,
    })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteNote(id) {
  requireClient()
  const { error } = await supabase.from("notes").delete().eq("id", id)
  if (error) throw error
}

export async function fetchAutomationRules() {
  requireClient()
  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertAutomationRule(rule) {
  requireClient()
  const { data, error } = await supabase
    .from("automation_rules")
    .upsert(rule, { onConflict: "id" })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createAutomationEvent(event) {
  requireClient()
  const { data, error } = await supabase
    .from("automation_events")
    .insert({
      event_type: event.type,
      payload: event.payload,
      rule_id: event.rule_id ?? null,
      action_type: event.action_type ?? null,
      status: event.status ?? "captured",
      message: event.message ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchAutomationEvents() {
  requireClient()
  const { data, error } = await supabase
    .from("automation_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function createAssistantMessage(message) {
  requireClient()
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      kind: message.kind ?? "note",
      title: message.title,
      body: message.body,
      source: message.source ?? "automation",
      read: false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchAssistantMessages() {
  requireClient()
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function markAssistantMessageRead(id) {
  requireClient()
  const { data, error } = await supabase
    .from("assistant_messages")
    .update({ read: true })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchReminders() {
  requireClient()
  const { data, error } = await supabase.from("reminders").select("*").order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createReminder({ title, body = "", remindAt = null }) {
  requireClient()
  const payload = {
    title: title.trim(),
    body: body ?? "",
    remind_at: remindAt ? new Date(remindAt).toISOString() : null,
  }
  const { data, error } = await supabase.from("reminders").insert(payload).select()
  if (error) throw error
  return firstRowOrThrow(data, "Insert reminders")
}

export async function updateReminder(id, patch) {
  requireClient()
  const row = {}
  if (patch.title !== undefined) row.title = patch.title.trim()
  if (patch.body !== undefined) row.body = patch.body ?? ""
  if (patch.done !== undefined) row.done = Boolean(patch.done)
  if (patch.remindAt !== undefined) {
    row.remind_at = patch.remindAt ? new Date(patch.remindAt).toISOString() : null
  }
  if (Object.keys(row).length === 0) {
    const { data, error } = await supabase.from("reminders").select("*").eq("id", id).limit(1)
    if (error) throw error
    return firstRowOrThrow(data, "Select reminders")
  }
  const { data, error } = await supabase.from("reminders").update(row).eq("id", id).select()
  if (error) throw error
  return firstRowOrThrow(data, "Update reminders")
}

export async function deleteReminder(id) {
  requireClient()
  const { error } = await supabase.from("reminders").delete().eq("id", id)
  if (error) throw error
}

/** Key-value memory for AI Life Manager (keys like life_manager_*) */
export async function fetchLifeManagerMemory() {
  requireClient()
  const { data, error } = await supabase
    .from("life_manager_memory")
    .select("key,value,updated_at")
    .like("key", "life_manager_%")
    .order("updated_at", { ascending: false })
  if (error) throw error
  const map = {}
  for (const row of data ?? []) {
    let val = row.value
    if (typeof val === "string") {
      try {
        val = JSON.parse(val)
      } catch {
        /* keep string */
      }
    }
    map[row.key] = val
  }
  return { rows: data ?? [], map }
}

export async function upsertLifeManagerMemory(key, value) {
  requireClient()
  const payload = {
    key,
    value: typeof value === "string" ? value : value,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from("life_manager_memory")
    .upsert(payload, { onConflict: "key" })
    .select()
    .single()
  if (error) throw error
  return data
}
