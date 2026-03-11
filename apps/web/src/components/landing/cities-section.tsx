import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const cities = [
  {
    name: "Ciudad de México",
    short: "CDMX",
    image: "https://bithaussstorage.blob.core.windows.net/images/CDMX.jpg",
  },
  {
    name: "Guadalajara",
    short: "Guadalajara",
    image: "https://bithaussstorage.blob.core.windows.net/images/Guadalajara.jpg",
  },
  {
    name: "Nuevo León",
    short: "Nuevo León",
    image: "https://bithaussstorage.blob.core.windows.net/images/NuevoLeon.jpg",
  },
  {
    name: "Puebla",
    short: "Puebla",
    image: "https://bithaussstorage.blob.core.windows.net/images/PUEBLA.jpg",
  },
  {
    name: "Veracruz",
    short: "Veracruz",
    image: "https://bithaussstorage.blob.core.windows.net/images/Veracruz.jpg",
  },
  {
    name: "Querétaro",
    short: "Querétaro",
    image: "https://bithaussstorage.blob.core.windows.net/images/Queretaro.jpg",
  },
];

const linkTypes = [
  "Casas en venta en",
  "Departamentos en venta en",
  "Casas en renta en",
  "Departamentos en renta en",
  "Terrenos en venta en",
];

export function CitiesSection() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-10">
          Compra tu casa hoy mismo
        </h2>

        {/* Cities grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cities.map((city) => (
            <div key={city.name}>
              {/* City image card */}
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden group">
                <Image
                  src={city.image}
                  alt={city.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-4 flex items-end justify-between">
                  <h3 className="text-white font-bold text-lg">{city.name}</h3>
                  <Link
                    href={`/propiedades?ciudad=${city.short}`}
                    className="text-white/90 text-sm font-medium hover:text-white transition-colors"
                  >
                    Ver más
                  </Link>
                </div>
              </div>

              {/* Links */}
              <div className="mt-3 space-y-1.5">
                {linkTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/propiedades?ciudad=${city.short}`}
                    className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {type} {city.short}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* View all button */}
        <div className="text-center mt-12">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="group border-border/60 px-8 gap-2 hover:border-transparent hover:bg-gradient-to-r hover:from-primary hover:to-accent hover:text-white transition-all duration-300"
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
