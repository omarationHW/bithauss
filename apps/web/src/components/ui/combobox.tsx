"use client";

import * as React from "react";
import { ChevronDown, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Combobox                                                           */
/*                                                                     */
/*  Dependency-free searchable select: a text input plus a listbox.    */
/*  Selection works with pointer (mouse, touch and pen) and keyboard,  */
/*  never relying on hover, so it behaves the same on phones/tablets.  */
/*  Options can be filtered locally or served asynchronously through   */
/*  `onQueryChange` (see the SEPOMEX-backed pickers).                  */
/* ------------------------------------------------------------------ */

export interface ComboboxOption {
  /** Stored value (also the default label). */
  value: string;
  /** Main line shown in the list. Defaults to `value`. */
  label?: string;
  /** Secondary line — used to disambiguate homonyms ("Polanco — CDMX"). */
  hint?: string;
  /** Small right-aligned tag (e.g. how many listings match). */
  badge?: string;
}

export interface ComboboxProps {
  value: string;
  onChange: (value: string, option?: ComboboxOption) => void;
  options: ComboboxOption[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Filter `options` against the typed text locally. Default: true. */
  filterLocally?: boolean;
  /** Notified on every keystroke (for server-side search). */
  onQueryChange?: (query: string) => void;
  /** Keep whatever the user typed even if it matches no option. */
  allowCustomValue?: boolean;
  emptyMessage?: string;
  /** Shown under the input when there is nothing else to say. */
  hint?: string;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function Combobox({
  value,
  onChange,
  options,
  id,
  placeholder,
  disabled = false,
  loading = false,
  filterLocally = true,
  onQueryChange,
  allowCustomValue = false,
  emptyMessage = "Sin resultados",
  hint,
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value);
  // True once the user types: until then the full list is offered.
  const [typing, setTyping] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Last value this component emitted, so we can tell an external update
  // (postal-code autofill, form reset, record loaded for editing) apart from
  // our own — only the former resets what the user is typing.
  const emittedRef = React.useRef(value);

  React.useEffect(() => {
    if (value === emittedRef.current) return;
    emittedRef.current = value;
    setQuery(value);
    setTyping(false);
  }, [value]);

  const emit = React.useCallback(
    (next: string, option?: ComboboxOption) => {
      emittedRef.current = next;
      onChange(next, option);
    },
    [onChange]
  );

  const filtered = React.useMemo(() => {
    if (!filterLocally || !typing) return options;
    const q = normalize(query);
    if (!q) return options;
    return options.filter((o) => {
      const label = o.label ?? o.value;
      return (
        normalize(label).includes(q) ||
        (o.hint ? normalize(o.hint).includes(q) : false)
      );
    });
  }, [options, filterLocally, typing, query]);

  React.useEffect(() => {
    setHighlight(0);
  }, [filtered.length, open]);

  // Close when pointing anywhere outside (works for touch too).
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setTyping(false);
        setQuery(value);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, value]);

  // Keep the highlighted row visible while navigating with the keyboard.
  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`
    );
    // Optional call: not every environment implements scrollIntoView.
    node?.scrollIntoView?.({ block: "nearest" });
  }, [highlight, open]);

  function commit(option: ComboboxOption) {
    emit(option.value, option);
    setQuery(option.label ?? option.value);
    setTyping(false);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((h) => {
        if (filtered.length === 0) return 0;
        const next = event.key === "ArrowDown" ? h + 1 : h - 1;
        return (next + filtered.length) % filtered.length;
      });
      return;
    }
    if (event.key === "Enter") {
      if (open && filtered[highlight]) {
        event.preventDefault();
        commit(filtered[highlight]);
      } else if (allowCustomValue && query.trim()) {
        event.preventDefault();
        emit(query.trim());
        setOpen(false);
      }
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setTyping(false);
      setQuery(value);
      return;
    }
    if (event.key === "Tab") setOpen(false);
  }

  const listboxId = id ? `${id}-listbox` : undefined;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setTyping(true);
            setOpen(true);
            onQueryChange?.(next);
            if (allowCustomValue) emit(next);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-16 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            inputClassName
          )}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {!loading && value && !disabled && (
            <button
              type="button"
              aria-label="Limpiar"
              className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
              onClick={() => {
                emit("");
                setQuery("");
                setTyping(false);
                setOpen(false);
                onQueryChange?.("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </div>

      {hint && !open && (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}

      {open && !disabled && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {filtered.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {loading ? "Buscando..." : emptyMessage}
            </p>
          )}
          {filtered.map((option, index) => {
            const label = option.label ?? option.value;
            const selected = normalize(option.value) === normalize(value);
            return (
              <div
                key={`${option.value}-${option.hint ?? ""}-${index}`}
                role="option"
                aria-selected={selected}
                data-index={index}
                // pointerdown (not click) so the input's blur never wins the race.
                onPointerDown={(e) => {
                  e.preventDefault();
                  commit(option);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={cn(
                  "flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm",
                  index === highlight
                    ? "bg-accent/10 text-foreground"
                    : "text-foreground",
                  selected && "font-semibold"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{label}</span>
                  {option.hint && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  )}
                </span>
                {option.badge && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {option.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
