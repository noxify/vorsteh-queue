import {
  BookOpenIcon,
  BracesIcon,
  CommandIcon,
  DatabaseIcon,
  FileCode2Icon,
  SearchIcon,
  SettingsIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const navIconMap = {
  book: BookOpenIcon,
  braces: BracesIcon,
  command: CommandIcon,
  database: DatabaseIcon,
  file: FileCode2Icon,
  search: SearchIcon,
  settings: SettingsIcon,
  terminal: TerminalIcon,
  wrench: WrenchIcon,
} as const

export type NavIconName = keyof typeof navIconMap

export function getNavIconComponent(iconName?: string): LucideIcon | undefined {
  if (!iconName) {
    return
  }

  return navIconMap[iconName.toLowerCase() as NavIconName]
}

export function listNavIconNames() {
  return Object.keys(navIconMap) as NavIconName[]
}
