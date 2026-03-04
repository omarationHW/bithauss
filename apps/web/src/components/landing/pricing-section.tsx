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
    <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Planes para Profesionales Inmobiliarios
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Elige el plan que mejor se adapte a tu negocio. Todos incluyen
            acceso a la plataforma y 14 días de prueba gratis.
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
                  ? "border-primary shadow-xl shadow-primary/10 md:scale-105 md:z-10"
                  : "border-border/50 hover:shadow-lg hover:shadow-primary/5"
              )}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground border-0 px-4 py-1 text-sm">
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
                  <span className="text-4xl font-bold text-foreground">
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
                          "rounded-full p-0.5 mt-0.5",
                          plan.popular
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-accent-foreground"
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.ctaVariant}
                  className={cn(
                    "w-full",
                    plan.popular && "shadow-md shadow-primary/25"
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
