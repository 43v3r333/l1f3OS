import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, FileSpreadsheet, LayoutGrid, LoaderCircle, RefreshCw } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { parseDelimitedTable, rowsToObjects } from "@/lib/userProfileSheet"
import { fetchProfileSheetFromServer } from "@/services/profileSheetApi"
import { cn } from "@/lib/utils"

const REMOTE_URL = (import.meta.env.VITE_USER_PROFILE_SHEET_URL || "").trim()

export default function ProfileDashboard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [formatWarning, setFormatWarning] = useState("")
  const [pathHint, setPathHint] = useState("")
  const [search, setSearch] = useState("")
  const [sectionFilter, setSectionFilter] = useState("all")

  const load = useCallback(async () => {
    setError("")
    setLoading(true)
    try {
      const data = await fetchProfileSheetFromServer()
      setPathHint(data.path || "")
      setFormatWarning(typeof data.formatWarning === "string" ? data.formatWarning : "")
      const text = data.content ?? ""
      if (!text.trim() || data.isBinaryExcel) {
        setRows([])
        return
      }
      const { headers, rows: rawRows } = parseDelimitedTable(text)
      setRows(rowsToObjects(headers, rawRows))
    } catch (e) {
      setError(e.message || "Could not load profile sheet.")
      setRows([])
      setFormatWarning("")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sections = useMemo(() => {
    const set = new Set()
    for (const r of rows) {
      const s = String(r.section || "").trim()
      if (s) set.add(s)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const stats = useMemo(() => {
    const emptyValue = rows.filter((r) => !String(r.value ?? "").trim()).length
    const secSet = new Set(rows.map((r) => String(r.section || "").trim()).filter(Boolean))
    return {
      total: rows.length,
      sections: secSet.size,
      emptyValue,
    }
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (sectionFilter !== "all" && String(r.section || "").trim() !== sectionFilter) return false
      if (!q) return true
      return [r.section, r.key, r.value].some((cell) => String(cell ?? "").toLowerCase().includes(q))
    })
  }, [rows, search, sectionFilter])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-8">
      <header className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <LayoutGrid className="size-6 shrink-0 text-primary" aria-hidden />
            Profile CSV dashboard
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Browse every <code className="rounded bg-muted px-1 text-[11px]">section,key,value</code> row from your
            profile sheet. Edit the raw file on{" "}
            <Link to="/profile-sheet" className="text-primary underline-offset-4 hover:underline">
              Profile
            </Link>
            .
          </p>
          {REMOTE_URL ? (
            <p className="text-xs text-amber-200/90">
              <code className="break-all rounded bg-muted/50 px-1 text-[11px] text-foreground">{REMOTE_URL}</code> —
              Life Manager may load this remote CSV; the server file below can be empty.
            </p>
          ) : null}
          {pathHint ? (
            <p className="text-[11px] text-muted-foreground">
              Server path: <span className="break-all font-mono">{pathHint}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => load()}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Reload
          </Button>
          <Button type="button" size="sm" asChild>
            <Link to="/profile-sheet" className="inline-flex items-center gap-2">
              <FileSpreadsheet className="size-4" />
              Edit CSV
            </Link>
          </Button>
        </div>
      </header>

      {formatWarning ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertCircle className="size-4" />
              Profile file issue
            </CardTitle>
            <CardDescription className="text-muted-foreground">{formatWarning}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading profile…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Data rows</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">{stats.total}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sections</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">{stats.sections}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Empty values</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums text-amber-200/90">{stats.emptyValue}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filter and search</CardTitle>
              <CardDescription>Client-side filter over {rows.length} parsed rows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search section, key, or value…"
                className="max-w-md"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={sectionFilter === "all" ? "secondary" : "outline"}
                  onClick={() => setSectionFilter("all")}
                >
                  All sections
                </Button>
                {sections.map((sec) => (
                  <Button
                    key={sec}
                    type="button"
                    size="sm"
                    variant={sectionFilter === sec ? "secondary" : "outline"}
                    onClick={() => setSectionFilter(sec)}
                  >
                    {sec}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">All entries ({filtered.length})</CardTitle>
              <CardDescription>Showing rows that match the current filter.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rows to show.</p>
              ) : (
                <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/80">
                      <th className="p-2 pr-3 font-medium text-muted-foreground">#</th>
                      <th className="p-2 pr-4 font-medium text-muted-foreground">section</th>
                      <th className="p-2 pr-4 font-medium text-muted-foreground">key</th>
                      <th className="p-2 font-medium text-muted-foreground">value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => (
                      <tr
                        key={`${row.section}-${row.key}-${i}`}
                        className="border-b border-border/40 align-top hover:bg-muted/30"
                      >
                        <td className="p-2 pr-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                        <td className="p-2 pr-4 font-mono text-xs text-muted-foreground">{row.section}</td>
                        <td className="p-2 pr-4 font-mono text-xs">{row.key}</td>
                        <td className="p-2 text-xs leading-snug whitespace-pre-wrap break-words">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
