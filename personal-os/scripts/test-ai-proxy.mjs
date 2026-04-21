/**
 * Smoke-test the AI proxy (health + one chat). Run: npm run test:ai
 * Optional: AI_TEST_URL=http://127.0.0.1:8787
 */
const base = (process.env.AI_TEST_URL || "http://127.0.0.1:8787").replace(/\/$/, "")

const healthRes = await fetch(`${base}/api/health`)
const health = await healthRes.json()
console.log("GET /api/health", healthRes.status, health)

if (!healthRes.ok) process.exit(1)

const chatRes = await fetch(`${base}/api/ai/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    user: "Reply with exactly one word: pong",
    temperature: 0.2,
    maxTokens: 48,
  }),
})
const chat = await chatRes.json()
console.log("POST /api/ai/chat", chatRes.status, chat)

if (!chatRes.ok) process.exit(1)
if (!chat.content || typeof chat.content !== "string") {
  console.error("Expected non-empty string content")
  process.exit(1)
}
console.log("OK — model replied with text.")
