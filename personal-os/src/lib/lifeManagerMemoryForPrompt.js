/**
 * Shapes Supabase `life_manager_memory` rows for Life Manager prompts — bounded size, recent sessions only.
 */

export const LIFE_MANAGER_AI_DIGEST_KEY = "life_manager_ai_digest"

/** Keys always included first (when present), before recent sessions. */
export const LIFE_MANAGER_PINNED_KEYS = [
  "life_manager_goals_current",
  "life_manager_finance_settings",
  "life_manager_dashboard_ai_latest",
  "life_manager_user_notes",
  LIFE_MANAGER_AI_DIGEST_KEY,
]

const SESSION_PREFIX = "life_manager_session_"
const MAX_MEMORY_CHARS = 7800
const MAX_JSON_PER_BLOCK = 2400
const MAX_SESSIONS_IN_PROMPT = 5

function clip(str, max) {
  const s = String(str ?? "")
  if (s.length <= max) return s
  return `${s.slice(0, max - 24)}\n… [truncated at ${max} chars]`
}

function formatValue(val, maxJson = MAX_JSON_PER_BLOCK) {
  if (val === undefined || val === null) return "(empty)"
  if (typeof val === "string") return clip(val, maxJson)
  try {
    const s = JSON.stringify(val, null, 2)
    return clip(s, maxJson)
  } catch {
    return clip(String(val), maxJson)
  }
}

function blockForKey(cleanKey, val, maxJson = MAX_JSON_PER_BLOCK) {
  return `[${cleanKey}]:\n${formatValue(val, maxJson)}`
}

/**
 * @param {Record<string, unknown>} memoryMap — parsed values by key
 * @param {Array<{ key: string; value?: unknown; updated_at?: string }>} memoryRows — from Supabase, newest first
 * @returns {{ text: string, meta: { sessionTotal: number, sessionsIncluded: number, chars: number } }}
 */
export function formatLifeManagerMemoryForPrompt(memoryMap, memoryRows = []) {
  const map = memoryMap && typeof memoryMap === "object" ? memoryMap : {}
  const rows = Array.isArray(memoryRows) ? memoryRows : []

  const sessionRows = rows.filter((r) => r.key && String(r.key).startsWith(SESSION_PREFIX))
  const sessionTotal = sessionRows.length

  const parts = []
  const usedKeys = new Set()

  for (const key of LIFE_MANAGER_PINNED_KEYS) {
    if (!(key in map) || map[key] === undefined) continue
    usedKeys.add(key)
    const clean = key.replace(/^life_manager_/, "")
    parts.push(blockForKey(clean, map[key]))
  }

  const sessionSlice = sessionRows.slice(0, MAX_SESSIONS_IN_PROMPT)
  for (const row of sessionSlice) {
    const key = row.key
    if (!key || !map[key]) continue
    usedKeys.add(key)
    const clean = key.replace(/^life_manager_/, "")
    parts.push(blockForKey(clean, map[key]))
  }

  if (sessionTotal > MAX_SESSIONS_IN_PROMPT) {
    parts.push(
      `(Note: ${sessionTotal - MAX_SESSIONS_IN_PROMPT} older ${SESSION_PREFIX}* rows omitted from this prompt to save tokens.)`,
    )
  }

  const otherKeys = Object.keys(map).filter(
    (k) => !usedKeys.has(k) && k.startsWith("life_manager_") && !k.startsWith(SESSION_PREFIX),
  )
  for (const key of otherKeys.sort()) {
    const clean = key.replace(/^life_manager_/, "")
    parts.push(blockForKey(clean, map[key], 800))
  }

  let text = parts.join("\n\n")
  if (text.length > MAX_MEMORY_CHARS) {
    text = clip(text, MAX_MEMORY_CHARS)
  }

  if (!text.trim()) {
    return {
      text: "No previous session data found. This appears to be a first session.",
      meta: { sessionTotal: 0, sessionsIncluded: 0, chars: 0 },
    }
  }

  return {
    text,
    meta: {
      sessionTotal,
      sessionsIncluded: sessionSlice.length,
      chars: text.length,
    },
  }
}
