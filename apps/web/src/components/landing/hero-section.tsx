"use client";

import { useState, useEffect, useRef } from "react";
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

const tabs = ["Compra", "Venta", "Renta", "Inversión", "Todos"];

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
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <Image
        src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/header.webp"
        alt="Bienes raíces"
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        {/* Headline */}
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
          Compra, Vende e Invierte{" "}
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
        <div className="mt-10 flex items-center justify-center gap-6 sm:gap-8">
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
          <div className="flex items-center rounded-full bg-white overflow-hidden shadow-xl">
            <Select>
              <SelectTrigger className="w-[160px] h-14 border-0 rounded-none bg-white text-foreground font-medium pl-5 focus:ring-0 shadow-none">
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="departamento">Departamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="oficina">Oficina</SelectItem>
                <SelectItem value="local">Local Comercial</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-8 w-px bg-border/50" />

            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputValue ? "" : placeholderText || "Buscar..."}
                className="w-full h-14 pl-10 pr-4 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pr-3">
              <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
              </div>
              <button className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
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
