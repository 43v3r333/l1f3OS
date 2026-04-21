import { lazy, Suspense } from "react"
import { Route, Routes } from "react-router-dom"

import AppLayout from "@/components/AppLayout"

const Dashboard = lazy(() => import("@/pages/Dashboard"))
const Finance = lazy(() => import("@/pages/Finance"))
const Inbox = lazy(() => import("@/pages/Inbox"))
const LifeManager = lazy(() => import("@/pages/LifeManager"))
const Notes = lazy(() => import("@/pages/Notes"))
const Reminders = lazy(() => import("@/pages/Reminders"))
const Saas = lazy(() => import("@/pages/Saas"))
const Today = lazy(() => import("@/pages/Today"))
const ProfileSheet = lazy(() => import("@/pages/ProfileSheet"))
const ProfileDashboard = lazy(() => import("@/pages/ProfileDashboard"))

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  )
}

function App() {
  return (
    <AppLayout>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/today" element={<Today />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/saas" element={<Saas />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/life" element={<LifeManager />} />
          <Route path="/profile-sheet" element={<ProfileSheet />} />
          <Route path="/profile-dashboard" element={<ProfileDashboard />} />
        </Routes>
      </Suspense>
    </AppLayout>
  )
}

export default App
