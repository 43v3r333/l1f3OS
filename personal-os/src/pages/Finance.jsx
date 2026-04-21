import { useCallback, useEffect, useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  ArrowRight,
  Calendar,
  LoaderCircle,
  PiggyBank,
  Plus,
  TrendingDown,
  Trash2,
  Wallet,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { USER_MEMORY_PROFILE_JSON } from "@/lib/lifeManagerUserProfile"
import { fetchLifeManagerMemory, upsertLifeManagerMemory } from "@/services/supabase"
import { useStore } from "@/store/useStore"
import { cn, getLocalDateISO } from "@/lib/utils"

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function newLineId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}

function parseFinanceSettings(raw) {
  const parsed =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? (() => {
            try {
              return JSON.parse(raw)
            } catch {
              return null
            }
          })()
        : null
  return parsed
}

export default function Finance() {
  const weeklyLogs = useStore((s) => s.weeklyLogs)
  const isLoadingWeekly = useStore((s) => s.isLoadingWeekly)
  const hydrateWeeklyLogs = useStore((s) => s.hydrateWeeklyLogs)
  const updateDailyLogEntry = useStore((s) => s.updateDailyLogEntry)
  const quickLogSpendForDate = useStore((s) => s.quickLogSpendForDate)

  const profileIncome = USER_MEMORY_PROFILE_JSON.finances.monthlyIncome
  const profileDiscretionary = USER_MEMORY_PROFILE_JSON.finances.discretionaryAfterFixedApprox

  const [incomeInput, setIncomeInput] = useState(() => String(profileIncome))
  const [budgetInput, setBudgetInput] = useState(() => String(profileDiscretionary))
  const [expenseLines, setExpenseLines] = useState(() => [{ id: newLineId(), label: "", amount: "" }])
  const [planMessage, setPlanMessage] = useState("")
  const [quickDate, setQuickDate] = useState(() => getLocalDateISO())
  const [quickAmount, setQuickAmount] = useState("")
  const [quickMessage, setQuickMessage] = useState("")
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    hydrateWeeklyLogs()
    fetchLifeManagerMemory()
      .then(({ map }) => {
        const parsed = parseFinanceSettings(map.life_manager_finance_settings)
        if (parsed?.monthlyIncome != null && parsed.monthlyIncome !== "") {
          setIncomeInput(String(parsed.monthlyIncome))
        } else {
          setIncomeInput(String(profileIncome))
        }
        if (parsed?.monthlyBudget != null && parsed.monthlyBudget !== "") {
          setBudgetInput(String(parsed.monthlyBudget))
        } else {
          setBudgetInput(String(profileDiscretionary))
        }
        const rawLines = parsed?.expenseLines
        if (Array.isArray(rawLines) && rawLines.length > 0) {
          setExpenseLines(
            rawLines.map((row, i) => ({
              id: row.id || `loaded-${i}`,
              label: String(row.label ?? ""),
              amount: row.amount != null && row.amount !== "" ? String(row.amount) : "",
            })),
          )
        } else {
          setExpenseLines([{ id: newLineId(), label: "", amount: "" }])
        }
      })
      .catch(() => {
        setIncomeInput(String(profileIncome))
        setBudgetInput(String(profileDiscretionary))
        setExpenseLines([{ id: newLineId(), label: "", amount: "" }])
      })
  }, [hydrateWeeklyLogs, profileDiscretionary, profileIncome])

  const { weekSpent, monthSpent, avgDaily30 } = useMemo(() => {
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const weekKeys = new Set()
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      weekKeys.add(getLocalDateISO(d))
    }

    let w = 0
    let m = 0
    const last30 = []
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      last30.push(getLocalDateISO(d))
    }

    weeklyLogs.forEach((log) => {
      const d = String(log.date).slice(0, 10)
      const amt = toNum(log.money_spent)
      if (weekKeys.has(d)) w += amt
      if (String(log.date).slice(0, 7) === monthPrefix) m += amt
    })

    const thirtySum = weeklyLogs.reduce((sum, log) => {
      const d = String(log.date).slice(0, 10)
      if (last30.includes(d)) return sum + toNum(log.money_spent)
      return sum
    }, 0)
    const avg = thirtySum / 30

    return { weekSpent: w, monthSpent: m, avgDaily30: avg }
  }, [weeklyLogs])

  const chart30 = useMemo(() => {
    const end = new Date()
    const rows = []
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(end)
      d.setDate(d.getDate() - i)
      const key = getLocalDateISO(d)
      const log = weeklyLogs.find((l) => String(l.date).slice(0, 10) === key)
      rows.push({
        key,
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        spend: toNum(log?.money_spent),
      })
    }
    return rows
  }, [weeklyLogs])

  const monthlyBudget = toNum(budgetInput)
  const monthlyIncomeSaved = toNum(incomeInput)
  const fixedExpensesTotal = expenseLines.reduce((sum, row) => sum + toNum(row.amount), 0)
  const surplusAfterFixed = monthlyIncomeSaved - fixedExpensesTotal

  const dayBudget = monthlyBudget > 0 ? monthlyBudget / 30 : 0
  const monthPct = monthlyBudget > 0 ? Math.min(100, Math.round((monthSpent / monthlyBudget) * 100)) : null

  const saveMonthlyPlan = useCallback(async () => {
    setPlanMessage("")
    const budgetN = toNum(budgetInput)
    const incomeN = toNum(incomeInput)
    if (!Number.isFinite(budgetN) || budgetN < 0) {
      setPlanMessage("Enter a valid monthly budget (spend cap / target).")
      return
    }
    if (!Number.isFinite(incomeN) || incomeN < 0) {
      setPlanMessage("Enter a valid monthly income.")
      return
    }
    const lines = expenseLines
      .map((row) => ({
        id: row.id,
        label: row.label.trim(),
        amount: toNum(row.amount),
      }))
      .filter((row) => row.label.length > 0 || row.amount > 0)

    try {
      await upsertLifeManagerMemory("life_manager_finance_settings", {
        monthlyBudget: budgetN,
        monthlyIncome: incomeN,
        expenseLines: lines,
      })
      setPlanMessage("Income, budget, and expense lines saved to Supabase.")
    } catch (e) {
      setPlanMessage(e.message || "Could not save.")
    }
  }, [budgetInput, incomeInput, expenseLines])

  const addExpenseLine = useCallback(() => {
    setExpenseLines((prev) => [...prev, { id: newLineId(), label: "", amount: "" }])
  }, [])

  const removeExpenseLine = useCallback((id) => {
    setExpenseLines((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }, [])

  const updateExpenseLine = useCallback((id, field, value) => {
    setExpenseLines((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }, [])

  const onQuickSubmit = async (e) => {
    e.preventDefault()
    setQuickMessage("")
    const result = await quickLogSpendForDate({ dateISO: quickDate, moneySpent: quickAmount })
    setQuickMessage(result.ok ? "Saved to daily_logs." : result.message)
    if (result.ok) setQuickAmount("")
  }

  const commitSpend = async (id, raw) => {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return
    setPendingId(id)
    await updateDailyLogEntry(id, { moneySpent: n })
    setPendingId(null)
  }

  const sortedLogs = useMemo(
    () => [...weeklyLogs].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [weeklyLogs],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cash &amp; logs</p>
          <h1 className="mt-2 text-2xl font-semibold">Finance</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Daily spend lives in <code className="rounded bg-muted px-1 text-[11px]">daily_logs</code> — same data as{" "}
            <Link className="text-primary underline-offset-4 hover:underline" to="/today">
              Today
            </Link>
            . Edits here sync everywhere.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto">
          <Link to="/today">
            Open Today <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="size-4 text-primary" />
              This week
            </CardTitle>
            <CardDescription>Rolling 7 days (from your logs).</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">R {weekSpent.toFixed(0)}</p>
            {dayBudget > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                ~R {dayBudget.toFixed(0)}/day if budget spread over 30 days
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-4 text-primary" />
              This month
            </CardTitle>
            <CardDescription>Calendar month spend in logs.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">R {monthSpent.toFixed(0)}</p>
            {monthPct != null ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    monthPct > 100 ? "bg-amber-500" : "bg-primary",
                  )}
                  style={{ width: `${monthPct}%` }}
                />
              </div>
            ) : null}
            {monthlyBudget > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {monthPct}% of R {monthlyBudget.toLocaleString()} budget
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Set a monthly budget below.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="size-4 text-primary" />
              Signals
            </CardTitle>
            <CardDescription>30-day average · profile income (reference).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Avg / day (30d):</span>{" "}
              <span className="font-medium tabular-nums">R {avgDaily30.toFixed(0)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Monthly income (saved plan):</span>{" "}
              <span className="tabular-nums">R {monthlyIncomeSaved.toLocaleString()}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Profile default was R {profileIncome.toLocaleString()} — override in Monthly plan below.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Spend (30 days)</CardTitle>
            <CardDescription>Daily totals from Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingWeekly ? (
              <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height={256} minWidth={0}>
                  <BarChart data={chart30} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 11 }} width={36} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12 }}
                      formatter={(value) => [`R ${Number(value).toFixed(0)}`, "Spend"]}
                    />
                    <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              Monthly plan
            </CardTitle>
            <CardDescription>Income, spending budget, and fixed expense lines — saved together in Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="monthly-income">Monthly income (ZAR)</Label>
              <Input
                id="monthly-income"
                type="number"
                min="0"
                step="100"
                value={incomeInput}
                onChange={(e) => setIncomeInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly-budget">Monthly budget / spend target (ZAR)</Label>
              <Input
                id="monthly-budget"
                type="number"
                min="0"
                step="100"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Compared to actual spend in logs (chart &amp; “This month”).
              </p>
            </div>

            <div className="space-y-2 border-t border-border/50 pt-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-foreground">Fixed monthly expenses</Label>
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={addExpenseLine}>
                  <Plus className="size-3.5" />
                  Add line
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Rent, subscriptions, loan payments — totals below; does not change daily_logs.
              </p>
              <ul className="space-y-2">
                {expenseLines.map((row) => (
                  <li key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Label</span>
                      <Input
                        placeholder="e.g. Rent"
                        value={row.label}
                        onChange={(e) => updateExpenseLine(row.id, "label", e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 sm:w-40">
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</span>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          className="tabular-nums"
                          value={row.amount}
                          onChange={(e) => updateExpenseLine(row.id, "amount", e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 self-end"
                        onClick={() => removeExpenseLine(row.id)}
                        aria-label="Remove line"
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total fixed expenses</span>
                <span className="font-semibold tabular-nums">R {fixedExpensesTotal.toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <span className="text-muted-foreground">After fixed (income − fixed)</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    surplusAfterFixed < 0 ? "text-amber-400" : "text-emerald-400/90",
                  )}
                >
                  R {surplusAfterFixed.toLocaleString()}
                </span>
              </div>
            </div>

            <Button type="button" className="w-full" onClick={saveMonthlyPlan}>
              Save monthly plan
            </Button>
            {planMessage ? <p className="text-xs text-muted-foreground">{planMessage}</p> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick log</CardTitle>
            <CardDescription>Set spend for any day (creates a minimal row if needed).</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onQuickSubmit}>
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="q-date">Date</Label>
                  <Input
                    id="q-date"
                    type="date"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-amt">Amount (ZAR)</Label>
                  <Input
                    id="q-amt"
                    type="number"
                    min="0"
                    step="0.01"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <Button type="submit" className="sm:shrink-0">
                Save
              </Button>
            </form>
            {quickMessage ? <p className="mt-2 text-xs text-muted-foreground">{quickMessage}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent daily rows</CardTitle>
            <CardDescription>Edit spend inline — updates Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {sortedLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rows in the last 90 days. Log on Today or use Quick log.</p>
            ) : (
              sortedLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{log.main_task}</p>
                    <p className="text-xs text-muted-foreground">{String(log.date).slice(0, 10)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">R</span>
                    <Input
                      className="h-9 w-28 tabular-nums"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={toNum(log.money_spent)}
                      key={String(log.id) + String(log.money_spent)}
                      disabled={pendingId === log.id}
                      onBlur={(e) => {
                        if (e.target.value !== String(toNum(log.money_spent))) {
                          commitSpend(log.id, e.target.value)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur()
                      }}
                    />
                    {pendingId === log.id ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
