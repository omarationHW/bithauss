"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Home,
  Heart,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    address: "Bosques de las Lomas, CDMX\nCDMX, C.P. 11700",
    price: "$8,500,000 MXN",
    bedrooms: 4,
    bathrooms: 3,
    area: 320,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.webp",
    tag: "Compra",
    isNew: true,
    notary: "Alejandro Ramírez Torres",
    timeAgo: "Hace 10 Horas",
    favorite: false,
  },
  {
    id: "2",
    title: "Departamento de Lujo en Polanco",
    address: "Polanco, CDMX\nCDMX, C.P. 11560",
    price: "$45,000/mes MXN",
    bedrooms: 2,
    bathrooms: 2,
    area: 150,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa2.webp",
    tag: "Renta",
    isNew: true,
    notary: "Valeria Montes García",
    timeAgo: "Hace 1 Día",
    favorite: true,
  },
  {
    id: "3",
    title: "Penthouse con Vista al Mar",
    address: "Zona Hotelera, Cancún\nQuintana Roo, C.P. 77500",
    price: "$12,300,000 MXN",
    bedrooms: 3,
    bathrooms: 3,
    area: 280,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa3.webp",
    tag: "Compra",
    isNew: false,
    notary: "Julián Herrera Domínguez",
    timeAgo: "Hace 2 semanas",
    favorite: false,
  },
  {
    id: "4",
    title: "Residencia en San Pedro Garza García",
    address: "San Pedro Garza García\nNuevo León, C.P. 66220",
    price: "$15,800,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 450,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa4.webp",
    tag: "Compra",
    isNew: true,
    notary: "Camila Torres Aguilar",
    timeAgo: "Hace 6 Horas",
    favorite: false,
  },
  {
    id: "5",
    title: "Loft Industrial en Roma Norte",
    address: "Roma Norte, CDMX\nCDMX, C.P. 06700",
    price: "$28,000/mes MXN",
    bedrooms: 1,
    bathrooms: 1,
    area: 85,
    brc: false,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa5.webp",
    tag: "Renta",
    isNew: false,
    notary: "Diego Ramírez Solís",
    timeAgo: "Hace 3 Semanas",
    favorite: false,
  },
  {
    id: "6",
    title: "Terreno en Riviera Maya",
    address: "Playa del Carmen\nQuintana Roo, C.P. 77710",
    price: "$3,200,000 MXN",
    bedrooms: 0,
    bathrooms: 0,
    area: 500,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa6.webp",
    tag: "Compra",
    isNew: true,
    notary: "María Fernanda López",
    timeAgo: "Hace 5 Horas",
    favorite: false,
  },
  {
    id: "7",
    title: "Oficina Premium en Santa Fe",
    address: "Santa Fe, CDMX\nCDMX, C.P. 05348",
    price: "$52,000/mes MXN",
    bedrooms: 0,
    bathrooms: 2,
    area: 200,
    brc: false,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa7.webp",
    tag: "Renta",
    isNew: false,
    notary: "Carlos Hernández Ruiz",
    timeAgo: "Hace 1 Semana",
    favorite: true,
  },
  {
    id: "8",
    title: "Casa de Campo en Valle de Bravo",
    address: "Valle de Bravo\nEstado de México, C.P. 51200",
    price: "$6,900,000 MXN",
    bedrooms: 3,
    bathrooms: 2,
    area: 380,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa8.webp",
    tag: "Compra",
    isNew: true,
    notary: "Ana Patricia Morales",
    timeAgo: "Hace 2 Días",
    favorite: false,
  },
  {
    id: "9",
    title: "Departamento en Providencia",
    address: "Providencia, Guadalajara\nJalisco, C.P. 44630",
    price: "$4,750,000 MXN",
    bedrooms: 2,
    bathrooms: 2,
    area: 120,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa9.webp",
    tag: "Compra",
    isNew: false,
    notary: "Laura Sánchez Medina",
    timeAgo: "Hace 12 Horas",
    favorite: false,
  },
  {
    id: "10",
    title: "Villa Frente al Lago",
    address: "Paseo del Lago 15, Valle de Bravo\nEstado de México, C.P. 51200",
    price: "$22,100,000 MXN",
    bedrooms: 8,
    bathrooms: 6,
    area: 620,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa10.webp",
    tag: "Compra",
    isNew: true,
    notary: "Gabriela Ortiz Campos",
    timeAgo: "Hace 1 Día",
    favorite: false,
  },
  {
    id: "11",
    title: "Casa en Juriquilla",
    address: "Blvd. Juriquilla 540\nQuerétaro, C.P. 76226",
    price: "$8,200,000 MXN",
    bedrooms: 4,
    bathrooms: 3,
    area: 310,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.webp",
    tag: "Compra",
    isNew: false,
    notary: "Patricia Delgado Reyes",
    timeAgo: "Hace 5 Días",
    favorite: true,
  },
  {
    id: "12",
    title: "Penthouse en Cancún",
    address: "Blvd. Kukulcán km 12, Zona Hotelera\nCancún, Q. Roo, C.P. 77500",
    price: "$19,800,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 380,
    brc: true,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa2.webp",
    tag: "Compra",
    isNew: true,
    notary: "Andrés Castillo Nava",
    timeAgo: "Hace 2 Horas",
    favorite: false,
  },
];

const propertyTypes = ["Casa", "Departamento", "Terreno", "Oficina", "Local"];
const bedroomOptions = ["1", "2", "3", "4+"];
const mexicanStates = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
  "Chiapas", "Chihuahua", "Ciudad de Mexico", "Coahuila", "Colima",
  "Durango", "Estado de Mexico", "Guanajuato", "Guerrero", "Hidalgo",
  "Jalisco", "Michoacan", "Morelos", "Nayarit", "Nuevo Leon", "Oaxaca",
  "Puebla", "Queretaro", "Quintana Roo", "San Luis Potosi", "Sinaloa",
  "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatan",
  "Zacatecas",
];

const citiesByState: Record<string, string[]> = {
  "Aguascalientes": ["Aguascalientes", "Jesús María", "Calvillo"],
  "Baja California": ["Tijuana", "Mexicali", "Ensenada", "Rosarito"],
  "Baja California Sur": ["La Paz", "Los Cabos", "Loreto"],
  "Campeche": ["Campeche", "Ciudad del Carmen", "Champotón"],
  "Chiapas": ["Tuxtla Gutiérrez", "San Cristóbal", "Tapachula"],
  "Chihuahua": ["Chihuahua", "Ciudad Juárez", "Delicias"],
  "Ciudad de Mexico": ["Álvaro Obregón", "Benito Juárez", "Coyoacán", "Cuauhtémoc", "Miguel Hidalgo", "Tlalpan", "Xochimilco"],
  "Coahuila": ["Saltillo", "Torreón", "Monclova", "Piedras Negras"],
  "Colima": ["Colima", "Manzanillo", "Tecomán"],
  "Durango": ["Durango", "Gómez Palacio", "Lerdo"],
  "Estado de Mexico": ["Toluca", "Naucalpan", "Tlalnepantla", "Huixquilucan", "Metepec", "Atizapán"],
  "Guanajuato": ["León", "Guanajuato", "Irapuato", "Celaya", "San Miguel de Allende"],
  "Guerrero": ["Acapulco", "Chilpancingo", "Zihuatanejo", "Taxco"],
  "Hidalgo": ["Pachuca", "Tulancingo", "Tula"],
  "Jalisco": ["Guadalajara", "Zapopan", "Tlaquepaque", "Puerto Vallarta", "Tonalá"],
  "Michoacan": ["Morelia", "Uruapan", "Lázaro Cárdenas", "Zamora"],
  "Morelos": ["Cuernavaca", "Jiutepec", "Temixco", "Cuautla"],
  "Nayarit": ["Tepic", "Bahía de Banderas", "Compostela"],
  "Nuevo Leon": ["Monterrey", "San Pedro Garza García", "San Nicolás", "Apodaca", "Santa Catarina"],
  "Oaxaca": ["Oaxaca de Juárez", "Salina Cruz", "Huatulco"],
  "Puebla": ["Puebla", "Cholula", "Atlixco", "Tehuacán"],
  "Queretaro": ["Querétaro", "San Juan del Río", "Corregidora", "El Marqués"],
  "Quintana Roo": ["Cancún", "Playa del Carmen", "Tulum", "Chetumal", "Cozumel"],
  "San Luis Potosi": ["San Luis Potosí", "Ciudad Valles", "Soledad"],
  "Sinaloa": ["Culiacán", "Mazatlán", "Los Mochis"],
  "Sonora": ["Hermosillo", "Ciudad Obregón", "Nogales", "Puerto Peñasco"],
  "Tabasco": ["Villahermosa", "Cárdenas", "Comalcalco"],
  "Tamaulipas": ["Tampico", "Reynosa", "Matamoros", "Ciudad Victoria"],
  "Tlaxcala": ["Tlaxcala", "Apizaco", "Huamantla"],
  "Veracruz": ["Veracruz", "Xalapa", "Coatzacoalcos", "Boca del Río"],
  "Yucatan": ["Mérida", "Valladolid", "Progreso", "Tizimín"],
  "Zacatecas": ["Zacatecas", "Fresnillo", "Guadalupe"],
};

function FiltersPanel() {
  const [operationType, setOperationType] = useState<"comprar" | "rentar">("comprar");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedBedrooms, setSelectedBedrooms] = useState<string | null>(null);
  const [brcOnly, setBrcOnly] = useState(false);
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");

  const cities = selectedState ? citiesByState[selectedState] || [] : [];

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-6">
      {/* Tipo de operación */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Tipo de operación</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={operationType === "comprar" ? "default" : "outline"}
            className={cn("flex-1", operationType === "comprar" && "bg-gradient-to-r from-primary to-accent text-white")}
            onClick={() => setOperationType("comprar")}
          >
            Comprar
          </Button>
          <Button
            size="sm"
            variant={operationType === "rentar" ? "default" : "outline"}
            className={cn("flex-1", operationType === "rentar" && "bg-gradient-to-r from-primary to-accent text-white")}
            onClick={() => setOperationType("rentar")}
          >
            Rentar
          </Button>
        </div>
      </div>

      <Separator />

      {/* Tipo de propiedad */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Tipo de propiedad</Label>
        <div className="flex flex-wrap gap-2">
          {propertyTypes.map((type) => (
            <Badge
              key={type}
              variant={selectedTypes.includes(type) ? "default" : "outline"}
              className={cn(
                "cursor-pointer select-none px-3 py-1.5 text-xs",
                selectedTypes.includes(type) && "bg-primary hover:bg-primary/90"
              )}
              onClick={() => toggleType(type)}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      {/* Estado */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Estado</Label>
        <Select value={selectedState} onValueChange={(val) => { setSelectedState(val); setSelectedCity(""); }}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona un estado" />
          </SelectTrigger>
          <SelectContent>
            {mexicanStates.map((state) => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Ciudad */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Ciudad</Label>
        <Select value={selectedCity} onValueChange={setSelectedCity} disabled={!selectedState}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona una ciudad" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Colonia */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Colonia</Label>
        <Select disabled={!selectedCity}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona una colonia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="centro">Centro</SelectItem>
            <SelectItem value="norte">Zona Norte</SelectItem>
            <SelectItem value="sur">Zona Sur</SelectItem>
            <SelectItem value="poniente">Zona Poniente</SelectItem>
            <SelectItem value="oriente">Zona Oriente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Rango de precio */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Rango de precio</Label>
        <div className="flex items-center gap-2">
          <Input placeholder="Min" type="number" className="text-sm" />
          <span className="text-muted-foreground text-sm">-</span>
          <Input placeholder="Max" type="number" className="text-sm" />
        </div>
      </div>

      {/* Certificado BRC */}
      <div className="flex items-center gap-3 py-2">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <Label className="text-sm font-semibold">Certificado BRC</Label>
        <button
          onClick={() => setBrcOnly(!brcOnly)}
          className={cn(
            "relative ml-auto inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            brcOnly ? "bg-accent" : "bg-muted"
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

      {/* Recámaras */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Recamaras</Label>
        <div className="flex gap-2">
          {bedroomOptions.map((opt) => (
            <Badge
              key={opt}
              variant={selectedBedrooms === opt ? "default" : "outline"}
              className={cn(
                "cursor-pointer select-none px-3 py-1.5 text-xs",
                selectedBedrooms === opt && "bg-primary hover:bg-primary/90"
              )}
              onClick={() => setSelectedBedrooms(selectedBedrooms === opt ? null : opt)}
            >
              {opt}
            </Badge>
          ))}
        </div>
      </div>

      {/* Aplicar filtros */}
      <Button className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white">
        Aplicar filtros
      </Button>
    </div>
  );
}

const mapMarkers = [
  { id: "1", price: "$8.50 M", top: "18%", left: "22%" },
  { id: "2", price: "$4.50 M", top: "28%", left: "38%" },
  { id: "3", price: "$12.30 M", top: "22%", right: "22%" },
  { id: "4", price: "$15.80 M", top: "42%", left: "18%" },
  { id: "5", price: "$9.45 M", top: "48%", left: "42%" },
  { id: "6", price: "$5.02 M", top: "38%", right: "18%" },
  { id: "7", price: "$6.80 M", top: "58%", left: "28%" },
  { id: "8", price: "$9.45 M", top: "62%", right: "28%" },
  { id: "9", price: "$5.02 M", top: "52%", right: "12%" },
  { id: "10", price: "$7.20 M", top: "72%", left: "32%" },
  { id: "11", price: "$9.45 M", top: "68%", right: "22%" },
  { id: "12", price: "$12.30 M", top: "78%", right: "38%" },
];

export default function PropiedadesPage() {
  const [viewMode, setViewMode] = useState<"lista" | "mapa">("lista");
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-background pt-[100px]">
      {/* Breadcrumb and Title */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <nav className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">Propiedades</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Propiedades en Venta y Renta
              </h1>
              <p className="mt-1 text-muted-foreground">
                Encuentra tu propiedad ideal con certificación BRC
              </p>
            </div>
            {/* View toggle */}
            <div className="hidden sm:flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("lista")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  viewMode === "lista"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Lista
              </button>
              <button
                onClick={() => setViewMode("mapa")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  viewMode === "mapa"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Mapa
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden w-72 shrink-0 md:block">
            <div className="rounded-xl border border-border/40 bg-card p-5 sticky top-24">
              <div className="mb-4 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Filtros</h2>
              </div>
              <FiltersPanel />
            </div>
          </aside>

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Results header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile filter trigger */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 md:hidden">
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
                  <span className="font-semibold text-foreground">{properties.length}</span>{" "}
                  propiedades encontradas
                </p>
              </div>
              <Select>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevancia">Más relevantes</SelectItem>
                  <SelectItem value="precio-asc">Precio: menor a mayor</SelectItem>
                  <SelectItem value="precio-desc">Precio: mayor a menor</SelectItem>
                  <SelectItem value="recientes">Más recientes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Property Grid / Map view */}
            <div>
            <div className={cn(
              "grid gap-5",
              viewMode === "mapa"
                ? "hidden"
                : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}>
              {properties.map((property, i) => (
                <Link
                  key={property.id}
                  href={`/propiedades/${property.id}`}
                  className="group"
                >
                  <div
                    className="bg-card rounded-xl border border-border/40 overflow-hidden hover:shadow-lg transition-all duration-500 animate-fade-in-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {/* Time label */}
                    <div className="flex items-center gap-1 px-3 py-2 text-[10px] xl:text-[9px] text-muted-foreground">
                      <Home className="h-3 w-3" />
                      <span>Agregado</span>
                      <span className="font-semibold text-foreground">{property.timeAgo}</span>
                    </div>

                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={property.image}
                        alt={property.title}
                        fill
                        placeholder="blur"
                        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzNnLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyMDIwMjAiLz48L3N2Zz4="
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        {property.isNew && (
                          <span className="bg-primary text-white text-[8px] font-semibold px-1.5 py-0.5 rounded">
                            Nuevo
                          </span>
                        )}
                        <span className="bg-accent text-white text-[8px] font-medium px-1.5 py-0.5 rounded">
                          {property.tag === "Renta" ? "Renta" : "Compra"}
                        </span>
                      </div>

                      {/* BRC Shield */}
                      {property.brc && (
                        <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-accent/90 flex items-center justify-center">
                          <ShieldCheck className="h-3 w-3 text-white" />
                        </div>
                      )}

                      {/* Navigation arrows */}
                      <button className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/30 flex items-center justify-center text-white/80 hover:bg-black/50 transition-colors">
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <button className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/30 flex items-center justify-center text-white/80 hover:bg-black/50 transition-colors">
                        <ChevronRight className="h-3 w-3" />
                      </button>

                      {/* Certificado BRC badge */}
                      {property.brc && (
                        <div className="absolute left-1/2 bottom-12 -translate-x-1/2 z-10">
                          <span className="inline-flex items-center bg-black/80 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                            <span className="text-[9px] font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                              Certificado BRC
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Price overlay */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-2 px-3">
                        <div className="text-white/60 text-[9px]">Precio</div>
                        <div className="text-white font-bold text-sm xl:text-base">{property.price}</div>
                      </div>
                    </div>

                    {/* Card content */}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-semibold text-foreground text-xs xl:text-[11px] leading-tight group-hover:text-primary transition-colors line-clamp-2">
                          {property.title}
                        </h3>
                        <button className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                          <Heart
                            className={cn(
                              "h-3.5 w-3.5",
                              property.favorite && "fill-primary text-primary"
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                        {property.bedrooms > 0 && <span>● {property.bedrooms} rec.</span>}
                        {property.bathrooms > 0 && <span>● {property.bathrooms} baños</span>}
                        <span>● {property.area}m²</span>
                      </div>

                      <p className="mt-1.5 text-[10px] text-muted-foreground whitespace-pre-line leading-relaxed line-clamp-2">
                        {property.address}
                      </p>

                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        Notario: <span className="font-semibold text-foreground">{property.notary}</span>
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Map */}
            {viewMode === "mapa" && (
              <div className="w-full h-[calc(100vh-200px)] rounded-xl overflow-hidden border border-border/40 relative">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d60216.953710835554!2d-99.19155229814455!3d19.390519038498072!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85ce0026db097507%3A0x54061076265ee841!2sCiudad%20de%20M%C3%A9xico%2C%20CDMX!5e0!3m2!1ses-419!2smx!4v1700000000000!5m2!1ses-419!2smx"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                {/* Price markers */}
                {mapMarkers.map((marker) => {
                  const property = properties.find((p) => p.id === marker.id);
                  const isActive = activeMarker === marker.id;
                  return (
                    <div
                      key={marker.id}
                      className={cn("absolute", isActive ? "z-50" : "z-10")}
                      style={{ top: marker.top, left: marker.left, right: marker.right }}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveMarker(isActive ? null : marker.id); }}
                        className={cn(
                          "relative rounded-lg px-2 py-1 shadow-md text-xs font-bold transition-all duration-200 hover:scale-110",
                          isActive
                            ? "text-white scale-110"
                            : "bg-white text-foreground border hover:bg-primary hover:text-white"
                        )}
                        style={isActive ? { background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" } : undefined}
                      >
                        {marker.price}
                      </button>

                      {/* Property popup */}
                      {isActive && property && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white rounded-xl shadow-2xl border overflow-hidden z-50 animate-fade-in-up">
                          {/* Arrow */}
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t rotate-45" />
                          <div className="relative">
                            <div className="relative h-36">
                              <Image
                                src={property.image}
                                alt={property.title}
                                fill
                                className="object-cover"
                              />
                              <div className="absolute top-2 left-2 flex gap-1">
                                {property.isNew && (
                                  <span className="bg-primary text-white text-[8px] font-semibold px-1.5 py-0.5 rounded">Nuevo</span>
                                )}
                                <span className="bg-accent text-white text-[8px] font-medium px-1.5 py-0.5 rounded">
                                  {property.tag}
                                </span>
                              </div>
                              {property.brc && (
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                                  <span className="inline-flex items-center bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-full">
                                    <span className="text-[8px] font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                                      Certificado BRC
                                    </span>
                                  </span>
                                </div>
                              )}
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent pt-6 pb-2 px-3">
                                <div className="text-white font-bold text-sm">{property.price}</div>
                              </div>
                            </div>
                            <div className="p-3">
                              <h4 className="font-semibold text-xs leading-tight">{property.title}</h4>
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                                <span>● {property.bedrooms} rec.</span>
                                <span>● {property.bathrooms} baños</span>
                                <span>● {property.area}m²</span>
                              </div>
                              <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1">{property.address.split("\n")[0]}</p>
                              <Link
                                href={`/propiedades/${property.id}`}
                                className="mt-2 block text-center text-[10px] font-semibold text-white bg-gradient-to-r from-primary to-accent rounded-lg py-1.5 hover:opacity-90 transition-opacity"
                              >
                                Ver propiedad
                              </Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Click overlay to close popup */}
                {activeMarker && (
                  <div
                    className="absolute inset-0 z-[5]"
                    onClick={() => setActiveMarker(null)}
                  />
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
