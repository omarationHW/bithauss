"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  BedDouble,
  Bath,
  Ruler,
  ShieldCheck,
  SlidersHorizontal,
  ChevronRight,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const properties = [
  {
    id: "1",
    title: "Casa Moderna en Bosques de las Lomas",
    location: "Bosques de las Lomas, CDMX",
    price: "$8,500,000",
    bedrooms: 4,
    bathrooms: 3.5,
    area: 320,
    brc: true,
    gradient: "from-blue-600 to-indigo-800",
    tag: "Compra",
  },
  {
    id: "2",
    title: "Departamento de Lujo en Polanco",
    location: "Polanco, CDMX",
    price: "$45,000/mes",
    bedrooms: 2,
    bathrooms: 2,
    area: 150,
    brc: true,
    gradient: "from-emerald-500 to-teal-700",
    tag: "Renta",
  },
  {
    id: "3",
    title: "Penthouse con Vista al Mar",
    location: "Zona Hotelera, Cancun",
    price: "$12,300,000",
    bedrooms: 3,
    bathrooms: 3,
    area: 280,
    brc: false,
    gradient: "from-cyan-500 to-blue-600",
    tag: "Compra",
  },
  {
    id: "4",
    title: "Residencia en San Pedro Garza Garcia",
    location: "San Pedro Garza Garcia, N.L.",
    price: "$15,800,000",
    bedrooms: 5,
    bathrooms: 4,
    area: 450,
    brc: true,
    gradient: "from-violet-500 to-purple-700",
    tag: "Compra",
  },
  {
    id: "5",
    title: "Loft Industrial en Roma Norte",
    location: "Roma Norte, CDMX",
    price: "$28,000/mes",
    bedrooms: 1,
    bathrooms: 1,
    area: 85,
    brc: false,
    gradient: "from-orange-500 to-red-600",
    tag: "Renta",
  },
  {
    id: "6",
    title: "Terreno en Riviera Maya",
    location: "Playa del Carmen, Q. Roo",
    price: "$3,200,000",
    bedrooms: 0,
    bathrooms: 0,
    area: 500,
    brc: true,
    gradient: "from-lime-500 to-green-700",
    tag: "Compra",
  },
  {
    id: "7",
    title: "Oficina Premium en Santa Fe",
    location: "Santa Fe, CDMX",
    price: "$52,000/mes",
    bedrooms: 0,
    bathrooms: 2,
    area: 200,
    brc: false,
    gradient: "from-slate-500 to-gray-700",
    tag: "Renta",
  },
  {
    id: "8",
    title: "Casa de Campo en Valle de Bravo",
    location: "Valle de Bravo, Edo. Mex.",
    price: "$6,900,000",
    bedrooms: 3,
    bathrooms: 2.5,
    area: 380,
    brc: true,
    gradient: "from-amber-500 to-orange-700",
    tag: "Compra",
  },
  {
    id: "9",
    title: "Departamento en Providencia",
    location: "Providencia, Guadalajara",
    price: "$4,750,000",
    bedrooms: 2,
    bathrooms: 2,
    area: 120,
    brc: false,
    gradient: "from-rose-500 to-pink-700",
    tag: "Compra",
  },
];

const propertyTypes = ["Casa", "Departamento", "Terreno", "Oficina"];
const bedroomOptions = ["1", "2", "3", "4+"];
const mexicanStates = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de Mexico",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de Mexico",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacan",
  "Morelos",
  "Nayarit",
  "Nuevo Leon",
  "Oaxaca",
  "Puebla",
  "Queretaro",
  "Quintana Roo",
  "San Luis Potosi",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatan",
  "Zacatecas",
];

function FiltersPanel() {
  const [operationType, setOperationType] = useState<"comprar" | "rentar">(
    "comprar"
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedBedrooms, setSelectedBedrooms] = useState<string | null>(null);
  const [brcOnly, setBrcOnly] = useState(false);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-6">
      {/* Tipo de operacion */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">
          Tipo de operacion
        </Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={operationType === "comprar" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setOperationType("comprar")}
          >
            Comprar
          </Button>
          <Button
            size="sm"
            variant={operationType === "rentar" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setOperationType("rentar")}
          >
            Rentar
          </Button>
        </div>
      </div>

      <Separator />

      {/* Rango de precio */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">
          Rango de precio
        </Label>
        <div className="flex items-center gap-2">
          <Input placeholder="Min" type="number" className="text-sm" />
          <span className="text-muted-foreground text-sm">-</span>
          <Input placeholder="Max" type="number" className="text-sm" />
        </div>
      </div>

      <Separator />

      {/* Tipo de propiedad */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">
          Tipo de propiedad
        </Label>
        <div className="flex flex-wrap gap-2">
          {propertyTypes.map((type) => (
            <Badge
              key={type}
              variant={selectedTypes.includes(type) ? "default" : "outline"}
              className="cursor-pointer select-none px-3 py-1.5 text-xs"
              onClick={() => toggleType(type)}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Recamaras */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Recamaras</Label>
        <div className="flex gap-2">
          {bedroomOptions.map((opt) => (
            <Badge
              key={opt}
              variant={selectedBedrooms === opt ? "default" : "outline"}
              className="cursor-pointer select-none px-3 py-1.5 text-xs"
              onClick={() =>
                setSelectedBedrooms(selectedBedrooms === opt ? null : opt)
              }
            >
              {opt}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Estado */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Estado</Label>
        <Select>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona un estado" />
          </SelectTrigger>
          <SelectContent>
            {mexicanStates.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Certificacion BRC */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <Label className="text-sm font-semibold">Certificacion BRC</Label>
        </div>
        <button
          onClick={() => setBrcOnly(!brcOnly)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            brcOnly ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
              brcOnly ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      <Separator />

      {/* Aplicar filtros */}
      <Button className="w-full">Aplicar filtros</Button>
    </div>
  );
}

export default function PropiedadesPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Breadcrumb and Title */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <nav className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Inicio
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">Propiedades</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Propiedades en Venta y Renta
          </h1>
          <p className="mt-1 text-muted-foreground">
            Encuentra tu propiedad ideal con certificacion blockchain
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden w-72 shrink-0 md:block">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">Filtros</h2>
                </div>
                <FiltersPanel />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Results header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile filter trigger */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 md:hidden"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filtros
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[320px] overflow-y-auto">
                    <SheetTitle className="mb-4 flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      Filtros
                    </SheetTitle>
                    <FiltersPanel />
                  </SheetContent>
                </Sheet>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">127</span>{" "}
                  propiedades encontradas
                </p>
              </div>
              <Select>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevancia">Mas relevantes</SelectItem>
                  <SelectItem value="precio-asc">
                    Precio: menor a mayor
                  </SelectItem>
                  <SelectItem value="precio-desc">
                    Precio: mayor a menor
                  </SelectItem>
                  <SelectItem value="recientes">Mas recientes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Property Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <Link
                  key={property.id}
                  href={`/propiedades/${property.id}`}
                  className="group"
                >
                  <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                    {/* Image placeholder */}
                    <div className="relative">
                      <div
                        className={cn(
                          "h-48 bg-gradient-to-br",
                          property.gradient
                        )}
                      >
                        <div className="flex h-full items-center justify-center">
                          <Home className="h-12 w-12 text-white/30" />
                        </div>
                      </div>
                      {/* Tag badge */}
                      <Badge
                        className={cn(
                          "absolute left-3 top-3 text-xs",
                          property.tag === "Renta"
                            ? "bg-amber-500 hover:bg-amber-500"
                            : "bg-primary hover:bg-primary"
                        )}
                      >
                        {property.tag}
                      </Badge>
                      {/* BRC badge */}
                      {property.brc && (
                        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                          <ShieldCheck className="h-3 w-3" />
                          BRC
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="mb-1 line-clamp-1 text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                        {property.title}
                      </h3>
                      <div className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {property.location}
                      </div>
                      <p className="mb-3 text-lg font-bold text-primary">
                        {property.price}
                        <span className="text-xs font-normal text-muted-foreground">
                          {" "}
                          MXN
                        </span>
                      </p>
                      <Separator className="mb-3" />
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {property.bedrooms > 0 && (
                          <div className="flex items-center gap-1">
                            <BedDouble className="h-3.5 w-3.5" />
                            <span>{property.bedrooms}</span>
                          </div>
                        )}
                        {property.bathrooms > 0 && (
                          <div className="flex items-center gap-1">
                            <Bath className="h-3.5 w-3.5" />
                            <span>{property.bathrooms}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Ruler className="h-3.5 w-3.5" />
                          <span>{property.area} m&sup2;</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
