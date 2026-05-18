import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface BrcExclusionNoticeProps {
  className?: string
  variant?: "default" | "compact"
}

export function BrcExclusionNotice({ className, variant = "default" }: BrcExclusionNoticeProps) {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900",
          className,
        )}
        role="note"
      >
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span>
          <strong className="font-bold">Importante:</strong> No verificamos terrenos ni remates hipotecarios.
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 shadow-sm",
        className,
      )}
      role="note"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="space-y-1">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-900">
          Importante
        </p>
        <p className="text-sm leading-relaxed text-amber-900">
          BitHauss <strong>no verifica terrenos ni remates hipotecarios</strong>. La certificación BRC aplica únicamente a propiedades edificadas.
        </p>
      </div>
    </div>
  )
}
