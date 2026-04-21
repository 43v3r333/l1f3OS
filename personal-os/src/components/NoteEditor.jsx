import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const bodyClass = "min-h-[7rem] resize-y text-sm leading-snug"

export default function NoteEditor({ initialNote, onSave, onCancel, className }) {
  const [title, setTitle] = useState(initialNote?.title ?? "")
  const [body, setBody] = useState(initialNote?.body ?? "")
  const [tags, setTags] = useState((initialNote?.tags ?? []).join(", "))
  const [linkedModule, setLinkedModule] = useState(initialNote?.linked_module ?? "notes")
  const [status, setStatus] = useState("")

  async function handleSubmit(event) {
    event.preventDefault()
    const payload = {
      title,
      body,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      linkedModule,
      pinned: Boolean(initialNote?.pinned),
    }
    const result = await onSave(payload)
    if (result.ok) {
      setStatus("Saved.")
      return
    }
    setStatus(result.message)
  }

  return (
    <Card className={cn("border-border/80", className)}>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base">{initialNote ? "Edit note" : "New note"}</CardTitle>
        <CardDescription className="text-xs">Title, body, tags — compact layout.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="note-title" className="text-xs">
              Title
            </Label>
            <Input
              id="note-title"
              className="h-9 text-sm"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Note title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-body" className="text-xs">
              Body
            </Label>
            <Textarea id="note-body" className={bodyClass} value={body} onChange={(event) => setBody(event.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="note-tags" className="text-xs">
                Tags
              </Label>
              <Input
                id="note-tags"
                className="h-9 text-sm"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="comma, separated"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-link" className="text-xs">
                Linked module
              </Label>
              <Input
                id="note-link"
                className="h-9 text-sm"
                value={linkedModule}
                onChange={(event) => setLinkedModule(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" className="min-w-[5rem]">
              Save
            </Button>
            {onCancel ? (
              <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
          {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
        </form>
      </CardContent>
    </Card>
  )
}
