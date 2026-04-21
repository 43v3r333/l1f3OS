import { useEffect, useState } from "react"
import { Bell, CheckCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import AiMarkdown from "@/components/AiMarkdown"
import { useStore } from "@/store/useStore"

export default function Inbox() {
  const assistantMessages = useStore((state) => state.assistantMessages)
  const hydrateAssistantMessages = useStore((state) => state.hydrateAssistantMessages)
  const readAssistantMessage = useStore((state) => state.readAssistantMessage)
  const [status, setStatus] = useState("")

  useEffect(() => {
    hydrateAssistantMessages().then((result) => {
      if (!result.ok) setStatus(result.message)
    })
  }, [hydrateAssistantMessages])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Assistant</p>
        <h1 className="mt-2 text-2xl font-semibold">Inbox</h1>
      </div>
      {status ? <p className="text-sm text-amber-300">{status}</p> : null}
      {assistantMessages.map((message) => (
        <Card key={message.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                {message.title}
              </span>
              {!message.read ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => readAssistantMessage(message.id)}
                >
                  <CheckCheck className="size-3.5" />
                  Read
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Read</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <AiMarkdown compact>{message.body}</AiMarkdown>
            <p className="text-xs text-muted-foreground">
              {message.kind} · {message.source}
            </p>
          </CardContent>
        </Card>
      ))}
      {assistantMessages.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            No assistant messages yet.
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
