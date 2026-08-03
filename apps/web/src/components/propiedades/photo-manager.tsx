"use client";

/**
 * Shared photo picker/organizer for the property forms (alta y edición).
 *
 * Both screens need the exact same behaviour — add, remove, reorder and pick
 * the cover photo — so the grid lives here instead of being duplicated. The
 * parent owns the ordered list; index 0 is always the principal/cover photo.
 *
 * Reordering is offered two ways on purpose: HTML5 drag & drop for pointer
 * devices, and explicit ←/→ buttons because `draggable` does not fire on
 * touch, which left phones and tablets unable to reorder at all.
 */

import Image from "next/image";
import { useRef, useState } from "react";
import {
  ImagePlus,
  X,
  Star,
  GripVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/** Maximum photos a single property may carry. */
export const MAX_PROPERTY_IMAGES = 45;

export interface PhotoItem {
  /** Stable React key (DB id for saved photos, synthetic for pending ones). */
  key: string;
  /** Anything <Image> can render: public URL or data: preview. */
  src: string;
}

interface PhotoManagerProps {
  items: PhotoItem[];
  onAdd: (files: FileList | File[]) => void;
  onRemove: (index: number) => void;
  /** Move the photo at `from` to position `to`. */
  onMove: (from: number, to: number) => void;
  /** Promote the photo at `index` to cover (position 0). */
  onSetPrincipal: (index: number) => void;
  max?: number;
}

export function PhotoManager({
  items,
  onAdd,
  onRemove,
  onMove,
  onSetPrincipal,
  max = MAX_PROPERTY_IMAGES,
}: PhotoManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const full = items.length >= max;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) onAdd(e.dataTransfer.files);
  }

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!full) fileInputRef.current?.click();
        }}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-all duration-200 sm:px-6 sm:py-12 ${
          full
            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
            : dragOver
              ? "cursor-pointer border-blue-400 bg-blue-50"
              : "cursor-pointer border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
        }`}
      >
        <div
          className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
          }}
        >
          <ImagePlus className="h-6 w-6" style={{ color: "hsl(221 83% 53%)" }} />
        </div>
        <p className="text-sm font-semibold text-gray-700">
          {full
            ? `Alcanzaste el máximo de ${max} imágenes`
            : "Arrastra tus imágenes aquí o haz clic para seleccionar"}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          JPG, PNG o WebP. Máximo {max} imágenes ({items.length} agregadas).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files) onAdd(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {items.length > 0 && (
        <>
          <p className="text-xs text-gray-500">
            Arrastra las fotos para reordenarlas (o usa{" "}
            <ChevronLeft className="inline h-3 w-3" />
            <ChevronRight className="inline h-3 w-3" /> en móvil). La primera (
            <span className="font-semibold text-blue-600">Principal</span>) es la
            portada de la publicación; usa{" "}
            <Star className="inline h-3 w-3" /> para hacer principal cualquier
            otra.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {items.map((item, idx) => (
              <div
                key={item.key}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) onMove(dragIndex, idx);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`group relative aspect-[4/3] cursor-move overflow-hidden rounded-xl border bg-gray-100 transition-all ${
                  idx === 0
                    ? "border-blue-400 ring-2 ring-blue-200"
                    : "border-gray-200"
                } ${dragIndex === idx ? "opacity-50" : ""}`}
              >
                <Image
                  src={item.src}
                  alt={`Imagen ${idx + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />

                {/* Drag affordance (pointer devices) */}
                <span className="absolute bottom-2 left-2 hidden h-6 w-6 items-center justify-center rounded-md bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
                  <GripVertical className="h-3.5 w-3.5" />
                </span>

                {/* Touch-friendly reorder — always visible, no hover needed */}
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <button
                    type="button"
                    title="Mover antes"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(idx, idx - 1);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Mover después"
                    disabled={idx === items.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(idx, idx + 1);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {idx === 0 ? (
                  <span className="absolute left-2 top-2 rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Principal
                  </span>
                ) : (
                  <button
                    type="button"
                    title="Hacer principal"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetPrincipal(idx);
                    }}
                    className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition-colors duration-200 hover:bg-blue-600"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  title="Eliminar"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(idx);
                  }}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition-colors duration-200 hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Pure helpers shared by both forms so ordering behaves identically. */

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

export function promoteToFront<T>(list: T[], index: number): T[] {
  if (index <= 0 || index >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.unshift(item!);
  return copy;
}
