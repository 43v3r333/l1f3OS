/**
 * After Life Manager approve: merge rolling AI digest in Supabase (continuous memory).
 */

import { LIFE_MANAGER_AI_DIGEST_KEY } from "@/lib/lifeManagerMemoryForPrompt"
import { chatCompletion } from "@/services/lifeManagerAi"
import { upsertLifeManagerMemory } from "@/services/supabase"

function stripCodeFences(text) {
  let t = String(text ?? "").trim()
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()
  }
  return t
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
}

function asStringArray(v, max = 12) {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, max)
}

/**
 * @param {unknown} raw
 * @returns {object | null}
 */
function normalizeDigestPayload(raw, lastSessionKey, updatedAt) {
  if (!isPlainObject(raw)) return null
  const summary = String(raw.summary ?? "").trim().slice(0, 4000)
  if (!summary) return null
  return {
    version: Number(raw.version) === 2 ? 2 : 1,
    summary,
    themes: asStringArray(raw.themes),
    avoid: asStringArray(raw.avoid),
    repeat: asStringArray(raw.repeat),
    lastSessionKey: lastSessionKey ?? null,
    updatedAt,
  }
}

const DIGEST_SYSTEM = `You maintain a compact "continuous memory" digest for a personal AI Life Manager (factory IT engineer, rotating shifts, building a startup in South Africa).

You MUST respond with a single JSON object only — no markdown, no code fences, no commentary.

Shape:
{
  "version": 1,
  "summary": "<5-10 sentences: what matters now across work, money, startup, habits; merge old + new; no repetition>",
  "themes": ["<short>", "..."],
  "avoid": ["<anti-patterns or scope mistakes to avoid>", "..."],
  "repeat": ["<what worked or should be reinforced>", "..."]
}

Rules:
- themes / avoid / repeat: max 8 items each; each item max 160 chars.
- summary max ~3500 chars.
- Integrate the NEW session into prior memory; drop stale details.
- Be specific (ZAR, shift pattern, project names) when the input contains them.
- If prior digest is empty, infer themes only from the new session.`

/**
 * Updates life_manager_ai_digest after approve. Never throws to caller — logs and returns on failure.
 * @param {{ memoryMap: object, sessionKey: string, sessionRecord: object, outputs: object }} args
 */
export async function updateLifeManagerDigestFromApprove({ memoryMap, sessionKey, sessionRecord, outputs }) {
  const previous = memoryMap?.[LIFE_MANAGER_AI_DIGEST_KEY]
  const prevText =
    previous && typeof previous === "object"
      ? JSON.stringify(previous, null, 2)
      : typeof previous === "string"
        ? previous
        : "(none)"

  const userPayload = {
    previous_digest: prevText,
    new_session_key: sessionKey,
    new_session_record: sessionRecord,
    unified_plan_excerpt: String(outputs?.unifiedPlan ?? "").slice(0, 2000),
    finance_excerpt: String(outputs?.financeAnalysis ?? "").slice(0, 1200),
    startup_excerpt: String(outputs?.startupGuidance ?? "").slice(0, 1200),
    coach_excerpt: String(outputs?.coaching ?? "").slice(0, 800),
  }

  const user = `Merge into the next digest JSON:\n${JSON.stringify(userPayload)}`

  try {
    const raw = await chatCompletion({
      system: DIGEST_SYSTEM,
      user,
      temperature: 0.25,
      maxTokens: 2200,
      bypassFastTokenCap: true,
    })
    const parsed = JSON.parse(stripCodeFences(raw))
    const updatedAt = new Date().toISOString()
    const digest = normalizeDigestPayload(parsed, sessionKey, updatedAt)
    if (!digest) {
      console.warn("[lifeManagerDigestAi] Model returned invalid digest JSON; skipping upsert.")
      return { ok: false }
    }
    await upsertLifeManagerMemory(LIFE_MANAGER_AI_DIGEST_KEY, digest)
    return { ok: true }
  } catch (e) {
    console.warn("[lifeManagerDigestAi] Digest update failed:", e?.message || e)
    return { ok: false }
  }
}
