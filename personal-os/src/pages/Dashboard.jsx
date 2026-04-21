import { useEffect, useMemo, useState } from "react"
import { Activity, BarChart3, Brain, CalendarDays, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import AiMarkdown from "@/components/AiMarkdown"
import DashboardLiveMonitor from "@/components/DashboardLiveMonitor"
import DashboardRemindersStrip from "@/components/DashboardRemindersStrip"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SHIFT_CALENDAR_PDF_PUBLIC_PATH } from "@/lib/shiftCalendarForAi"
import { buildMemorySnapshot, generateInsights } from "@/lib/memory"
import { getLocalDateISO } from "@/lib/utils"
import { useStore } from "@/store/useStore"

const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function Dashboard() {
  const weeklyLogs = useStore((state) => state.weeklyLogs)
  const saasTasks = useStore((state) => state.saasTasks)
  const notes = useStore((state) => state.notes)
  const automationEvents = useStore((state) => state.automationEvents)
  const assistantMessages = useStore((state) => state.assistantMessages)
  const ai = useStore((state) => state.ai)
  const skills = useStore((state) => state.skills)
  const hydrateAllCore = useStore((state) => state.hydrateAllCore)
  const runAICycle = useStore((state) => state.runAICycle)
  const [status, setStatus] = useState("")

  useEffect(() => {
    let cancelled = false

    async function hydrateDashboard() {
      const result = await hydrateAllCore()
      if (cancelled) return
      if (!result.ok) {
        setStatus(result.message || "Unable to load full dashboard data.")
        return
      }
      // Defer AI work so the shell + charts can paint first (reduces jank).
      const run = () => {
        if (!cancelled) void runAICycle()
      }
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(run, { timeout: 2500 })
      } else {
        setTimeout(run, 120)
      }
    }

    hydrateDashboard()
    return () => {
      cancelled = true
    }
  }, [hydrateAllCore, runAICycle])

  const chartData = useMemo(() => {
    const map = new Map()
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = getLocalDateISO(date)
      map.set(key, {
        key,
        day: weekday[date.getDay()],
        deepWork: 0,
      })
    }

    weeklyLogs.forEach((log) => {
      const dk = String(log.date).slice(0, 10)
      if (map.has(dk)) {
        const current = map.get(dk)
        current.deepWork += Number(log.deep_work_hours || 0)
      }
    })

    return Array.from(map.values())
  }, [weeklyLogs])

  const totalDeepWork = useMemo(
    () => chartData.reduce((sum, item) => sum + item.deepWork, 0),
    [chartData],
  )
  const doneTasks = saasTasks.filter((task) => task.lane === "done").length
  const totalTasks = saasTasks.length
  const saasProgress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0
  const completedLogs = weeklyLogs.filter((log) => log.task_completed).length
  const taskCompletion = weeklyLogs.length
    ? Math.round((completedLogs / weeklyLogs.length) * 100)
    : 0

  const metrics = [
    { label: "Weekly Deep Work", value: `${totalDeepWork.toFixed(1)}h`, icon: Activity },
    { label: "SaaS Progress", value: `${saasProgress}%`, icon: BarChart3 },
    { label: "Task Completion", value: `${taskCompletion}%`, icon: Sparkles },
  ]
  const memory = useMemo(
    () => buildMemorySnapshot({ weeklyLogs, saasTasks, skills }),
    [weeklyLogs, saasTasks, skills],
  )
  const insights = useMemo(() => generateInsights(memory), [memory])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Control Center</p>
        <h1 className="mt-2 text-2xl font-semibold">Dashboard</h1>
      </div>

      {status ? <p className="text-sm text-amber-300">{status}</p> : null}

      <DashboardLiveMonitor />

      <DashboardRemindersStrip />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="size-5 text-primary" />
            AI Life Manager
          </CardTitle>
          <CardDescription>
            Multi-agent check-in: job, startup, finance, discipline — unified plan + Supabase memory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button asChild className="w-full">
            <Link to="/life">Open Life Manager</Link>
          </Button>
          <Button asChild variant="outline" className="w-full" size="sm">
            <a href={SHIFT_CALENDAR_PDF_PUBLIC_PATH} target="_blank" rel="noopener noreferrer">
              <CalendarDays className="size-4 shrink-0" />
              2026 shift calendar (PDF, C shift)
            </a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="flex items-center justify-between text-xl">
                {metric.value}
                <metric.icon className="size-5 text-primary" />
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Weekly Deep Work Hours</CardTitle>
            <CardDescription>Last 7 days of focused execution time.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height={224} minWidth={0}>
                <BarChart data={chartData}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                    }}
                  />
                  <Bar dataKey="deepWork" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution Pulse</CardTitle>
            <CardDescription>Live KPI bars from current data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">SaaS done ratio</span>
                <span>{saasProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${saasProgress}%` }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Daily logs completed</span>
                <span>{taskCompletion}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${taskCompletion}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI-Ready Insights</CardTitle>
            <CardDescription>Memory-based alerts and reward signals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Coding</p>
                <p className="text-lg font-semibold">{memory.skills.coding || 0}/10</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Work</p>
                <p className="text-lg font-semibold">{memory.skills.work || 0}/10</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Study</p>
                <p className="text-lg font-semibold">{memory.skills.study || 0}/10</p>
              </div>
            </div>
            {insights.map((insight) => (
              <div
                key={insight.title}
                className={
                  insight.type === "alert"
                    ? "rounded-2xl border border-red-400/40 bg-red-950/20 p-3"
                    : insight.type === "reward"
                      ? "rounded-2xl border border-emerald-400/40 bg-emerald-950/20 p-3"
                      : "rounded-2xl border border-border/70 bg-muted/30 p-3"
                }
              >
                <p className="text-sm font-medium">{insight.title}</p>
                <AiMarkdown compact className="text-muted-foreground [&_p]:text-xs [&_li]:text-xs">
                  {insight.message}
                </AiMarkdown>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automation Feed</CardTitle>
            <CardDescription>Latest automations and pending assistant outputs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {automationEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-2xl border border-border/70 bg-muted/30 p-3">
                <p className="text-sm font-medium">{event.action_type || event.event_type}</p>
                <AiMarkdown
                  compact
                  className="text-muted-foreground [&_p]:text-xs [&_li]:text-xs"
                  emptyFallback={<span className="text-xs text-muted-foreground">Captured</span>}
                >
                  {event.message || ""}
                </AiMarkdown>
              </div>
            ))}
            {automationEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No automation events yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Copilot</CardTitle>
          <CardDescription>Plan and recommendation from your live data.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 md:col-span-2">
            <p className="text-xs text-muted-foreground">Daily plan</p>
            {ai.dailyPlan ? (
              <AiMarkdown>{ai.dailyPlan}</AiMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground">Run AI cycle from dashboard load.</p>
            )}
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Next best task</p>
            {ai.nextTaskRecommendation ? (
              <AiMarkdown compact>{ai.nextTaskRecommendation}</AiMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground">No recommendation yet.</p>
            )}
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 md:col-span-3">
            <p className="text-xs text-muted-foreground">Reflection draft</p>
            {ai.reflection ? (
              <AiMarkdown>{ai.reflection}</AiMarkdown>
            ) : (
              <p className="text-sm text-muted-foreground">No reflection yet.</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground md:col-span-3">
            Notes: {notes.length} · Inbox unread: {assistantMessages.filter((msg) => !msg.read).length}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
