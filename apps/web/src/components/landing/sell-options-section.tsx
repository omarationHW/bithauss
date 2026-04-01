'use client'

import Image from 'next/image'
import { Eye } from 'lucide-react'

const options = [
  {
    title: 'Vende tu casa tú mismo\nCon certificación BRC',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Opcionventa1.webp',
  },
  {
    title: 'Busca tu propio agente\nespecializado',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Opcionventa2.webp',
  },
  {
    title: 'Recibe leads directos\nde compradores interesados',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Opcionventa3.webp',
  },
]

export function SellOptionsSection() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Explora más opciones de venta
          </h2>
          <p className="text-muted-foreground mt-3">
            Vende tu casa a tu manera. Elige el camino que se adapte a tus necesidades.
          </p>
        </div>

        {/* Options triptych */}
        <div className="flex h-[420px] overflow-hidden rounded-2xl">
          {options.map((option) => (
            <div
              key={option.title}
              className="group relative flex-1 cursor-pointer overflow-hidden transition-all duration-500 ease-in-out hover:flex-[2]"
            >
              <Image
                src={option.image}
                alt={option.title}
                fill
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzNnLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyMDIwMjAiLz48L3N2Zz4="
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/50 transition-colors duration-300 group-hover:bg-black/40" />

              {/* Ver más - centered, only on hover */}
              <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm">
                  <Eye className="h-5 w-5" />
                  Ver más
                </span>
              </div>

              {/* Text - centered at bottom */}
              <div className="absolute inset-x-0 bottom-0 flex justify-center p-5">
                <p className="text-center text-sm leading-snug font-semibold whitespace-pre-line text-white sm:text-base">
                  {option.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
