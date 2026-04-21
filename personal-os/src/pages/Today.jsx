import { useEffect, useState } from "react"
import { CheckCircle2, Clock3, LoaderCircle, Target } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AiMarkdown from "@/components/AiMarkdown"
import { stripSimpleMarkdown } from "@/lib/utils"
import { useStore } from "@/store/useStore"

const tasks = [
  { title: "Ship onboarding draft", detail: "45 min deep sprint", icon: Target },
  { title: "Architecture review", detail: "20 min async notes", icon: Clock3 },
  { title: "Day close checklist", detail: "Reflect and set tomorrow", icon: CheckCircle2 },
]

export default function Today() {
  const todayTask = useStore((state) => state.todayTask)
  const metrics = useStore((state) => state.metrics)
  const skills = useStore((state) => state.skills)
  const taskCompleted = useStore((state) => state.taskCompleted)
  const weeklyLogs = useStore((state) => state.weeklyLogs)
  const ai = useStore((state) => state.ai)
  const isLoadingWeekly = useStore((state) => state.isLoadingWeekly)
  const isSaving = useStore((state) => state.isSaving)
  const setTodayTask = useStore((state) => state.setTodayTask)
  const setMetric = useStore((state) => state.setMetric)
  const setSkill = useStore((state) => state.setSkill)
  const setTaskCompleted = useStore((state) => state.setTaskCompleted)
  const hydrateWeeklyLogs = useStore((state) => state.hydrateWeeklyLogs)
  const saveTodayLog = useStore((state) => state.saveTodayLog)
  const runAICycle = useStore((state) => state.runAICycle)

  const [status, setStatus] = useState({ type: "idle", message: "" })

  useEffect(() => {
    hydrateWeeklyLogs().then((result) => {
      if (!result.ok) {
        setStatus({ type: "error", message: result.message })
      }
    })
    runAICycle()
  }, [hydrateWeeklyLogs, runAICycle])

  async function onSubmit(event) {
    event.preventDefault()
    setStatus({ type: "idle", message: "" })
    const result = await saveTodayLog()
    setStatus({
      type: result.ok ? "success" : "error",
      message: result.message,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Execution lane</p>
        <h1 className="mt-2 text-2xl font-semibold">Today</h1>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-3">
            {tasks.map((task) => (
              <Card key={task.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <task.icon className="size-4 text-primary" />
                    {task.title}
                  </CardTitle>
                  <CardDescription>{task.detail}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Daily Log</CardTitle>
              <CardDescription>Capture execution metrics and save to Supabase.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="main-task">Task</Label>
                  <Input
                    id="main-task"
                    value={todayTask}
                    onChange={(event) => setTodayTask(event.target.value)}
                    placeholder="Ship homepage revisions"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="deep-hours">Hours</Label>
                    <Input
                      id="deep-hours"
                      type="number"
                      min="0"
                      step="0.5"
                      value={metrics.deepWorkHours}
                      onChange={(event) => setMetric("deepWorkHours", event.target.value)}
                      placeholder="2.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="money-spent">Money</Label>
                    <Input
                      id="money-spent"
                      type="number"
                      min="0"
                      step="0.01"
                      value={metrics.moneySpent}
                      onChange={(event) => setMetric("moneySpent", event.target.value)}
                      placeholder="45"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="skill-coding">Coding</Label>
                    <Input
                      id="skill-coding"
                      type="number"
                      min="0"
                      max="10"
                      value={skills.coding}
                      onChange={(event) => setSkill("coding", event.target.value)}
                      placeholder="8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skill-work">Work</Label>
                    <Input
                      id="skill-work"
                      type="number"
                      min="0"
                      max="10"
                      value={skills.work}
                      onChange={(event) => setSkill("work", event.target.value)}
                      placeholder="7"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skill-study">Study</Label>
                    <Input
                      id="skill-study"
                      type="number"
                      min="0"
                      max="10"
                      value={skills.study}
                      onChange={(event) => setSkill("study", event.target.value)}
                      placeholder="6"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                  <p className="text-sm text-muted-foreground">Mark today task as completed</p>
                  <Button
                    type="button"
                    variant={taskCompleted ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTaskCompleted(!taskCompleted)}
                  >
                    {taskCompleted ? "Completed" : "Pending"}
                  </Button>
                </div>

                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>

                {status.message ? (
                  <p
                    className={
                      status.type === "error"
                        ? "text-sm text-red-400"
                        : "text-sm text-emerald-400"
                    }
                  >
                    {status.message}
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Coach</CardTitle>
              <CardDescription>Fast execution guidance for today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ai.nextTaskRecommendation ? (
                <AiMarkdown compact className="text-muted-foreground">
                  {ai.nextTaskRecommendation}
                </AiMarkdown>
              ) : (
                <p className="text-sm text-muted-foreground">No recommendation yet.</p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!ai.nextTaskRecommendation) return
                    const raw = ai.nextTaskRecommendation.replace(/^Start next priority task:\s*/i, "")
                    setTodayTask(stripSimpleMarkdown(raw))
                  }}
                >
                  Accept
                </Button>
                <Button type="button" variant="ghost" onClick={() => runAICycle()}>
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weekly Logs</CardTitle>
              <CardDescription>Recent entries from `daily_logs`.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingWeekly ? (
                <p className="text-sm text-muted-foreground">Loading weekly logs...</p>
              ) : weeklyLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries found yet.</p>
              ) : (
                weeklyLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-border/70 bg-muted/40 p-3">
                    <p className="text-sm font-medium">{log.main_task}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.date} · {log.deep_work_hours}h · R {log.money_spent}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
