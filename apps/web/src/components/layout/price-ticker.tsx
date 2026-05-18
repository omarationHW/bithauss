"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DollarSign, Euro, Bitcoin } from "lucide-react";
import { logError } from "@/lib/log";

type IconComp = typeof DollarSign | null;

interface DisplayItem {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: IconComp;
}

interface ApiItem {
  label: string;
  value: number;
  change: number;
}

const fallbackItems: DisplayItem[] = [
  { label: "USD/MXN", value: "17.15", change: "+0.12%", positive: true, icon: DollarSign },
  { label: "EUR/MXN", value: "18.62", change: "+0.08%", positive: true, icon: Euro },
  { label: "BTC/USD", value: "68,432.50", change: "+2.34%", positive: true, icon: Bitcoin },
  { label: "ETH/USD", value: "3,842.18", change: "-0.45%", positive: false, icon: null },
  { label: "BTC/MXN", value: "1,173,717", change: "+2.46%", positive: true, icon: Bitcoin },
  { label: "USDC/MXN", value: "17.14", change: "+0.10%", positive: true, icon: DollarSign },
];

function iconFor(label: string): IconComp {
  if (label.startsWith("BTC")) return Bitcoin;
  if (label.startsWith("ETH")) return null;
  if (label.includes("EUR")) return Euro;
  return DollarSign;
}

function formatValue(value: number, label: string): string {
  if (label === "BTC/MXN") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (label.startsWith("BTC") || label.startsWith("ETH")) {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function EthIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
    </svg>
  );
}

export function PriceTicker() {
  const [scrolled, setScrolled] = useState(false);
  const [items, setItems] = useState<DisplayItem[]>(fallbackItems);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/ticker", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items: ApiItem[] };
        if (cancelled || !Array.isArray(data.items) || data.items.length === 0) return;
        setItems(
          data.items.map((it) => ({
            label: it.label,
            value: formatValue(it.value, it.label),
            change: formatChange(it.change),
            positive: it.change >= 0,
            icon: iconFor(it.label),
          })),
        );
      } catch (err) {
        logError("price ticker fetch failed", err);
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const solid = !isHome || scrolled;

  return (
    <div
      className={cn(
        "fixed top-16 z-40 w-full overflow-hidden transition-all duration-300",
        solid
          ? "bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm"
          : "bg-black/20 backdrop-blur-md border-b border-white/10"
      )}
    >
      <div className="relative h-9 flex items-center">
        {/* Fade edges */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none",
            solid
              ? "bg-gradient-to-r from-background/90 to-transparent"
              : "bg-gradient-to-r from-black/20 to-transparent"
          )}
        />
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none",
            solid
              ? "bg-gradient-to-l from-background/90 to-transparent"
              : "bg-gradient-to-l from-black/20 to-transparent"
          )}
        />

        {/* Scrolling content */}
        <div className="animate-ticker flex whitespace-nowrap">
          {[...items, ...items].map((item, i) => {
            const IconComponent = item.icon;
            return (
              <div key={i} className="inline-flex items-center gap-1.5 px-5">
                {IconComponent ? (
                  <IconComponent className={cn("h-3.5 w-3.5", solid ? "text-primary" : "text-primary/80")} />
                ) : (
                  <EthIcon className={cn("h-3.5 w-3.5", solid ? "text-primary" : "text-primary/80")} />
                )}
                <span className={cn("text-xs font-medium", solid ? "text-foreground" : "text-white")}>
                  {item.label}
                </span>
                <span className={cn("text-xs font-semibold", solid ? "text-foreground" : "text-white")}>
                  {item.value}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    item.positive ? "text-accent" : "text-destructive"
                  )}
                >
                  {item.change}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
