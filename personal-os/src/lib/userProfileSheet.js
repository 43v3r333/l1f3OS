/**
 * Loads an editable user profile "spreadsheet" (CSV/TSV) for Life Manager calibration.
 * - Default: fetch `/user-profile-sheet.csv` from `public/`
 * - Optional: `VITE_USER_PROFILE_SHEET_URL` = full URL to a published Google Sheet CSV or any CSV
 */

let cachedAppendix = null
let loadPromise = null
let loadAttempted = false

const PROFILE_SHEET_MAX_BYTES = 280_000

/** Client-side guard before PUT (server validates again). */
export function validateProfileSheetCsv(text) {
  if (typeof text !== "string" || text.length < 12) return false
  if (text.length > PROFILE_SHEET_MAX_BYTES) return false
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
  const header = (lines[0] ?? "").toLowerCase()
  return header.includes("section") && header.includes("key") && header.includes("value")
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** Detect delimiter from header line */
function sniffDelimiter(line) {
  if (line.includes("\t")) return "\t"
  return ","
}

/**
 * Minimal row parser: delimiter tab or comma; fields in "double quotes" may contain delimiter or newlines.
 */
export function parseDelimitedTable(text) {
  const raw = stripBom(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")
  const lines = []
  let row = []
  let field = ""
  let i = 0
  let inQuotes = false
  const delim = (() => {
    const first = raw.split("\n").find((l) => l.trim() && !l.trim().startsWith("#"))
    return first ? sniffDelimiter(first) : ","
  })()

  while (i < raw.length) {
    const c = raw[i]
    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === delim) {
      row.push(field.trim())
      field = ""
      i += 1
      continue
    }
    if (c === "\n") {
      row.push(field.trim())
      field = ""
      if (row.some((cell) => cell.length > 0)) lines.push(row)
      row = []
      i += 1
      continue
    }
    field += c
    i += 1
  }
  if (field.length || row.length) {
    row.push(field.trim())
    if (row.some((cell) => cell.length > 0)) lines.push(row)
  }

  if (!lines.length) return { headers: [], rows: [] }
  const headers = lines[0].map((h) => h.trim().toLowerCase())
  const rows = lines.slice(1).filter((r) => r.length && r.some((c) => c && !String(c).startsWith("#")))
  return { headers, rows }
}

export function rowsToObjects(headers, rows) {
  const idx = (name) => headers.indexOf(name)
  const s = idx("section")
  const k = idx("key")
  const v = idx("value")
  if (s === -1 || k === -1 || v === -1) return []
  return rows
    .map((r) => {
      const pad = [...r]
      while (pad.length < 3) pad.push("")
      return {
        section: pad[s] ?? "",
        key: pad[k] ?? "",
        value: pad[v] ?? "",
      }
    })
    .filter((o) => o.section || o.key || o.value)
}

function formatAppendix(objects, maxChars = 12000) {
  if (!objects.length) return ""
  const bySection = new Map()
  for (const o of objects) {
    const sec = o.section.trim() || "general"
    if (!bySection.has(sec)) bySection.set(sec, [])
    bySection.get(sec).push(o)
  }
  const parts = ["USER PROFILE SHEET (editable; overrides/extends static baseline where relevant):"]
  for (const [sec, list] of bySection) {
    parts.push(`\n[${sec}]`)
    for (const { key, value } of list) {
      const line = `${key}: ${String(value).replace(/\n+/g, " ").trim()}`
      parts.push(line)
    }
  }
  let text = parts.join("\n")
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars - 40)}\n… [profile sheet truncated at ${maxChars} chars]`
  }
  return text
}

export function getProfileSheetAppendix() {
  return cachedAppendix ?? ""
}

/**
 * Fetches and caches the profile sheet.
 * @param {{ force?: boolean }} [options] — `force: true` clears cache and refetches (use after editing CSV/Excel).
 */
export function ensureUserProfileSheetLoaded(options = {}) {
  const force = Boolean(options.force)
  if (force) {
    cachedAppendix = null
    loadPromise = null
    loadAttempted = false
  }

  if (loadPromise) return loadPromise

  loadAttempted = true
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/")
  const url =
    (import.meta.env.VITE_USER_PROFILE_SHEET_URL || "").trim() || `${base}user-profile-sheet.csv`

  loadPromise = (async () => {
    try {
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) {
        cachedAppendix = ""
        return
      }
      const text = await res.text()
      const { headers, rows } = parseDelimitedTable(text)
      const objs = rowsToObjects(headers, rows)
      cachedAppendix = formatAppendix(objs)
    } catch {
      cachedAppendix = ""
    }
  })()

  return loadPromise
}

/** For tests / HMR: reset cache */
export function resetProfileSheetCacheForTests() {
  cachedAppendix = null
  loadPromise = null
  loadAttempted = false
}
