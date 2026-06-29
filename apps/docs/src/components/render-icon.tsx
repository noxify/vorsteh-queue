import type { LucideProps } from "lucide-react"
import React from "react"

type RenderIconProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: React.ComponentType<LucideProps> | { $$typeof: any }
} & React.Attributes &
  LucideProps

export function RenderIcon({ icon, ...props }: RenderIconProps) {
  if (!icon) {
    return null
  }
  // Funktionale Komponente
  if (typeof icon === "function") {
    return React.createElement(icon, props)
  }
  // forwardRef-Komponente (Objekt mit $$typeof)
  if (typeof icon === "object" && "$$typeof" in icon) {
    return React.createElement(
      icon as unknown as React.ComponentType<LucideProps>,
      props
    )
  }

  return null
}
