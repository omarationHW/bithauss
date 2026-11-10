"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { ASSISTANT_NAME, isAssistantRoute } from "@/lib/assistant/constants";

/**
 * Floating entry point of the property-search assistant.
 *
 * Only this button ships with the public pages. The panel (dialog, voice,
 * cards, API client) is a separate chunk, fetched on first hover/focus and
 * mounted on first open; it then stays mounted so the conversation survives
 * client-side navigation between public pages.
 */
const loadPanel = () => import("./assistant-panel");
const AssistantPanel = dynamic(loadPanel, { ssr: false });

export function AssistantLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (!isAssistantRoute(pathname)) return null;

  const prefetch = () => {
    void loadPanel().catch(() => {
      /* retried on click */
    });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setActivated(true);
          setOpen(true);
        }}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onTouchStart={prefetch}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Abrir ${ASSISTANT_NAME}: busca propiedades escribiendo o con tu voz`}
        className={
          "fixed z-40 inline-flex h-14 items-center gap-2 rounded-full bg-primary pl-4 pr-4 text-primary-foreground shadow-lg shadow-primary/30 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:pr-5 " +
          "bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] right-[max(1rem,calc(env(safe-area-inset-right)+0.5rem))] " +
          (open ? "pointer-events-none opacity-0" : "")
        }
      >
        <MessageCircle className="h-6 w-6" aria-hidden />
        <span className="hidden text-sm font-semibold sm:inline">¿Qué buscas?</span>
      </button>
      {activated && (
        <AssistantPanel open={open} onOpenChange={setOpen} returnFocusRef={buttonRef} />
      )}
    </>
  );
}
