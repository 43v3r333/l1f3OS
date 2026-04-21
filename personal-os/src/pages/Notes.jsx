import { useEffect, useMemo, useState } from "react"
import { Brain, NotebookPen, Search, Sparkles, Trash2, Zap } from "lucide-react"

import NoteEditor from "@/components/NoteEditor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"

export default function Notes() {
  const notes = useStore((state) => state.notes)
  const noteSearch = useStore((state) => state.noteSearch)
  const hydrateNotes = useStore((state) => state.hydrateNotes)
  const addNote = useStore((state) => state.addNote)
  const editNote = useStore((state) => state.editNote)
  const removeNote = useStore((state) => state.removeNote)
  const setNoteSearch = useStore((state) => state.setNoteSearch)
  const addSaasTask = useStore((state) => state.addSaasTask)
  const summarizeAndTagNote = useStore((state) => state.summarizeAndTagNote)

  const [activeNote, setActiveNote] = useState(null)
  const [status, setStatus] = useState("")

  useEffect(() => {
    hydrateNotes().then((result) => {
      if (!result.ok) setStatus(result.message)
    })
  }, [hydrateNotes])

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        note.body.toLowerCase().includes(q) ||
        (note.tags ?? []).join(" ").toLowerCase().includes(q),
    )
  }, [notes, noteSearch])

  async function handleCreate(payload) {
    const result = await addNote(payload)
    if (result.ok) setStatus("Note saved.")
    else setStatus(result.message)
    return result
  }

  async function handleUpdate(payload) {
    const result = await editNote(activeNote.id, payload)
    if (result.ok) {
      setStatus("Note updated.")
      setActiveNote(null)
    } else setStatus(result.message)
    return result
  }

  async function convertToTask(note) {
    const result = await addSaasTask({ title: note.title, lane: "todo" })
    setStatus(result.ok ? "Converted note to SaaS task." : result.message)
  }

  async function linkToDaily(note) {
    const result = await editNote(note.id, { ...note, linkedModule: "today" })
    setStatus(result.ok ? "Linked note to Today module." : result.message)
  }

  async function summarize(note) {
    const text = await summarizeAndTagNote(note)
    setStatus(text)
  }

  function IconForNote(note) {
    if (note.linked_module === "today") return <Brain className="size-4 shrink-0 text-primary" />
    if (note.linked_module === "saas") return <NotebookPen className="size-4 shrink-0 text-primary" />
    return <Zap className="size-4 shrink-0 text-primary" />
  }

  return (
    <div className="w-full space-y-3 pb-6 md:space-y-4">
      <div className="mx-auto w-full max-w-md sm:max-w-none">
        <header className="flex flex-col gap-1 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-0 sm:pb-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Memory lane</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">Notes</h1>
          </div>
          <p className="max-w-md text-xs text-muted-foreground sm:text-right sm:text-sm">
            Search, capture, scroll the list — wide layout on desktop.
          </p>
        </header>
      </div>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        {/* Portrait column on phone; editor + search sticky on desktop */}
        <div className="mx-auto w-full max-w-md space-y-3 lg:col-span-5 lg:mx-0 lg:max-w-none">
          <Card className="border-border/80">
            <CardContent className="p-3 sm:p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={noteSearch}
                  onChange={(event) => setNoteSearch(event.target.value)}
                  className="h-9 pl-9 text-sm"
                  placeholder="Search title, body, tags..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="lg:sticky lg:top-6">
            {activeNote ? (
              <NoteEditor
                initialNote={activeNote}
                onSave={handleUpdate}
                onCancel={() => setActiveNote(null)}
              />
            ) : (
              <NoteEditor onSave={handleCreate} />
            )}
          </div>
        </div>

        {/* List: uses remaining width; scroll inside on large screens */}
        <div className="min-w-0 lg:col-span-7">
          <div
            className={cn("space-y-3", "lg:max-h-[min(75vh,820px)] lg:overflow-y-auto lg:pr-1")}
          >
            {filteredNotes.length === 0 ? (
              <Card className="border-border/80 border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No notes match your filter. Add one on the left.
                </CardContent>
              </Card>
            ) : (
              filteredNotes.map((note) => (
                <Card key={note.id} className="border-border/80">
                  <CardHeader className="space-y-2 pb-2">
                    <CardTitle className="flex items-start justify-between gap-2 text-base font-semibold leading-snug">
                      <span className="flex min-w-0 items-start gap-2">
                        <span className="mt-0.5">{IconForNote(note)}</span>
                        <span className="truncate">{note.title}</span>
                      </span>
                      {note.pinned ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-primary">Pinned</span>
                      ) : null}
                    </CardTitle>
                    <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                      {note.body || "—"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      {(note.tags ?? []).length > 0
                        ? (note.tags ?? []).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5"
                            >
                              #{tag}
                            </span>
                          ))
                        : null}
                      {note.linked_module ? (
                        <span className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          {note.linked_module}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setActiveNote(note)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => convertToTask(note)}
                      >
                        To task
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => linkToDaily(note)}>
                        Link Today
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => summarize(note)}>
                        <Sparkles className="size-3" />
                        AI
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs text-destructive hover:text-destructive"
                        onClick={() => removeNote(note.id)}
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {status ? <p className="text-xs text-muted-foreground sm:text-sm">{status}</p> : null}
    </div>
  )
}
