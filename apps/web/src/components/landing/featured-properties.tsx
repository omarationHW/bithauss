"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const filterTabs = [
  "Propiedades Verificadas",
  "Lo más nuevo",
  "Más vistos",
  "Precios más bajos",
  "Propiedades de lujo",
];

const allProperties = [
  // Page 1
  {
    title: "Villa Frente al Mar",
    price: "$8,900,000 MXN",
    bedrooms: 7,
    bathrooms: 4,
    area: 320,
    address: "Hidalgo 56, Centro Histórico, Mérida\nYucatán, C.P. 97000",
    notary: "Alejandro Ramírez Torres",
    image: "/images/Casa1.jpg",
    timeAgo: "Hace 10 Horas",
    timeLabel: "Agregado",
    isNew: true,
    certified: true,
    favorite: false,
  },
  {
    title: "Loft tropical",
    price: "$18,200,000 MXN",
    bedrooms: 9,
    bathrooms: 4,
    area: 320,
    address: "Av. Bonampak 250, Centro, Benito Juárez\nQuintana Roo, C.P. 77500",
    notary: "Valeria Montes García",
    image: "/images/casa2.jpg",
    timeAgo: "Hace 1 Día",
    timeLabel: "Agregado",
    isNew: true,
    certified: true,
    favorite: true,
  },
  {
    title: "Residencia moderna",
    price: "$10,500,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 320,
    address: "Av. Bonampak 250, Centro, Benito Juárez\nQuintana Roo, C.P. 77500",
    notary: "Julián Herrera Domínguez",
    image: "/images/casa3.jpg",
    timeAgo: "Hace 2 semanas",
    timeLabel: "Actualizado",
    isNew: false,
    certified: true,
    favorite: false,
  },
  {
    title: "Casa Colonial Céntrica",
    price: "$16,700,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 320,
    address: "Insurgentes 890, Del Valle, Benito Juárez\nCDMX, C.P. 03100",
    notary: "Camila Torres Aguilar",
    image: "/images/casa4.jpg",
    timeAgo: "Hace 6 Horas",
    timeLabel: "Agregado",
    isNew: true,
    certified: true,
    favorite: false,
  },
  // Page 2
  {
    title: "Penthouse en Santa Fe",
    price: "$12,500,000 MXN",
    bedrooms: 4,
    bathrooms: 3,
    area: 280,
    address: "Av. Vasco de Quiroga 3800, Santa Fe\nCDMX, C.P. 05348",
    notary: "Roberto Guzmán Pérez",
    image: "/images/casa5.jpg",
    timeAgo: "Hace 3 Días",
    timeLabel: "Agregado",
    isNew: false,
    certified: true,
    favorite: false,
  },
  {
    title: "Casa en Perisur",
    price: "$7,800,000 MXN",
    bedrooms: 6,
    bathrooms: 3,
    area: 410,
    address: "Calle Jardines 120, Pedregal\nCDMX, C.P. 04500",
    notary: "María Fernanda López",
    image: "/images/casa6.jpg",
    timeAgo: "Hace 5 Horas",
    timeLabel: "Agregado",
    isNew: true,
    certified: false,
    favorite: false,
  },
  {
    title: "Departamento en Condesa",
    price: "$5,200,000 MXN",
    bedrooms: 3,
    bathrooms: 2,
    area: 150,
    address: "Av. Ámsterdam 45, Hipódromo Condesa\nCDMX, C.P. 06100",
    notary: "Carlos Hernández Ruiz",
    image: "/images/casa7.jpg",
    timeAgo: "Hace 1 Semana",
    timeLabel: "Actualizado",
    isNew: false,
    certified: true,
    favorite: true,
  },
  {
    title: "Residencia en Coyoacán",
    price: "$9,400,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 350,
    address: "Calle Francisco Sosa 230, Coyoacán\nCDMX, C.P. 04000",
    notary: "Ana Patricia Morales",
    image: "/images/casa8.jpg",
    timeAgo: "Hace 2 Días",
    timeLabel: "Agregado",
    isNew: true,
    certified: true,
    favorite: false,
  },
  // Page 3
  {
    title: "Casa en San Pedro",
    price: "$14,300,000 MXN",
    bedrooms: 6,
    bathrooms: 5,
    area: 480,
    address: "Sierra Madre 890, San Pedro Garza García\nNuevo León, C.P. 66220",
    notary: "Fernando Treviño Garza",
    image: "/images/casa9.jpg",
    timeAgo: "Hace 4 Horas",
    timeLabel: "Agregado",
    isNew: true,
    certified: true,
    favorite: false,
  },
  {
    title: "Villa en Providencia",
    price: "$11,700,000 MXN",
    bedrooms: 4,
    bathrooms: 3,
    area: 290,
    address: "Av. Providencia 1540, Providencia\nGuadalajara, Jalisco, C.P. 44630",
    notary: "Laura Sánchez Medina",
    image: "/images/casa10.jpg",
    timeAgo: "Hace 12 Horas",
    timeLabel: "Agregado",
    isNew: false,
    certified: true,
    favorite: false,
  },
  {
    title: "Loft en Roma Norte",
    price: "$4,600,000 MXN",
    bedrooms: 2,
    bathrooms: 2,
    area: 110,
    address: "Calle Orizaba 78, Roma Norte\nCDMX, C.P. 06700",
    notary: "Diego Ramírez Solís",
    image: "/images/Casa1.jpg",
    timeAgo: "Hace 3 Semanas",
    timeLabel: "Actualizado",
    isNew: false,
    certified: false,
    favorite: false,
  },
  {
    title: "Casa Frente al Lago",
    price: "$22,100,000 MXN",
    bedrooms: 8,
    bathrooms: 6,
    area: 620,
    address: "Paseo del Lago 15, Valle de Bravo\nEstado de México, C.P. 51200",
    notary: "Gabriela Ortiz Campos",
    image: "/images/casa2.jpg",
    timeAgo: "Hace 1 Día",
    timeLabel: "Agregado",
    isNew: true,
    certified: true,
    favorite: false,
  },
  // Page 4
  {
    title: "Departamento en Polanco",
    price: "$6,900,000 MXN",
    bedrooms: 3,
    bathrooms: 2,
    area: 175,
    address: "Av. Presidente Masaryk 320, Polanco\nCDMX, C.P. 11560",
    notary: "Jorge Villanueva Torres",
    image: "/images/casa3.jpg",
    timeAgo: "Hace 8 Horas",
    timeLabel: "Agregado",
    isNew: true,
    certified: true,
    favorite: false,
  },
  {
    title: "Casa en Juriquilla",
    price: "$8,200,000 MXN",
    bedrooms: 4,
    bathrooms: 3,
    area: 310,
    address: "Blvd. Juriquilla 540, Juriquilla\nQuerétaro, C.P. 76226",
    notary: "Patricia Delgado Reyes",
    image: "/images/casa4.jpg",
    timeAgo: "Hace 5 Días",
    timeLabel: "Actualizado",
    isNew: false,
    certified: true,
    favorite: true,
  },
  {
    title: "Penthouse en Cancún",
    price: "$19,800,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 380,
    address: "Blvd. Kukulcán km 12, Zona Hotelera\nCancún, Q. Roo, C.P. 77500",
    notary: "Andrés Castillo Nava",
    image: "/images/casa5.jpg",
    timeAgo: "Hace 2 Horas",
    timeLabel: "Agregado",
    isNew: true,
    certified: true,
    favorite: false,
  },
  {
    title: "Casa en Lomas de Chapultepec",
    price: "$25,500,000 MXN",
    bedrooms: 7,
    bathrooms: 5,
    area: 550,
    address: "Sierra Leona 430, Lomas de Chapultepec\nCDMX, C.P. 11000",
    notary: "Elena Fuentes Ríos",
    image: "/images/casa6.jpg",
    timeAgo: "Hace 1 Semana",
    timeLabel: "Agregado",
    isNew: false,
    certified: true,
    favorite: false,
  },
];

const ITEMS_PER_PAGE = 4;
const totalPages = Math.ceil(allProperties.length / ITEMS_PER_PAGE);

export function FeaturedProperties() {
  const [activeTab, setActiveTab] = useState("Propiedades Verificadas");
  const [currentPage, setCurrentPage] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(nextPage, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextPage]);

  const handleDotClick = (i: number) => {
    setCurrentPage(i);
    setIsAutoPlaying(false);
    // Resume autoplay after 10 seconds of inactivity
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const visibleProperties = allProperties.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Propiedades Verificadas
          </h2>
          <p className="mt-3 text-muted-foreground">
            Explora las mejores propiedades verificadas en las principales ciudades de México
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-6 sm:gap-8 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "whitespace-nowrap pb-2 text-sm font-medium transition-colors duration-200 border-b-2",
                activeTab === tab
                  ? "text-foreground border-foreground"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Property cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {visibleProperties.map((property, i) => (
            <div
              key={`${currentPage}-${i}`}
              className="bg-card rounded-xl border border-border/40 overflow-hidden hover:shadow-lg transition-all duration-500 animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
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
                    <span className="bg-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                      Nuevo
                    </span>
                  )}
                  <span className="bg-accent text-white text-[10px] font-medium px-2 py-0.5 rounded">
                    Cita: 9:00am a 6:00pm
                  </span>
                </div>

                {/* BRC Shield */}
                {property.certified && (
                  <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-accent/90 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-white" />
                  </div>
                )}

                {/* Navigation arrows */}
                <button className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 flex items-center justify-center text-white/80 hover:bg-black/50 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/30 flex items-center justify-center text-white/80 hover:bg-black/50 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Certificado BRC badge centered */}
                {property.certified && (
                  <div className="absolute left-1/2 bottom-14 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center bg-black/80 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10">
                      <span className="text-xs font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        Certificado BRC
                      </span>
                    </span>
                  </div>
                )}

                {/* Price overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-3 px-4">
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
                    <Heart
                      className={cn(
                        "h-4 w-4",
                        property.favorite && "fill-primary text-primary"
                      )}
                    />
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
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => handleDotClick(i)}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors duration-200",
                currentPage === i
                  ? "bg-primary"
                  : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
              )}
            />
          ))}
        </div>

        {/* View all button */}
        <div className="text-center mt-8">
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

        {/* Trust stats */}
        <div className="text-center mt-16 max-w-3xl mx-auto">
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Confianza en nuestras más de 500 mil Propiedades Certificadas
          </h3>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Solo <span className="font-bold text-foreground">Bit</span>
            <span className="font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Hauss</span> te
            conecta directamente con propiedades con un sello digital verificable que
            garantiza la legitimidad de la propiedad.
          </p>
        </div>
      </div>
    </section>
  );
}
