import { useState } from "react"
import { AlarmClock, Lightbulb, ListPlus, LoaderCircle, PenLine, Sparkles, Timer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useStore } from "@/store/useStore"
import { supabase } from "@/services/supabase"
import { planSystemActions } from "@/services/systemCopilotAi"
import { executeSystemActionPlan } from "@/lib/systemActionExecutor"

const quickModes = [
  { id: "task", label: "Task", icon: ListPlus },
  { id: "note", label: "Note", icon: PenLine },
  { id: "reminder", label: "Remind", icon: AlarmClock },
  { id: "metric", label: "Metric", icon: Timer },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "ai", label: "AI", icon: Sparkles },
]

export default function QuickCaptureSheet() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState("task")
  const [value, setValue] = useState("")
  const [status, setStatus] = useState("")
  const [aiBusy, setAiBusy] = useState(false)

  const addSaasTask = useStore((state) => state.addSaasTask)
  const addReminder = useStore((state) => state.addReminder)
  const addNote = useStore((state) => state.addNote)
  const setMetric = useStore((state) => state.setMetric)
  const setTodayTask = useStore((state) => state.setTodayTask)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!value.trim()) return

    if (mode === "ai") {
      if (!supabase) {
        setStatus("Configure Supabase (VITE_SUPABASE_URL + key) to use AI capture.")
        return
      }
      setAiBusy(true)
      setStatus("Asking AI…")
      try {
        const planned = await planSystemActions(value.trim())
        if (!planned.ok) {
          setStatus(planned.error || "AI planning failed.")
          return
        }
        const done = await executeSystemActionPlan(planned.actions)
        if (!done.ok) {
          setStatus(done.errors.join(" ") || "Some actions failed.")
          return
        }
        const lines = []
        if (planned.feedback) lines.push(planned.feedback)
        lines.push(done.applied.length ? `Done: ${done.applied.join("; ")}` : "Done.")
        setStatus(lines.join("\n\n"))
      } catch (e) {
        setStatus(e?.message || "AI capture failed.")
      } finally {
        setAiBusy(false)
      }
      setValue("")
      return
    }

    if (mode === "task") {
      setTodayTask(value.trim())
      setStatus("Task loaded into Today.")
    } else if (mode === "idea") {
      const result = await addSaasTask({ title: value.trim(), lane: "todo" })
      setStatus(result.ok ? "Idea added to SaaS Todo." : result.message)
    } else if (mode === "note") {
      const result = await addNote({ title: "Quick capture", body: value.trim(), tags: ["quick"] })
      setStatus(result.ok ? "Note captured." : result.message)
    } else if (mode === "reminder") {
      const result = await addReminder({ title: value.trim() })
      setStatus(result.ok ? "Reminder saved to Supabase." : result.message)
    } else {
      setMetric("deepWorkHours", value.trim())
      setStatus("Deep work metric prefilled.")
    }

    setValue("")
  }

  return (
    <>
      <Button
        type="button"
        size="icon"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-40 rounded-full shadow-md md:bottom-8 md:right-8"
        onClick={() => setOpen((prev) => !prev)}
      >
        <PenLine className="size-4" />
      </Button>

      {open ? (
        <Card className="fixed inset-x-4 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+5.5rem))] z-40 border-border/90 bg-card md:bottom-24 md:right-8 md:left-auto md:w-[28rem]">
          <CardHeader>
            <CardTitle>Quick Capture</CardTitle>
            <CardDescription>
              Capture in one step. AI mode turns a sentence into notes, reminders, SaaS tasks, Today task, profile rows,
              Life Manager memory keys, or daily log patches (local proxy + Supabase).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-6 sm:gap-2">
              {quickModes.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={mode === item.id ? "default" : "outline"}
                  onClick={() => setMode(item.id)}
                  disabled={item.id === "ai" && !supabase}
                  className="h-auto flex-col py-2 text-[11px]"
                  title={item.id === "ai" && !supabase ? "Supabase required for AI routing" : undefined}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={handleSubmit}>
              <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={
                  mode === "ai"
                    ? 'e.g. "add reminder buy milk tomorrow" or "SaaS todo: wire webhooks"'
                    : "Type and press Enter..."
                }
                disabled={aiBusy}
              />
              <Button type="submit" disabled={aiBusy}>
                {aiBusy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {mode === "ai" ? "Run" : "Save"}
              </Button>
            </form>
            {status ? (
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{status}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
