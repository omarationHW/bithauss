import Image from 'next/image'
import { ArrowDown } from 'lucide-react'

export function SellConfidenceSection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="border-primary/10 from-primary/10 to-accent/10 overflow-hidden rounded-2xl border bg-gradient-to-br p-8 sm:p-12">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            {/* Left content */}
            <div>
              <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                Vende tu casa con{' '}
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

              <p className="text-muted-foreground mt-4 leading-relaxed">
                Te ofrecemos Certificado BRC la primera plataforma con verificación Notarial que
                protege a compradores y vendedores. Únete a la plataforma de bienes raíces más
                segura de México.
              </p>

              <button className="from-primary to-accent mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r px-6 py-3 text-sm font-semibold text-white shadow-md transition-opacity duration-200 hover:opacity-90">
                Comienza tu verificación
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            {/* Right image */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
              <Image
                src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Vendetucasa.webp"
                alt="Vende tu casa con confianza"
                fill
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzNnLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyMDIwMjAiLz48L3N2Zz4="
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
