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
  { value: "2,500+", label: "Propiedades", accent: "from-primary/10 to-primary/5" },
  { value: "500+", label: "Brokers Verificados", accent: "from-accent/10 to-accent/5" },
  { value: "99.9%", label: "Seguridad", accent: "from-violet-500/10 to-violet-500/5" },
  { value: "$0", label: "Fraudes", accent: "from-emerald-500/10 to-emerald-500/5" },
];

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient base */}
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

      {/* Dot grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(221 83% 53% / 0.08) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Mesh gradient overlay for extra depth */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            conic-gradient(from 45deg at 30% 30%, hsl(221 83% 53% / 0.06), transparent 25%),
            conic-gradient(from 200deg at 70% 70%, hsl(160 84% 39% / 0.05), transparent 25%),
            conic-gradient(from 120deg at 50% 50%, hsl(280 65% 60% / 0.03), transparent 20%)
          `,
        }}
      />

      {/* Animated floating decorative elements */}
      <div
        className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full animate-float-slow"
        style={{
          background: "radial-gradient(circle, hsl(221 83% 53% / 0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute top-[60%] right-[8%] w-96 h-96 rounded-full animate-float-slower"
        style={{
          background: "radial-gradient(circle, hsl(160 84% 39% / 0.07) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute top-[30%] right-[20%] w-48 h-48 rounded-full animate-float-drift"
        style={{
          background: "radial-gradient(circle, hsl(280 65% 60% / 0.05) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />
      <div
        className="absolute bottom-[15%] left-[15%] w-64 h-64 rounded-full animate-float-slower"
        style={{
          background: "radial-gradient(circle, hsl(221 83% 53% / 0.06) 0%, transparent 70%)",
          filter: "blur(35px)",
          animationDelay: "3s",
        }}
      />

      {/* Small floating geometric shapes */}
      <div
        className="absolute top-[20%] right-[12%] w-3 h-3 rounded-full bg-primary/20 animate-float-slow"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute top-[70%] left-[10%] w-2 h-2 rounded-full bg-accent/25 animate-float-drift"
        style={{ animationDelay: "4s" }}
      />
      <div
        className="absolute top-[15%] left-[30%] w-4 h-4 rotate-45 bg-primary/10 animate-float-slower"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-[25%] right-[25%] w-3 h-3 rotate-12 bg-accent/15 animate-float-slow"
        style={{ animationDelay: "5s" }}
      />

      {/* Geometric pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
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
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6 backdrop-blur-sm border border-primary/10">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent animate-pulse-glow" />
            </span>
            Plataforma No. 1 en Bienes Raíces Certificados
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
            <span className="relative inline-block">
              Compra, Vende e Invierte
              <svg
                className="absolute -bottom-1 left-0 w-full"
                viewBox="0 0 400 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M1 5.5C80 1.5 160 1 200 3C240 5 320 2 399 5.5"
                  stroke="hsl(221 83% 53% / 0.2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            en Bienes Raíces{" "}
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

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            La primera plataforma en digitalizar todo el procedimiento de compraventa
            de inmuebles. Publica, certifica y opera propiedades a distancia con
            total{" "}
            <span className="relative inline-block">
              <span className="font-medium text-foreground/80">seguridad juridica</span>
              <svg
                className="absolute -bottom-0.5 left-0 w-full"
                viewBox="0 0 200 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M1 4C40 1.5 80 1 100 2.5C120 4 160 1.5 199 4"
                  stroke="hsl(160 84% 39% / 0.4)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>.
          </p>
        </div>

        {/* Search bar with glassmorphism */}
        <div className="mt-10 sm:mt-12 max-w-4xl mx-auto">
          <div className="rounded-2xl p-3 sm:p-4 shadow-xl shadow-primary/8 border border-white/60 bg-white/70 backdrop-blur-xl dark:bg-card/70 dark:border-border/50">
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

              <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
          </div>
        </div>

        {/* Stats with gradient backgrounds */}
        <div className="mt-12 sm:mt-16 max-w-3xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`text-center px-4 py-4 animate-fade-in-up rounded-xl bg-gradient-to-br ${stat.accent} backdrop-blur-sm border border-white/40 dark:border-border/30`}
                style={{ animationDelay: `${i * 150}ms` }}
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
