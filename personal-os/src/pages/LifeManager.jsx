import { useCallback, useEffect, useState } from "react"
import { Brain, Briefcase, Check, Dumbbell, Laptop, LoaderCircle, RefreshCw, Sparkles, Wallet, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import AiMarkdown from "@/components/AiMarkdown"
import { buildLiveOsSnapshotForAi } from "@/lib/liveOsSnapshot"
import { ensureUserProfileSheetLoaded } from "@/lib/userProfileSheet"
import { runFullLifeManagerPipeline } from "@/services/lifeManagerAi"
import { updateLifeManagerDigestFromApprove } from "@/services/lifeManagerDigestAi"
import { fetchLifeManagerMemory, upsertLifeManagerMemory } from "@/services/supabase"
import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"

const defaultCheckIn = {
  sessionType: "",
  shiftStatus: "",
  energyLevel: "",
  topPriority: "",
  whatsHappening: "",
  financialUpdate: "",
  startupUpdate: "",
  additionalContext: "",
}

const textareaClass = "min-h-[4.5rem] resize-y text-sm leading-snug"

const OUTPUT_SIZE_KEY = "lifeManagerOutputSize"

const aiOutputBodyBase =
  "min-h-0 w-full min-w-0 max-w-full overflow-y-auto break-words whitespace-pre-wrap text-foreground antialiased [overflow-wrap:anywhere]"

/** default = short bands; enlarged = bigger type + taller scroll areas */
const OUTPUT_SIZE_STYLES = {
  default: {
    body: "text-base leading-[1.7]",
    unified: "min-h-[6rem] max-h-[min(32vh,18rem)] sm:max-h-[min(34vh,19rem)] p-4 sm:p-5",
    specialist: "max-h-[min(11rem,26vh)] sm:max-h-[min(12rem,28vh)]",
    specialistPad: "p-3 sm:p-4",
    specialistHeader: "text-sm sm:text-[15px]",
  },
  enlarged: {
    body: "text-lg leading-[1.75]",
    unified: "min-h-[14rem] max-h-[min(58vh,42rem)] sm:max-h-[min(62vh,44rem)] p-6 sm:p-8",
    specialist: "max-h-[min(26rem,52vh)] sm:max-h-[min(30rem,58vh)]",
    specialistPad: "p-4 sm:p-5",
    specialistHeader: "text-base sm:text-lg",
  },
}

const SPECIALIST_SECTIONS = [
  { key: "lifePlan", label: "Life planner", icon: Sparkles },
  { key: "financeAnalysis", label: "Financial strategist", icon: Wallet },
  { key: "startupGuidance", label: "Startup builder", icon: Briefcase },
  { key: "workTasks", label: "Work mastery", icon: Laptop },
  { key: "coaching", label: "Execution coach", icon: Dumbbell },
]

function OutputSizeToggle({ value, onChange }) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Output size</span>
      <div className="flex rounded-xl border border-border/80 bg-muted/30 p-1">
        <Button
          type="button"
          size="sm"
          variant={value === "default" ? "secondary" : "ghost"}
          className="h-8 rounded-lg px-3 text-xs"
          onClick={() => onChange("default")}
        >
          Default
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value === "enlarged" ? "secondary" : "ghost"}
          className="h-8 rounded-lg px-3 text-xs"
          onClick={() => onChange("enlarged")}
        >
          Enlarged
        </Button>
      </div>
    </div>
  )
}

/** One tile in the specialist grid; scroll inside */
function SpecialistPanel({ label, icon, children, className, size = "default" }) {
  const Glyph = icon
  const st = OUTPUT_SIZE_STYLES[size] ?? OUTPUT_SIZE_STYLES.default
  return (
    <div
      className={cn(
        "flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-muted/20",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/50 px-3 py-2.5 sm:px-4 sm:py-3">
        <Glyph className="size-5 shrink-0 text-primary" aria-hidden />
        <h3
          className={cn(
            "line-clamp-2 font-semibold leading-snug text-foreground",
            st.specialistHeader,
          )}
        >
          {label}
        </h3>
      </div>
      <div className={cn(aiOutputBodyBase, st.specialistPad, st.specialist)}>
        <AiMarkdown className={cn(st.body)}>{children}</AiMarkdown>
      </div>
    </div>
  )
}

export default function LifeManager() {
  const hydrateAllCore = useStore((s) => s.hydrateAllCore)

  const [checkIn, setCheckIn] = useState(defaultCheckIn)
  const [memoryMap, setMemoryMap] = useState({})
  const [memoryRows, setMemoryRows] = useState([])
  const [memoryFound, setMemoryFound] = useState(false)
  const [memoryLoadError, setMemoryLoadError] = useState("")

  const [outputs, setOutputs] = useState(null)
  const [unifiedPlan, setUnifiedPlan] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [progressStatus, setProgressStatus] = useState("")

  const [adjustments, setAdjustments] = useState("")
  const [reviewDecision, setReviewDecision] = useState(null)
  const [saveStatus, setSaveStatus] = useState("")
  const [outputSize, setOutputSize] = useState(() => {
    try {
      const v = localStorage.getItem(OUTPUT_SIZE_KEY)
      return v === "enlarged" ? "enlarged" : "default"
    } catch {
      return "default"
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(OUTPUT_SIZE_KEY, outputSize)
    } catch {
      /* ignore */
    }
  }, [outputSize])

  const loadMemory = useCallback(async () => {
    setMemoryLoadError("")
    try {
      const { map, rows } = await fetchLifeManagerMemory()
      setMemoryMap(map)
      setMemoryRows(rows ?? [])
      setMemoryFound(Object.keys(map).length > 0)
    } catch (e) {
      setMemoryLoadError(e.message)
      setMemoryMap({})
      setMemoryRows([])
      setMemoryFound(false)
    }
  }, [])

  useEffect(() => {
    loadMemory()
  }, [loadMemory])

  useEffect(() => {
    hydrateAllCore()
    ensureUserProfileSheetLoaded()
  }, [hydrateAllCore])

  async function handleGenerate() {
    setError("")
    setOutputs(null)
    setUnifiedPlan("")
    setReviewDecision(null)
    setSaveStatus("")
    setProgressStatus("Starting AI pipeline...")
    setLoading(true)
    try {
      await ensureUserProfileSheetLoaded({ force: true })
      const liveSnapshotText = buildLiveOsSnapshotForAi(useStore.getState())
      const result = await runFullLifeManagerPipeline(
        checkIn,
        memoryMap,
        memoryFound,
        setProgressStatus,
        liveSnapshotText,
        memoryRows,
      )
      setOutputs(result)
      setUnifiedPlan(result.unifiedPlan)
      setProgressStatus("Plan generated.")
    } catch (e) {
      setError(e.message || "Generation failed.")
      setProgressStatus("")
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    if (!outputs) return
    setReviewDecision("approved")
    setSaveStatus("Saving...")
    try {
      const ts = new Date()
      const sessionKey = `life_manager_session_${ts.toISOString().replace(/[:.]/g, "-").slice(0, 19)}`
      const sessionRecord = {
        timestamp: ts.toISOString(),
        session_type: checkIn.sessionType,
        plan_summary: (outputs.unifiedPlan || "").slice(0, 500),
        financial_notes: (outputs.financeAnalysis || "").slice(0, 300),
        startup_notes: (outputs.startupGuidance || "").slice(0, 300),
        adjustments: adjustments.trim() || "",
      }
      await upsertLifeManagerMemory(sessionKey, sessionRecord)

      const goalsSnapshot = {
        last_updated: ts.toISOString(),
        current_priority: checkIn.topPriority,
        latest_plan_summary: (outputs.unifiedPlan || "").slice(0, 800),
      }
      await upsertLifeManagerMemory("life_manager_goals_current", goalsSnapshot)

      const digestResult = await updateLifeManagerDigestFromApprove({
        memoryMap,
        sessionKey,
        sessionRecord,
        outputs,
      })
      setSaveStatus(
        `Plan approved and saved to memory. Goals snapshot updated.${digestResult.ok ? " Rolling AI digest updated." : ""}`,
      )
      await loadMemory()
    } catch (e) {
      setSaveStatus(e.message || "Save failed.")
    }
  }

  function handleReject() {
    setReviewDecision("rejected")
    setSaveStatus("Rejected. Adjust inputs and generate again.")
  }

  function setField(key, value) {
    setCheckIn((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="w-full space-y-3 pb-6 md:space-y-4">
      {/* Portrait column on phone; full width on md+ */}
      <div className="mx-auto w-full max-w-md sm:max-w-none">
        <header className="flex flex-col gap-1 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-0 sm:pb-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">AI Life Manager</p>
            <h1 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
              <Brain className="size-5 shrink-0 text-primary sm:size-6" />
              <span className="truncate">Unified intelligence</span>
            </h1>
          </div>
          <p className="max-w-xl text-xs text-muted-foreground sm:text-right sm:text-sm">
            Check in, generate, review. Wide layout on desktop; compact on mobile.
          </p>
        </header>

        {memoryLoadError ? (
          <p className="mt-2 text-xs text-amber-300 sm:text-sm">
            Memory load: {memoryLoadError} — create table{" "}
            <code className="text-[10px] sm:text-xs">life_manager_memory</code> per README.
          </p>
        ) : null}
      </div>

      <div
        className={
          outputs ? "grid gap-4 lg:grid-cols-12 lg:gap-6 lg:items-start" : "grid gap-4 xl:grid-cols-1"
        }
      >
        {/* Check-in: portrait column on phone; full row when solo desktop; 5/12 when plan is shown */}
        <Card
          className={
            outputs
              ? "mx-auto w-full max-w-md border-border/80 lg:col-span-5 lg:mx-0 lg:max-w-none"
              : "mx-auto w-full max-w-md border-border/80 xl:mx-0 xl:max-w-none xl:w-full"
          }
        >
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-base">Daily check-in</CardTitle>
            <CardDescription className="text-xs">Session, shift, updates — keep it tight.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div
              className={cn(
                "space-y-3",
                !outputs && "xl:grid xl:grid-cols-2 xl:gap-6 xl:items-start",
              )}
            >
              <div className={cn("space-y-3", !outputs && "xl:sticky xl:top-24")}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="session-type" className="text-xs">
                      Session
                    </Label>
                    <Input
                      id="session-type"
                      className="h-9 text-sm"
                      value={checkIn.sessionType}
                      onChange={(e) => setField("sessionType", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="shift" className="text-xs">
                      Shift
                    </Label>
                    <Input
                      id="shift"
                      className="h-9 text-sm"
                      value={checkIn.shiftStatus}
                      onChange={(e) => setField("shiftStatus", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5 sm:col-span-1">
                    <Label htmlFor="energy" className="text-xs">
                      Energy 1–10
                    </Label>
                    <Input
                      id="energy"
                      className="h-9 text-sm"
                      inputMode="numeric"
                      value={checkIn.energyLevel}
                      onChange={(e) => setField("energyLevel", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="priority" className="text-xs">
                    #1 priority
                  </Label>
                  <Input
                    id="priority"
                    className="h-9 text-sm"
                    value={checkIn.topPriority}
                    onChange={(e) => setField("topPriority", e.target.value)}
                  />
                </div>
              </div>

              <div
                className={cn(
                  "grid gap-3 xl:gap-3",
                  outputs ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-1",
                )}
              >
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="happening" className="text-xs">
                    Right now
                  </Label>
                  <Textarea
                    id="happening"
                    rows={2}
                    className={textareaClass}
                    value={checkIn.whatsHappening}
                    onChange={(e) => setField("whatsHappening", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="financial" className="text-xs">
                    Financial
                  </Label>
                  <Textarea
                    id="financial"
                    rows={2}
                    className={textareaClass}
                    value={checkIn.financialUpdate}
                    onChange={(e) => setField("financialUpdate", e.target.value)}
                    placeholder="Line items..."
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="startup" className="text-xs">
                    Startup
                  </Label>
                  <Textarea
                    id="startup"
                    rows={2}
                    className={textareaClass}
                    value={checkIn.startupUpdate}
                    onChange={(e) => setField("startupUpdate", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="extra" className="text-xs">
                    Extra context
                  </Label>
                  <Textarea
                    id="extra"
                    rows={2}
                    className={textareaClass}
                    value={checkIn.additionalContext}
                    onChange={(e) => setField("additionalContext", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Button type="button" className="h-10 w-full" disabled={loading} onClick={handleGenerate}>
              {loading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Running agents...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  Generate unified plan
                </>
              )}
            </Button>
            {loading && progressStatus ? (
              <p className="text-xs text-amber-300 sm:text-sm">{progressStatus}</p>
            ) : null}
            {error ? <p className="text-xs text-red-400 sm:text-sm">{error}</p> : null}
          </CardContent>
        </Card>

        {/* Results: unified + review in right column; specialist row is full-width below */}
        {outputs ? (
          <>
            <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
              <Card className="min-w-0 overflow-hidden border-border/80">
                <CardHeader className="flex flex-col gap-3 border-b border-border/50 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg font-semibold tracking-tight">Unified action plan</CardTitle>
                    <CardDescription className="text-sm">
                      {outputSize === "enlarged"
                        ? "Enlarged — bigger text and taller panel."
                        : "Default — compact band; scroll inside."}
                    </CardDescription>
                  </div>
                  <OutputSizeToggle value={outputSize} onChange={setOutputSize} />
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    className={cn(
                      aiOutputBodyBase,
                      "border-t border-border/30 bg-muted/15",
                      (OUTPUT_SIZE_STYLES[outputSize] ?? OUTPUT_SIZE_STYLES.default).unified,
                    )}
                  >
                    <AiMarkdown
                      className={(OUTPUT_SIZE_STYLES[outputSize] ?? OUTPUT_SIZE_STYLES.default).body}
                    >
                      {unifiedPlan}
                    </AiMarkdown>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80 lg:sticky lg:top-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Review &amp; save</CardTitle>
                  <CardDescription className="text-xs">Approve to persist to Supabase memory.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1.5">
                    <Label htmlFor="adj" className="text-xs">
                      Adjustments (optional)
                    </Label>
                    <Textarea
                      id="adj"
                      rows={2}
                      className={textareaClass}
                      value={adjustments}
                      onChange={(e) => setAdjustments(e.target.value)}
                      placeholder="Tweaks before saving..."
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={handleApprove} disabled={reviewDecision === "approved"}>
                      <Check className="size-4" />
                      Approve &amp; save
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={handleReject}>
                      <X className="size-4" />
                      Reject
                    </Button>
                  </div>
                  {saveStatus ? <p className="text-xs text-emerald-400 sm:text-sm">{saveStatus}</p> : null}
                  {reviewDecision === "rejected" ? (
                    <p className="text-xs text-muted-foreground">Edit check-in and generate again.</p>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* Full viewport width row: five specialists side-by-side (scroll on narrow) */}
            <div className="w-full min-w-0 lg:col-span-12">
              <Card className="border-border/80">
                <CardHeader className="flex flex-col gap-3 border-b border-border/50 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-lg font-semibold tracking-tight">Specialist outputs</CardTitle>
                    <CardDescription className="text-sm">
                      Two wide columns on large screens. Use output size above or here to enlarge tiles.
                    </CardDescription>
                  </div>
                  <OutputSizeToggle value={outputSize} onChange={setOutputSize} />
                </CardHeader>
                <CardContent className="min-w-0 p-3 sm:p-4">
                  <div className="w-full min-w-0">
                    <div
                      className={cn(
                        "grid w-full min-w-0 grid-cols-1 gap-4",
                        "sm:grid-cols-2",
                        /* Two wide columns on desktop — not five thin strips */
                        "lg:grid-cols-2",
                      )}
                    >
                      {SPECIALIST_SECTIONS.map(({ key, label, icon }) => (
                        <SpecialistPanel key={key} label={label} icon={icon} size={outputSize}>
                          {outputs[key] || "—"}
                        </SpecialistPanel>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>

      {memoryFound && Object.keys(memoryMap).length > 0 ? (
        <Card className="border-border/80">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Memory keys</CardTitle>
            <CardDescription className="text-xs">Used as context next run.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              {Object.keys(memoryMap)
                .slice(0, 16)
                .map((k) => (
                  <li
                    key={k}
                    className="max-w-full truncate rounded-full border border-border/60 bg-muted/30 px-2 py-0.5"
                    title={k}
                  >
                    {k}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
