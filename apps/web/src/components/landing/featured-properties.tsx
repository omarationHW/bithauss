import Link from "next/link";
import {
  Bed,
  Bath,
  Maximize,
  MapPin,
  ShieldCheck,
  Eye,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const properties = [
  {
    title: "Residencia en Polanco",
    city: "CDMX",
    price: "$12,500,000 MXN",
    bedrooms: 4,
    bathrooms: 3,
    area: 320,
    gradient: "from-blue-500 to-blue-700",
    certified: true,
  },
  {
    title: "Penthouse Santa Fe",
    city: "CDMX",
    price: "$8,900,000 MXN",
    bedrooms: 3,
    bathrooms: 2,
    area: 180,
    gradient: "from-emerald-400 to-emerald-600",
    certified: true,
  },
  {
    title: "Casa en San Pedro",
    city: "Monterrey",
    price: "$6,750,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 450,
    gradient: "from-violet-400 to-violet-600",
    certified: true,
  },
  {
    title: "Departamento en Providencia",
    city: "Guadalajara",
    price: "$3,500,000 MXN",
    bedrooms: 2,
    bathrooms: 2,
    area: 120,
    gradient: "from-amber-400 to-orange-500",
    certified: false,
  },
  {
    title: "Villa Frente al Mar",
    city: "Cancun",
    price: "$18,200,000 MXN",
    bedrooms: 6,
    bathrooms: 5,
    area: 580,
    gradient: "from-cyan-400 to-blue-500",
    certified: true,
  },
  {
    title: "Loft Centro Historico",
    city: "Queretaro",
    price: "$2,100,000 MXN",
    bedrooms: 1,
    bathrooms: 1,
    area: 75,
    gradient: "from-rose-400 to-pink-600",
    certified: false,
  },
];

export function FeaturedProperties() {
  return (
    <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Subtle dot pattern background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(221 83% 53%) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Soft gradient wash at top and bottom */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/[0.03] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-accent/[0.03] to-transparent" />

      <div className="relative mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Seleccion curada
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Propiedades{" "}
            <span className="relative inline-block">
              Verificadas
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
            </span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Explora las mejores propiedades verificadas en las principales
            ciudades de Mexico
          </p>
        </div>

        {/* Property grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {properties.map((property, index) => (
            <Link key={property.title} href={`/propiedades/${index + 1}`}>
              <Card className="group relative overflow-hidden border-border/40 bg-card/80 backdrop-blur-sm transition-all duration-500 hover:shadow-xl hover:shadow-primary/8 hover:-translate-y-2 hover:border-primary/20 cursor-pointer">
                {/* Subtle top accent line */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Image placeholder */}
                <div className="relative overflow-hidden">
                  <div
                    className={`h-56 bg-gradient-to-br ${property.gradient} flex items-end p-5 transition-transform duration-700 group-hover:scale-105`}
                  >
                    {/* Simulated building shapes */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute bottom-0 left-4 w-16 h-28 bg-white rounded-t-sm" />
                      <div className="absolute bottom-0 left-14 w-12 h-36 bg-white rounded-t-sm" />
                      <div className="absolute bottom-0 right-8 w-20 h-24 bg-white rounded-t-sm" />
                      <div className="absolute bottom-0 right-4 w-10 h-32 bg-white rounded-t-sm" />
                    </div>

                    {/* Dark gradient overlay at bottom for readability */}
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-500 flex items-center justify-center">
                      <span className="flex items-center gap-2 text-white font-semibold text-lg opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-3 group-hover:translate-y-0 drop-shadow-lg">
                        <Eye className="h-5 w-5" />
                        Ver Detalles
                      </span>
                    </div>

                    {/* BRC Badge - Enhanced */}
                    <div className="absolute top-3 right-3 z-10">
                      {property.certified ? (
                        <Badge className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0 gap-1.5 px-3 py-1 shadow-lg shadow-emerald-500/30 font-semibold text-xs backdrop-blur-sm">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Certificado BRC
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-white/90 text-muted-foreground border-0 backdrop-blur-sm shadow-sm px-3 py-1"
                        >
                          Sin BRC
                        </Badge>
                      )}
                    </div>

                    {/* Price overlay - Enhanced */}
                    <div className="relative z-10 flex flex-col">
                      <span className="text-white/70 text-xs font-medium uppercase tracking-wider mb-0.5">
                        Precio
                      </span>
                      <span className="text-white font-bold text-2xl drop-shadow-lg tracking-tight">
                        {property.price}
                      </span>
                    </div>
                  </div>
                </div>

                <CardContent className="p-5">
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors duration-300">
                    {property.title}
                  </h3>

                  <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-accent" />
                    <span className="text-sm">{property.city}</span>
                  </div>

                  <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border/40">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Bed className="h-4 w-4 text-primary/60" />
                      <span className="font-medium text-foreground/80">
                        {property.bedrooms}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Bath className="h-4 w-4 text-primary/60" />
                      <span className="font-medium text-foreground/80">
                        {property.bathrooms}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Maximize className="h-4 w-4 text-primary/60" />
                      <span className="font-medium text-foreground/80">
                        {property.area} m2
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* View all button - Enhanced */}
        <div className="text-center mt-14">
          <Button
            asChild
            size="lg"
            variant="outline"
            className="group/btn border-primary/20 hover:border-primary/40 hover:bg-primary/5 px-8 gap-2 transition-all duration-300"
          >
            <Link href="/propiedades">
              Ver todas las propiedades
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
