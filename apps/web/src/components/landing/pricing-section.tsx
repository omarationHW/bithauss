import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    name: "Empresas",
    price: "$2,499",
    period: "MXN/mes",
    description: "Para inmobiliarias y equipos grandes.",
    popular: false,
    features: [
      "Propiedades ilimitadas",
      "Leads ilimitados",
      "API access completo",
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
    <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="mx-auto max-w-6xl">
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
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
            Los portales tradicionales cobran de $20,000 a $80,000 MXN por
            publicar 500 propiedades, con un jugador dominante controlando el
            70% del mercado. En BitHauss ofrecemos precios justos con CRM
            integrado, 14 días de prueba gratis.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-center">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-xl border p-8 transition-all duration-300",
                plan.popular
                  ? "text-white md:scale-105 md:z-10 md:py-12 shadow-2xl border-transparent"
                  : "bg-white border-border/50 hover:shadow-lg hover:-translate-y-1"
              )}
              style={
                plan.popular
                  ? {
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53%) 0%, hsl(160 84% 39%) 50%, hsl(221 83% 53%) 100%)",
                      backgroundSize: "200% 200%",
                      animation: "gradient 8s ease infinite, card-glow 3s ease-in-out infinite",
                    }
                  : undefined
              }
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge className="border-0 px-5 py-1.5 text-sm font-semibold bg-primary text-white shadow-lg">
                    Más Popular
                  </Badge>
                </div>
              )}

              <div className="mb-4">
                <h3
                  className={cn(
                    "text-xl font-bold",
                    plan.popular ? "text-white" : "text-foreground"
                  )}
                >
                  {plan.name}
                </h3>
                <p
                  className={cn(
                    "text-sm mt-1",
                    plan.popular ? "text-white/80" : "text-muted-foreground"
                  )}
                >
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span
                  className={cn(
                    "text-4xl font-bold",
                    plan.popular ? "text-white" : "text-foreground"
                  )}
                >
                  {plan.price}
                </span>
                <span
                  className={cn(
                    "ml-1.5 text-sm",
                    plan.popular ? "text-white/70" : "text-muted-foreground"
                  )}
                >
                  {plan.period}
                </span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "rounded-full p-1 mt-0.5 shrink-0",
                        plan.popular
                          ? "bg-white/20 text-white"
                          : "bg-accent/15 text-accent"
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        plan.popular ? "text-white/90" : "text-foreground"
                      )}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.popular ? (
                <Button
                  size="lg"
                  className="w-full bg-white text-primary font-semibold hover:bg-white/90 transition-all duration-300"
                >
                  {plan.cta}
                </Button>
              ) : (
                <Button
                  variant={plan.ctaVariant}
                  size="lg"
                  className="w-full transition-all duration-300"
                >
                  {plan.cta}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
