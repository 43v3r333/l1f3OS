import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import { Layers2, LoaderCircle, Plus, Rocket, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useStore } from "@/store/useStore"

const lanes = [
  { id: "todo", name: "Roadmap", icon: Layers2 },
  { id: "doing", name: "Current Build", icon: Rocket },
  { id: "done", name: "Revenue Ops", icon: Wallet },
]

export default function Saas() {
  const MotionDiv = motion.div
  const saasTasks = useStore((state) => state.saasTasks)
  const isLoadingSaas = useStore((state) => state.isLoadingSaas)
  const hydrateSaasTasks = useStore((state) => state.hydrateSaasTasks)
  const addSaasTask = useStore((state) => state.addSaasTask)
  const moveSaasTask = useStore((state) => state.moveSaasTask)

  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [status, setStatus] = useState({ type: "idle", message: "" })
  const [isAdding, setIsAdding] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [activeLane, setActiveLane] = useState(null)

  useEffect(() => {
    hydrateSaasTasks().then((result) => {
      if (!result.ok) {
        setStatus({ type: "error", message: result.message })
      }
    })
  }, [hydrateSaasTasks])

  const laneTasks = useMemo(
    () =>
      lanes.reduce((acc, lane) => {
        acc[lane.id] = saasTasks.filter((task) => task.lane === lane.id)
        return acc
      }, {}),
    [saasTasks],
  )

  async function onAddTask(event) {
    event.preventDefault()
    setStatus({ type: "idle", message: "" })
    setIsAdding(true)
    const result = await addSaasTask({ title: newTaskTitle, lane: "todo" })
    setIsAdding(false)

    if (result.ok) {
      setNewTaskTitle("")
      setStatus({ type: "success", message: "Task added to Todo." })
      return
    }

    setStatus({ type: "error", message: result.message })
  }

  async function onDropLane(laneId) {
    if (!draggedTaskId) return

    const result = await moveSaasTask({ taskId: draggedTaskId, toLane: laneId })
    if (!result.ok) {
      setStatus({ type: "error", message: result.message })
    }

    setDraggedTaskId(null)
    setActiveLane(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Build mode</p>
        <h1 className="mt-2 text-2xl font-semibold">SaaS Board</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Add SaaS Task</CardTitle>
          <CardDescription>Create a new task and place it in Todo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex items-center gap-2" onSubmit={onAddTask}>
            <Input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Ship billing webhook retry logic"
            />
            <Button type="submit" size="icon" disabled={isAdding}>
              {isAdding ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </form>
          {status.message ? (
            <p className={status.type === "error" ? "mt-3 text-sm text-red-400" : "mt-3 text-sm text-emerald-400"}>
              {status.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {lanes.map((lane) => (
          <Card
            key={lane.id}
            onDragOver={(event) => {
              event.preventDefault()
              setActiveLane(lane.id)
            }}
            onDragLeave={() => setActiveLane(null)}
            onDrop={() => onDropLane(lane.id)}
            className={activeLane === lane.id ? "ring-2 ring-ring" : ""}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <lane.icon className="size-4 text-primary" />
                  {lane.name}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{laneTasks[lane.id]?.length ?? 0}</span>
              </CardTitle>
              <CardDescription>
                {lane.id === "todo" ? "Tasks queued for execution." : lane.id === "doing" ? "Tasks in active build." : "Completed deliverables."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSaas ? (
                <p className="text-sm text-muted-foreground">Loading board...</p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {(laneTasks[lane.id] ?? []).map((task) => (
                      <MotionDiv
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        draggable
                        onDragStart={() => setDraggedTaskId(task.id)}
                        className="cursor-grab rounded-2xl border border-border/70 bg-muted/40 p-3 active:cursor-grabbing"
                      >
                        <p className="text-sm font-medium">{task.title}</p>
                      </MotionDiv>
                    ))}
                  </AnimatePresence>
                  {(laneTasks[lane.id] ?? []).length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border/80 p-3 text-xs text-muted-foreground">
                      Drop a task here.
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
