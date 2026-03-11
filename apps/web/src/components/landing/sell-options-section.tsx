"use client";

import Image from "next/image";
import { Eye } from "lucide-react";

const options = [
  {
    title: "Vende tu casa tú mismo\nCon certificación BRC",
    image: "https://bithaussstorage.blob.core.windows.net/images/Opcionventa1.jpg",
  },
  {
    title: "Busca tu propio agente\nespecializado",
    image: "https://bithaussstorage.blob.core.windows.net/images/Opcionventa2.jpg",
  },
  {
    title: "Recibe una oferta\nen efectivo",
    image: "https://bithaussstorage.blob.core.windows.net/images/Opcionventa3.jpg",
  },
];

export function SellOptionsSection() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Explora más opciones de venta
          </h2>
          <p className="mt-3 text-muted-foreground">
            Vende tu casa a tu manera. Elige el camino que se adapte a tus necesidades.
          </p>
        </div>

        {/* Options triptych */}
        <div className="flex rounded-2xl overflow-hidden h-[420px]">
          {options.map((option) => (
            <div
              key={option.title}
              className="relative flex-1 group cursor-pointer overflow-hidden transition-all duration-500 ease-in-out hover:flex-[2]"
            >
              <Image
                src={option.image}
                alt={option.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors duration-300" />

              {/* Ver más - centered, only on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold px-6 py-3 rounded-full text-base">
                  <Eye className="h-5 w-5" />
                  Ver más
                </span>
              </div>

              {/* Text - centered at bottom */}
              <div className="absolute bottom-0 inset-x-0 p-5 flex justify-center">
                <p className="text-white font-semibold text-sm sm:text-base leading-snug whitespace-pre-line text-center">
                  {option.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
