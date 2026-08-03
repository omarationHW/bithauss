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
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import {
  MEXICAN_STATES,
  toCanonicalState,
  useColoniaSearch,
  useMunicipios,
} from "@/lib/mx-locations";
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
  CASA_CONDOMINIO: "Casa en Condominio",
  DEPARTAMENTO: "Departamento",
  TERRENO: "Terreno",
  OFICINA: "Oficina",
  LOCAL_COMERCIAL: "Local Comercial",
  LOCAL: "Local",
  BODEGA: "Bodega",
  HOTEL: "Hotel",
  DEPARTAMENTO_HOTEL: "Departamento en Hotel",
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

// Derived from PROPERTY_TYPE_MAP so a new type in the catalog can never be
// missing from the filter again (they used to be two hand-kept lists).
const propertyTypes = Array.from(new Set(Object.values(PROPERTY_TYPE_MAP)));
const bedroomOptions = ["1", "2", "3", "4+"];

interface FiltersState {
  operationType: "comprar" | "rentar";
  /** Free-text search coming from the home hero (?q=). */
  query: string;
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
  query: "",
  types: [],
  state: "",
  city: "",
  neighborhood: "",
  minPrice: "",
  maxPrice: "",
  brcOnly: false,
  bedrooms: null,
};

/** A colonia offered in the filter, always tied to its city + state. */
interface ColoniaSuggestion {
  colonia: string;
  city: string;
  state: string;
  /** Published listings matching it (0 when it only exists in the catalog). */
  count: number;
}

interface FiltersPanelProps {
  filters: FiltersState;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  onReset: () => void;
  /** Current inventory, used to rank and count the location suggestions. */
  properties: MappedProperty[];
}

function FiltersPanel({ filters, setFilters, onReset, properties }: FiltersPanelProps) {
  const { operationType, types: selectedTypes, state: selectedState, city: selectedCity, neighborhood, minPrice, maxPrice, brcOnly, bedrooms: selectedBedrooms } = filters;

  const stateNorm = selectedState ? normalize(selectedState) : "";
  const cityNorm = selectedCity ? normalize(selectedCity) : "";

  // What the user is typing in the colonia box (may differ from the applied
  // filter until an option is picked).
  const [coloniaQuery, setColoniaQuery] = useState(neighborhood);
  const coloniaTerm = coloniaQuery || neighborhood;

  /* ---- Ciudad / municipio options: SEPOMEX catalog + real inventory ---- */

  const { municipios, loading: loadingCities } = useMunicipios(selectedState);

  const cityCounts = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const p of properties) {
      if (!p.city) continue;
      if (stateNorm && normalize(p.state) !== stateNorm) continue;
      const key = normalize(p.city);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { name: p.city, count: 1 });
    }
    return counts;
  }, [properties, stateNorm]);

  const cityOptions = useMemo<ComboboxOption[]>(() => {
    const options: ComboboxOption[] = [];
    const seen = new Set<string>();
    for (const m of municipios) {
      const key = normalize(m.municipio);
      seen.add(key);
      const inventory = cityCounts.get(key);
      options.push({
        value: m.municipio,
        badge: inventory ? String(inventory.count) : undefined,
      });
    }
    // Cities present in listings but absent from the catalog (legacy data)
    // must stay reachable, otherwise the filter would hide them.
    for (const [key, entry] of cityCounts) {
      if (seen.has(key)) continue;
      options.push({
        value: entry.name,
        hint: "Fuera del catálogo",
        badge: String(entry.count),
      });
    }
    return options.sort((a, b) => {
      const byInventory = (b.badge ? 1 : 0) - (a.badge ? 1 : 0);
      if (byInventory !== 0) return byInventory;
      return a.value.localeCompare(b.value, "es");
    });
  }, [municipios, cityCounts]);

  /* ---- Colonia options, always disambiguated by ciudad + estado ---- */

  const { colonias: catalogColonias, loading: loadingColonias } =
    useColoniaSearch({
      estado: selectedState,
      municipio: selectedCity,
      q: coloniaTerm,
      limit: 12,
    });

  const inventoryColonias = useMemo<ColoniaSuggestion[]>(() => {
    const term = normalize(coloniaTerm);
    const found = new Map<string, ColoniaSuggestion>();
    for (const p of properties) {
      if (!p.neighborhood) continue;
      if (stateNorm && normalize(p.state) !== stateNorm) continue;
      if (cityNorm && normalize(p.city) !== cityNorm) continue;
      if (term && !normalize(p.neighborhood).includes(term)) continue;
      const key = `${normalize(p.neighborhood)}|${normalize(p.city)}|${normalize(p.state)}`;
      const entry = found.get(key);
      if (entry) entry.count += 1;
      else
        found.set(key, {
          colonia: p.neighborhood,
          city: p.city,
          state: p.state,
          count: 1,
        });
    }
    return [...found.values()].sort(
      (a, b) => b.count - a.count || a.colonia.localeCompare(b.colonia, "es")
    );
  }, [properties, coloniaTerm, stateNorm, cityNorm]);

  const { coloniaOptions, coloniaLookup } = useMemo(() => {
    const options: ComboboxOption[] = [];
    const lookup = new Map<string, ColoniaSuggestion>();
    const add = (item: ColoniaSuggestion) => {
      // "Polanco — Miguel Hidalgo, Ciudad de México": the hint is what tells
      // apart the many colonias that share a name across the country.
      const hint = [item.city, item.state].filter(Boolean).join(", ");
      const key = `${normalize(item.colonia)}|${normalize(hint)}`;
      if (lookup.has(key)) return;
      lookup.set(key, item);
      options.push({
        value: item.colonia,
        hint,
        badge: item.count > 0 ? String(item.count) : undefined,
      });
    };
    inventoryColonias.forEach(add);
    catalogColonias.forEach((c) =>
      add({ colonia: c.colonia, city: c.municipio, state: c.estado, count: 0 })
    );
    return { coloniaOptions: options, coloniaLookup: lookup };
  }, [inventoryColonias, catalogColonias]);

  /** Places where the typed colonia name exists — the "Polanco" problem. */
  const ambiguousPlaces = useMemo<ColoniaSuggestion[]>(() => {
    const term = normalize(neighborhood);
    if (!term) return [];
    const places = new Map<string, ColoniaSuggestion>();
    const consider = (item: ColoniaSuggestion) => {
      if (normalize(item.colonia) !== term) return;
      const key = `${normalize(item.city)}|${normalize(item.state)}`;
      const entry = places.get(key);
      if (!entry || entry.count < item.count) places.set(key, item);
    };
    inventoryColonias.forEach(consider);
    catalogColonias.forEach((c) =>
      consider({
        colonia: c.colonia,
        city: c.municipio,
        state: c.estado,
        count: 0,
      })
    );
    return [...places.values()];
  }, [neighborhood, inventoryColonias, catalogColonias]);

  const setOperationType = (op: "comprar" | "rentar") =>
    setFilters((f) => ({ ...f, operationType: op }));
  const setSelectedState = (s: string) =>
    setFilters((f) => ({ ...f, state: s, city: "", neighborhood: "" }));
  const setSelectedCity = (c: string) =>
    setFilters((f) => ({ ...f, city: c, neighborhood: "" }));
  const setNeighborhood = (n: string) => setFilters((f) => ({ ...f, neighborhood: n }));

  /** Apply a suggestion: the colonia AND the place it belongs to. */
  const applyColonia = (item: ColoniaSuggestion) =>
    setFilters((f) => ({
      ...f,
      neighborhood: item.colonia,
      city: item.city || f.city,
      state: toCanonicalState(item.state) ?? item.state ?? f.state,
    }));
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
        <Select value={selectedState} onValueChange={setSelectedState}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona un estado" />
          </SelectTrigger>
          <SelectContent>
            {MEXICAN_STATES.map((state) => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Ciudad / municipio (catálogo SEPOMEX del estado elegido) */}
      <div>
        <Label htmlFor="filtro-ciudad" className="mb-3 block text-sm font-semibold">
          Ciudad / Municipio
        </Label>
        <Combobox
          id="filtro-ciudad"
          value={selectedCity}
          onChange={setSelectedCity}
          options={cityOptions}
          loading={loadingCities}
          disabled={!selectedState}
          placeholder={
            selectedState ? "Busca la ciudad o municipio" : "Elige primero el estado"
          }
          emptyMessage="Ninguna coincidencia"
          inputClassName="text-sm"
        />
      </div>

      <Separator />

      {/* Colonia — acotada por estado/ciudad y siempre desambiguada */}
      <div>
        <Label htmlFor="filtro-colonia" className="mb-3 block text-sm font-semibold">
          Colonia
        </Label>
        <Combobox
          id="filtro-colonia"
          value={neighborhood}
          onChange={(value, option) => {
            if (!option) {
              setNeighborhood(value);
              return;
            }
            const match = coloniaLookup.get(
              `${normalize(value)}|${normalize(option.hint ?? "")}`
            );
            if (match) applyColonia(match);
            else setNeighborhood(value);
          }}
          options={coloniaOptions}
          onQueryChange={setColoniaQuery}
          filterLocally={false}
          allowCustomValue
          loading={loadingColonias}
          placeholder="Ej. Polanco, Roma Norte..."
          emptyMessage={
            selectedState
              ? "Ninguna colonia coincide"
              : "Escribe al menos 3 letras"
          }
          inputClassName="text-sm"
        />
        {ambiguousPlaces.length > 1 && !selectedCity && (
          <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-2.5">
            <p className="text-xs text-muted-foreground">
              &laquo;{neighborhood}&raquo; existe en {ambiguousPlaces.length}{" "}
              lugares. Elige uno para acotar:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ambiguousPlaces.slice(0, 6).map((place) => (
                <button
                  key={`${place.city}-${place.state}`}
                  type="button"
                  onClick={() => applyColonia(place)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors active:bg-muted"
                >
                  {[place.city, place.state].filter(Boolean).join(", ")}
                  {place.count > 0 && (
                    <span className="ml-1 text-primary">({place.count})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {!selectedState && !neighborhood && (
          <p className="mt-2 text-xs text-muted-foreground">
            Puedes buscar solo por colonia: te mostramos a qué ciudad y estado
            pertenece cada coincidencia.
          </p>
        )}
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

function PropiedadesPageInner() {
  const [viewMode, setViewMode] = useState<"lista" | "mapa">("lista");
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [properties, setProperties] = useState<MappedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FiltersState>(() => ({
    ...initialFilters,
    operationType: searchParams.get("op") === "rentar" ? "rentar" : "comprar",
    query: searchParams.get("q") ?? "",
    city: searchParams.get("ciudad") ?? "",
    types: searchParams.get("tipo") ? [searchParams.get("tipo") as string] : [],
  }));

  // The home hero and the city cards link here with ?op / ?q / ?ciudad / ?tipo.
  // Those were previously ignored, so every one of those links landed on an
  // unfiltered list.
  useEffect(() => {
    const op = searchParams.get("op") === "rentar" ? "rentar" : "comprar";
    const q = searchParams.get("q") ?? "";
    const ciudad = searchParams.get("ciudad") ?? "";
    const tipo = searchParams.get("tipo");
    setFilters((f) => {
      const types = tipo ? [tipo] : f.types;
      if (
        f.operationType === op &&
        f.query === q &&
        f.city === ciudad &&
        f.types.join() === types.join()
      ) {
        return f;
      }
      return { ...f, operationType: op, query: q, city: ciudad, types };
    });
  }, [searchParams]);

  const resetFilters = () => setFilters(initialFilters);

  const filteredProperties = useMemo(() => {
    const wantedOp = filters.operationType === "rentar" ? "RENTA" : "VENTA";
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;
    const stateNorm = filters.state ? normalize(filters.state) : "";
    const cityNorm = filters.city ? normalize(filters.city) : "";
    const neighNorm = filters.neighborhood ? normalize(filters.neighborhood) : "";
    // Free text matches any of the fields a visitor would plausibly type:
    // title, colonia, ciudad, estado or address.
    const queryTerms = normalize(filters.query).split(/\s+/).filter(Boolean);
    return properties.filter((p) => {
      if (queryTerms.length > 0) {
        const haystack = normalize(
          [p.title, p.neighborhood, p.city, p.state, p.address].join(" ")
        );
        if (!queryTerms.every((t) => haystack.includes(t))) return false;
      }
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
        // No demo fallback: showing invented listings on a failed query is
        // worse than showing none — they are not clickable and mislead buyers.
        logError("Error fetching properties:", error);
        setProperties([]);
        setLoadError(true);
      } else {
        setProperties(((data || []) as PropertyFromDB[]).map(mapProperty));
        setLoadError(false);
      }
      setLoading(false);
    }
    fetchProperties();
  }, []);

  return (
    <main className="min-h-screen bg-background pt-[var(--header-offset)]">
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
              <FiltersPanel filters={filters} setFilters={setFilters} onReset={resetFilters} properties={properties} />
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
                    <FiltersPanel filters={filters} setFilters={setFilters} onReset={resetFilters} properties={properties} />
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

            {/* Empty state — distinguishes "nothing published" from "we could
                not load anything", which are very different for the visitor. */}
            {!loading && properties.length === 0 && viewMode === "lista" && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-1">
                  {loadError
                    ? "No pudimos cargar las propiedades"
                    : "No se encontraron propiedades"}
                </h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  {loadError
                    ? "Hubo un problema al conectar con el servidor. Recarga la página para intentarlo de nuevo."
                    : "No hay propiedades publicadas en este momento. Intenta ajustar los filtros o vuelve más tarde."}
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
