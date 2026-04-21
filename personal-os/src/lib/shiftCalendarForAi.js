import { getAiProxyOrigin } from "@/lib/aiProxyOrigin"

const LIFE_MANAGER_SHIFT_CALENDAR_MAX_CHARS = 6000
const COPILOT_SHIFT_CALENDAR_MAX_CHARS = 4000

/**
 * Fetches plain text extracted from `public/Shift Calendar 2026.pdf` via the local AI proxy.
 * @param {{ maxChars?: number }} opts
 * @returns {Promise<string>} Trimmed text, capped; empty if proxy unreachable or no text.
 */
export async function fetchShiftCalendarTextFromProxy(opts = {}) {
  const maxChars = Number.isFinite(opts.maxChars) ? Math.max(0, opts.maxChars) : 14_000
  const origin = getAiProxyOrigin()
  let res
  try {
    res = await fetch(`${origin}/api/shift-calendar-text`, { cache: "no-store" })
  } catch {
    return ""
  }
  if (!res.ok) return ""
  let json
  try {
    json = await res.json()
  } catch {
    return ""
  }
  if (!json || json.ok !== true) return ""
  const raw = String(json.text ?? "").trim()
  if (!raw) return ""
  return raw.length > maxChars ? raw.slice(0, maxChars) : raw
}

export function fetchShiftCalendarExcerptForLifeManager() {
  return fetchShiftCalendarTextFromProxy({ maxChars: LIFE_MANAGER_SHIFT_CALENDAR_MAX_CHARS })
}

export function fetchShiftCalendarExcerptForCopilot() {
  return fetchShiftCalendarTextFromProxy({ maxChars: COPILOT_SHIFT_CALENDAR_MAX_CHARS })
}
