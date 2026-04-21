import { useEffect, useState } from "react"
import {
  AlarmClock,
  Bell,
  Brain,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  NotebookText,
  Rocket,
  Settings2,
  SunMoon,
  Wallet,
  X,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import QuickCaptureSheet from "@/components/QuickCaptureSheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/today", label: "Today", icon: SunMoon },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/saas", label: "SaaS", icon: Rocket },
  { to: "/notes", label: "Notes", icon: NotebookText },
  { to: "/reminders", label: "Reminders", icon: AlarmClock },
  { to: "/inbox", label: "Inbox", icon: Bell },
  { to: "/life", label: "Life", icon: Brain },
  { to: "/profile-sheet", label: "Profile", icon: Settings2 },
  { to: "/profile-dashboard", label: "Profile dash", icon: LayoutGrid },
]

function MobileNavDrawer({ open, onClose }) {
  const location = useLocation()

  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] bg-background/70 backdrop-blur-sm md:hidden"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        id="mobile-nav-drawer"
        className="fixed inset-y-0 left-0 z-[100] flex w-[min(18rem,88vw)] flex-col border-r border-border/80 bg-card pt-[env(safe-area-inset-top,0px)] shadow-xl md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-3">
          <span className="text-sm font-semibold tracking-tight">personal-os</span>
          <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={onClose}>
            <X className="size-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain p-2">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to
              return (
                <li key={item.to}>
                  <Button
                    asChild
                    variant="ghost"
                    className={cn(
                      "h-11 w-full justify-start gap-3 rounded-2xl px-3 text-sm",
                      active && "bg-muted text-foreground",
                    )}
                  >
                    <Link to={item.to} onClick={onClose}>
                      <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                      {item.label}
                    </Link>
                  </Button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </>
  )
}

export default function AppLayout({ children }) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKey = (e) => {
      if (e.key === "Escape") setMobileMenuOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileMenuOpen])

  return (
    <div className="mx-auto min-h-svh w-full max-w-7xl px-3 pb-24 pt-[calc(0.75rem+env(safe-area-inset-top,0px)+3rem)] md:px-6 md:pb-6 md:pt-4">
      <header className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center gap-2 border-b border-border/80 bg-background/95 px-3 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm md:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 rounded-full border-border/80"
          onClick={() => setMobileMenuOpen(true)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-drawer"
        >
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </Button>
        <span className="truncate text-sm font-semibold tracking-tight text-foreground/90">personal-os</span>
      </header>

      <MobileNavDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex min-h-[calc(100svh-5rem-env(safe-area-inset-top,0px))] flex-col gap-4 md:min-h-[calc(100svh-2rem)] md:flex-row md:gap-6">
        <aside className="hidden md:sticky md:top-6 md:block md:h-fit md:w-56 md:flex-shrink-0">
          <nav className="rounded-3xl border border-border/80 bg-card p-2 shadow-sm">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <li key={item.to}>
                    <Button
                      asChild
                      variant="ghost"
                      className={cn(
                        "h-11 w-full justify-start gap-2 rounded-2xl px-3 text-sm",
                        active && "bg-muted text-foreground",
                      )}
                    >
                      <Link to={item.to}>
                        <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                        {item.label}
                      </Link>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        <div className="flex-1 md:min-w-0">
          <main key={location.pathname} className="space-y-4 overscroll-y-contain md:px-2">
            {children}
          </main>
        </div>
      </div>

      <QuickCaptureSheet />
    </div>
  )
}
