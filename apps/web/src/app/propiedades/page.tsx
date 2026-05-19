"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

const PropertyMap = dynamic(() => import("@/components/propiedades/property-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  ),
});
import {
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Home,
  Heart,
  Search,
  Loader2,
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
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import { ShieldBrc } from '@/components/ui/shield-brc'

interface PropertyFromDB {
  id: string;
  title: string;
  address_line: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  price: number | null;
  currency: string | null;
  operation: string | null;
  type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_total: number | null;
  featured_image_url: string | null;
  brc_status: string | null;
  slug: string | null;
  created_at: string | null;
  status: string | null;
  accepts_crypto: boolean | null;
  latitude: number | null;
  longitude: number | null;
}

interface MappedProperty {
  id: string;
  title: string;
  address: string;
  price: string;
  priceNumber: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  brc: boolean;
  image: string;
  tag: string;
  operation: "VENTA" | "RENTA";
  type: string;
  state: string;
  city: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  isNew: boolean;
  notary: string;
  timeAgo: string;
  favorite: boolean;
  acceptsCrypto: boolean;
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  CASA: "Casa",
  DEPARTAMENTO: "Departamento",
  TERRENO: "Terreno",
  OFICINA: "Oficina",
  LOCAL: "Local",
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function formatPrice(price: number | null, currency: string | null, operation: string | null): string {
  if (!price) return "Precio no disponible";
  const cur = currency || "MXN";
  const formatted = price.toLocaleString("es-MX", { style: "currency", currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (operation === "RENTA") {
    return `${formatted}/mes ${cur}`;
  }
  return `${formatted} ${cur}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 60) return `Hace ${diffMinutes} minutos`;
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? "Hora" : "Horas"}`;
  if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? "Día" : "Días"}`;
  if (diffWeeks < 5) return `Hace ${diffWeeks} ${diffWeeks === 1 ? "Semana" : "Semanas"}`;
  return `Hace ${diffMonths} ${diffMonths === 1 ? "Mes" : "Meses"}`;
}

function isNewProperty(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays <= 7;
}

function buildAddress(p: PropertyFromDB): string {
  const line1Parts = [p.address_line, p.neighborhood].filter(Boolean);
  const line2Parts = [p.city, p.state].filter(Boolean);
  const line1 = line1Parts.join(", ");
  const line2 = line2Parts.join(", ");
  return [line1, line2].filter(Boolean).join("\n");
}

function mapProperty(p: PropertyFromDB): MappedProperty {
  const op: "VENTA" | "RENTA" = p.operation === "RENTA" ? "RENTA" : "VENTA";
  return {
    id: p.id,
    title: p.title || "Sin título",
    address: buildAddress(p),
    price: formatPrice(p.price, p.currency, p.operation),
    priceNumber: p.price ?? 0,
    bedrooms: p.bedrooms || 0,
    bathrooms: p.bathrooms || 0,
    area: p.area_total || 0,
    brc: p.brc_status === "CERTIFICADO",
    image: p.featured_image_url || "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.jpg",
    tag: op === "RENTA" ? "Renta" : "Compra",
    operation: op,
    type: p.type ? (PROPERTY_TYPE_MAP[p.type.toUpperCase()] ?? p.type) : "",
    state: p.state || "",
    city: p.city || "",
    neighborhood: p.neighborhood || "",
    latitude: p.latitude,
    longitude: p.longitude,
    isNew: isNewProperty(p.created_at),
    notary: "",
    timeAgo: timeAgo(p.created_at),
    favorite: false,
    acceptsCrypto: !!p.accepts_crypto,
  };
}

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

interface FiltersState {
  operationType: "comprar" | "rentar";
  types: string[];
  state: string;
  city: string;
  neighborhood: string;
  minPrice: string;
  maxPrice: string;
  brcOnly: boolean;
  bedrooms: string | null;
}

const initialFilters: FiltersState = {
  operationType: "comprar",
  types: [],
  state: "",
  city: "",
  neighborhood: "",
  minPrice: "",
  maxPrice: "",
  brcOnly: false,
  bedrooms: null,
};

interface FiltersPanelProps {
  filters: FiltersState;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  onReset: () => void;
}

function FiltersPanel({ filters, setFilters, onReset }: FiltersPanelProps) {
  const { operationType, types: selectedTypes, state: selectedState, city: selectedCity, neighborhood, minPrice, maxPrice, brcOnly, bedrooms: selectedBedrooms } = filters;
  const cities = selectedState ? citiesByState[selectedState] || [] : [];

  const setOperationType = (op: "comprar" | "rentar") =>
    setFilters((f) => ({ ...f, operationType: op }));
  const setSelectedState = (s: string) =>
    setFilters((f) => ({ ...f, state: s, city: "" }));
  const setSelectedCity = (c: string) => setFilters((f) => ({ ...f, city: c }));
  const setNeighborhood = (n: string) => setFilters((f) => ({ ...f, neighborhood: n }));
  const setMinPrice = (v: string) => setFilters((f) => ({ ...f, minPrice: v }));
  const setMaxPrice = (v: string) => setFilters((f) => ({ ...f, maxPrice: v }));
  const setBrcOnly = (v: boolean) => setFilters((f) => ({ ...f, brcOnly: v }));
  const setSelectedBedrooms = (v: string | null) => setFilters((f) => ({ ...f, bedrooms: v }));

  const toggleType = (type: string) => {
    setFilters((f) => ({
      ...f,
      types: f.types.includes(type) ? f.types.filter((t) => t !== type) : [...f.types, type],
    }));
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
        <Input
          placeholder="Ej. Polanco, Roma Norte..."
          className="text-sm"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
        />
      </div>

      <Separator />

      {/* Rango de precio */}
      <div>
        <Label className="mb-3 block text-sm font-semibold">Rango de precio</Label>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Min"
            type="number"
            className="text-sm"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <span className="text-muted-foreground text-sm">-</span>
          <Input
            placeholder="Max"
            type="number"
            className="text-sm"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
      </div>

      {/* Certificado BRC */}
      <div className="flex items-center gap-3 py-2">
        <ShieldBrc className="h-5 w-5 text-accent" />
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

      {/* Limpiar filtros */}
      <Button variant="outline" className="w-full" onClick={onReset}>
        Limpiar filtros
      </Button>
    </div>
  );
}

const demoProperties: MappedProperty[] = [
  { id: "demo-1", title: "Casa Moderna en Bosques de las Lomas", address: "Bosques de las Lomas\nCDMX, C.P. 11700", price: "$8,500,000 MXN", priceNumber: 8500000, bedrooms: 4, bathrooms: 3, area: 320, brc: true, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.jpg", tag: "Compra", operation: "VENTA", type: "Casa", state: "Ciudad de Mexico", city: "Miguel Hidalgo", neighborhood: "Bosques de las Lomas", latitude: 19.4126, longitude: -99.2491, isNew: true, notary: "Alejandro Ramírez Torres", timeAgo: "Hace 10 Horas", favorite: false, acceptsCrypto: true },
  { id: "demo-2", title: "Departamento de Lujo en Polanco", address: "Polanco\nCDMX, C.P. 11560", price: "$45,000/mes MXN", priceNumber: 45000, bedrooms: 2, bathrooms: 2, area: 150, brc: true, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa2.jpg", tag: "Renta", operation: "RENTA", type: "Departamento", state: "Ciudad de Mexico", city: "Miguel Hidalgo", neighborhood: "Polanco", latitude: 19.4322, longitude: -99.1988, isNew: true, notary: "Valeria Montes García", timeAgo: "Hace 1 Día", favorite: true, acceptsCrypto: false },
  { id: "demo-3", title: "Penthouse con Vista al Mar", address: "Zona Hotelera, Cancún\nQuintana Roo, C.P. 77500", price: "$12,300,000 MXN", priceNumber: 12300000, bedrooms: 3, bathrooms: 3, area: 280, brc: true, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa3.jpg", tag: "Compra", operation: "VENTA", type: "Departamento", state: "Quintana Roo", city: "Cancún", neighborhood: "Zona Hotelera", latitude: 21.1393, longitude: -86.7711, isNew: false, notary: "Julián Herrera", timeAgo: "Hace 2 semanas", favorite: false, acceptsCrypto: true },
  { id: "demo-4", title: "Residencia en San Pedro Garza García", address: "San Pedro Garza García\nNuevo León, C.P. 66220", price: "$15,800,000 MXN", priceNumber: 15800000, bedrooms: 5, bathrooms: 4, area: 450, brc: true, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa4.jpg", tag: "Compra", operation: "VENTA", type: "Casa", state: "Nuevo Leon", city: "San Pedro Garza García", neighborhood: "Del Valle", latitude: 25.6586, longitude: -100.4023, isNew: true, notary: "Camila Torres", timeAgo: "Hace 6 Horas", favorite: false, acceptsCrypto: false },
  { id: "demo-5", title: "Terreno en Riviera Maya", address: "Playa del Carmen\nQuintana Roo, C.P. 77710", price: "$3,200,000 MXN", priceNumber: 3200000, bedrooms: 0, bathrooms: 0, area: 500, brc: false, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa5.jpg", tag: "Compra", operation: "VENTA", type: "Terreno", state: "Quintana Roo", city: "Playa del Carmen", neighborhood: "Playacar", latitude: 20.6296, longitude: -87.0739, isNew: false, notary: "", timeAgo: "Hace 3 Días", favorite: false, acceptsCrypto: false },
  { id: "demo-6", title: "Oficina en Santa Fe", address: "Santa Fe\nCDMX, C.P. 05300", price: "$28,000/mes MXN", priceNumber: 28000, bedrooms: 0, bathrooms: 2, area: 120, brc: true, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa6.jpg", tag: "Renta", operation: "RENTA", type: "Oficina", state: "Ciudad de Mexico", city: "Álvaro Obregón", neighborhood: "Santa Fe", latitude: 19.3597, longitude: -99.2587, isNew: true, notary: "Roberto Juárez", timeAgo: "Hace 4 Horas", favorite: false, acceptsCrypto: false },
  { id: "demo-7", title: "Casa Colonial en Centro Histórico", address: "Centro Histórico\nCDMX, C.P. 06000", price: "$16,700,000 MXN", priceNumber: 16700000, bedrooms: 5, bathrooms: 4, area: 320, brc: true, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa7.jpg", tag: "Compra", operation: "VENTA", type: "Casa", state: "Ciudad de Mexico", city: "Cuauhtémoc", neighborhood: "Centro Histórico", latitude: 19.4326, longitude: -99.1332, isNew: false, notary: "María Fernández", timeAgo: "Hace 1 Semana", favorite: false, acceptsCrypto: true },
  { id: "demo-8", title: "Departamento Nuevo en Condesa", address: "Condesa\nCDMX, C.P. 06140", price: "$5,900,000 MXN", priceNumber: 5900000, bedrooms: 2, bathrooms: 2, area: 95, brc: false, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa8.jpg", tag: "Compra", operation: "VENTA", type: "Departamento", state: "Ciudad de Mexico", city: "Cuauhtémoc", neighborhood: "Condesa", latitude: 19.4128, longitude: -99.1722, isNew: true, notary: "", timeAgo: "Hace 2 Horas", favorite: false, acceptsCrypto: false },
  { id: "demo-9", title: "Casa con Jardín en Coyoacán", address: "Coyoacán\nCDMX, C.P. 04000", price: "$9,450,000 MXN", priceNumber: 9450000, bedrooms: 3, bathrooms: 3, area: 280, brc: true, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa9.jpg", tag: "Compra", operation: "VENTA", type: "Casa", state: "Ciudad de Mexico", city: "Coyoacán", neighborhood: "Del Carmen Coyoacán", latitude: 19.3496, longitude: -99.1620, isNew: false, notary: "Carlos Mendoza", timeAgo: "Hace 5 Días", favorite: false, acceptsCrypto: false },
  { id: "demo-10", title: "Loft Industrial en Roma Norte", address: "Roma Norte\nCDMX, C.P. 06700", price: "$35,000/mes MXN", priceNumber: 35000, bedrooms: 1, bathrooms: 1, area: 85, brc: false, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa10.jpg", tag: "Renta", operation: "RENTA", type: "Departamento", state: "Ciudad de Mexico", city: "Cuauhtémoc", neighborhood: "Roma Norte", latitude: 19.4188, longitude: -99.1606, isNew: true, notary: "", timeAgo: "Hace 3 Horas", favorite: false, acceptsCrypto: false },
  { id: "demo-11", title: "Villa Frente al Lago en Valle de Bravo", address: "Valle de Bravo\nEstado de México, C.P. 51200", price: "$22,500,000 MXN", priceNumber: 22500000, bedrooms: 6, bathrooms: 5, area: 580, brc: true, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.jpg", tag: "Compra", operation: "VENTA", type: "Casa", state: "Estado de Mexico", city: "Valle de Bravo", neighborhood: "Avándaro", latitude: 19.1953, longitude: -100.1311, isNew: false, notary: "Ana Martínez", timeAgo: "Hace 1 Semana", favorite: false, acceptsCrypto: true },
  { id: "demo-12", title: "Penthouse en Interlomas", address: "Interlomas, Huixquilucan\nEstado de México, C.P. 52787", price: "$7,200,000 MXN", priceNumber: 7200000, bedrooms: 3, bathrooms: 2, area: 180, brc: true, image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa2.jpg", tag: "Compra", operation: "VENTA", type: "Departamento", state: "Estado de Mexico", city: "Huixquilucan", neighborhood: "Interlomas", latitude: 19.3973, longitude: -99.2787, isNew: true, notary: "Andrés Castillo", timeAgo: "Hace 2 Horas", favorite: false, acceptsCrypto: false },
];

function PropiedadesPageInner() {
  const [viewMode, setViewMode] = useState<"lista" | "mapa">("lista");
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [properties, setProperties] = useState<MappedProperty[]>([]);
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FiltersState>(() => ({
    ...initialFilters,
    operationType: searchParams.get("op") === "rentar" ? "rentar" : "comprar",
  }));

  useEffect(() => {
    const op = searchParams.get("op") === "rentar" ? "rentar" : "comprar";
    setFilters((f) => (f.operationType === op ? f : { ...f, operationType: op }));
  }, [searchParams]);

  const resetFilters = () => setFilters(initialFilters);

  const filteredProperties = useMemo(() => {
    const wantedOp = filters.operationType === "rentar" ? "RENTA" : "VENTA";
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;
    const stateNorm = filters.state ? normalize(filters.state) : "";
    const cityNorm = filters.city ? normalize(filters.city) : "";
    const neighNorm = filters.neighborhood ? normalize(filters.neighborhood) : "";
    return properties.filter((p) => {
      if (p.operation !== wantedOp) return false;
      if (filters.types.length > 0 && !filters.types.includes(p.type)) return false;
      if (stateNorm && normalize(p.state) !== stateNorm) return false;
      if (cityNorm && normalize(p.city) !== cityNorm) return false;
      if (neighNorm && !normalize(p.neighborhood).includes(neighNorm)) return false;
      if (min !== null && p.priceNumber < min) return false;
      if (max !== null && p.priceNumber > max) return false;
      if (filters.brcOnly && !p.brc) return false;
      if (filters.bedrooms) {
        const wanted = filters.bedrooms;
        if (wanted === "4+") {
          if (p.bedrooms < 4) return false;
        } else {
          if (p.bedrooms !== Number(wanted)) return false;
        }
      }
      return true;
    });
  }, [properties, filters]);

  useEffect(() => {
    async function fetchProperties() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, address_line, neighborhood, city, state, price, currency, operation, type, bedrooms, bathrooms, area_total, featured_image_url, brc_status, slug, created_at, status, accepts_crypto, latitude, longitude")
        .eq("status", "PUBLICADO")
        .order("created_at", { ascending: false });

      if (error) {
        logError("Error fetching properties:", error);
        setProperties(demoProperties);
      } else {
        const dbProperties = (data || []) as PropertyFromDB[];
        const realMapped = dbProperties.map(mapProperty);
        setProperties([...realMapped, ...demoProperties]);
      }
      setLoading(false);
    }
    fetchProperties();
  }, []);

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
              <FiltersPanel filters={filters} setFilters={setFilters} onReset={resetFilters} />
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
                    <FiltersPanel filters={filters} setFilters={setFilters} onReset={resetFilters} />
                  </SheetContent>
                </Sheet>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{loading ? "..." : filteredProperties.length}</span>{" "}
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
            {/* Loading state */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground text-sm">Cargando propiedades...</p>
              </div>
            )}

            {/* Empty state */}
            {!loading && properties.length === 0 && viewMode === "lista" && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-1">No se encontraron propiedades</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  No hay propiedades publicadas en este momento. Intenta ajustar los filtros o vuelve más tarde.
                </p>
              </div>
            )}

            <div className={cn(
              "grid gap-5",
              viewMode === "mapa" || loading
                ? "hidden"
                : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}>
              {filteredProperties.map((property, i) => (
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
                        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMnLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyMDIwMjAiLz48L3N2Zz4="
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
                        <div className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center">
                          <Image
                            src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/ICONO-DE-VERIFICACION.png"
                            alt="Verificado BRC"
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        </div>
                      )}

                      {/* Crypto badge overlay */}
                      {property.acceptsCrypto && (
                        <div className={cn(
                          "absolute right-2 z-10 flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-sm px-1.5 py-0.5 shadow-md",
                          property.brc ? "top-12" : "top-2"
                        )}>
                          <Image src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Bitcoin-icono.png" alt="Bitcoin" width={12} height={12} className="object-contain" />
                          <Image src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/ethereum-icon.png" alt="Ethereum" width={12} height={12} className="object-contain" />
                          <span className="text-[8px] font-bold text-amber-700 uppercase tracking-wide">Cripto</span>
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

                      {property.notary && (
                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          Notario: <span className="font-semibold text-foreground">{property.notary}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Map */}
            {viewMode === "mapa" && !loading && (
              <div className="w-full h-[calc(100vh-200px)] rounded-xl overflow-hidden border border-border/40 relative">
                <PropertyMap
                  properties={filteredProperties
                    .filter((p) => p.latitude !== null && p.longitude !== null)
                    .map((p) => ({
                      id: p.id,
                      title: p.title,
                      priceLabel: p.price,
                      bedrooms: p.bedrooms,
                      bathrooms: p.bathrooms,
                      area: p.area,
                      brc: p.brc,
                      image: p.image,
                      latitude: p.latitude as number,
                      longitude: p.longitude as number,
                    }))}
                  activeId={activeMarker}
                  onMarkerClick={(id) => setActiveMarker(id === activeMarker ? null : id)}
                />
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PropiedadesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PropiedadesPageInner />
    </Suspense>
  );
}
