import { Bed, Bath, Maximize, MapPin, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    city: "Cancún",
    price: "$18,200,000 MXN",
    bedrooms: 6,
    bathrooms: 5,
    area: 580,
    gradient: "from-cyan-400 to-blue-500",
    certified: true,
  },
  {
    title: "Loft Centro Histórico",
    city: "Querétaro",
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
    <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Propiedades Destacadas
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Explora las mejores propiedades verificadas en las principales
            ciudades de México
          </p>
        </div>

        {/* Property grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {properties.map((property) => (
            <Card
              key={property.title}
              className="group overflow-hidden border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 cursor-pointer"
            >
              {/* Image placeholder */}
              <div className="relative">
                <div
                  className={`h-52 bg-gradient-to-br ${property.gradient} flex items-end p-4`}
                >
                  {/* Simulated building shapes */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute bottom-0 left-4 w-16 h-28 bg-white rounded-t-sm" />
                    <div className="absolute bottom-0 left-14 w-12 h-36 bg-white rounded-t-sm" />
                    <div className="absolute bottom-0 right-8 w-20 h-24 bg-white rounded-t-sm" />
                    <div className="absolute bottom-0 right-4 w-10 h-32 bg-white rounded-t-sm" />
                  </div>

                  {/* BRC Badge */}
                  <div className="absolute top-3 right-3">
                    {property.certified ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Certificado BRC
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-white/80 text-muted-foreground border-0"
                      >
                        Sin BRC
                      </Badge>
                    )}
                  </div>

                  {/* Price overlay */}
                  <div className="relative z-10">
                    <span className="text-white font-bold text-xl drop-shadow-md">
                      {property.price}
                    </span>
                  </div>
                </div>
              </div>

              <CardContent className="p-5">
                <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                  {property.title}
                </h3>

                <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-sm">{property.city}</span>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Bed className="h-4 w-4" />
                    <span>{property.bedrooms}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Bath className="h-4 w-4" />
                    <span>{property.bathrooms}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Maximize className="h-4 w-4" />
                    <span>{property.area} m²</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* View all link */}
        <div className="text-center mt-10">
          <button className="text-primary font-medium hover:underline underline-offset-4 transition-all">
            Ver todas las propiedades &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}
