import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Inbox,
  ListTodo,
  Radio,
  RefreshCw,
  Wallet,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { USER_MEMORY_PROFILE_JSON } from "@/lib/lifeManagerUserProfile"
import { useStore } from "@/store/useStore"
import { cn, getLocalDateISO } from "@/lib/utils"

const LANES = [
  { id: "todo", label: "Todo" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
]

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return "—"
  }
}

export default function DashboardLiveMonitor() {
  const weeklyLogs = useStore((s) => s.weeklyLogs)
  const saasTasks = useStore((s) => s.saasTasks)
  const notes = useStore((s) => s.notes)
  const assistantMessages = useStore((s) => s.assistantMessages)
  const automationEvents = useStore((s) => s.automationEvents)
  const todayTask = useStore((s) => s.todayTask)
  const metrics = useStore((s) => s.metrics)
  const hydrateAllCore = useStore((s) => s.hydrateAllCore)

  const [lastSync, setLastSync] = useState(() => Date.now())
  const [refreshing, setRefreshing] = useState(false)

  const manualRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await hydrateAllCore()
      setLastSync(Date.now())
    } finally {
      setRefreshing(false)
    }
  }, [hydrateAllCore])

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      hydrateAllCore().then(() => setLastSync(Date.now()))
    }
    const id = setInterval(tick, 120000)
    return () => clearInterval(id)
  }, [hydrateAllCore])

  const todayISO = getLocalDateISO()

  const todayLog = useMemo(
    () => weeklyLogs.find((log) => String(log.date).slice(0, 10) === todayISO),
    [weeklyLogs, todayISO],
  )

  const weekWindow = useMemo(() => {
    const keys = new Set()
    const [yy, mm, dd] = todayISO.split("-").map(Number)
    const today = new Date(yy, mm - 1, dd)
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      keys.add(getLocalDateISO(d))
    }
    return keys
  }, [todayISO])

  const financeWeek = useMemo(() => {
    let spent = 0
    let days = 0
    weeklyLogs.forEach((log) => {
      const d = String(log.date).slice(0, 10)
      if (weekWindow.has(d)) {
        spent += Number(log.money_spent || 0)
        days += 1
      }
    })
    return { spent, daysWithLog: days }
  }, [weeklyLogs, weekWindow])

  const baselineIncome = USER_MEMORY_PROFILE_JSON.finances.monthlyIncome

  const laneCounts = useMemo(() => {
    const c = { todo: 0, doing: 0, done: 0 }
    saasTasks.forEach((t) => {
      const lane = t.lane || "todo"
      if (c[lane] !== undefined) c[lane] += 1
    })
    return c
  }, [saasTasks])

  const activeTasks = useMemo(() => {
    const pick = saasTasks.filter((t) => t.lane === "todo" || t.lane === "doing")
    return pick.slice(0, 8)
  }, [saasTasks])

  const unreadInbox = assistantMessages.filter((m) => !m.read).length
  const latestAutomation = automationEvents[0]

  return (
    <Card className="border-primary/20 bg-gradient-to-b from-card to-muted/20">
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <CardTitle className="text-lg">Live monitor</CardTitle>
          </div>
          <CardDescription>
            Tasks, cash tracked in logs, notes, and signals — auto-refresh every 2 min when tab visible (data only).
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <Radio className="size-3.5 text-emerald-400" aria-hidden />
            <span>Sync {formatTime(lastSync)}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={refreshing}
            onClick={manualRefresh}
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        {/* Tasks */}
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ListTodo className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">SaaS tasks</h3>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link to="/saas">
                Board <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
          <div className="flex gap-2">
            {LANES.map(({ id, label }) => (
              <div key={id} className="flex-1 rounded-xl bg-background/60 px-2 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold tabular-nums">{laneCounts[id]}</p>
              </div>
            ))}
          </div>
          <ul className="space-y-1.5 text-sm">
            {activeTasks.length === 0 ? (
              <li className="text-xs text-muted-foreground">No active tasks in Todo/Doing.</li>
            ) : (
              activeTasks.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0">
                  <span className="line-clamp-2 min-w-0">{t.title}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">{t.lane}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Finance */}
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Finance (from logs)</h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">7-day spend (logged)</dt>
              <dd className="font-medium tabular-nums">R {financeWeek.spent.toFixed(0)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Days with log (7d)</dt>
              <dd className="tabular-nums">{financeWeek.daysWithLog}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Today logged</dt>
              <dd className="tabular-nums">
                {todayLog ? `R ${Number(todayLog.money_spent || 0).toFixed(0)}` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-border/50 pt-2 text-xs">
              <dt className="text-muted-foreground">Baseline (profile)</dt>
              <dd>R {baselineIncome.toLocaleString()}/mo</dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 flex-1 text-xs">
              <Link to="/today">Today</Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="h-8 flex-1 text-xs">
              <Link to="/finance">Finance</Link>
            </Button>
          </div>
        </div>

        {/* System + drafts */}
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">System &amp; drafts</h3>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Notes</span>
              <span className="font-medium">{notes.length}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Inbox className="size-3.5" /> Inbox unread
              </span>
              <span className="font-medium">{unreadInbox}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Automation events</span>
              <span className="font-medium">{automationEvents.length}</span>
            </li>
            {latestAutomation ? (
              <li className="border-t border-border/50 pt-2 text-xs text-muted-foreground">
                Latest: {latestAutomation.action_type || latestAutomation.event_type || "event"}
              </li>
            ) : null}
          </ul>
          <div className="rounded-xl border border-dashed border-border/60 bg-background/40 p-2 text-xs">
            <p className="font-medium text-foreground">Today draft (not saved)</p>
            <p className="mt-1 line-clamp-2 text-muted-foreground">
              {todayTask.trim() || "No main task typed on Today yet."}
            </p>
            <p className="mt-1 text-muted-foreground">
              Spend draft: {metrics.moneySpent !== "" ? `R ${metrics.moneySpent}` : "—"} · Deep work:{" "}
              {metrics.deepWorkHours !== "" ? `${metrics.deepWorkHours}h` : "—"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 flex-1 text-xs">
              <Link to="/notes">Notes</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 flex-1 text-xs">
              <Link to="/inbox">
                <Inbox className="size-3.5" /> Inbox
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
