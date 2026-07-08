import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  readonly theme: Theme
  readonly resolvedTheme: "light" | "dark"
  readonly setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/**
 * Provides theme context to the application with light/dark/system support.
 */
export function ThemeProvider({
  children,
}: {
  readonly children: React.ReactNode
}) {
  const [themeState, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "system"
    }
    return (localStorage.getItem("theme") as Theme) ?? "system"
  })

  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "dark"
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  })

  const resolvedTheme = themeState === "system" ? systemTheme : themeState

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light")
    }
    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem("theme", newTheme)
  }, [])

  const value = useMemo(
    () => ({ theme: themeState, resolvedTheme, setTheme }),
    [themeState, resolvedTheme, setTheme]
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

/**
 * Access the current theme context.
 *
 * @returns Theme context with current theme, resolved theme, and setter
 * @throws {Error} If used outside of ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
