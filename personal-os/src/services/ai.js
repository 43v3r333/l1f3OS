import { getAiProxyOrigin } from "@/lib/aiProxyOrigin"
import { buildMemorySnapshot, generateInsights } from "@/lib/memory"

async function callExternalAI(prompt) {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${getAiProxyOrigin()}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: prompt,
          temperature: 0.2,
          maxTokens: 260,
        }),
      })
      if (response.ok) {
        const json = await response.json()
        return json?.content ?? null
      }
      if (attempt < maxAttempts && (response.status === 504 || response.status === 503 || response.status === 500)) {
        await new Promise((r) => setTimeout(r, 400 * attempt * attempt))
        continue
      }
      return null
    } catch {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt * attempt))
        continue
      }
      return null
    }
  }
  return null
}

export async function generateDailyPlan({ weeklyLogs, saasTasks, notes }) {
  const memory = buildMemorySnapshot({ weeklyLogs, saasTasks, skills: {} })
  const prompt = `Return 3 short bullets only. Build a practical day plan from: ${JSON.stringify(memory)} and notes count ${notes.length}.`
  const external = await callExternalAI(prompt)
  if (external) return external

  const topTodo = saasTasks.find((task) => task.lane === "todo")
  return [
    `1) Main task: ${topTodo?.title ?? "Pick one high-impact SaaS task"}.`,
    "2) Protect two deep-work blocks (90 min each).",
    "3) Close day with a quick review note and one done move.",
  ].join("\n")
}

export async function summarizeNote(note) {
  const prompt = `Summarize in one sentence and suggest 3 comma-separated tags. Note: ${note.body}`
  const external = await callExternalAI(prompt)
  if (external) return external
  const words = note.body.split(/\s+/).slice(0, 18).join(" ")
  return `Summary: ${words}${note.body.length > words.length ? "..." : ""}. Suggested tags: focus, build, review.`
}

export function recommendNextTask({ saasTasks, insights }) {
  const doing = saasTasks.find((task) => task.lane === "doing")
  if (doing) return `Finish in-progress task: ${doing.title}`
  const todo = saasTasks.find((task) => task.lane === "todo")
  if (todo) return `Start next priority task: ${todo.title}`
  const alert = insights.find((insight) => insight.type === "alert")
  if (alert) return "Reset with one small completion before expanding scope."
  return "Capture a fresh task in Todo and schedule a focus block."
}

export function generateReflection({ weeklyLogs, saasTasks }) {
  const memory = buildMemorySnapshot({ weeklyLogs, saasTasks, skills: {} })
  const insights = generateInsights(memory)
  return `Today snapshot: ${memory.performance.deepWorkTotal.toFixed(1)}h deep work this week, ${memory.performance.saasProgress}% SaaS progress. Reflection: ${insights[0]?.message}`
}
