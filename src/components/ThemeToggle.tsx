"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/ThemeProvider"

function subscribeNever() {
  return () => {}
}

// The server always renders assuming "dark" (readStoredTheme can't see
// localStorage during SSR, and :root is the dark palette). The inline
// script in layout.tsx corrects <html data-theme> before paint so the
// page's colors never flash, but it doesn't touch this button's own
// markup — so if a visitor's real theme is "light", rendering the real
// theme immediately here would mismatch the server-sent icon/label and
// fail hydration. useSyncExternalStore's getServerSnapshot forces the
// hydration render to agree with the server (false) regardless of the
// real theme, then React re-renders with the real client value (true)
// right after — the standard effect-free way to read a value that's
// only known on the client.
function useMounted() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  )
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const mounted = useMounted()

  const isDark = !mounted || theme === "dark"

  return (
    <Button
      onClick={toggleTheme}
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
