import React from "react"
import { cn } from "@/lib/utils"

interface ShieldBrcProps {
  className?: string
  strokeWidth?: number
  style?: React.CSSProperties
}

export function ShieldBrc({ className, strokeWidth = 1.25, style }: ShieldBrcProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={cn("lucide", className)}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <text
        x="12"
        y="15"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="4.8"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="currentColor"
        stroke="none"
        letterSpacing="-0.5"
        paintOrder="stroke"
      >
        BRC
      </text>
    </svg>
  )
}
