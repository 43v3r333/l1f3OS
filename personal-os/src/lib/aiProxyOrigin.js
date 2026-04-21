/**
 * Base URL for the AI proxy HTTP API.
 * Empty string = same origin (Vite dev `server.proxy` forwards `/api` → local proxy).
 * Set `VITE_AI_PROXY_URL` only for split origins (e.g. second ngrok tunnel to port 8787).
 */
export function getAiProxyOrigin() {
  const raw = import.meta.env.VITE_AI_PROXY_URL
  if (typeof raw !== "string") return ""
  const trimmed = raw.trim()
  if (!trimmed) return ""
  return trimmed.replace(/\/$/, "")
}
