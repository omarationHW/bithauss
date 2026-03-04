"use client";

import Link from "next/link";
import {
  MapPin,
  BedDouble,
  Bath,
  Ruler,
  Car,
  ShieldCheck,
  Phone,
  Mail,
  ChevronRight,
  Home,
  Heart,
  Share2,
  Check,
  ArrowLeft,
  Bed,
  Maximize,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const thumbnailGradients = [
  "from-blue-600 to-indigo-800",
  "from-blue-500 to-sky-700",
  "from-indigo-500 to-violet-700",
  "from-slate-500 to-blue-700",
];

const amenities = [
  "Alberca",
  "Jardin privado",
  "Gimnasio",
  "Seguridad 24/7",
  "Estacionamiento techado",
  "Cuarto de servicio",
  "Bodega",
  "Terraza panoramica",
  "Sistema de alarma",
  "Cocina integral",
  "Pisos de marmol",
  "Ventanas de doble acristalamiento",
  "Calefaccion central",
  "Cuarto de lavado",
  "Area de BBQ",
  "Sala de cine",
];

export default function PropertyDetailPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Back link */}
      <div className="bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <Link
            href="/propiedades"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a propiedades
          </Link>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Inicio
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href="/propiedades"
              className="hover:text-foreground transition-colors"
            >
              Propiedades
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium line-clamp-1">
              Casa Moderna en Bosques de las Lomas
            </span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Image Gallery */}
        <div className="mb-8">
          {/* Main image */}
          <div className="relative mb-3 overflow-hidden rounded-xl">
            <div className="h-[300px] bg-gradient-to-br from-blue-600 to-indigo-800 sm:h-[400px]">
              <div className="flex h-full items-center justify-center">
                <Home className="h-20 w-20 text-white/20" />
              </div>
            </div>
            {/* Action buttons */}
            <div className="absolute right-4 top-4 flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-full bg-white/90 hover:bg-white"
              >
                <Heart className="h-4 w-4 text-foreground" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-full bg-white/90 hover:bg-white"
              >
                <Share2 className="h-4 w-4 text-foreground" />
              </Button>
            </div>
            <Badge className="absolute left-4 top-4 bg-primary hover:bg-primary text-sm">
              En Venta
            </Badge>
          </div>
          {/* Thumbnails */}
          <div className="grid grid-cols-4 gap-3">
            {thumbnailGradients.map((gradient, i) => (
              <div
                key={i}
                className={cn(
                  "h-20 cursor-pointer overflow-hidden rounded-lg bg-gradient-to-br transition-opacity hover:opacity-80 sm:h-24",
                  gradient,
                  i === 0 && "ring-2 ring-primary ring-offset-2"
                )}
              >
                <div className="flex h-full items-center justify-center">
                  <Home className="h-6 w-6 text-white/20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: Property Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title and Price Section */}
            <div>
              <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Casa Moderna en Bosques de las Lomas
                  </h1>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">Bosques de las Lomas, CDMX</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-muted-foreground"
                  >
                    <Share2 className="h-4 w-4" />
                    Compartir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-muted-foreground"
                  >
                    <Heart className="h-4 w-4" />
                    Guardar
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-3xl font-bold text-primary">
                  $8,500,000
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    MXN
                  </span>
                </p>
                <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-500 text-white text-xs px-3 py-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Certificada BRC
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Key Specs */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <BedDouble className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">4</p>
                  <p className="text-xs text-muted-foreground">Recamaras</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bath className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">3.5</p>
                  <p className="text-xs text-muted-foreground">Banos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Ruler className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">320</p>
                  <p className="text-xs text-muted-foreground">m&sup2;</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">2</p>
                  <p className="text-xs text-muted-foreground">
                    Estacionamientos
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="descripcion" className="w-full">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="descripcion" className="flex-1 sm:flex-none">
                  Descripcion
                </TabsTrigger>
                <TabsTrigger
                  value="caracteristicas"
                  className="flex-1 sm:flex-none"
                >
                  Caracteristicas
                </TabsTrigger>
                <TabsTrigger value="ubicacion" className="flex-1 sm:flex-none">
                  Ubicacion
                </TabsTrigger>
              </TabsList>

              <TabsContent value="descripcion" className="mt-6">
                <div className="prose prose-sm max-w-none space-y-4 text-muted-foreground">
                  <p>
                    Espectacular residencia contemporanea ubicada en una de las
                    zonas mas exclusivas de la Ciudad de Mexico. Esta propiedad
                    combina diseno arquitectonico de vanguardia con acabados de la
                    mas alta calidad, ofreciendo un estilo de vida inigualable.
                  </p>
                  <p>
                    La casa cuenta con amplios espacios iluminados naturalmente
                    gracias a sus ventanales de piso a techo. La planta baja
                    incluye una sala de estar con doble altura, comedor formal,
                    cocina gourmet equipada con electrodomesticos de linea
                    profesional, y un estudio privado con vista al jardin.
                  </p>
                  <p>
                    En la planta alta encontrara la suite principal con vestidor
                    y bano de lujo, tres recamaras adicionales cada una con bano
                    completo, y una terraza con vista panoramica a la ciudad. El
                    area exterior cuenta con jardin privado, alberca infinita y
                    zona de asador.
                  </p>
                  <p>
                    La propiedad cuenta con certificacion BRC (Bienes Raices
                    Certificados) que garantiza la autenticidad de la
                    documentacion, el estado legal del inmueble y la transparencia
                    en la transaccion.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="caracteristicas" className="mt-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {amenities.map((amenity) => (
                    <div
                      key={amenity}
                      className="flex items-center gap-2 rounded-lg border px-4 py-3"
                    >
                      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-sm">{amenity}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="ubicacion" className="mt-6">
                <div className="overflow-hidden rounded-xl border">
                  <div className="flex h-[350px] items-center justify-center bg-muted/50">
                    <div className="text-center">
                      <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">
                        Mapa disponible proximamente
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        Bosques de las Lomas, CDMX
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Contact Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Broker Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-700 text-lg font-bold text-white">
                      CM
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Carlos Mendoza
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        RE/MAX Mexico
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>+52 55 1234 5678</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>carlos.mendoza@remax.mx</span>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Contactar al asesor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Nombre</Label>
                    <Input id="contact-name" placeholder="Tu nombre completo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="tu@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Telefono</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      placeholder="+52 55 0000 0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-message">Mensaje</Label>
                    <Textarea
                      id="contact-message"
                      placeholder="Me interesa esta propiedad. Me gustaria agendar una visita..."
                      rows={4}
                    />
                  </div>
                  <Button className="w-full">Enviar Mensaje</Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Al contactar, aceptas nuestros{" "}
                    <Link href="#" className="underline hover:text-foreground">
                      terminos de servicio
                    </Link>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Propiedades Similares */}
      <div className="border-t bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight mb-8">
            Propiedades Similares
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Residencia en Polanco",
                city: "CDMX",
                price: "$12,500,000 MXN",
                bedrooms: 4,
                bathrooms: 3,
                area: 320,
                gradient: "from-blue-500 to-blue-700",
              },
              {
                title: "Penthouse Santa Fe",
                city: "CDMX",
                price: "$8,900,000 MXN",
                bedrooms: 3,
                bathrooms: 2,
                area: 180,
                gradient: "from-emerald-400 to-emerald-600",
              },
              {
                title: "Villa Frente al Mar",
                city: "Cancun",
                price: "$18,200,000 MXN",
                bedrooms: 6,
                bathrooms: 5,
                area: 580,
                gradient: "from-cyan-400 to-blue-500",
              },
            ].map((prop, i) => (
              <Link key={prop.title} href={`/propiedades/${i + 2}`}>
                <Card className="group overflow-hidden border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 cursor-pointer">
                  <div className="relative">
                    <div
                      className={`h-40 bg-gradient-to-br ${prop.gradient} flex items-end p-3`}
                    >
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute bottom-0 left-4 w-12 h-20 bg-white rounded-t-sm" />
                        <div className="absolute bottom-0 left-12 w-8 h-28 bg-white rounded-t-sm" />
                        <div className="absolute bottom-0 right-6 w-14 h-16 bg-white rounded-t-sm" />
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                        <span className="text-white font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                          Ver Detalles
                        </span>
                      </div>
                      <Badge className="absolute top-2 right-2 bg-emerald-500 hover:bg-emerald-500 text-white text-xs border-0 gap-1 z-10">
                        <ShieldCheck className="h-3 w-3" />
                        BRC
                      </Badge>
                      <div className="relative z-10">
                        <span className="text-white font-bold text-base drop-shadow-md">
                          {prop.price}
                        </span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {prop.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="text-xs">{prop.city}</span>
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
                        <span>{prop.area} m&sup2;</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
