import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-foreground text-background">
      {/* Subtle pattern overlay */}
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
          ¿Listo para transformar tu negocio inmobiliario?
        </h2>

        <p className="mt-6 text-lg text-background/70 max-w-2xl mx-auto leading-relaxed">
          Únete a miles de profesionales que ya protegen sus transacciones con
          BitHauss. Comienza tu prueba gratuita de 14 días hoy.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="h-12 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
          >
            Comenzar Gratis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-12 px-8 text-base border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
          >
            Agendar Demo
          </Button>
        </div>

        <p className="mt-6 text-sm text-background/50">
          Sin tarjeta de crédito requerida &middot; Configuración en 5 minutos
        </p>
      </div>
    </section>
  );
}
