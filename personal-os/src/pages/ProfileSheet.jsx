import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Check, FileSpreadsheet, LoaderCircle, RefreshCw, RotateCcw, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  ensureUserProfileSheetLoaded,
  parseDelimitedTable,
  resetProfileSheetCacheForTests,
  rowsToObjects,
  validateProfileSheetCsv,
} from "@/lib/userProfileSheet"
import {
  fetchProfileSheetFromServer,
  restoreProfileSheetDefaultOnServer,
  saveProfileSheetToServer,
} from "@/services/profileSheetApi"
import { cn } from "@/lib/utils"

const REMOTE_URL = (import.meta.env.VITE_USER_PROFILE_SHEET_URL || "").trim()

export default function ProfileSheet() {
  const [tab, setTab] = useState("preview")
  const [content, setContent] = useState("")
  const [pathHint, setPathHint] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [formatWarning, setFormatWarning] = useState("")
  const [restoring, setRestoring] = useState(false)

  const remoteBlocked = Boolean(REMOTE_URL)

  const load = useCallback(async () => {
    setError("")
    setSuccess("")
    setLoading(true)
    try {
      const data = await fetchProfileSheetFromServer()
      setContent(data.content ?? "")
      setPathHint(data.path || "")
      setFormatWarning(typeof data.formatWarning === "string" ? data.formatWarning : "")
    } catch (e) {
      setError(e.message || "Could not load profile sheet.")
      setContent("")
      setFormatWarning("")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const parsed = useMemo(() => {
    if (!content.trim()) return { rows: [], headers: [] }
    try {
      const { headers, rows } = parseDelimitedTable(content)
      const objs = rowsToObjects(headers, rows)
      return { headers, rows: objs }
    } catch {
      return { rows: [], headers: [], parseError: true }
    }
  }, [content])

  async function handleSave() {
    setError("")
    setSuccess("")
    if (remoteBlocked) {
      setError("Remote URL is configured — save is disabled. Edit the Google Sheet or unset VITE_USER_PROFILE_SHEET_URL.")
      return
    }
    if (!validateProfileSheetCsv(content)) {
      setError("CSV must include a header row: section,key,value")
      return
    }
    setSaving(true)
    try {
      await saveProfileSheetToServer(content)
      resetProfileSheetCacheForTests()
      await ensureUserProfileSheetLoaded({ force: true })
      setSuccess("Saved. Life Manager will use this on the next Generate.")
    } catch (e) {
      setError(e.message || "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  async function handleRestoreDefault() {
    setError("")
    setSuccess("")
    if (remoteBlocked) {
      setError("Remote URL is configured — restore is disabled. Unset VITE_USER_PROFILE_SHEET_URL.")
      return
    }
    setRestoring(true)
    try {
      const data = await restoreProfileSheetDefaultOnServer()
      setContent(data.content ?? "")
      setFormatWarning("")
      setPathHint(data.path || "")
      resetProfileSheetCacheForTests()
      await ensureUserProfileSheetLoaded({ force: true })
      setSuccess("Restored the default CSV template from disk. Review, edit, then Save & apply.")
    } catch (e) {
      setError(e.message || "Restore failed.")
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-8">
      <header className="flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <FileSpreadsheet className="size-6 shrink-0 text-primary" aria-hidden />
            Profile sheet
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            View and edit the CSV that seeds Life Manager. Saving updates{" "}
            <code className="rounded bg-muted px-1 text-[11px]">public/user-profile-sheet.csv</code> via the AI proxy
            (requires <code className="rounded bg-muted px-1 text-[11px]">npm run dev:server</code>). If you use Excel,
            use <strong className="font-medium text-foreground">File → Save As → CSV UTF-8</strong> — never rename a
            <code className="mx-0.5 rounded bg-muted px-1 text-[11px]">.xlsx</code> to
            <code className="rounded bg-muted px-1 text-[11px]">.csv</code>.
          </p>
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={restoring || loading || remoteBlocked}
            onClick={() => handleRestoreDefault()}
          >
            {restoring ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Restore template
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || loading || remoteBlocked}
            onClick={() => handleSave()}
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save &amp; apply
          </Button>
        </div>
      </header>

      {REMOTE_URL ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-200">
              <AlertCircle className="size-4" />
              Remote sheet active
            </CardTitle>
            <CardDescription className="text-amber-100/80">
              <code className="break-all rounded bg-muted/50 px-1 text-[11px] text-foreground">{REMOTE_URL}</code>
              <br />
              Life Manager loads this URL, not the local file. Saving here is disabled. Edit the published sheet or
              remove <code className="text-[11px]">VITE_USER_PROFILE_SHEET_URL</code> to use local CSV.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {formatWarning ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertCircle className="size-4" />
              Wrong file format
            </CardTitle>
            <CardDescription className="text-muted-foreground">{formatWarning}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={restoring || remoteBlocked}
              onClick={() => handleRestoreDefault()}
            >
              {restoring ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Overwrite with default CSV
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <Check className="size-4 shrink-0" />
          {success}
        </p>
      ) : null}

      <div className="flex gap-2 rounded-xl border border-border/60 bg-muted/20 p-1">
        <Button type="button" size="sm" variant={tab === "preview" ? "secondary" : "ghost"} onClick={() => setTab("preview")}>
          Preview table
        </Button>
        <Button type="button" size="sm" variant={tab === "edit" ? "secondary" : "ghost"} onClick={() => setTab("edit")}>
          Edit CSV
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading…
        </div>
      ) : tab === "edit" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Raw CSV</CardTitle>
            <CardDescription>
              Keep the <code className="text-[11px]">section,key,value</code> header. Lines starting with{" "}
              <code className="text-[11px]">#</code> are comments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[32rem] font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parsed rows ({parsed.rows.length})</CardTitle>
            <CardDescription>Read-only view of the same data as in the editor.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {parsed.parseError ? (
              <p className="text-sm text-destructive">Could not parse CSV.</p>
            ) : (
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/80">
                    <th className="p-2 pr-4 font-medium text-muted-foreground">section</th>
                    <th className="p-2 pr-4 font-medium text-muted-foreground">key</th>
                    <th className="p-2 font-medium text-muted-foreground">value</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row, i) => (
                    <tr key={`${row.section}-${row.key}-${i}`} className="border-b border-border/40 align-top">
                      <td className="p-2 pr-4 font-mono text-xs text-muted-foreground">{row.section}</td>
                      <td className="p-2 pr-4 font-mono text-xs">{row.key}</td>
                      <td className="p-2 text-xs leading-snug">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
