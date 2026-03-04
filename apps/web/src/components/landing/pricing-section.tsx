import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Básico",
    price: "$499",
    period: "MXN/mes",
    description: "Ideal para brokers independientes que inician.",
    popular: false,
    features: [
      "10 propiedades activas",
      "50 leads por mes",
      "Panel básico de estadísticas",
      "Listado en directorio",
      "Soporte por email",
    ],
    cta: "Comenzar Gratis",
    ctaVariant: "outline" as const,
  },
  {
    name: "Profesional",
    price: "$999",
    period: "MXN/mes",
    description: "Para profesionales que buscan crecer su negocio.",
    popular: true,
    features: [
      "50 propiedades activas",
      "Leads ilimitados",
      "CRM avanzado integrado",
      "BRC con descuento (50% off)",
      "Reportes avanzados",
      "Posicionamiento premium",
      "Soporte prioritario",
    ],
    cta: "Comenzar Gratis",
    ctaVariant: "default" as const,
  },
  {
    name: "Enterprise",
    price: "$2,499",
    period: "MXN/mes",
    description: "Para inmobiliarias y equipos grandes.",
    popular: false,
    features: [
      "Propiedades ilimitadas",
      "Leads ilimitados",
      "API access completo",
      "BRC incluido (sin costo extra)",
      "CRM + integraciones",
      "Soporte dedicado 24/7",
      "Marca personalizada",
      "Reportes ejecutivos",
    ],
    cta: "Contactar Ventas",
    ctaVariant: "outline" as const,
  },
];

export function PricingSection() {
  return (
    <section className="relative py-20 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Gradient mesh background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 10% 80%, hsl(221 83% 53% / 0.06) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 90% 20%, hsl(160 84% 39% / 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 50% 50%, hsl(221 83% 53% / 0.03) 0%, transparent 60%),
            linear-gradient(180deg, hsl(210 20% 98%) 0%, hsl(214 32% 96% / 0.5) 50%, hsl(210 20% 98%) 100%)
          `,
        }}
      />

      {/* Floating decorative circles */}
      <div className="absolute top-20 left-[8%] w-64 h-64 rounded-full border border-primary/[0.07] animate-float-slow" />
      <div className="absolute bottom-16 right-[5%] w-48 h-48 rounded-full border border-accent/[0.08] animate-float-reverse" />
      <div className="absolute top-1/2 left-[3%] w-20 h-20 rounded-full bg-primary/[0.04] animate-float-drift" />
      <div className="absolute top-32 right-[12%] w-32 h-32 rounded-full bg-accent/[0.03] animate-float-slower" />
      <div className="absolute bottom-32 left-[15%] w-12 h-12 rounded-full bg-primary/[0.06] animate-float" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Planes Accesibles para{" "}
            <span className="relative inline-block">
              <span className="text-primary">Profesionales</span>
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
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Los portales tradicionales cobran de $20,000 a $80,000 MXN por
            publicar 500 propiedades, con un jugador dominante controlando el
            70% del mercado. En BitHauss ofrecemos precios justos con CRM
            integrado. 14 dias de prueba gratis.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-start">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                "relative transition-all duration-300",
                plan.popular
                  ? "border-transparent md:scale-105 md:z-10 animate-card-glow"
                  : "border-border/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
              )}
            >
              {/* Gradient border for popular card */}
              {plan.popular && (
                <div
                  className="absolute -inset-[1px] rounded-xl -z-10"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%), hsl(221 83% 53%))",
                    backgroundSize: "200% 200%",
                    animation: "gradient-shift 4s ease infinite",
                  }}
                />
              )}

              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge
                    className="border-0 px-5 py-1.5 text-sm font-semibold text-white shadow-lg shadow-primary/30"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53%), hsl(221 83% 45%))",
                    }}
                  >
                    Más Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4 pt-8">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.description}
                </p>
                <div className="mt-4">
                  <span
                    className={cn(
                      "text-4xl font-bold",
                      plan.popular
                        ? "bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent"
                        : "text-foreground"
                    )}
                  >
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground ml-1.5 text-sm">
                    {plan.period}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="pb-8">
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div
                        className={cn(
                          "rounded-full p-1 mt-0.5 shrink-0",
                          plan.popular
                            ? "text-white shadow-sm shadow-primary/20"
                            : "text-white shadow-sm shadow-accent/20"
                        )}
                        style={{
                          background: plan.popular
                            ? "linear-gradient(135deg, hsl(221 83% 53%), hsl(221 83% 45%))"
                            : "linear-gradient(135deg, hsl(160 84% 39%), hsl(160 84% 32%))",
                        }}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </div>
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.ctaVariant}
                  className={cn(
                    "w-full transition-all duration-300",
                    plan.popular &&
                      "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                  )}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
