import React from "react"
import { cn } from "@/lib/utils"

interface ShieldBrcProps {
  className?: string
  strokeWidth?: number
  style?: React.CSSProperties
  gradient?: boolean
}

export function ShieldBrc({ className, strokeWidth = 1.25, style, gradient }: ShieldBrcProps) {
  const gradientId = "shield-brc-brand-gradient"
  const paint = gradient ? `url(#${gradientId})` : "currentColor"
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={paint}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={cn("lucide", className)}
    >
      {gradient && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(221, 83%, 53%)" />
            <stop offset="100%" stopColor="hsl(160, 84%, 39%)" />
          </linearGradient>
        </defs>
      )}
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <text
        x="12"
        y="12"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="4.8"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={paint}
        stroke="none"
        letterSpacing="-0.5"
        paintOrder="stroke"
      >
        BRC
      </text>
    </svg>
  )
}
