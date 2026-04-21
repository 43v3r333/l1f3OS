import { useMemo } from "react"
import { AlarmClock, ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useStore } from "@/store/useStore"

function formatShort(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch {
    return "—"
  }
}

export default function DashboardRemindersStrip() {
  const reminders = useStore((s) => s.reminders)
  const patchReminder = useStore((s) => s.patchReminder)

  const upcoming = useMemo(() => {
    const open = reminders.filter((r) => !r.done)
    const byTime = (a, b) => {
      const ta = a.remind_at ? new Date(a.remind_at).getTime() : Number.POSITIVE_INFINITY
      const tb = b.remind_at ? new Date(b.remind_at).getTime() : Number.POSITIVE_INFINITY
      return ta - tb
    }
    return [...open].sort(byTime).slice(0, 4)
  }, [reminders])

  return (
    <Card className="border-primary/15">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlarmClock className="size-5 text-primary" />
            Reminders
          </CardTitle>
          <CardDescription>Next open items — full list on Reminders.</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-1">
          <Link to="/reminders">
            All <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open reminders. Add one on the Reminders page.</p>
        ) : (
          upcoming.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm"
            >
              <button
                type="button"
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-border bg-background text-[10px]"
                onClick={() => patchReminder(r.id, { done: true })}
                aria-label="Mark done"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight">{r.title}</p>
                <p className="text-xs text-muted-foreground">{formatShort(r.remind_at)}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
