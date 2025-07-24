import type { LucideProps } from "lucide-react"
import {
  ArrowUp,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Code,
  Database,
  Globe,
  Heart,
  Info,
  Play,
  Power,
  RotateCcw,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"

import { cn } from "./utils"

export const allowedIcons = {
  Calendar,
  CheckCircle,
  Clock,
  Code,
  Database,
  Heart,
  Info,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Users,
  Zap,
  Globe,
  Power,
  ArrowUp,
  TrendingUp,
  Trash2,
  BarChart3,
}

export type AllowedIcon = keyof typeof allowedIcons

export function getIcon(name: AllowedIcon, props?: LucideProps) {
  const Icon = allowedIcons[name]
  return <Icon {...props} />
}
