"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function CtaSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    if (!section || !image) return;

    const handleScroll = () => {
      const rect = section.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const progress = Math.max(
        0,
        Math.min(1, 1 - rect.top / windowHeight)
      );
      const scale = 1 + progress * 0.15;
      image.style.transform = `scale(${scale})`;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8"
      style={{
        background: "linear-gradient(135deg, #0F172A 0%, #142C5F 50%, #0F172A 100%)",
      }}
    >
      <div className="mx-auto max-w-6xl">
        <div
          ref={sectionRef}
          className="relative overflow-hidden rounded-2xl"
        >
          {/* Background image with scroll zoom */}
          <Image
            ref={imageRef}
            src="https://bithaussstorage.blob.core.windows.net/images/Footer.webp"
            alt="Ciudad"
            fill
            className="object-cover transition-transform duration-100 will-change-transform"
            sizes="(max-width: 1280px) 100vw, 1280px"
            priority={false}
          />

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-[#0F1729]/75" />

          {/* Content */}
          <div className="relative z-10 px-6 sm:px-12 lg:px-20 py-16 sm:py-24 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
              ¿Listo para{" "}
              <span className="relative inline-block">
                transformar
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

            <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
              Únete a miles de profesionales que ya protegen sus transacciones
              con BitHauss. Comienza tu prueba gratuita de 14 días hoy.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="h-13 px-10 text-base font-semibold bg-primary text-white hover:bg-primary/90 transition-all duration-300"
              >
                Comenzar Gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-13 px-10 text-base font-semibold border-white/30 bg-transparent text-white hover:bg-white/10 hover:border-white/50 hover:text-white transition-all duration-300"
              >
                Agendar Demo
              </Button>
            </div>

            <p className="mt-6 text-sm text-white/50">
              Sin tarjeta de crédito requerida &middot; Configuración en 5
              minutos
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
