"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  MapPin,
  BedDouble,
  Bath,
  Ruler,
  Car,
  Phone,
  Mail,
  ChevronRight,
  Heart,
  Share2,
  Check,
  ArrowLeft,
  Bed,
  Maximize,
  Calendar,
  Star,
  X,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { ShieldBrc } from '@/components/ui/shield-brc'

interface Property {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  type: string;
  operation: string;
  status: string;
  price: number;
  currency: string;
  accepts_crypto: boolean;
  area_total: number;
  area_built: number;
  bedrooms: number;
  bathrooms: number;
  parking_spaces: number;
  floors: number;
  address_line: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  amenities: string[];
  featured_image_url: string;
  brc_status: string;
  brc_certificate_id: string;
  view_count: number;
  lead_count: number;
  published_at: string;
  created_at: string;
}

interface PropertyMedia {
  id: string;
  property_id: string;
  url: string;
  media_type: string;
  alt_text: string;
  sort_order: number;
}

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string;
  role: string;
}

interface SimilarProperty {
  id: string;
  title: string;
  city: string;
  state: string;
  price: number;
  currency: string;
  operation: string;
  bedrooms: number;
  bathrooms: number;
  area_total: number;
  featured_image_url: string;
  brc_status: string;
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `Publicado hace ${diffMinutes} minuto${diffMinutes !== 1 ? "s" : ""}`;
  }
  if (diffHours < 24) {
    return `Publicado hace ${diffHours} hora${diffHours !== 1 ? "s" : ""}`;
  }
  if (diffDays < 30) {
    return `Publicado hace ${diffDays} día${diffDays !== 1 ? "s" : ""}`;
  }
  return `Publicado el ${date.toLocaleDateString("es-MX")}`;
}

function operationLabel(operation: string): string {
  switch (operation) {
    case "VENTA":
      return "En Venta";
    case "RENTA":
      return "En Renta";
    case "TRASPASO":
      return "En Traspaso";
    default:
      return operation;
  }
}

function buildMapEmbedUrl(lat: number | null, lng: number | null, neighborhood: string, city: string, state: string): string {
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    if (lat && lng) {
      return `https://www.google.com/maps/embed/v1/view?key=${googleKey}&center=${lat},${lng}&zoom=16&maptype=roadmap`;
    }
    const q = encodeURIComponent(`${neighborhood}, ${city}, ${state}, México`);
    return `https://www.google.com/maps/embed/v1/place?key=${googleKey}&q=${q}`;
  }
  // OSM fallback (no API key required)
  if (lat && lng) {
    const d = 0.005;
    const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  }
  const q = encodeURIComponent(`${neighborhood}, ${city}, ${state}, México`);
  return `https://www.openstreetmap.org/export/embed.html?bbox=-99.3,19.2,-99.0,19.55&layer=mapnik&query=${q}`;
}

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background pt-[100px]">
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            <div className="h-4 w-4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-4 w-4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 grid grid-cols-4 grid-rows-2 gap-3 h-[400px] sm:h-[480px] rounded-2xl overflow-hidden">
          <div className="col-span-2 row-span-2 bg-muted animate-pulse" />
          <div className="bg-muted animate-pulse" />
          <div className="bg-muted animate-pulse" />
          <div className="bg-muted animate-pulse" />
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-5 w-1/2 rounded bg-muted animate-pulse" />
            <div className="h-10 w-1/3 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="h-64 rounded-2xl bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}

function NotFoundView() {
  return (
    <main className="min-h-screen bg-background pt-[100px] flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Propiedad no encontrada</h1>
        <p className="text-muted-foreground">
          La propiedad que buscas no existe o ha sido eliminada.
        </p>
        <Button asChild>
          <Link href="/propiedades">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Ver todas las propiedades
          </Link>
        </Button>
      </div>
    </main>
  );
}

const CDN_BASE = "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images";

const demoPropertyData: Property = {
  id: "demo-1",
  owner_id: "demo-owner",
  title: "Casa Moderna en Bosques de las Lomas",
  slug: "casa-moderna-bosques-lomas",
  description:
    "Espectacular residencia de estilo contemporáneo ubicada en una de las zonas más exclusivas de la Ciudad de México. Esta propiedad cuenta con amplios espacios iluminados con luz natural, acabados de primera calidad, cocina integral equipada con electrodomésticos de línea europea, pisos de mármol y madera de ingeniería.\n\nLa casa dispone de un jardín privado con alberca climatizada y terraza techada ideal para reuniones. Cuenta con sistema de seguridad perimetral, domótica integral y estacionamiento para 4 vehículos.\n\nUbicada a minutos de centros comerciales, colegios de prestigio y vías rápidas de acceso.",
  type: "CASA",
  operation: "VENTA",
  status: "PUBLICADO",
  price: 8500000,
  currency: "MXN",
  accepts_crypto: true,
  area_total: 450,
  area_built: 320,
  bedrooms: 4,
  bathrooms: 3,
  parking_spaces: 4,
  floors: 2,
  address_line: "Bosques de las Lomas",
  neighborhood: "Bosques de las Lomas",
  city: "Ciudad de México",
  state: "Ciudad de México",
  zip_code: "11700",
  latitude: 19.3795,
  longitude: -99.2635,
  amenities: [
    "Alberca",
    "Jardín",
    "Seguridad 24/7",
    "Estacionamiento techado",
    "Terraza",
    "Sistema de alarma",
    "Cocina integral",
    "Roof garden",
    "Área de BBQ",
    "Cuarto de lavado",
  ],
  featured_image_url: `${CDN_BASE}/Casa1.jpg`,
  brc_status: "CERTIFICADO",
  brc_certificate_id: "BRC-DEMO-001",
  view_count: 245,
  lead_count: 12,
  published_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
  created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
};

const demoMediaList: PropertyMedia[] = [
  { id: "dm-1", property_id: "demo-1", url: `${CDN_BASE}/Casa1.jpg`, media_type: "IMAGE", alt_text: "Fachada principal", sort_order: 0 },
  { id: "dm-2", property_id: "demo-1", url: `${CDN_BASE}/casa2.jpg`, media_type: "IMAGE", alt_text: "Sala de estar", sort_order: 1 },
  { id: "dm-3", property_id: "demo-1", url: `${CDN_BASE}/casa3.jpg`, media_type: "IMAGE", alt_text: "Cocina integral", sort_order: 2 },
  { id: "dm-4", property_id: "demo-1", url: `${CDN_BASE}/casa4.jpg`, media_type: "IMAGE", alt_text: "Recámara principal", sort_order: 3 },
  { id: "dm-5", property_id: "demo-1", url: `${CDN_BASE}/casa5.jpg`, media_type: "IMAGE", alt_text: "Jardín y alberca", sort_order: 4 },
  { id: "dm-6", property_id: "demo-1", url: `${CDN_BASE}/casa6.jpg`, media_type: "IMAGE", alt_text: "Terraza", sort_order: 5 },
];

const demoOwner: Profile = {
  id: "demo-owner",
  email: "contacto@bithauss.com",
  first_name: "Alejandro",
  last_name: "Ramírez Torres",
  phone: "+52 55 1234 5678",
  avatar_url: "",
  role: "BROKER",
};

function ContactForm({ propertyId, ownerId }: { propertyId: string; ownerId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError("Nombre y email son obligatorios.");
      return;
    }

    setSending(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("leads").insert({
        property_id: propertyId,
        owner_id: ownerId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        message: message.trim() || null,
        status: "NUEVO",
        source: "ORGANICO",
      });

      if (insertError) throw new Error(insertError.message);

      // Increment lead_count on the property
      supabase.rpc("increment_property_lead_count", { prop_id: propertyId }).then();

      // Create a conversation if user is logged in
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser && currentUser.id !== ownerId) {
        // Check if conversation already exists between these users for this property
        const { data: existingConvs } = await supabase
          .from("conversation_participants")
          .select("conversation_id, conversations!inner(property_id)")
          .eq("user_id", currentUser.id);

        let existingConvId: string | null = null;
        if (existingConvs) {
          for (const cp of existingConvs) {
            const conv = cp as unknown as { conversation_id: string; conversations: { property_id: string } };
            if (conv.conversations?.property_id === propertyId) {
              existingConvId = conv.conversation_id;
              break;
            }
          }
        }

        let conversationId: string;

        if (existingConvId) {
          conversationId = existingConvId;
        } else {
          // Create new conversation
          const { data: newConv } = await supabase
            .from("conversations")
            .insert({
              property_id: propertyId,
              subject: `Consulta sobre propiedad`,
            })
            .select("id")
            .single();

          if (newConv) {
            conversationId = newConv.id;
            // Add both participants
            await supabase.from("conversation_participants").insert([
              { conversation_id: conversationId, user_id: currentUser.id },
              { conversation_id: conversationId, user_id: ownerId },
            ]);
          } else {
            conversationId = "";
          }
        }

        // Send the message in the conversation
        if (conversationId) {
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            sender_id: currentUser.id,
            content: message.trim() || `Hola, me interesa esta propiedad. Mi contacto: ${email.trim()}${phone.trim() ? `, ${phone.trim()}` : ""}`,
          });
        }
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="font-semibold text-emerald-800">Mensaje enviado</h3>
        <p className="text-sm text-emerald-600 mt-1">
          El asesor se pondrá en contacto contigo pronto.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 p-5">
      <h3 className="font-semibold text-sm mb-4">Agenda una visita</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="contact-name" className="text-xs">Nombre *</Label>
          <Input
            id="contact-name"
            placeholder="Tu nombre completo"
            className="text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email" className="text-xs">Email *</Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="tu@email.com"
            className="text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-phone" className="text-xs">Teléfono</Label>
          <Input
            id="contact-phone"
            type="tel"
            placeholder="+52 55 0000 0000"
            className="text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-message" className="text-xs">Mensaje</Label>
          <Textarea
            id="contact-message"
            placeholder="Me interesa esta propiedad..."
            rows={3}
            className="text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={sending}
          className="w-full border-0 text-white"
          style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {sending ? "Enviando..." : "Enviar mensaje"}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground">
          Al contactar, aceptas nuestros{" "}
          <Link href="#" className="underline hover:text-foreground">
            términos de servicio
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [property, setProperty] = useState<Property | null>(null);
  const [media, setMedia] = useState<PropertyMedia[]>([]);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [similarProperties, setSimilarProperties] = useState<SimilarProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Geocode the property address when no lat/lng is stored
  useEffect(() => {
    if (!property) return;
    if (property.latitude && property.longitude) return;
    const parts = [property.address_line, property.neighborhood, property.city, property.state, "México"]
      .filter(Boolean)
      .join(", ");
    if (!parts) return;
    let cancelled = false;
    fetch(`/api/geocode?q=${encodeURIComponent(parts)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.result?.lat && data.result.lng) {
          setGeocoded({ lat: data.result.lat, lng: data.result.lng });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [property]);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      setLoading(true);
      setNotFound(false);

      // Handle demo properties with hardcoded data
      if (id.startsWith("demo-")) {
        setProperty(demoPropertyData);
        setMedia(demoMediaList);
        setOwner(demoOwner);
        setSimilarProperties([]);
        setLoading(false);
        return;
      }

      // Fetch property
      const { data: prop, error: propError } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      if (propError || !prop) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProperty(prop as Property);

      // Check if current user is the owner
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setIsOwner(currentUser?.id === prop.owner_id);

      // Fetch media, owner, and similar properties in parallel
      const [mediaResult, ownerResult, similarResult] = await Promise.all([
        supabase
          .from("property_media")
          .select("*")
          .eq("property_id", id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("profiles")
          .select("*")
          .eq("id", prop.owner_id)
          .single(),
        // Related properties: separate parameterized queries instead of .or() with
        // string interpolation, which would let crafted city/state values inject
        // PostgREST filter operators.
        supabase
          .from("properties")
          .select("id, title, city, state, price, currency, operation, bedrooms, bathrooms, area_total, featured_image_url, brc_status")
          .eq("status", "PUBLICADO")
          .eq("city", prop.city ?? "")
          .neq("id", id)
          .limit(3),
      ]);

      if (mediaResult.data) {
        setMedia(mediaResult.data as PropertyMedia[]);
      }
      if (ownerResult.data) {
        setOwner(ownerResult.data as Profile);
      }
      if (similarResult.data) {
        setSimilarProperties(similarResult.data as SimilarProperty[]);
      }

      // Increment view count (fire and forget)
      if (!id.startsWith("demo-")) {
        supabase.rpc("increment_property_view_count", { property_id: id }).then();
      }

      setLoading(false);
    }

    fetchData();
  }, [id, supabase]);

  // Build images array from media or fallback to featured_image_url
  const images = useMemo(() => {
    if (media.length > 0) {
      return media.map((m) => m.url);
    }
    if (property?.featured_image_url) {
      return [property.featured_image_url];
    }
    return [];
  }, [media, property?.featured_image_url]);

  const amenities = property?.amenities ?? [];

  useEffect(() => {
    document.body.style.overflow = galleryOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [galleryOpen]);

  const openGallery = (index: number) => {
    setCurrentImage(index);
    setGalleryOpen(true);
  };

  const nextImage = () => setCurrentImage((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImage((prev) => (prev - 1 + images.length) % images.length);

  if (loading) return <LoadingSkeleton />;
  if (notFound || !property) return <NotFoundView />;

  const isBrcCertified = property.brc_status === "CERTIFICADO";
  const priceLabel = `${formatPrice(property.price, property.currency)} ${property.currency}`;
  const operationSuffix = property.operation === "RENTA" ? "/mes" : "";
  const locationText = [property.address_line, property.neighborhood, property.city, property.zip_code ? `C.P. ${property.zip_code}` : ""].filter(Boolean).join(", ");
  const ownerName = owner ? `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() : "Asesor";

  return (
    <main className="min-h-screen bg-background pt-[100px]">
      {/* Gallery Modal */}
      {galleryOpen && images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col overflow-hidden"
          onClick={() => setGalleryOpen(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" onClick={(e) => e.stopPropagation()}>
            <span className="text-white/70 text-sm">{currentImage + 1} / {images.length}</span>
            <button onClick={() => setGalleryOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center px-16 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={prevImage}
              className="absolute left-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="relative w-full max-w-4xl h-[70vh]">
              <Image
                src={images[currentImage]!}
                alt={`Foto ${currentImage + 1}`}
                fill
                className="object-contain"
              />
            </div>

            <button
              onClick={nextImage}
              className="absolute right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Thumbnails */}
          <div className="px-6 py-4 flex items-center justify-center gap-2 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrentImage(i)}
                className={`relative h-14 w-20 rounded-lg overflow-hidden shrink-0 transition-all ${
                  i === currentImage ? "ring-2 ring-white opacity-100" : "opacity-50 hover:opacity-80"
                }`}
              >
                <Image src={img} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Back + Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/propiedades">
                <ArrowLeft className="h-4 w-4" />
                Regresar
              </Link>
            </Button>
            <nav className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href="/propiedades" className="hover:text-foreground transition-colors">Propiedades</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">{property.title}</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground hover:text-white"
              style={{ transition: "all 0.3s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: property.title,
                    url: window.location.href,
                  }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert("Link copiado al portapapeles");
                }
              }}
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Compartir</span>
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Guardar</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Image Gallery */}
        {images.length > 0 && (
          <div className="mb-8 grid grid-cols-4 grid-rows-2 gap-3 h-[400px] sm:h-[480px] rounded-2xl overflow-hidden">
            {/* Main image */}
            <div className="col-span-2 row-span-2 relative group cursor-pointer" onClick={() => openGallery(0)}>
              <Image
                src={images[0]!}
                alt="Propiedad principal"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                priority
              />
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-lg">
                  {operationLabel(property.operation)}
                </span>
                {isBrcCertified && (
                  <span
                    className="text-white text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1"
                    style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                  >
                    <ShieldBrc className="h-3 w-3" />
                    Certificada BRC
                  </span>
                )}
              </div>
            </div>
            {/* Side images */}
            {images.slice(1, 4).map((img, i) => (
              <div
                key={i}
                className="relative group cursor-pointer"
                onClick={() => openGallery(i + 1)}
              >
                <Image
                  src={img}
                  alt={`Vista ${i + 2}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {i === 2 && images.length > 4 && (
                  <div
                    className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); openGallery(3); }}
                  >
                    <span className="text-white font-semibold text-sm">+{images.length - 3} fotos</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title + Price */}
            <div className="animate-fade-in-up">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {property.title}
              </h1>
              <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{locationText}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <p
                  className="text-3xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {priceLabel}{operationSuffix}
                </p>
                {property.published_at && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatTimeAgo(property.published_at)}
                  </div>
                )}
                {property.accepts_crypto && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    <Image src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Bitcoin-icono.png" alt="Bitcoin" width={16} height={16} className="object-contain" />
                    <Image src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/ethereum-icon.png" alt="Ethereum" width={16} height={16} className="object-contain" />
                    Acepta criptomonedas
                  </div>
                )}
              </div>
            </div>

            {/* Key Specs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: BedDouble, value: String(property.bedrooms ?? 0), label: "Recámaras" },
                { icon: Bath, value: String(property.bathrooms ?? 0), label: "Baños" },
                { icon: Ruler, value: String(property.area_built ?? property.area_total ?? 0), label: "m²" },
                { icon: Car, value: String(property.parking_spaces ?? 0), label: "Estacionamientos" },
              ].map((spec) => {
                const Icon = spec.icon;
                return (
                  <div
                    key={spec.label}
                    className="rounded-xl border border-border/50 p-4 text-center transition-all duration-300 hover:shadow-md hover:border-primary/30"
                  >
                    <div className="mx-auto mb-2 h-10 w-10 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))' }}
                    >
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-xl font-bold">{spec.value}</p>
                    <p className="text-xs text-muted-foreground">{spec.label}</p>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* BRC Certification Banner */}
            {isBrcCertified && (
              <div
                className="rounded-2xl p-5 flex items-center gap-4"
                style={{ background: 'linear-gradient(135deg, hsl(221 83% 53% / 0.08), hsl(160 84% 39% / 0.08))' }}
              >
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                >
                  <ShieldBrc className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Propiedad Certificada BRC</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Documentación legal verificada por Notario Público. Certificado con sello digital verificable.
                  </p>
                </div>
                {property.brc_certificate_id && (
                  <Button
                    asChild
                    size="sm"
                    className="ml-auto shrink-0 border-0 text-white text-xs"
                    style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                  >
                    <Link href={`/certificado/${property.brc_certificate_id}`}>Ver certificado</Link>
                  </Button>
                )}
              </div>
            )}

            {/* BRC - Not requested */}
            {property.brc_status === "NO_SOLICITADO" && (
              <div className="rounded-2xl p-5 flex items-center gap-4 border border-border/50">
                <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0 bg-muted">
                  <ShieldBrc className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">
                    {isOwner ? "Certificación BRC no solicitada" : "Propiedad sin certificación BRC"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isOwner
                      ? "Solicita la certificación BRC para verificar la documentación legal y aumentar la confianza."
                      : "Esta propiedad aún no cuenta con certificación BRC."}
                  </p>
                </div>
                {isOwner && (
                  <Button
                    asChild
                    size="sm"
                    className="ml-auto shrink-0 text-xs border-0 text-white"
                    style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                  >
                    <Link href={`/dashboard/propiedades/${property.id}/solicitar-brc`}>Solicitar certificación BRC</Link>
                  </Button>
                )}
              </div>
            )}

            {/* BRC - In review */}
            {property.brc_status === "EN_REVISION" && (
              <div
                className="rounded-2xl p-5 flex items-center gap-4"
                style={{ background: 'hsl(221 83% 53% / 0.06)' }}
              >
                <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0 bg-blue-100">
                  <ShieldBrc className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Certificación BRC en revisión</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    La documentación de esta propiedad está siendo revisada por un Notario Público. Te notificaremos cuando esté lista.
                  </p>
                </div>
                <span className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600">
                  <ShieldBrc className="h-3.5 w-3.5" />
                  En revisión
                </span>
              </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="descripcion" className="w-full">
              <TabsList className="w-full sm:w-auto bg-muted/50 rounded-xl p-1">
                <TabsTrigger value="descripcion" className="flex-1 sm:flex-none rounded-lg">
                  Descripción
                </TabsTrigger>
                <TabsTrigger value="caracteristicas" className="flex-1 sm:flex-none rounded-lg">
                  Características
                </TabsTrigger>
                <TabsTrigger value="ubicacion" className="flex-1 sm:flex-none rounded-lg">
                  Ubicación
                </TabsTrigger>
              </TabsList>

              <TabsContent value="descripcion" className="mt-6">
                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {property.description || "Sin descripción disponible."}
                </div>
              </TabsContent>

              <TabsContent value="caracteristicas" className="mt-6">
                {amenities.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {amenities.map((amenity) => (
                      <div
                        key={amenity}
                        className="flex items-center gap-2.5 rounded-xl bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="h-5 w-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-accent" />
                        </div>
                        <span className="text-sm">{amenity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay características registradas.</p>
                )}
              </TabsContent>

              <TabsContent value="ubicacion" className="mt-6">
                <div className="overflow-hidden rounded-2xl border">
                  <iframe
                    src={buildMapEmbedUrl(
                      property.latitude || geocoded?.lat || null,
                      property.longitude || geocoded?.lng || null,
                      property.neighborhood,
                      property.city,
                      property.state,
                    )}
                    width="100%"
                    height="350"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Notary info */}
            {isBrcCertified && (
              <div className="rounded-2xl border border-border/50 p-5">
                <h3 className="font-semibold text-sm mb-3">Información Notarial</h3>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldBrc className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Certificado BRC verificado</p>
                    <p className="text-xs text-muted-foreground">Documentación legal validada</p>
                  </div>
                </div>
              </div>
            )}
            {property.brc_status === "EN_REVISION" && (
              <div className="rounded-2xl border border-blue-100 p-5">
                <h3 className="font-semibold text-sm mb-3">Información Notarial</h3>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <ShieldBrc className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Revisión en proceso</p>
                    <p className="text-xs text-muted-foreground">Un notario está validando la documentación legal de esta propiedad</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-5">
              {/* Broker Card */}
              <div className="rounded-2xl border border-border/50 overflow-hidden">
                <div
                  className="p-5 text-white"
                  style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {owner?.avatar_url ? (
                        <Image
                          src={owner.avatar_url}
                          alt={ownerName}
                          width={56}
                          height={56}
                          className="rounded-full object-cover h-14 w-14"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                          {(owner?.first_name?.[0] ?? "A").toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-400 border-2 border-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{ownerName}</h3>
                      <p className="text-xs text-white/80">{owner?.role === "BROKER" ? "Broker" : "Propietario"}</p>
                      <div className="flex items-center gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        ))}
                        <span className="text-[10px] text-white/70 ml-1">5.0</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {owner?.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{owner.phone}</span>
                    </div>
                  )}
                  {owner?.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{owner.email}</span>
                    </div>
                  )}
                  {owner?.phone && (
                    <Button
                      asChild
                      className="w-full mt-2 border-0 text-white"
                      style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                    >
                      <a href={`tel:${owner.phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Llamar ahora
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Contact Form */}
              <ContactForm propertyId={property.id} ownerId={property.owner_id} />
            </div>
          </div>
        </div>
      </div>

      {/* Similar Properties */}
      {similarProperties.length > 0 && (
        <div className="border-t bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 sm:py-16">
            <h2 className="text-2xl font-bold tracking-tight mb-8">
              Propiedades Similares
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarProperties.map((prop) => (
                <Link key={prop.id} href={`/propiedades/${prop.id}`}>
                  <div className="group rounded-2xl overflow-hidden border border-border/50 bg-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                    <div className="relative h-48 overflow-hidden">
                      {prop.featured_image_url ? (
                        <Image
                          src={prop.featured_image_url}
                          alt={prop.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">Sin imagen</span>
                        </div>
                      )}
                      {prop.brc_status === "CERTIFICADO" && (
                        <div className="absolute top-2 right-2">
                          <span
                            className="text-white text-[10px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1"
                            style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                          >
                            <ShieldBrc className="h-3 w-3" />
                            BRC
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent pt-8 pb-3 px-4">
                        <p className="text-white font-bold">
                          {formatPrice(prop.price, prop.currency)} {prop.currency}
                          {prop.operation === "RENTA" ? "/mes" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {prop.title}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="text-xs">{prop.city}, {prop.state}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Bed className="h-3.5 w-3.5" />
                          <span>{prop.bedrooms}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Bath className="h-3.5 w-3.5" />
                          <span>{prop.bathrooms}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Maximize className="h-3.5 w-3.5" />
                          <span>{prop.area_total} m²</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
