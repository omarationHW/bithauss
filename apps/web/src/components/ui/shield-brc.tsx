import React from "react"
import { cn } from "@/lib/utils"

interface ShieldBrcProps {
  className?: string
  strokeWidth?: number
  style?: React.CSSProperties
  gradient?: boolean
}

const LARGE_CLASS_RE = /\b(h|w)-(8|9|10|11|12|14|16|20|24|32|40|48|56|64)\b/

export function ShieldBrc({ className, strokeWidth = 1.25, style, gradient }: ShieldBrcProps) {
  const gradientId = "shield-brc-brand-gradient"
  const curvePathId = "shield-brc-curve"
  const paint = gradient ? `url(#${gradientId})` : "currentColor"
  const showCurvedLabel = LARGE_CLASS_RE.test(className ?? "")

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      stroke={paint}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={cn("lucide", className)}
    >
      <defs>
        {gradient && (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(221, 83%, 53%)" />
            <stop offset="100%" stopColor="hsl(160, 84%, 39%)" />
          </linearGradient>
        )}
        {showCurvedLabel && (
          <path
            id={curvePathId}
            d="M 32 6 A 26 26 0 1 1 31.99 6"
            fill="none"
            stroke="none"
          />
        )}
      </defs>

      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        stroke={paint}
        strokeWidth={strokeWidth * 1.6}
      />

      <path
        d="M32 54s14-7 14-17.5V18l-14-5.2-14 5.2v18.5C18 47 32 54 32 54z"
        fill="none"
        stroke={paint}
        strokeWidth={strokeWidth}
      />

      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="900"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={paint}
        stroke="none"
        letterSpacing="-0.4"
      >
        BRC
      </text>

      {showCurvedLabel && (
        <text
          fill={paint}
          stroke="none"
          fontSize="4.6"
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="1.2"
        >
          <textPath href={`#${curvePathId}`} startOffset="50%" textAnchor="middle">
            BIENES RAÍCES CERTIFICADAS
          </textPath>
        </text>
      )}
    </svg>
  )
}
