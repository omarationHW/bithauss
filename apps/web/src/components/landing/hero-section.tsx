"use client";

import { Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const stats = [
  { value: "2,500+", label: "Propiedades" },
  { value: "500+", label: "Brokers Verificados" },
  { value: "99.9%", label: "Seguridad" },
  { value: "$0", label: "Fraudes" },
];

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background pattern with gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 50%, hsl(221 83% 53% / 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, hsl(160 84% 39% / 0.06) 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, hsl(221 83% 53% / 0.04) 0%, transparent 50%),
            linear-gradient(135deg, hsl(210 20% 98%) 0%, hsl(214 32% 96%) 50%, hsl(210 20% 98%) 100%)
          `,
        }}
      />
      {/* Geometric pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(30deg, hsl(221 83% 53%) 12%, transparent 12.5%, transparent 87%, hsl(221 83% 53%) 87.5%, hsl(221 83% 53%)),
            linear-gradient(150deg, hsl(221 83% 53%) 12%, transparent 12.5%, transparent 87%, hsl(221 83% 53%) 87.5%, hsl(221 83% 53%)),
            linear-gradient(30deg, hsl(221 83% 53%) 12%, transparent 12.5%, transparent 87%, hsl(221 83% 53%) 87.5%, hsl(221 83% 53%)),
            linear-gradient(150deg, hsl(221 83% 53%) 12%, transparent 12.5%, transparent 87%, hsl(221 83% 53%) 87.5%, hsl(221 83% 53%)),
            linear-gradient(60deg, hsl(160 84% 39% / 0.5) 25%, transparent 25.5%, transparent 75%, hsl(160 84% 39% / 0.5) 75%, hsl(160 84% 39% / 0.5)),
            linear-gradient(60deg, hsl(160 84% 39% / 0.5) 25%, transparent 25.5%, transparent 75%, hsl(160 84% 39% / 0.5) 75%, hsl(160 84% 39% / 0.5))
          `,
          backgroundSize: "80px 140px",
          backgroundPosition:
            "0 0, 0 0, 40px 70px, 40px 70px, 0 0, 40px 70px",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
        {/* Headline */}
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Plataforma No. 1 en Bienes Raíces Certificados
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
            Compra, Vende e Invierte en Bienes Raíces{" "}
            <span className="relative">
              <span className="text-primary">Certificados</span>
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

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            La primera plataforma inmobiliaria en México con certificación
            jurídica digital. Protege tu patrimonio con BitHauss.
          </p>
        </div>

        {/* Search bar */}
        <div className="mt-10 sm:mt-12 max-w-4xl mx-auto">
          <div className="rounded-2xl bg-card p-3 sm:p-4 shadow-xl shadow-primary/5 border border-border/50">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ubicación, colonia o ciudad..."
                  className="pl-10 h-12 border-0 bg-secondary/50 focus-visible:ring-1"
                />
              </div>

              <Select>
                <SelectTrigger className="w-full sm:w-[160px] h-12 border-0 bg-secondary/50">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casa">Casa</SelectItem>
                  <SelectItem value="departamento">Departamento</SelectItem>
                  <SelectItem value="terreno">Terreno</SelectItem>
                  <SelectItem value="oficina">Oficina</SelectItem>
                  <SelectItem value="local">Local Comercial</SelectItem>
                </SelectContent>
              </Select>

              <Select>
                <SelectTrigger className="w-full sm:w-[150px] h-12 border-0 bg-secondary/50">
                  <SelectValue placeholder="Operación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comprar">Comprar</SelectItem>
                  <SelectItem value="rentar">Rentar</SelectItem>
                </SelectContent>
              </Select>

              <Button size="lg" className="h-12 px-8 text-base">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12 sm:mt-16 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-0">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`text-center px-4 py-3 ${
                  i < stats.length - 1
                    ? "md:border-r md:border-border/50"
                    : ""
                }`}
              >
                <div className="text-2xl sm:text-3xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
