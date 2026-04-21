import { create } from "zustand"

import {
  createAssistantMessage,
  createAutomationEvent,
  createNote,
  createReminder,
  createSaasTask,
  deleteNote,
  deleteReminder,
  fetchAssistantMessages,
  fetchAutomationEvents,
  fetchAutomationRules,
  fetchLifeManagerMemory,
  fetchNotes,
  fetchReminders,
  fetchSaasTasks,
  fetchDailyLogs,
  fetchDailyLogByDate,
  updateDailyLog,
  upsertDailyLogForDate,
  insertDailyLog,
  markAssistantMessageRead,
  updateNote,
  updateReminder,
  updateSaasTaskLane,
  upsertAutomationRule,
  upsertLifeManagerMemory,
} from "@/services/supabase"
import { defaultAutomationRules, evaluateAutomationRules } from "@/lib/automation"
import {
  generateDailyPlan,
  generateReflection,
  recommendNextTask,
  summarizeNote,
} from "@/services/ai"
import { buildMemorySnapshot, generateInsights } from "@/lib/memory"
import { getLocalDateISO } from "@/lib/utils"

export const useStore = create((set, get) => ({
  todayTask: "",
  metrics: {
    deepWorkHours: "",
    moneySpent: "",
  },
  skills: {
    coding: "",
    work: "",
    study: "",
  },
  taskCompleted: false,
  saasTasks: [],
  weeklyLogs: [],
  notes: [],
  noteSearch: "",
  automationRules: [],
  automationEvents: [],
  assistantMessages: [],
  reminders: [],
  ai: {
    dailyPlan: "",
    nextTaskRecommendation: "",
    reflection: "",
  },
  isLoadingWeekly: false,
  isLoadingSaas: false,
  isLoadingNotes: false,
  isLoadingAutomation: false,
  isLoadingAssistant: false,
  isLoadingReminders: false,
  isSaving: false,

  setTodayTask: (value) => set({ todayTask: value }),
  setMetric: (key, value) =>
    set((state) => ({ metrics: { ...state.metrics, [key]: value } })),
  setSkill: (key, value) =>
    set((state) => ({ skills: { ...state.skills, [key]: value } })),
  setTaskCompleted: (value) => set({ taskCompleted: value }),
  setSaasTasks: (tasks) => set({ saasTasks: tasks }),
  setNoteSearch: (value) => set({ noteSearch: value }),

  hydrateNotes: async () => {
    set({ isLoadingNotes: true })
    try {
      const notes = await fetchNotes()
      set({ notes })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    } finally {
      set({ isLoadingNotes: false })
    }
  },

  addNote: async ({ title, body, tags = [], linkedModule = "notes", pinned = false }) => {
    if (!title.trim() && !body.trim()) return { ok: false, message: "Note title or body is required." }
    try {
      const saved = await createNote({ title: title.trim() || "Untitled note", body, tags, linkedModule, pinned })
      set((state) => ({ notes: [saved, ...state.notes] }))
      await get().runAutomationEvent({ type: "note_created", payload: { title: saved.title } })
      return { ok: true, note: saved, message: "Note saved." }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  editNote: async (id, patch) => {
    try {
      const updated = await updateNote(id, patch)
      set((state) => ({
        notes: state.notes.map((note) => (String(note.id) === String(id) ? { ...note, ...updated } : note)),
      }))
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  removeNote: async (id) => {
    try {
      await deleteNote(id)
      set((state) => ({ notes: state.notes.filter((note) => String(note.id) !== String(id)) }))
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  hydrateAutomation: async () => {
    set({ isLoadingAutomation: true })
    try {
      let rules = await fetchAutomationRules()
      if (!rules.length) {
        const seeded = await Promise.all(defaultAutomationRules.map((rule) => upsertAutomationRule(rule)))
        rules = seeded
      }
      const events = await fetchAutomationEvents()
      set({ automationRules: rules, automationEvents: events })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    } finally {
      set({ isLoadingAutomation: false })
    }
  },

  runAutomationEvent: async ({ type, payload }) => {
    try {
      const state = get()
      const evaluated = evaluateAutomationRules(state.automationRules, { type, payload })
      const captured = await createAutomationEvent({ type, payload, status: "captured", message: "Event captured." })
      const actionEvents = await Promise.all(
        evaluated.map(async (action) =>
          createAutomationEvent({
            type: action.event_type,
            payload: action.payload,
            rule_id: action.rule_id,
            action_type: action.action_type,
            status: action.status,
            message: action.message,
          }),
        ),
      )
      const assistant = await Promise.all(
        evaluated.map((action) =>
          createAssistantMessage({
            kind: action.action_type.includes("reward") ? "reward" : "alert",
            title: action.action_type,
            body: action.message,
            source: "automation",
          }),
        ),
      )

      set((current) => ({
        automationEvents: [captured, ...actionEvents, ...current.automationEvents].slice(0, 50),
        assistantMessages: [...assistant, ...current.assistantMessages],
      }))
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  hydrateReminders: async () => {
    set({ isLoadingReminders: true })
    try {
      const rows = await fetchReminders()
      set({ reminders: rows })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    } finally {
      set({ isLoadingReminders: false })
    }
  },

  addReminder: async ({ title, body = "", remindAt = null }) => {
    const t = title.trim()
    if (!t) return { ok: false, message: "Title is required." }
    try {
      const saved = await createReminder({ title: t, body, remindAt })
      set((state) => ({ reminders: [saved, ...state.reminders] }))
      return { ok: true, reminder: saved }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  patchReminder: async (id, patch) => {
    try {
      const updated = await updateReminder(id, patch)
      set((state) => ({
        reminders: state.reminders.map((r) => (String(r.id) === String(id) ? { ...r, ...updated } : r)),
      }))
      return { ok: true, reminder: updated }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  removeReminder: async (id) => {
    try {
      await deleteReminder(id)
      set((state) => ({ reminders: state.reminders.filter((r) => String(r.id) !== String(id)) }))
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  hydrateAssistantMessages: async () => {
    set({ isLoadingAssistant: true })
    try {
      const messages = await fetchAssistantMessages()
      set({ assistantMessages: messages })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    } finally {
      set({ isLoadingAssistant: false })
    }
  },

  readAssistantMessage: async (id) => {
    try {
      const updated = await markAssistantMessageRead(id)
      set((state) => ({
        assistantMessages: state.assistantMessages.map((msg) =>
          String(msg.id) === String(id) ? { ...msg, ...updated } : msg,
        ),
      }))
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  hydrateSaasTasks: async () => {
    set({ isLoadingSaas: true })
    try {
      const tasks = await fetchSaasTasks()
      set({ saasTasks: tasks })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    } finally {
      set({ isLoadingSaas: false })
    }
  },

  addSaasTask: async ({ title, lane = "todo" }) => {
    const trimmed = title.trim()
    if (!trimmed) {
      return { ok: false, message: "Task title is required." }
    }

    try {
      const saved = await createSaasTask({ title: trimmed, lane })
      set((state) => ({ saasTasks: [...state.saasTasks, saved] }))
      await get().runAutomationEvent({ type: "saas_task_created", payload: { lane, title: saved.title } })
      return { ok: true, message: "Task added.", task: saved }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  moveSaasTask: async ({ taskId, toLane }) => {
    const previousTasks = get().saasTasks
    const previousTask = previousTasks.find((task) => String(task.id) === String(taskId))

    if (!previousTask || previousTask.lane === toLane) {
      return { ok: true }
    }

    set((state) => ({
      saasTasks: state.saasTasks.map((task) =>
        String(task.id) === String(taskId) ? { ...task, lane: toLane } : task,
      ),
    }))

    try {
      const updated = await updateSaasTaskLane({ id: taskId, lane: toLane })
      set((state) => ({
        saasTasks: state.saasTasks.map((task) =>
          String(task.id) === String(taskId) ? { ...task, ...updated } : task,
        ),
      }))
      await get().runAutomationEvent({
        type: "saas_task_moved",
        payload: { task_id: taskId, to_lane: toLane, title: updated.title },
      })
      return { ok: true }
    } catch (error) {
      set({ saasTasks: previousTasks })
      return { ok: false, message: error.message }
    }
  },

  hydrateWeeklyLogs: async () => {
    set({ isLoadingWeekly: true })
    try {
      const logs = await fetchDailyLogs({ days: 90 })
      set({ weeklyLogs: logs })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message }
    } finally {
      set({ isLoadingWeekly: false })
    }
  },

  updateDailyLogEntry: async (id, patch) => {
    try {
      const updated = await updateDailyLog(id, patch)
      set((state) => ({
        weeklyLogs: state.weeklyLogs.map((log) => (String(log.id) === String(id) ? { ...log, ...updated } : log)),
      }))
      return { ok: true, log: updated }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  /** Log spend for a day — updates `money_spent` only if a row exists (keeps Today task text). */
  quickLogSpendForDate: async ({ dateISO, moneySpent }) => {
    const d = String(dateISO).slice(0, 10)
    const amount = Number(moneySpent)
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, message: "Enter a valid amount." }
    }
    try {
      let existing = get().weeklyLogs.find((log) => String(log.date).slice(0, 10) === d)
      if (!existing) {
        existing = await fetchDailyLogByDate(d)
      }

      let saved
      if (existing?.id) {
        saved = await updateDailyLog(existing.id, { moneySpent: amount })
      } else {
        saved = await insertDailyLog({
          date: d,
          mainTask: "(spend)",
          deepWorkHours: 0,
          studyHours: 0,
          saasProgress: "",
          moneySpent: amount,
          taskCompleted: false,
        })
      }

      let refreshed
      try {
        refreshed = await fetchDailyLogs({ days: 90 })
      } catch {
        refreshed = null
      }
      set((current) => ({
        weeklyLogs:
          refreshed ??
          (() => {
            const rest = current.weeklyLogs.filter((log) => String(log.date).slice(0, 10) !== d)
            return [saved, ...rest].slice(0, 90)
          })(),
      }))
      await get().runAutomationEvent({
        type: "finance_spend_logged",
        payload: { date: d, money_spent: saved.money_spent },
      })
      return { ok: true, log: saved }
    } catch (error) {
      return { ok: false, message: error.message }
    }
  },

  saveTodayLog: async (overrides = {}) => {
    const state = get()
    const todayISO = getLocalDateISO()
    const mainTask = (overrides.mainTask ?? state.todayTask).trim()

    if (!mainTask) {
      return { ok: false, message: "Task is required." }
    }

    set({ isSaving: true })
    try {
      const saved = await upsertDailyLogForDate({
        date: todayISO,
        mainTask,
        deepWorkHours: Number((overrides.deepWorkHours ?? state.metrics.deepWorkHours) || 0),
        studyHours: Number((overrides.studyHours ?? state.skills.study) || 0),
        saasProgress: "Phase 3 sync",
        moneySpent: Number((overrides.moneySpent ?? state.metrics.moneySpent) || 0),
        taskCompleted: Boolean(overrides.taskCompleted ?? state.taskCompleted),
      })

      let refreshed
      try {
        refreshed = await fetchDailyLogs({ days: 90 })
      } catch {
        refreshed = null
      }

      set((current) => {
        const merged =
          refreshed ??
          (() => {
            const rest = current.weeklyLogs.filter((log) => String(log.date).slice(0, 10) !== todayISO)
            return [saved, ...rest].slice(0, 90)
          })()
        return {
          weeklyLogs: merged,
          todayTask: "",
          metrics: {
            ...current.metrics,
            deepWorkHours: "",
            moneySpent: "",
          },
          skills: {
            ...current.skills,
            coding: "",
            work: "",
            study: "",
          },
          taskCompleted: false,
        }
      })

      await get().runAutomationEvent({
        type: "daily_log_saved",
        payload: {
          deep_work_hours: saved.deep_work_hours,
          task_completed: saved.task_completed,
          date: saved.date,
        },
      })

      return { ok: true, message: "Daily log saved to Supabase." }
    } catch (error) {
      return { ok: false, message: error.message }
    } finally {
      set({ isSaving: false })
    }
  },

  hydrateAllCore: async () => {
    const [weekly, saas, notes, auto, messages, rem] = await Promise.all([
      get().hydrateWeeklyLogs(),
      get().hydrateSaasTasks(),
      get().hydrateNotes(),
      get().hydrateAutomation(),
      get().hydrateAssistantMessages(),
      get().hydrateReminders(),
    ])
    const failed = [weekly, saas, notes, auto, messages, rem].find((result) => !result.ok)
    return failed ? { ok: false, message: failed.message } : { ok: true }
  },

  runAICycle: async () => {
    const state = get()
    const memory = buildMemorySnapshot({
      weeklyLogs: state.weeklyLogs,
      saasTasks: state.saasTasks,
      skills: state.skills,
    })
    const insights = generateInsights(memory)
    const dailyPlan = await generateDailyPlan({
      weeklyLogs: state.weeklyLogs,
      saasTasks: state.saasTasks,
      notes: state.notes,
    })
    const nextTaskRecommendation = recommendNextTask({
      saasTasks: state.saasTasks,
      insights,
    })
    const reflection = generateReflection({
      weeklyLogs: state.weeklyLogs,
      saasTasks: state.saasTasks,
    })
    set({ ai: { dailyPlan, nextTaskRecommendation, reflection } })

    try {
      const { map } = await fetchLifeManagerMemory()
      const today = getLocalDateISO()
      const prev = map.life_manager_dashboard_ai_latest
      const lastInboxSent = prev && typeof prev === "object" ? prev.lastInboxSentDate : null

      const snapshot = {
        updated_at: new Date().toISOString(),
        dailyPlan,
        nextTaskRecommendation,
        reflection,
        lastInboxSentDate: lastInboxSent ?? null,
      }

      if (lastInboxSent !== today) {
        const saved = await createAssistantMessage({
          kind: "coach",
          title: "Daily coach",
          body: `**Plan**\n${dailyPlan}\n\n**Next task**\n${nextTaskRecommendation}\n\n**Reflection**\n${reflection}`,
          source: "dashboard_ai",
        })
        snapshot.lastInboxSentDate = today
        set((s) => ({
          assistantMessages: [saved, ...s.assistantMessages],
        }))
      }

      await upsertLifeManagerMemory("life_manager_dashboard_ai_latest", snapshot)
    } catch (e) {
      console.warn("Dashboard AI persist failed:", e.message)
    }

    return { ok: true }
  },

  summarizeAndTagNote: async (note) => {
    const summary = await summarizeNote(note)
    return summary
  },
}))
