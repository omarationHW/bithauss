import Image from "next/image";
import { ArrowDown } from "lucide-react";

export function SellConfidenceSection() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-primary/10 p-8 sm:p-12 overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left content */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Vende tu casa con{" "}
                <span className="relative inline-block">
                  <span className="text-primary">confianza</span>
                  <svg
                    className="absolute -bottom-1 left-0 w-full"
                    viewBox="0 0 200 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M1 4C40 1.5 80 1 100 2.5C120 4 160 1.5 199 4"
                      stroke="hsl(160 84% 39%)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h2>

              <p className="mt-4 text-muted-foreground leading-relaxed">
                Te ofrecemos Certificado BRC la primera plataforma con
                verificación judicial que protege a compradores y vendedores.
                Únete a la plataforma de bienes raíces más segura de México.
              </p>

              <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-opacity duration-200">
                Comienza tu verificación
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            {/* Right image */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
              <Image
                src="https://bithaussstorage.blob.core.windows.net/images/Vendetucasa.webp"
                alt="Vende tu casa con confianza"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
