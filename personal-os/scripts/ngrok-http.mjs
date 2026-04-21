/**
 * Starts ngrok for port 5173 after loading .env (supports NGROK_AUTHTOKEN).
 * Usage: node scripts/ngrok-http.mjs [port]
 */
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, "..", ".env") })

const port = process.argv[2] || "5173"
const child = spawn("npx", ["ngrok", "http", port], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  shell: true,
  env: process.env,
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
