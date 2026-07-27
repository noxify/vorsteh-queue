import { useId } from "react"

import { cn } from "@/lib/utils"

export function VorstehLogo({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  const rawId = useId()
  const idPrefix = rawId.replaceAll(":", "")
  const gradientId = `${idPrefix}-grad`

  return (
    <svg
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8", className)}
      aria-label="Vorsteh Queue logo"
      role="img"
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill={`url(#${gradientId})`} />
      {/* Stylized pointer dog / queue arrow mark */}
      <path
        d="M12 20 h8 a4 4 0 0 0 0-8 h-2 M20 20 l6 6 M20 20 l6-6"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
