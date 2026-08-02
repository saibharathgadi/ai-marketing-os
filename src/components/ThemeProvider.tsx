"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react"

type Theme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  if (typeof document === "undefined") {
    return "dark"
  }

  const attr = document.documentElement.dataset.theme

  return attr === "light" ? "light" : "dark"
}

export function ThemeProvider({
  children
}: {
  children: React.ReactNode
}) {
  // Mirrors the inline blocking script in layout.tsx, which already set
  // documentElement.dataset.theme before hydration — the lazy initializer
  // reads it back during the client's first render (hydration), by which
  // point the attribute is already correct, so React state and the DOM
  // attribute never disagree without needing an extra sync effect.
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem("theme", theme)
  }, [theme])

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
