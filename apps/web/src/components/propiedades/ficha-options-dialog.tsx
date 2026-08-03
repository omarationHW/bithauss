"use client";

/**
 * Options asked before generating the property PDF: page orientation, how much
 * content goes in, and whether the full gallery is attached.
 *
 * The dialog keeps a draft of the options while it is open and only reports
 * back on "Descargar", so cancelling never mutates the caller's state.
 */

import { useEffect, useState } from "react";
import {
  Download,
  FileText,
  Images,
  Loader2,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  FichaLayout,
  FichaOptions,
  FichaOrientation,
} from "./ficha-options";

export interface FichaOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial selection — usually the last choice of the session. */
  value: FichaOptions;
  onConfirm: (options: FichaOptions) => void;
  /** True while the PDF is being generated. */
  loading?: boolean;
  /** Total photos available, used to explain what "todas las fotografías" means. */
  photoCount?: number;
}

interface OptionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}

function OptionCard({
  icon: Icon,
  title,
  hint,
  selected,
  onSelect,
}: OptionCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-1 flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-input hover:bg-accent",
      )}
    >
      <Icon className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
      <span className="text-sm font-medium leading-none">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

export function FichaOptionsDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
  loading = false,
  photoCount = 0,
}: FichaOptionsDialogProps) {
  const [draft, setDraft] = useState<FichaOptions>(value);

  // Re-seed the draft every time the dialog is opened so it reflects the last
  // confirmed choice instead of whatever the user was toying with before.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const setOrientation = (orientation: FichaOrientation) =>
    setDraft((d) => ({ ...d, orientation }));
  const setLayout = (layout: FichaLayout) => setDraft((d) => ({ ...d, layout }));

  const isSingle = draft.layout === "single";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Descargar ficha técnica</DialogTitle>
          <DialogDescription>
            Elige cómo quieres el PDF de esta propiedad.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Orientation */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Orientación</p>
            <div role="radiogroup" aria-label="Orientación" className="flex gap-2">
              <OptionCard
                icon={RectangleVertical}
                title="Vertical"
                hint="A4 en pie"
                selected={draft.orientation === "portrait"}
                onSelect={() => setOrientation("portrait")}
              />
              <OptionCard
                icon={RectangleHorizontal}
                title="Horizontal"
                hint="A4 apaisado"
                selected={draft.orientation === "landscape"}
                onSelect={() => setOrientation("landscape")}
              />
            </div>
          </div>

          {/* Layout */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Formato</p>
            <div role="radiogroup" aria-label="Formato" className="flex gap-2">
              <OptionCard
                icon={FileText}
                title="1 hoja"
                hint="Resumen con foto principal"
                selected={isSingle}
                onSelect={() => setLayout("single")}
              />
              <OptionCard
                icon={Images}
                title="Completa"
                hint="Todas las secciones"
                selected={!isSingle}
                onSelect={() => setLayout("full")}
              />
            </div>
          </div>

          {/* Photos */}
          <div
            className={cn(
              "rounded-lg border border-input p-3",
              isSingle && "opacity-60",
            )}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
                checked={!isSingle && draft.includeAllPhotos}
                disabled={isSingle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, includeAllPhotos: e.target.checked }))
                }
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium leading-none">
                  Incluir todas las fotografías
                </span>
                <span className="block text-xs text-muted-foreground">
                  {isSingle
                    ? "En 1 hoja las fotos se incluyen como miniaturas."
                    : photoCount > 0
                      ? `Agrega páginas de galería con las ${photoCount} fotos. Si lo desactivas sólo se incluye una página de galería.`
                      : "Agrega páginas de galería con todas las fotos de la propiedad."}
                </span>
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(draft)} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {loading ? "Generando..." : "Descargar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
