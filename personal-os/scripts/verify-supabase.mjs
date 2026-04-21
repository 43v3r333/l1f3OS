/**
 * Verifies .env has Supabase vars and that each app table is reachable (RLS SELECT).
 * Run: npm run verify:db
 */
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "..", ".env") })

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const aiProxy = process.env.VITE_AI_PROXY_URL || "(unset → same-origin /api via Vite proxy)"

console.log("--- Environment ---")
console.log(`VITE_SUPABASE_URL: ${url ? "set" : "MISSING"}`)
console.log(`VITE_SUPABASE_ANON_KEY: ${key ? "set" : "MISSING"}`)
console.log(`VITE_AI_PROXY_URL: ${process.env.VITE_AI_PROXY_URL?.trim() ? process.env.VITE_AI_PROXY_URL : aiProxy}`)

if (!url || !key) {
  console.error("\nCopy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
  process.exit(1)
}

const supabase = createClient(url, key)

/** Matches src/services/supabase.js — full schema in src/services/README.md */
const tableChecks = [
  { table: "daily_logs", areas: "Dashboard, Today, Finance" },
  { table: "saas_tasks", areas: "SaaS, AI" },
  { table: "notes", areas: "Notes, AI" },
  { table: "automation_rules", areas: "Automation" },
  { table: "automation_events", areas: "Automation" },
  { table: "assistant_messages", areas: "Inbox, Dashboard coach (daily)" },
  { table: "reminders", areas: "Reminders, Dashboard" },
  { table: "life_manager_memory", areas: "Life Manager, Finance, Dashboard AI snapshot" },
]

let failed = 0
for (const { table, areas } of tableChecks) {
  const { error } = await supabase.from(table).select("*").limit(1)
  if (error) {
    console.error(`FAIL ${table} (${areas}): ${error.message}`)
    failed += 1
  } else {
    console.log(`OK   ${table}`)
  }
}

if (failed) {
  console.error(`\n${failed} table(s) failed. Apply the SQL in src/services/README.md (full script) in Supabase SQL Editor.`)
  process.exit(1)
}

console.log("\nAll tables reachable. Optional manual UI smoke: / → /today → /finance → /saas → /notes → /reminders → /inbox → /life")
