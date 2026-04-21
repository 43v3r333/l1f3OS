import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.json({ limit: "1mb" }))

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gpt-oss:120b-cloud"
const AI_PROXY_PORT = Number(process.env.AI_PROXY_PORT || 8787)
// CPU inference + Life Manager prompts often exceed 2–3m; parallel specialists need headroom per request.
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 300000)
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 1536)
const OLLAMA_NUM_PREDICT_DEFAULT = Number(process.env.OLLAMA_NUM_PREDICT_DEFAULT || 512)

/** Always `personal-os/public/...` even if `node server/index.js` was started from another cwd */
const PROFILE_SHEET_PATH = path.resolve(__dirname, "..", "public", "user-profile-sheet.csv")
const PROFILE_SHEET_DEFAULT_PATH = path.resolve(__dirname, "..", "public", "user-profile-sheet.default.csv")
const PROFILE_SHEET_MAX_BYTES = 280_000

const SHIFT_CALENDAR_PDF_PATH = path.resolve(__dirname, "..", "public", "Shift Calendar 2026.pdf")
/** Max characters returned by API (client may slice smaller for prompts). */
const SHIFT_CALENDAR_API_TEXT_CAP = 14_000

/** @type {{ loaded: boolean, fullText: string, warning: string, loadError: string }} */
let shiftCalendarCache = { loaded: false, fullText: "", warning: "", loadError: "" }

async function loadShiftCalendarPdfIntoCache() {
  if (shiftCalendarCache.loaded) return
  shiftCalendarCache.loaded = true
  try {
    const buf = await fs.readFile(SHIFT_CALENDAR_PDF_PATH)
    const pdfParse = require("pdf-parse")
    const data = await pdfParse(buf)
    const raw = String(data?.text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
    shiftCalendarCache.fullText = raw
    if (!raw.length) {
      shiftCalendarCache.warning =
        "PDF parsed but no text layers found (may be image-only). C shift still applies from app profile."
    }
  } catch (e) {
    shiftCalendarCache.loadError = e?.message || String(e)
    shiftCalendarCache.fullText = ""
  }
}

function isLikelyXlsxZipBuffer(buf) {
  if (!buf || buf.length < 4) return false
  // .xlsx is a ZIP archive; local header starts with PK 0x03 0x04 or similar
  if (buf[0] === 0x50 && buf[1] === 0x4b) return true
  return false
}

function isValidProfileSheetCsv(text) {
  if (typeof text !== "string" || text.length < 12) return false
  if (text.length > PROFILE_SHEET_MAX_BYTES) return false
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
  const header = lines[0]?.toLowerCase() ?? ""
  return header.includes("section") && header.includes("key") && header.includes("value")
}

function errorFingerprint(error) {
  if (!error) return ""
  const parts = [
    error.message,
    error.name,
    error.code,
    error.cause?.message,
    error.cause?.name,
    typeof error === "string" ? error : "",
    String(error),
  ].filter(Boolean)
  return parts.join(" ").toLowerCase()
}

function isAbortLikeError(error) {
  const fp = errorFingerprint(error)
  if (fp.includes("abort") || fp.includes("aborted")) return true
  if (String(error?.name || "").toLowerCase() === "aborterror") return true
  if (String(error?.code || "").toUpperCase() === "ABORT_ERR") return true
  return false
}

function mapOllamaError(error, text = "") {
  const message = `${errorFingerprint(error)} ${text}`.toLowerCase()
  if (message.includes("econnrefused") || message.includes("fetch failed")) {
    return {
      status: 503,
      error: "Ollama is not reachable. Start it with `ollama serve`.",
    }
  }
  if (message.includes("model") && message.includes("not found")) {
    return {
      status: 400,
      error: `Model ${OLLAMA_MODEL} not found. Run \`ollama pull ${OLLAMA_MODEL}\` (cloud models need \`ollama signin\` first).`,
    }
  }
  if (
    message.includes("401") ||
    message.includes("unauthorized") ||
    message.includes("not signed in") ||
    message.includes("sign in")
  ) {
    return {
      status: 401,
      error:
        "Ollama rejected the request (auth). For cloud models run `ollama signin`, then `ollama pull " +
        OLLAMA_MODEL +
        "`.",
    }
  }
  if (message.includes("timeout")) {
    return {
      status: 504,
      error: "Ollama request timed out. Try again or use a lighter prompt.",
    }
  }
  if (isAbortLikeError(error)) {
    return {
      status: 504,
      error:
        "Ollama stopped responding before the deadline (request aborted). Increase OLLAMA_TIMEOUT_MS or reduce prompt size.",
    }
  }
  return {
    status: 500,
    error: "AI proxy request failed.",
  }
}

function isGptOssModel(model) {
  return typeof model === "string" && model.toLowerCase().includes("gpt-oss")
}

async function callOllamaChat({
  system = "",
  user = "",
  model = OLLAMA_MODEL,
  temperature = 0.4,
  maxTokens = OLLAMA_NUM_PREDICT_DEFAULT,
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)
  try {
    // gpt-oss spends output tokens on `message.thinking` first; small num_predict yields empty `content` (length stop).
    const gptOss = isGptOssModel(model)
    const numPredict = gptOss ? Math.max(maxTokens, 1024) : maxTokens
    const payload = {
      model,
      stream: false,
      keep_alive: "10m",
      options: {
        temperature,
        num_ctx: OLLAMA_NUM_CTX,
        num_predict: numPredict,
      },
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
    }
    if (gptOss) payload.think = "low"

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Ollama HTTP ${response.status}: ${text}`)
    }

    const json = await response.json()
    return json?.message?.content ?? ""
  } finally {
    clearTimeout(timeout)
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "ollama",
    model: OLLAMA_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  })
})

app.get("/api/profile-sheet", async (_req, res) => {
  const remoteUrl = (process.env.VITE_USER_PROFILE_SHEET_URL || "").trim() || null
  try {
    const raw = await fs.readFile(PROFILE_SHEET_PATH)
    if (isLikelyXlsxZipBuffer(raw)) {
      res.json({
        ok: true,
        content: "",
        path: PROFILE_SHEET_PATH,
        remoteUrl,
        formatWarning:
          "This file is binary Excel (.xlsx), not CSV. Excel may have saved the wrong format into user-profile-sheet.csv. Use “Restore template” below, then in Excel always use Save As → CSV UTF-8 (Comma delimited).",
        isBinaryExcel: true,
      })
      return
    }
    const content = raw.toString("utf8")
    res.json({
      ok: true,
      content,
      path: PROFILE_SHEET_PATH,
      remoteUrl,
    })
  } catch (error) {
    res.status(404).json({
      ok: false,
      error: "Could not read user-profile-sheet.csv from public/",
      detail: error?.message || String(error),
    })
  }
})

app.get("/api/shift-calendar-text", async (_req, res) => {
  try {
    await loadShiftCalendarPdfIntoCache()
    if (shiftCalendarCache.loadError) {
      res.json({
        ok: true,
        text: "",
        truncated: false,
        charCount: 0,
        warning: `Shift calendar PDF unavailable: ${shiftCalendarCache.loadError}`,
      })
      return
    }
    const full = shiftCalendarCache.fullText
    const truncated = full.length > SHIFT_CALENDAR_API_TEXT_CAP
    const text = truncated ? full.slice(0, SHIFT_CALENDAR_API_TEXT_CAP) : full
    const baseWarning = shiftCalendarCache.warning || ""
    res.json({
      ok: true,
      text,
      truncated,
      charCount: text.length,
      ...(baseWarning ? { warning: baseWarning } : {}),
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      text: "",
      truncated: false,
      charCount: 0,
      error: error?.message || String(error),
    })
  }
})

app.post("/api/profile-sheet/restore-default", async (_req, res) => {
  if ((process.env.VITE_USER_PROFILE_SHEET_URL || "").trim()) {
    res.status(400).json({
      ok: false,
      error: "VITE_USER_PROFILE_SHEET_URL is set — unset it to restore the local CSV file.",
    })
    return
  }
  try {
    await fs.copyFile(PROFILE_SHEET_DEFAULT_PATH, PROFILE_SHEET_PATH)
    const content = await fs.readFile(PROFILE_SHEET_PATH, "utf8")
    res.json({ ok: true, path: PROFILE_SHEET_PATH, content })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Could not restore default profile sheet",
      detail: error?.message || String(error),
    })
  }
})

app.put("/api/profile-sheet", async (req, res) => {
  if ((process.env.VITE_USER_PROFILE_SHEET_URL || "").trim()) {
    res.status(400).json({
      ok: false,
      error: "VITE_USER_PROFILE_SHEET_URL is set — Life Manager loads the remote CSV. Unset it to allow saving this file from the app.",
    })
    return
  }

  const content = req.body?.content
  if (typeof content !== "string") {
    res.status(400).json({ ok: false, error: "JSON body must include string field: content" })
    return
  }

  if (isLikelyXlsxZipBuffer(Buffer.from(content, "utf8"))) {
    res.status(400).json({
      ok: false,
      error:
        "Body looks like an Excel .xlsx (ZIP) file, not text CSV. In Excel use File → Save As → CSV UTF-8 (*.csv) and overwrite user-profile-sheet.csv, or use Restore template in the app.",
    })
    return
  }

  if (!isValidProfileSheetCsv(content)) {
    res.status(400).json({
      ok: false,
      error: "Invalid CSV: keep a header row section,key,value (lines starting with # are ok).",
    })
    return
  }

  try {
    await fs.mkdir(path.dirname(PROFILE_SHEET_PATH), { recursive: true })
    await fs.writeFile(PROFILE_SHEET_PATH, content, "utf8")
    res.json({ ok: true, path: PROFILE_SHEET_PATH })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Failed to write profile sheet",
      detail: error?.message || String(error),
    })
  }
})

app.post("/api/ai/chat", async (req, res) => {
  const {
    system = "",
    user = "",
    temperature = 0.4,
    maxTokens = OLLAMA_NUM_PREDICT_DEFAULT,
    model = OLLAMA_MODEL,
  } = req.body || {}

  if (!user || typeof user !== "string") {
    res.status(400).json({ error: "Missing required field: user" })
    return
  }

  try {
    const content = await callOllamaChat({
      system,
      user,
      model,
      temperature,
      maxTokens,
    })
    res.json({ content })
  } catch (error) {
    const mapped = mapOllamaError(error)
    const detail = error?.message || errorFingerprint(error) || String(error)
    res.status(mapped.status).json({ error: mapped.error, detail })
  }
})

app.listen(AI_PROXY_PORT, () => {
  console.log(`[ai-proxy] listening on http://localhost:${AI_PROXY_PORT}`)
  console.log(`[ai-proxy] ollama model: ${OLLAMA_MODEL}`)
  console.log(`[ai-proxy] profile sheet path: ${PROFILE_SHEET_PATH}`)
})
