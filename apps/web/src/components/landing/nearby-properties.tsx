import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShieldBrc } from '@/components/ui/shield-brc'

const properties = [
  {
    title: "Villa Frente al Mar",
    price: "$8,900,000 MXN",
    bedrooms: 7,
    bathrooms: 4,
    area: 320,
    address: "Hidalgo 56, Centro Histórico, Mérida\nYucatán, C.P. 97000",
    notary: "Alejandro Ramírez Torres",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa5.jpg",
    timeAgo: "Hace 3 Semanas",
    timeLabel: "Agregado",
    isNew: false,
    certified: false,
  },
  {
    title: "Casa en Perisur",
    price: "$18,200,000 MXN",
    bedrooms: 9,
    bathrooms: 4,
    area: 320,
    address: "Av. Bonampak 250, Centro, Benito Juárez\nQuintana Roo, C.P. 77500",
    notary: "Valeria Montes García",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa6.jpg",
    timeAgo: "Hace 1 Día",
    timeLabel: "Agregado",
    isNew: true,
    certified: false,
  },
  {
    title: "Departamento arreglado",
    price: "$10,500,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 320,
    address: "Av. Bonampak 250, Centro, Benito Juárez\nQuintana Roo, C.P. 77500",
    notary: "Julián Herrera Domínguez",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa7.jpg",
    timeAgo: "Hace 2 semanas",
    timeLabel: "Agregado",
    isNew: false,
    certified: false,
  },
  {
    title: "Casa Colonial Céntrica",
    price: "$16,700,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 320,
    address: "Insurgentes 890, Del Valle, Benito Juárez\nCDMX, C.P. 03100",
    notary: "Camila Torres Aguilar",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa8.jpg",
    timeAgo: "Hace 6 Horas",
    timeLabel: "Agregado",
    isNew: true,
    certified: true,
  },
];

export function NearbyProperties() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Propiedades cerca de tí
          </h2>
          <p className="mt-3 text-muted-foreground">
            Sugerencias basadas en tu localización
          </p>
        </div>

        {/* Property cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {properties.map((property) => (
            <div
              key={property.title}
              className="bg-card rounded-xl border border-border/40 overflow-hidden hover:shadow-lg transition-shadow duration-300"
            >
              {/* Time label */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 text-xs text-muted-foreground">
                <Home className="h-3.5 w-3.5" />
                <span>{property.timeLabel}</span>
                <span className="font-semibold text-foreground">{property.timeAgo}</span>
              </div>

              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={property.image}
                  alt={property.title}
                  fill
                  className="object-cover"
                />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  {property.isNew && (
                    <span className="bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                      Nuevo
                    </span>
                  )}
                  <span className="bg-teal-600 text-white text-[10px] font-medium px-2 py-0.5 rounded">
                    Cita: 9:00am a 6:00pm
                  </span>
                </div>

                {/* BRC Shield */}
                {property.certified && (
                  <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-accent/90 flex items-center justify-center">
                    <ShieldBrc className="h-4 w-4 text-white" />
                  </div>
                )}

                {/* Navigation arrows */}
                <button className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 flex items-center justify-center text-white/80 hover:bg-black/50 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 flex items-center justify-center text-white/80 hover:bg-black/50 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Price overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-3 px-4">
                  {property.certified && (
                    <span className="text-accent text-xs font-semibold">
                      Certificado BRC
                    </span>
                  )}
                  <div className="text-white/60 text-[10px]">Precio</div>
                  <div className="text-white font-bold text-lg">
                    {property.price}
                  </div>
                </div>
              </div>

              {/* Card content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    {property.title}
                  </h3>
                  <button className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                    <Heart className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>● {property.bedrooms} recámaras</span>
                  <span>● {property.bathrooms} baños</span>
                  <span>● {property.area}m2</span>
                </div>

                <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                  {property.address}
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  Notario: <span className="font-semibold text-foreground">{property.notary}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
        </div>

        {/* View all button */}
        <div className="text-center mt-8">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="group border-border/60 hover:border-primary/40 px-8 gap-2"
          >
            <Link href="/propiedades">
              Ver todas las propiedades
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
