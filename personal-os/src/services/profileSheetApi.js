import { getAiProxyOrigin } from "@/lib/aiProxyOrigin"

function apiBase() {
  return getAiProxyOrigin()
}

function explainProfileSheetFailure(status) {
  if (status === 404) {
    return "Profile API returned 404. Start the AI proxy from the personal-os folder (`npm run dev:server` or `npm run dev:all`). If it is running, the CSV path on the server may be wrong — check the proxy terminal for `[ai-proxy] profile sheet path:`."
  }
  if (status === 502 || status === 503) {
    return "Cannot reach the AI proxy (502/503). Run `npm run dev:server` on port 8787 alongside Vite, or open the Profile page only when `dev:all` is running."
  }
  return ""
}

export async function fetchProfileSheetFromServer() {
  const res = await fetch(`${apiBase()}/api/profile-sheet`, { cache: "no-store" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const hint = explainProfileSheetFailure(res.status)
    const base = data?.error || data?.detail || `HTTP ${res.status}`
    throw new Error(hint ? `${base} ${hint}` : base)
  }
  return data
}

export async function saveProfileSheetToServer(content) {
  const res = await fetch(`${apiBase()}/api/profile-sheet`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || data?.detail || `HTTP ${res.status}`)
  }
  return data
}

export async function restoreProfileSheetDefaultOnServer() {
  const res = await fetch(`${apiBase()}/api/profile-sheet/restore-default`, { method: "POST" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const hint = explainProfileSheetFailure(res.status)
    const base = data?.error || data?.detail || `HTTP ${res.status}`
    throw new Error(hint ? `${base} ${hint}` : base)
  }
  return data
}
