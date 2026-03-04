import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    name: "Carlos Mendoza",
    role: "Broker Independiente",
    initials: "CM",
    color: "bg-blue-500",
    quote:
      "BitHauss transformó mi negocio. Mis clientes confían más cuando ven el sello BRC en mis propiedades. He cerrado un 40% más de ventas desde que empecé a usar la plataforma.",
  },
  {
    name: "Ana Lucía Vargas",
    role: "Directora de Inmobiliaria",
    initials: "AV",
    color: "bg-emerald-500",
    quote:
      "Como inmobiliaria, la certificación BRC nos diferencia de la competencia. El CRM integrado y los leads calificados han sido un game-changer para nuestro equipo de 15 agentes.",
  },
  {
    name: "Roberto Sánchez",
    role: "Comprador",
    initials: "RS",
    color: "bg-violet-500",
    quote:
      "Compré mi primera casa con total tranquilidad gracias al certificado BRC. Saber que la propiedad fue verificada legalmente me dio la confianza para hacer la inversión más grande de mi vida.",
  },
];

const partners = [
  "Notaría 45 CDMX",
  "Colegio de Notarios",
  "AMPI",
  "PROFECO",
  "CNBV",
  "RAN",
];

export function TrustSection() {
  return (
    <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/30">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            La Confianza de Miles de Profesionales
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Brokers, inmobiliarias y compradores confían en BitHauss para
            proteger sus transacciones
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.name}
              className="border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardContent className="p-6 sm:p-8">
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-sm text-foreground leading-relaxed">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border/50">
                  <div
                    className={`${testimonial.color} w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold`}
                  >
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Partners section */}
        <div className="mt-16 sm:mt-20 text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
            Respaldado por
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {partners.map((partner) => (
              <div
                key={partner}
                className="flex items-center justify-center rounded-lg bg-card border border-border/50 px-6 py-3 sm:px-8 sm:py-4 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground transition-all duration-200"
              >
                {partner}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
