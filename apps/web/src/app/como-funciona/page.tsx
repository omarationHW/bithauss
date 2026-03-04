import type { Metadata } from "next";
import Link from "next/link";
import {
  Search,
  ShieldCheck,
  CheckCircle,
  Upload,
  Award,
  Handshake,
  FileText,
  ClipboardCheck,
  Scale,
  Shield,
  Cpu,
  DollarSign,
  Headphones,
  Ban,
  Users,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Como Funciona - BitHauss",
  description:
    "Descubre como funciona BitHauss: la plataforma mas segura para comprar, vender e invertir en bienes raices en Mexico con certificacion BRC.",
};

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

const buyerSteps = [
  {
    icon: Search,
    title: "Busca",
    description:
      "Explora miles de propiedades verificadas con filtros avanzados",
  },
  {
    icon: ShieldCheck,
    title: "Verifica",
    description:
      "Revisa el certificado BRC y la validacion notarial de cada propiedad",
  },
  {
    icon: CheckCircle,
    title: "Compra Seguro",
    description:
      "Realiza tu compra con total confianza y respaldo juridico",
  },
];

const sellerSteps = [
  {
    icon: Upload,
    title: "Publica",
    description:
      "Sube tu propiedad con fotos, descripcion y documentacion",
  },
  {
    icon: Award,
    title: "Certifica",
    description:
      "Solicita el certificado BRC para aumentar la confianza y visibilidad",
  },
  {
    icon: Handshake,
    title: "Cierra Tratos",
    description:
      "Recibe leads calificados y gestiona todo desde tu dashboard",
  },
];

const brcSteps = [
  {
    icon: FileText,
    title: "Solicitud",
    description:
      "El broker o vendedor solicita la certificacion BRC para su propiedad",
    accent: "blue",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    ringColor: "ring-blue-500/20",
    glowColor: "shadow-blue-500/20",
    gradientFrom: "from-blue-500",
    gradientTo: "to-indigo-500",
  },
  {
    icon: Upload,
    title: "Carga de Documentos",
    description:
      "Se suben escritura, identificacion oficial, comprobante predial y mas",
    accent: "blue",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    ringColor: "ring-blue-500/20",
    glowColor: "shadow-blue-500/20",
    gradientFrom: "from-blue-500",
    gradientTo: "to-indigo-500",
  },
  {
    icon: ClipboardCheck,
    title: "Revision Operativa",
    description:
      "Nuestro equipo de operadores verifica la integridad documental",
    accent: "amber",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    ringColor: "ring-amber-500/20",
    glowColor: "shadow-amber-500/20",
    gradientFrom: "from-amber-500",
    gradientTo: "to-orange-500",
  },
  {
    icon: Scale,
    title: "Validacion Notarial",
    description:
      "Un notario publico certificado valida la autenticidad legal",
    accent: "violet",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    ringColor: "ring-violet-500/20",
    glowColor: "shadow-violet-500/20",
    gradientFrom: "from-violet-500",
    gradientTo: "to-purple-500",
  },
  {
    icon: Award,
    title: "Certificado Digital",
    description:
      "Se emite el Certificado BRC con sello digital verificable",
    accent: "emerald",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    ringColor: "ring-emerald-500/20",
    glowColor: "shadow-emerald-500/20",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-teal-500",
  },
];

const benefits = [
  {
    icon: Shield,
    title: "Seguridad Juridica",
    description: "Validacion notarial de cada propiedad",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderTopColor: "border-t-blue-500",
    gradientFrom: "from-blue-500",
    gradientTo: "to-indigo-500",
  },
  {
    icon: Cpu,
    title: "Tecnologia de Punta",
    description: "Plataforma moderna y rapida",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderTopColor: "border-t-violet-500",
    gradientFrom: "from-violet-500",
    gradientTo: "to-purple-500",
  },
  {
    icon: DollarSign,
    title: "Precios Accesibles",
    description: "Planes desde $499 MXN/mes",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderTopColor: "border-t-emerald-500",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-teal-500",
  },
  {
    icon: Headphones,
    title: "Soporte Dedicado",
    description: "Equipo de soporte en espanol 24/7",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderTopColor: "border-t-amber-500",
    gradientFrom: "from-amber-500",
    gradientTo: "to-orange-500",
  },
  {
    icon: Ban,
    title: "Sin Fraudes",
    description: "Proteccion contra fraudes inmobiliarios",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderTopColor: "border-t-red-500",
    gradientFrom: "from-red-500",
    gradientTo: "to-rose-500",
  },
  {
    icon: Users,
    title: "Red de Notarios",
    description: "Notarios certificados en todo Mexico",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderTopColor: "border-t-primary",
    gradientFrom: "from-blue-600",
    gradientTo: "to-blue-400",
  },
];

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function ComoFuncionaPage() {
  return (
    <main className="min-h-screen">
      {/* ================================================================== */}
      {/*  1. Hero                                                           */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Subtle gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 30% 20%, hsl(221 83% 53% / 0.08) 0%, transparent 50%),
              radial-gradient(circle at 70% 80%, hsl(160 84% 39% / 0.06) 0%, transparent 50%),
              linear-gradient(180deg, hsl(210 20% 98%) 0%, hsl(214 32% 96%) 100%)
            `,
          }}
        />
        {/* Geometric pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(221 83% 53%) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge
            variant="secondary"
            className="mb-6 px-4 py-1.5 text-sm font-medium"
          >
            Transparencia y Confianza
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
            &iquest;Como Funciona{" "}
            <span className="relative inline-block">
              <span className="text-primary">BitHauss</span>
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
            ?
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            La plataforma mas segura para comprar, vender e invertir en bienes
            raices en Mexico
          </p>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  2. Para Compradores                                               */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(221 83% 53%) 1px, transparent 0)`,
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <Badge
              variant="outline"
              className="mb-4 px-4 py-1.5 text-sm font-medium"
            >
              Compradores
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Para Compradores
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Encuentra tu propiedad ideal con la seguridad que mereces
            </p>
          </div>

          {/* Horizontal timeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 relative">
            {/* Connecting line (desktop only) - thicker gradient line */}
            <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-primary/40 via-primary/60 to-primary/40" />

            {buyerSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative flex flex-col items-center text-center group">
                  {/* Step number circle */}
                  <div className="relative z-10 mb-6">
                    <div className="w-24 h-24 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-primary/15 group-hover:bg-primary/15 group-hover:border-primary/30">
                      <Icon className="h-10 w-10 text-primary" />
                    </div>
                    {/* Gradient number badge */}
                    <div className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/30">
                      {index + 1}
                    </div>
                  </div>

                  {/* Arrow between steps (mobile only) */}
                  {index < buyerSteps.length - 1 && (
                    <ChevronRight className="hidden max-md:hidden md:absolute md:top-12 md:right-0 md:translate-x-1/2 md:-translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                  )}

                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Decorative wave divider */}
      <div className="w-full overflow-hidden leading-[0]">
        <svg
          viewBox="0 0 1200 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-[30px] sm:h-[40px]"
          preserveAspectRatio="none"
        >
          <path
            d="M0 60V30C200 10 400 50 600 30C800 10 1000 50 1200 30V60H0Z"
            fill="hsl(221 83% 53%)"
            fillOpacity="0.04"
          />
          <path
            d="M0 60V40C200 20 400 55 600 35C800 15 1000 55 1200 35V60H0Z"
            fill="hsl(160 84% 39%)"
            fillOpacity="0.03"
          />
        </svg>
      </div>

      {/* ================================================================== */}
      {/*  3. Para Brokers y Vendedores                                      */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle gradient mesh */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 20% 50%, hsl(160 84% 39% / 0.04) 0%, transparent 40%),
              radial-gradient(circle at 80% 50%, hsl(221 83% 53% / 0.03) 0%, transparent 40%)
            `,
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <Badge
              variant="outline"
              className="mb-4 px-4 py-1.5 text-sm font-medium"
            >
              Brokers y Vendedores
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Para Brokers y Vendedores
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Publica, certifica y cierra tratos con herramientas profesionales
            </p>
          </div>

          {/* Horizontal timeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 relative">
            {/* Connecting line (desktop only) - thicker gradient line */}
            <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-accent/40 via-accent/60 to-accent/40" />

            {sellerSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative flex flex-col items-center text-center group">
                  {/* Step icon */}
                  <div className="relative z-10 mb-6">
                    <div className="w-24 h-24 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-accent/15 group-hover:bg-accent/15 group-hover:border-accent/30">
                      <Icon className="h-10 w-10 text-accent" />
                    </div>
                    {/* Gradient number badge */}
                    <div className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-accent/30">
                      {index + 1}
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  4. El Proceso BRC  - MAIN ATTRACTION                              */}
      {/* ================================================================== */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 20% 50%, hsl(221 83% 53% / 0.06) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 50%, hsl(160 84% 39% / 0.04) 0%, transparent 60%),
              linear-gradient(180deg, hsl(214 32% 96%) 0%, hsl(210 20% 98%) 50%, hsl(214 32% 96%) 100%)
            `,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(221 83% 53%) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-4xl">
          {/* Section header */}
          <div className="text-center mb-16 sm:mb-20">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <ShieldCheck className="h-4 w-4" />
              Certificacion BRC
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              El Proceso BRC
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Conoce paso a paso como certificamos cada propiedad para garantizar
              tu tranquilidad
            </p>
          </div>

          {/* Vertical timeline */}
          <div className="relative">
            {/* Vertical connecting line - thicker, more dramatic */}
            <div className="absolute left-8 sm:left-10 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/50 via-amber-500/50 via-violet-500/50 to-emerald-500/50" />
            {/* Secondary glow line behind */}
            <div className="absolute left-[31px] sm:left-[39px] top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500/10 via-amber-500/10 via-violet-500/10 to-emerald-500/10 blur-sm" />

            <div className="space-y-10 sm:space-y-12">
              {brcSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative flex gap-6 sm:gap-8 group">
                    {/* Left: icon node */}
                    <div className="relative z-10 flex-shrink-0">
                      {/* Outer glow ring */}
                      <div
                        className={cn(
                          "absolute inset-0 rounded-2xl opacity-0 transition-all duration-500 group-hover:opacity-100 blur-xl -z-10 scale-150",
                          step.bgColor,
                        )}
                      />
                      {/* Animated ring on hover */}
                      <div
                        className={cn(
                          "absolute inset-0 rounded-2xl border-2 opacity-0 transition-all duration-500 group-hover:opacity-40 group-hover:scale-125",
                          step.borderColor,
                        )}
                        style={{ inset: "-4px" }}
                      />
                      <div
                        className={cn(
                          "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl",
                          step.bgColor,
                          step.borderColor,
                          step.glowColor,
                        )}
                      >
                        <Icon className={cn("h-7 w-7 sm:h-8 sm:w-8", step.color)} />
                      </div>
                      {/* Small connector dot on the timeline */}
                      <div className={cn(
                        "absolute top-1/2 -left-[11px] sm:-left-[11px] w-2.5 h-2.5 rounded-full -translate-y-1/2 border-2 border-card transition-all duration-300",
                        step.accent === "blue" && "bg-blue-500",
                        step.accent === "amber" && "bg-amber-500",
                        step.accent === "violet" && "bg-violet-500",
                        step.accent === "emerald" && "bg-emerald-500",
                      )} />
                    </div>

                    {/* Right: card content */}
                    <Card className="flex-1 border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 group-hover:shadow-xl group-hover:border-border group-hover:-translate-y-1 overflow-hidden">
                      {/* Gradient top bar on the card */}
                      <div className={cn("h-0.5 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100", step.gradientFrom, step.gradientTo)} />
                      <CardContent className="p-5 sm:p-6">
                        <div className="flex items-center gap-3 mb-3">
                          {/* Gradient number badge */}
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white bg-gradient-to-br shadow-sm",
                              step.gradientFrom,
                              step.gradientTo,
                            )}
                          >
                            {index + 1}
                          </span>
                          <CardTitle className="text-lg sm:text-xl">
                            {step.title}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-sm sm:text-base leading-relaxed">
                          {step.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Final flourish - certificate badge */}
            <div className="relative z-10 mt-14 flex justify-center">
              <div className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 px-7 py-3.5 text-emerald-600 font-semibold transition-all duration-300 hover:from-emerald-500/15 hover:to-teal-500/15 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/10">
                <Award className="h-5 w-5" />
                Propiedad Certificada BRC
                <CheckCircle className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Decorative wave divider */}
      <div className="w-full overflow-hidden leading-[0] rotate-180">
        <svg
          viewBox="0 0 1200 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-[30px] sm:h-[40px]"
          preserveAspectRatio="none"
        >
          <path
            d="M0 60V30C200 10 400 50 600 30C800 10 1000 50 1200 30V60H0Z"
            fill="hsl(221 83% 53%)"
            fillOpacity="0.04"
          />
          <path
            d="M0 60V40C200 20 400 55 600 35C800 15 1000 55 1200 35V60H0Z"
            fill="hsl(160 84% 39%)"
            fillOpacity="0.03"
          />
        </svg>
      </div>

      {/* ================================================================== */}
      {/*  5. Por que BitHauss - Benefits grid                               */}
      {/* ================================================================== */}
      <section className="relative py-20 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background pattern */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 15% 30%, hsl(221 83% 53% / 0.04) 0%, transparent 40%),
              radial-gradient(circle at 85% 70%, hsl(160 84% 39% / 0.03) 0%, transparent 40%)
            `,
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              &iquest;Por que BitHauss?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Las razones por las que miles de profesionales confian en nosotros
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Card
                  key={benefit.title}
                  className={cn(
                    "transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1.5 group overflow-hidden",
                    "border-border/50 border-t-[3px]",
                    benefit.borderTopColor,
                  )}
                >
                  <CardContent className="p-6 sm:p-8">
                    {/* Icon with gradient background on hover */}
                    <div className="relative mb-4">
                      <div
                        className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg",
                          benefit.bgColor,
                        )}
                      >
                        <Icon className={cn("h-6 w-6", benefit.color)} />
                      </div>
                      {/* Glow behind icon on hover */}
                      <div
                        className={cn(
                          "absolute inset-0 w-14 h-14 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 blur-xl -z-10",
                          benefit.bgColor,
                        )}
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  6. CTA                                                            */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden bg-foreground text-background">
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        {/* Gradient accents */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            &iquest;Listo para empezar?
          </h2>

          <p className="mt-6 text-lg text-background/70 max-w-2xl mx-auto leading-relaxed">
            Unete a la plataforma de bienes raices mas segura de Mexico. Tu
            proxima propiedad te esta esperando.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
            >
              <Link href="/auth/register">
                Registrarse Gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
            >
              <Link href="/propiedades">Ver Propiedades</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-background/50">
            Sin tarjeta de credito requerida &middot; Configuracion en 5 minutos
          </p>
        </div>
      </section>
    </main>
  );
}
