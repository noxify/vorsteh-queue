import type { Theme } from "../../components/ui/types"

export const defaultTheme: Theme = {
  border: {
    color: "#4B5563",
    focusColor: "#f97316",
    style: "round",
  },
  colors: {
    accent: "#fb923c",
    accentForeground: "#000000",
    background: "#000000",
    border: "#4B5563",
    error: "#EF4444",
    errorForeground: "#FFFFFF",

    focusRing: "#f97316",
    foreground: "#E5E7EB",
    info: "#3B82F6",
    infoForeground: "#FFFFFF",
    muted: "#374151",
    mutedForeground: "#9CA3AF",
    primary: "#f97316",
    primaryForeground: "#000000",

    secondary: "#6B7280",
    secondaryForeground: "#FFFFFF",
    selection: "#f97316",
    selectionForeground: "#000000",
    success: "#10B981",

    successForeground: "#FFFFFF",
    warning: "#F59E0B",
    warningForeground: "#000000",
  },
  name: "vorsteh-queue",
  spacing: {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    6: 6,
    8: 8,
  },
  typography: {
    base: "",
    bold: true,
    lg: "bold",
    sm: "dim",
    xl: "bold",
  },
}
