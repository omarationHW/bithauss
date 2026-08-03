"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const tabs = ["Compra", "Venta", "Renta", "Todos"];

const placeholders = [
  "Departamento en Polanco, CDMX",
  "Casa en San Pedro Garza García, Monterrey",
  "Terreno en Playa del Carmen, Quintana Roo",
  "Oficina en Santa Fe, CDMX",
  "Casa en Providencia, Guadalajara",
  "Departamento en Condesa, CDMX",
  "Villa frente al mar en Mérida, Yucatán",
  "Local comercial en Roma Norte, CDMX",
];

export function HeroSection() {
  const [activeTab, setActiveTab] = useState("Compra");
  const [placeholderText, setPlaceholderText] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [charIdx, setCharIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const router = useRouter();

  /**
   * Sends the visitor to the listing with the chosen filters. The tab maps to
   * the operation (`op`), the select to `tipo` and the free text to `q`.
   */
  function runSearch() {
    const params = new URLSearchParams();
    if (activeTab === "Renta") params.set("op", "rentar");
    if (propertyType) params.set("tipo", propertyType);
    const q = inputValue.trim();
    if (q) params.set("q", q);
    const qs = params.toString();
    router.push(qs ? `/propiedades?${qs}` : "/propiedades");
  }

  useEffect(() => {
    if (inputValue) return; // Stop animation when user types

    const current = placeholders[placeholderIdx] ?? "";

    if (!isDeleting && charIdx <= current.length) {
      const timeout = setTimeout(() => {
        setPlaceholderText(current.slice(0, charIdx));
        setCharIdx((c) => c + 1);
      }, 50);
      return () => clearTimeout(timeout);
    }

    if (!isDeleting && charIdx > current.length) {
      const timeout = setTimeout(() => setIsDeleting(true), 2000);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && charIdx > 0) {
      const timeout = setTimeout(() => {
        setCharIdx((c) => c - 1);
        setPlaceholderText(current.slice(0, charIdx - 1));
      }, 30);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && charIdx === 0) {
      setIsDeleting(false);
      setPlaceholderIdx((i) => (i + 1) % placeholders.length);
    }
  }, [charIdx, isDeleting, placeholderIdx, inputValue]);

  return (
    // pt-[--header-offset] keeps the centered content clear of the fixed
    // Navbar + PriceTicker, which otherwise sit on top of the headline on
    // short viewports (tablets in landscape, small laptops).
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-[var(--header-offset)]">
      {/* Background image */}
      <Image
        src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/header.jpg"
        alt="BitHauss - Compra, vende y renta bienes raíces certificados"
        fill
        className="object-cover"
        sizes="100vw"
        priority
        placeholder="blur"
        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzNnLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyMDIwMjAiLz48L3N2Zz4="
      />

      {/* Brand gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          opacity: 0.17,
        }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 text-center">
        {/* Headline */}
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
          Compra, Vende y Renta{" "}
          <br className="hidden sm:block" />
          en Bienes Raíces{" "}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Certificados</span>
            <svg
              className="absolute -bottom-2 left-0 w-full"
              viewBox="0 0 300 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 8.5C50 2.5 100 1 150 3.5C200 6 250 2.5 299 8.5"
                stroke="hsl(160 84% 39%)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        {/* Tabs */}
        <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:gap-x-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative pb-2 text-sm sm:text-base font-medium transition-colors duration-200",
                activeTab === tab
                  ? "text-white"
                  : "text-white/60 hover:text-white/80"
              )}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="mt-6 max-w-3xl mx-auto">
          {/* Stacks on phones (a 160px select + input + actions do not fit on
              a 360px screen); single pill from sm: up. */}
          <div className="flex flex-col sm:flex-row sm:items-center rounded-3xl sm:rounded-full bg-white overflow-hidden shadow-xl divide-y sm:divide-y-0 divide-border/50">
            {/* Values must match the labels the listing filters on. */}
            <Select value={propertyType} onValueChange={setPropertyType}>
              <SelectTrigger className="w-full sm:w-[160px] h-12 sm:h-14 border-0 rounded-none bg-white text-foreground font-medium pl-5 focus:ring-0 shadow-none">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Departamento">Departamento</SelectItem>
                <SelectItem value="Casa">Casa</SelectItem>
                <SelectItem value="Casa en Condominio">Casa en Condominio</SelectItem>
                <SelectItem value="Terreno">Terreno</SelectItem>
                <SelectItem value="Oficina">Oficina</SelectItem>
                <SelectItem value="Local Comercial">Local Comercial</SelectItem>
                <SelectItem value="Bodega">Bodega</SelectItem>
                <SelectItem value="Hotel">Hotel</SelectItem>
                <SelectItem value="Departamento en Hotel">Departamento en Hotel</SelectItem>
              </SelectContent>
            </Select>

            <div className="hidden sm:block h-8 w-px bg-border/50" />

            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
                placeholder={inputValue ? "" : placeholderText || "Buscar..."}
                className="w-full h-12 sm:h-14 pl-10 pr-4 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 px-3 pb-3 sm:px-0 sm:pb-0 sm:pr-3">
              <button
                type="button"
                onClick={runSearch}
                aria-label="Buscar propiedades"
                className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
              >
                <Search className="h-5 w-5 text-primary" />
              </button>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-8 text-sm sm:text-base text-white/80 max-w-3xl mx-auto leading-relaxed">
          La primera plataforma en digitalizar todo el procedimiento de compraventa de
          inmuebles. Publica, certifica y opera propiedades a distancia con total seguridad
          jurídica.
        </p>
      </div>
    </section>
  );
}
