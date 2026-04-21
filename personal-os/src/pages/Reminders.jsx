import { useEffect, useMemo, useState } from "react"
import { AlarmClock, ArrowRight, LoaderCircle, Trash2 } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"

function formatRemindAt(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return String(iso)
  }
}

function sortReminders(list) {
  const open = list.filter((r) => !r.done)
  const done = list.filter((r) => r.done)
  const byTime = (a, b) => {
    const ta = a.remind_at ? new Date(a.remind_at).getTime() : Number.POSITIVE_INFINITY
    const tb = b.remind_at ? new Date(b.remind_at).getTime() : Number.POSITIVE_INFINITY
    if (ta !== tb) return ta - tb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }
  open.sort(byTime)
  done.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return [...open, ...done]
}

export default function Reminders() {
  const reminders = useStore((s) => s.reminders)
  const isLoadingReminders = useStore((s) => s.isLoadingReminders)
  const hydrateReminders = useStore((s) => s.hydrateReminders)
  const addReminder = useStore((s) => s.addReminder)
  const patchReminder = useStore((s) => s.patchReminder)
  const removeReminder = useStore((s) => s.removeReminder)

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [remindLocal, setRemindLocal] = useState("")
  const [status, setStatus] = useState("")
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    hydrateReminders().then((r) => {
      if (!r.ok) setStatus(r.message || "Could not load reminders.")
    })
  }, [hydrateReminders])

  const sorted = useMemo(() => sortReminders(reminders), [reminders])

  async function onAdd(e) {
    e.preventDefault()
    setStatus("")
    const remindAt =
      remindLocal.trim() === ""
        ? null
        : (() => {
            const d = new Date(remindLocal)
            return Number.isNaN(d.getTime()) ? null : d.toISOString()
          })()
    const result = await addReminder({ title, body, remindAt })
    setStatus(result.ok ? "" : result.message)
    if (result.ok) {
      setTitle("")
      setBody("")
      setRemindLocal("")
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Persistent</p>
        <h1 className="mt-2 text-2xl font-semibold">Reminders</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Stored in Supabase — survives refresh and other devices once the table exists.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlarmClock className="size-5 text-primary" />
            Add reminder
          </CardTitle>
          <CardDescription>Optional date &amp; time — leave blank for a timeless note.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onAdd}>
            <div className="space-y-2">
              <Label htmlFor="rem-title">Title</Label>
              <Input
                id="rem-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Pay rent, call dentist…"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rem-body">Notes</Label>
              <Textarea
                id="rem-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Optional details"
                rows={3}
                className="resize-y min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rem-when">Remind at (local)</Label>
              <Input
                id="rem-when"
                type="datetime-local"
                value={remindLocal}
                onChange={(e) => setRemindLocal(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              Save reminder
            </Button>
            {status ? <p className="text-sm text-amber-300">{status}</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your reminders</CardTitle>
          <CardDescription>Open items first (by due time), then completed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoadingReminders ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Loading…
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminders yet. Add one above.</p>
          ) : (
            sorted.map((r) => {
              const overdue = !r.done && r.remind_at && new Date(r.remind_at) < new Date()
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-start sm:justify-between",
                    r.done && "opacity-60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-xs",
                          r.done ? "bg-primary text-primary-foreground" : "bg-background",
                        )}
                        onClick={() => patchReminder(r.id, { done: !r.done })}
                        aria-label={r.done ? "Mark not done" : "Mark done"}
                      >
                        {r.done ? "✓" : ""}
                      </button>
                      <p className={cn("font-medium", r.done && "line-through")}>{r.title}</p>
                      {overdue ? (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-200">
                          Overdue
                        </span>
                      ) : null}
                      {r.remind_at && !r.done ? (
                        <span className="text-xs text-muted-foreground">{formatRemindAt(r.remind_at)}</span>
                      ) : null}
                    </div>
                    {r.body ? <p className="mt-2 text-sm text-muted-foreground">{r.body}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 self-end sm:self-start"
                    disabled={pendingId === r.id}
                    onClick={async () => {
                      setPendingId(r.id)
                      await removeReminder(r.id)
                      setPendingId(null)
                    }}
                    aria-label="Delete reminder"
                  >
                    {pendingId === r.id ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Button asChild variant="outline" className="w-full gap-2">
        <Link to="/">
          Back to Dashboard <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  )
}
