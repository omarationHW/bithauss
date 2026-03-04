import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  ArrowLeftRight,
  Eye,
  Shield,
  Lightbulb,
  Users,
  Linkedin,
  Target,
  Crosshair,
  ArrowRight,
  Bitcoin,
  Brain,
  Blocks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Nosotros - BitHauss | Bienes Raices Certificados",
  description:
    "Conoce la mision, vision y equipo detras de BitHauss. Transformamos el mercado inmobiliario en Mexico eliminando el fraude con certificacion juridica digital.",
};

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const problemStats = [
  {
    value: "$600M MXN",
    label: "Perdidas anuales por fraudes inmobiliarios en Mexico",
  },
  {
    value: "35M",
    label: "Propiedades en Mexico, solo el 10% estan digitalizadas",
  },
  {
    value: "8 de 10",
    label: "Operaciones inmobiliarias se inician en internet",
  },
  {
    value: "$20k-$80k",
    label: "MXN cuesta publicar 500 propiedades en portales tradicionales",
  },
];

const marketStats = [
  {
    value: "280.6",
    unit: "Billones USD",
    label: "Valor de bienes inmuebles en el mundo",
  },
  {
    value: "3.5x",
    unit: "PIB Mundial",
    label: "Los bienes raices como deposito de riqueza",
  },
  {
    value: "80%",
    unit: "de leads",
    label: "De compra se originan de portales inmobiliarios",
  },
  {
    value: "10%",
    unit: "digitalizadas",
    label: "De las propiedades en venta o renta en Mexico",
  },
];

const solutions = [
  {
    icon: ShieldCheck,
    title: "Bienes Raices Certificados",
    description:
      "Creadores del concepto BRC para reducir fraudes inmobiliarios mediante validacion notarial digital.",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-teal-500",
  },
  {
    icon: Building2,
    title: "Portal Inmobiliario CRM",
    description:
      "Creacion del primer portal inmobiliario con CRM integrado y precios accesibles en Mexico.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    gradientFrom: "from-blue-500",
    gradientTo: "to-indigo-500",
  },
  {
    icon: ArrowLeftRight,
    title: "Compraventa Digital",
    description:
      "Primer portal en integrar todo el proceso de compraventa inmobiliaria de manera digital.",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    gradientFrom: "from-violet-500",
    gradientTo: "to-purple-500",
  },
  {
    icon: Bitcoin,
    title: "Compra con Criptomonedas",
    description:
      "Portal inmobiliario que permite la compra de propiedades a distancia mediante criptomonedas.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    gradientFrom: "from-amber-500",
    gradientTo: "to-orange-500",
  },
  {
    icon: Brain,
    title: "Inteligencia Artificial",
    description:
      "Apps de IA para facilitar la busqueda de inmuebles con recomendaciones inteligentes.",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    gradientFrom: "from-pink-500",
    gradientTo: "to-rose-500",
  },
  {
    icon: Blocks,
    title: "Inmuebles Tokenizados",
    description:
      "Portal que permite publicar y administrar inmuebles tokenizados para inversion fraccionada.",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    gradientFrom: "from-cyan-500",
    gradientTo: "to-sky-500",
  },
];

const team = [
  {
    name: "Renato Torres",
    role: "Fundador",
    bio: "Visionario del sector inmobiliario con amplia experiencia en negocios y desarrollo estrategico",
    initials: "RT",
    color: "bg-blue-600",
  },
  {
    name: "Omar Rivera",
    role: "Co-Fundador",
    bio: "Emprendedor tech con 10+ anos en desarrollo de plataformas digitales",
    initials: "OR",
    color: "bg-emerald-600",
  },
  {
    name: "Oscar Rivera",
    role: "Co-Fundador",
    bio: "Especialista en tecnologia y arquitectura de soluciones empresariales",
    initials: "OR",
    color: "bg-violet-600",
  },
];

const values = [
  {
    icon: Eye,
    title: "Transparencia",
    description: "Cada paso del proceso es visible y verificable",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderTopColor: "border-t-blue-500",
  },
  {
    icon: Shield,
    title: "Seguridad",
    description: "La proteccion de tu patrimonio es nuestra prioridad",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderTopColor: "border-t-emerald-500",
  },
  {
    icon: Lightbulb,
    title: "Innovacion",
    description: "Tecnologia al servicio del sector inmobiliario",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderTopColor: "border-t-amber-500",
  },
  {
    icon: Users,
    title: "Accesibilidad",
    description: "Herramientas profesionales a precios justos",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderTopColor: "border-t-violet-500",
  },
];

const platformStats = [
  { value: "2,500+", label: "Propiedades" },
  { value: "500+", label: "Brokers" },
  { value: "150+", label: "Notarios" },
  { value: "32", label: "Estados" },
];

/* ------------------------------------------------------------------ */
/*  Decorative section divider                                         */
/* ------------------------------------------------------------------ */
function SectionDivider({ flip = false }: { flip?: boolean }) {
  return (
    <div className={cn("w-full overflow-hidden leading-[0]", flip && "rotate-180")}>
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
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function NosotrosPage() {
  return (
    <main className="min-h-screen">
      {/* ============================================================ */}
      {/*  1. Hero                                                     */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 30% 20%, hsl(221 83% 53% / 0.10) 0%, transparent 50%),
              radial-gradient(circle at 70% 80%, hsl(160 84% 39% / 0.08) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, hsl(221 83% 53% / 0.04) 0%, transparent 70%),
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

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge
            variant="secondary"
            className="mb-6 px-4 py-1.5 text-sm font-medium"
          >
            Sobre BitHauss
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
            Transformando el Mercado Inmobiliario en{" "}
            <span className="relative inline-block">
              <span className="text-primary">Mexico</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 8.5C50 2.5 100 1 150 3.5C200 6 250 2.5 299 8.5" stroke="hsl(160 84% 39%)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            BitHauss es la primera plataforma en digitalizar todo el procedimiento
            de compraventa de inmuebles, permitiendo realizar operaciones a distancia.
            Tambien, la primera en implementar el concepto BRC (Bienes Raices Certificados)
            para evitar fraudes inmobiliarios.
          </p>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Somos el portal de acceso a la nueva era digital inmobiliaria, donde el
            cliente puede publicar inmuebles tradicionales, buscar propiedades
            certificadas, tokenizadas, o comprar propiedades con criptomonedas.
          </p>
        </div>
      </section>

      {/* Decorative divider */}
      <SectionDivider />

      {/* ============================================================ */}
      {/*  2. Mision y Vision                                          */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-6 sm:gap-8">
          {/* Mision */}
          <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-primary" />
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Nuestra Mision</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                Proteger el patrimonio de los mexicanos mediante tecnologia y
                certificacion juridica, eliminando el fraude en transacciones
                inmobiliarias.
              </p>
            </CardContent>
          </Card>

          {/* Vision */}
          <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-lg bg-accent/10 p-2.5">
                  <Crosshair className="h-5 w-5 text-accent" />
                </div>
                <CardTitle className="text-xl">Nuestra Vision</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                Ser la plataforma lider en Latinoamerica para bienes raices
                certificados, donde cada propiedad cuenta con respaldo notarial
                verificable.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Decorative divider */}
      <SectionDivider />

      {/* ============================================================ */}
      {/*  2.5 Oportunidad de Mercado                                  */}
      {/* ============================================================ */}
      <section className="relative py-16 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Gradient mesh background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 20% 30%, hsl(221 83% 53% / 0.06) 0%, transparent 40%),
              radial-gradient(circle at 80% 70%, hsl(160 84% 39% / 0.05) 0%, transparent 40%),
              radial-gradient(circle at 50% 50%, hsl(221 83% 53% / 0.02) 0%, transparent 60%),
              linear-gradient(180deg, hsl(214 32% 96%) 0%, hsl(210 20% 98%) 50%, hsl(214 32% 96%) 100%)
            `,
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="text-center mb-10 sm:mb-14">
            <Badge
              variant="secondary"
              className="mb-6 px-4 py-1.5 text-sm font-medium"
            >
              Oportunidad de Mercado
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              El mercado inmobiliario en{" "}
              <span className="text-primary">numeros</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Los bienes raices son el deposito de riqueza mas importante del
              planeta y representan mas de 3.5 veces el PIB mundial
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {marketStats.map((stat, index) => {
              const gradients = [
                "from-blue-500 to-indigo-500",
                "from-emerald-500 to-teal-500",
                "from-violet-500 to-purple-500",
                "from-amber-500 to-orange-500",
              ];
              return (
                <div
                  key={stat.label}
                  className="relative rounded-xl border border-border/50 bg-card p-6 text-center transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-border overflow-hidden group"
                >
                  {/* Gradient top border */}
                  <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", gradients[index])} />
                  {/* Subtle glow on hover */}
                  <div className={cn("absolute top-0 left-0 right-0 h-24 bg-gradient-to-b opacity-0 transition-opacity duration-300 group-hover:opacity-100", gradients[index]?.replace("from-", "from-").replace("to-", "to-"))} style={{ opacity: 0 }} />
                  <div className="relative">
                    <div className="text-3xl sm:text-4xl font-extrabold text-primary">
                      {stat.value}
                    </div>
                    <div className="text-xs font-semibold text-accent mt-1 uppercase tracking-wide">
                      {stat.unit}
                    </div>
                    <Separator className="my-3 mx-auto w-12 bg-border" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {stat.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Fuentes: Savills World Research, INEGI, El Economista
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  3. El Problema - Stats                                      */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-foreground text-background">
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Gradient accents */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-destructive/10 rounded-full blur-3xl" />

        {/* Animated floating elements */}
        <div className="absolute top-20 left-[10%] w-3 h-3 rounded-full bg-primary/30 animate-pulse" />
        <div className="absolute top-40 right-[15%] w-2 h-2 rounded-full bg-accent/30 animate-pulse [animation-delay:1s]" />
        <div className="absolute bottom-32 left-[20%] w-2.5 h-2.5 rounded-full bg-destructive/20 animate-pulse [animation-delay:0.5s]" />
        <div className="absolute bottom-20 right-[25%] w-2 h-2 rounded-full bg-primary/25 animate-pulse [animation-delay:1.5s]" />
        <div className="absolute top-1/2 left-[5%] w-1.5 h-1.5 rounded-full bg-accent/20 animate-pulse [animation-delay:2s]" />
        <div className="absolute top-1/3 right-[8%] w-3 h-3 rounded-full bg-primary/15 animate-pulse [animation-delay:0.7s]" />

        {/* Floating geometric shapes */}
        <div className="absolute top-16 right-[20%] w-20 h-20 border border-primary/10 rounded-xl rotate-12 animate-pulse [animation-delay:1.2s]" />
        <div className="absolute bottom-24 left-[12%] w-16 h-16 border border-accent/10 rounded-full animate-pulse [animation-delay:0.3s]" />
        <div className="absolute top-1/2 right-[6%] w-12 h-12 border border-primary/8 rounded-lg rotate-45 animate-pulse [animation-delay:1.8s]" />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="text-center mb-12 sm:mb-16">
            <Badge
              variant="outline"
              className="mb-6 px-4 py-1.5 text-sm font-medium border-background/20 text-background/80"
            >
              El Problema
            </Badge>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              El fraude inmobiliario es una{" "}
              <span className="text-destructive">crisis real</span>
            </h2>
            <p className="mt-4 text-lg text-background/60 max-w-2xl mx-auto">
              Estas cifras muestran la magnitud del problema que estamos
              resolviendo
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-6">
            {problemStats.map((stat) => (
              <div key={stat.value} className="text-center group">
                <div className="relative inline-block">
                  <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-primary transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_20px_hsl(221_83%_53%/0.3)]">
                    {stat.value}
                  </div>
                  {/* Subtle glow behind the number */}
                  <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
                <Separator className="my-4 mx-auto w-12 bg-background/20" />
                <p className="text-sm text-background/60 leading-relaxed">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Decorative divider (flipped) */}
      <SectionDivider flip />

      {/* ============================================================ */}
      {/*  4. Nuestra Solucion                                         */}
      {/* ============================================================ */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle gradient mesh background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 15% 80%, hsl(160 84% 39% / 0.04) 0%, transparent 40%),
              radial-gradient(circle at 85% 20%, hsl(221 83% 53% / 0.04) 0%, transparent 40%)
            `,
          }}
        />

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            <Badge
              variant="secondary"
              className="mb-6 px-4 py-1.5 text-sm font-medium"
            >
              Nuestras Soluciones
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              6 soluciones para un mercado inmobiliario{" "}
              <span className="text-primary">moderno</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Existen portales inmobiliarios donde un jugador dominante controla
              el 70% del mercado. Inmobiliarias y brokers independientes,
              inconformes por los precios altos y la falta de conectividad,
              buscan opciones mas economicas y funcionales. En los demas rubros,
              la competencia de BitHauss es incipiente o no existe.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {solutions.map((solution, index) => {
              const Icon = solution.icon;
              return (
                <Card
                  key={solution.title}
                  className="border-border/50 transition-all duration-500 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1.5 group overflow-hidden"
                >
                  {/* Gradient top bar */}
                  <div className={cn("h-1 bg-gradient-to-r", solution.gradientFrom, solution.gradientTo)} />
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg",
                          solution.bgColor,
                          solution.borderColor
                        )}
                      >
                        <Icon className={cn("h-5 w-5", solution.color)} />
                      </div>
                      {/* Numbered badge with gradient */}
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white bg-gradient-to-br shadow-sm",
                          solution.gradientFrom,
                          solution.gradientTo
                        )}
                      >
                        {index + 1}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{solution.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {solution.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Decorative divider */}
      <SectionDivider />

      {/* ============================================================ */}
      {/*  5. Equipo Fundador                                          */}
      {/* ============================================================ */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background with gradient mesh */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 25% 25%, hsl(221 83% 53% / 0.05) 0%, transparent 40%),
              radial-gradient(circle at 75% 75%, hsl(160 84% 39% / 0.04) 0%, transparent 40%),
              linear-gradient(180deg, hsl(214 32% 96%) 0%, hsl(210 20% 98%) 50%, hsl(214 32% 96%) 100%)
            `,
          }}
        />
        {/* Decorative pattern behind cards */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `
              linear-gradient(45deg, hsl(221 83% 53%) 25%, transparent 25%),
              linear-gradient(-45deg, hsl(221 83% 53%) 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, hsl(221 83% 53%) 75%),
              linear-gradient(-45deg, transparent 75%, hsl(221 83% 53%) 75%)
            `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />
        {/* Large decorative circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-primary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-accent/5" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="text-center mb-12 sm:mb-16">
            <Badge
              variant="secondary"
              className="mb-6 px-4 py-1.5 text-sm font-medium"
            >
              Nuestro Equipo
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              El equipo detras de BitHauss
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Profesionales comprometidos con transformar el mercado inmobiliario
              en Mexico
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {team.map((member) => (
              <Card
                key={member.name}
                className="border-border/50 text-center transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 group overflow-hidden bg-card/80 backdrop-blur-sm"
              >
                {/* Gradient top accent */}
                <div className={cn("h-1.5 bg-gradient-to-r",
                  member.color === "bg-blue-600" && "from-blue-500 to-indigo-500",
                  member.color === "bg-emerald-600" && "from-emerald-500 to-teal-500",
                  member.color === "bg-violet-600" && "from-violet-500 to-purple-500",
                )} />
                <CardContent className="pt-8 pb-6 px-6">
                  {/* Avatar with ring */}
                  <div className="relative mx-auto w-24 h-24 mb-5">
                    <div
                      className={cn(
                        "w-full h-full rounded-full flex items-center justify-center text-white text-xl font-bold transition-all duration-300 group-hover:scale-110 shadow-lg",
                        member.color
                      )}
                    >
                      {member.initials}
                    </div>
                    {/* Decorative ring */}
                    <div className={cn(
                      "absolute inset-0 rounded-full border-2 border-dashed opacity-30 animate-[spin_20s_linear_infinite]",
                      member.color === "bg-blue-600" && "border-blue-400",
                      member.color === "bg-emerald-600" && "border-emerald-400",
                      member.color === "bg-violet-600" && "border-violet-400",
                    )} style={{ inset: "-6px" }} />
                  </div>

                  <h3 className="font-semibold text-foreground text-lg">
                    {member.name}
                  </h3>
                  <p className="text-sm font-medium text-primary mt-1">
                    {member.role}
                  </p>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {member.bio}
                  </p>

                  {/* LinkedIn */}
                  <div className="mt-5">
                    <Link
                      href="#"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary text-muted-foreground transition-all duration-200 hover:scale-110"
                      aria-label={`LinkedIn de ${member.name}`}
                    >
                      <Linkedin className="h-4 w-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Decorative divider */}
      <SectionDivider flip />

      {/* ============================================================ */}
      {/*  6. Valores                                                   */}
      {/* ============================================================ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12 sm:mb-16">
            <Badge
              variant="secondary"
              className="mb-6 px-4 py-1.5 text-sm font-medium"
            >
              Nuestros Valores
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Los principios que nos guian
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <div
                  key={value.title}
                  className={cn(
                    "relative overflow-hidden rounded-xl border border-border/50 bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 hover:border-border group",
                    "border-t-[3px]",
                    value.borderTopColor
                  )}
                >
                  <div className="flex gap-4 p-6">
                    <div
                      className={cn(
                        "flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-md",
                        value.bgColor
                      )}
                    >
                      <Icon className={cn("h-5 w-5", value.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {value.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {value.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Decorative divider */}
      <SectionDivider />

      {/* ============================================================ */}
      {/*  7. Numeros que nos respaldan                                 */}
      {/* ============================================================ */}
      <section className="relative py-16 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 30% 50%, hsl(221 83% 53% / 0.05) 0%, transparent 40%),
              radial-gradient(circle at 70% 50%, hsl(160 84% 39% / 0.04) 0%, transparent 40%),
              linear-gradient(180deg, hsl(214 32% 96%) 0%, hsl(210 20% 98%) 100%)
            `,
          }}
        />
        <div className="relative z-10 mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-center mb-10 sm:mb-12">
            Numeros que nos respaldan
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-0">
            {platformStats.map((stat, i) => (
              <div
                key={stat.label}
                className={cn(
                  "text-center px-4 py-5 group",
                  i < platformStats.length - 1 &&
                    "md:border-r md:border-border/50"
                )}
              >
                <div className="text-3xl sm:text-4xl font-bold text-primary transition-transform duration-300 group-hover:scale-110">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  8. CTA                                                       */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-foreground text-background">
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Gradient accents */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Unete a la revolucion inmobiliaria
          </h2>

          <p className="mt-6 text-lg text-background/70 max-w-2xl mx-auto leading-relaxed">
            Se parte de la plataforma que esta cambiando la forma en que Mexico
            compra, vende e invierte en bienes raices.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
            >
              <Link href="/auth/registro">
                Crear Cuenta
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
            >
              <Link href="#">Contactar Ventas</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
