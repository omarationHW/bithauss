import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 animate-gradient-shift"
        style={{
          background: `linear-gradient(
            135deg,
            hsl(222 47% 11%) 0%,
            hsl(221 60% 18%) 25%,
            hsl(222 47% 11%) 50%,
            hsl(230 50% 15%) 75%,
            hsl(222 47% 11%) 100%
          )`,
          backgroundSize: "200% 200%",
        }}
      />

      {/* Secondary color shimmer layer */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 20% 60%, hsl(221 83% 53% / 0.2) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 30%, hsl(160 84% 39% / 0.12) 0%, transparent 70%)
          `,
        }}
      />

      {/* Dot particle pattern */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(0 0% 100%) 0.5px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating geometric shapes */}
      {/* Top-left triangle */}
      <div className="absolute top-16 left-[8%] animate-float-slow opacity-[0.06]">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <polygon
            points="30,5 55,50 5,50"
            stroke="hsl(160 84% 39%)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>

      {/* Top-right circle */}
      <div className="absolute top-20 right-[12%] animate-float-reverse opacity-[0.07]">
        <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
          <circle
            cx="25"
            cy="25"
            r="22"
            stroke="hsl(221 83% 53%)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>

      {/* Bottom-left hexagon */}
      <div className="absolute bottom-20 left-[15%] animate-float-drift opacity-[0.06]">
        <svg width="45" height="45" viewBox="0 0 45 45" fill="none">
          <polygon
            points="22.5,2 40,12.5 40,32.5 22.5,43 5,32.5 5,12.5"
            stroke="hsl(160 84% 39%)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>

      {/* Bottom-right diamond */}
      <div className="absolute bottom-24 right-[8%] animate-float-slower opacity-[0.05]">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect
            x="20"
            y="2"
            width="25"
            height="25"
            rx="2"
            transform="rotate(45 20 2)"
            stroke="hsl(221 83% 53%)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>

      {/* Middle-left small circle */}
      <div className="absolute top-1/2 left-[4%] animate-dot-pulse opacity-[0.12]">
        <div className="w-3 h-3 rounded-full bg-accent" />
      </div>

      {/* Mid-right small dot */}
      <div
        className="absolute top-1/3 right-[6%] animate-dot-pulse opacity-[0.1]"
        style={{ animationDelay: "2s" }}
      >
        <div className="w-2 h-2 rounded-full bg-primary" />
      </div>

      {/* Small floating dots scattered */}
      <div
        className="absolute top-[25%] left-[25%] animate-dot-pulse opacity-[0.08]"
        style={{ animationDelay: "1s" }}
      >
        <div className="w-2 h-2 rounded-full bg-white" />
      </div>
      <div
        className="absolute top-[70%] right-[25%] animate-dot-pulse opacity-[0.08]"
        style={{ animationDelay: "3s" }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
      </div>
      <div
        className="absolute top-[15%] right-[35%] animate-dot-pulse opacity-[0.06]"
        style={{ animationDelay: "1.5s" }}
      >
        <div className="w-2 h-2 rounded-full bg-primary" />
      </div>

      {/* Large gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[100px] animate-float-slow" />
      <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] bg-accent/10 rounded-full blur-[100px] animate-float-slower" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
          ¿Listo para{" "}
          <span className="relative inline-block">
            <span
              style={{
                background:
                  "linear-gradient(135deg, hsl(0 0% 100%), hsl(210 40% 90%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              transformar
            </span>
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
          tu negocio inmobiliario?
        </h2>

        <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
          Únete a miles de profesionales que ya protegen sus transacciones con
          BitHauss. Comienza tu prueba gratuita de 14 días hoy.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="h-13 px-10 text-base font-semibold bg-primary text-white hover:bg-primary/90 shadow-[0_0_20px_hsl(221_83%_53%/0.4)] hover:shadow-[0_0_35px_hsl(221_83%_53%/0.6)] transition-all duration-300 hover:-translate-y-0.5"
          >
            Comenzar Gratis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-13 px-10 text-base font-semibold border-white/20 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10 hover:border-white/30 hover:text-white hover:shadow-[0_0_20px_hsl(0_0%_100%/0.1)] transition-all duration-300 hover:-translate-y-0.5"
          >
            Agendar Demo
          </Button>
        </div>

        <p className="mt-6 text-sm text-white/40">
          Sin tarjeta de crédito requerida &middot; Configuración en 5 minutos
        </p>
      </div>
    </section>
  );
}
