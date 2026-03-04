import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const testimonials = [
  {
    name: "Carlos Mendoza",
    role: "Broker Independiente",
    initials: "CM",
    color: "bg-blue-500",
    gradientFrom: "from-blue-500",
    gradientTo: "to-blue-600",
    quote:
      "BitHauss transformó mi negocio. Mis clientes confían más cuando ven el sello BRC en mis propiedades. He cerrado un 40% más de ventas desde que empecé a usar la plataforma.",
  },
  {
    name: "Ana Lucía Vargas",
    role: "Directora de Inmobiliaria",
    initials: "AV",
    color: "bg-emerald-500",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-emerald-600",
    quote:
      "Como inmobiliaria, la certificación BRC nos diferencia de la competencia. El CRM integrado y los leads calificados han sido un game-changer para nuestro equipo de 15 agentes.",
  },
  {
    name: "Roberto Sánchez",
    role: "Comprador",
    initials: "RS",
    color: "bg-violet-500",
    gradientFrom: "from-violet-500",
    gradientTo: "to-violet-600",
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
    <section className="relative py-20 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-secondary/30">
      {/* Background pattern - subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(221 83% 53%) 1px, transparent 0)`,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Decorative gradient blurs */}
      <div className="absolute top-0 right-[10%] w-72 h-72 bg-primary/[0.04] rounded-full blur-3xl animate-float-slow" />
      <div className="absolute bottom-0 left-[10%] w-64 h-64 bg-accent/[0.04] rounded-full blur-3xl animate-float-slower" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            La{" "}
            <span className="relative inline-block">
              <span className="text-primary">Confianza</span>
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
            </span>{" "}
            de Miles de Profesionales
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
              className="group relative border-border/30 bg-card/70 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
            >
              {/* Subtle gradient top border */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "linear-gradient(90deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              />

              <CardContent className="relative p-6 sm:p-8">
                {/* Decorative quote mark */}
                <div className="absolute top-4 right-5 opacity-[0.06]">
                  <Quote className="h-16 w-16 text-primary fill-primary" />
                </div>

                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400 drop-shadow-[0_1px_1px_rgba(251,191,36,0.3)]"
                    />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="relative text-sm text-foreground leading-relaxed">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border/50">
                  <div className="relative">
                    {/* Avatar ring glow */}
                    <div
                      className={`absolute -inset-[2px] rounded-full bg-gradient-to-br ${testimonial.gradientFrom} ${testimonial.gradientTo} opacity-70`}
                    />
                    <div
                      className={`relative bg-gradient-to-br ${testimonial.gradientFrom} ${testimonial.gradientTo} w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-md`}
                    >
                      {testimonial.initials}
                    </div>
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
                className="group flex items-center justify-center rounded-lg bg-card/80 backdrop-blur-sm border border-border/40 px-6 py-3 sm:px-8 sm:py-4 text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground hover:shadow-md hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5"
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
