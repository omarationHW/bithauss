"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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

const images = [
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa2.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa3.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa4.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa5.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa6.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa7.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa8.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa9.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa10.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.webp",
  "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa2.webp",
];

const amenities = [
  "Alberca",
  "Jardín privado",
  "Gimnasio",
  "Seguridad 24/7",
  "Estacionamiento techado",
  "Cuarto de servicio",
  "Bodega",
  "Terraza panorámica",
  "Sistema de alarma",
  "Cocina integral",
  "Pisos de mármol",
  "Ventanas doble acristalamiento",
  "Calefacción central",
  "Cuarto de lavado",
  "Área de BBQ",
  "Sala de cine",
];

const similarProperties = [
  {
    id: "2",
    title: "Departamento de Lujo en Polanco",
    city: "CDMX",
    price: "$45,000/mes MXN",
    bedrooms: 2,
    bathrooms: 2,
    area: 150,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa2.webp",
  },
  {
    id: "3",
    title: "Penthouse con Vista al Mar",
    city: "Cancún",
    price: "$12,300,000 MXN",
    bedrooms: 3,
    bathrooms: 3,
    area: 280,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa3.webp",
  },
  {
    id: "4",
    title: "Residencia en San Pedro",
    city: "Nuevo León",
    price: "$15,800,000 MXN",
    bedrooms: 5,
    bathrooms: 4,
    area: 450,
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa4.webp",
  },
];

export default function PropertyDetailPage() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

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

  return (
    <main className="min-h-screen bg-background pt-[100px]">
      {/* Gallery Modal */}
      {galleryOpen && (
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
                src={images[currentImage]}
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
              <span className="text-foreground font-medium">Casa Moderna en Bosques de las Lomas</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
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
        <div className="mb-8 grid grid-cols-4 grid-rows-2 gap-3 h-[400px] sm:h-[480px] rounded-2xl overflow-hidden">
          {/* Main image */}
          <div className="col-span-2 row-span-2 relative group cursor-pointer" onClick={() => openGallery(0)}>
            <Image
              src={images[0]}
              alt="Propiedad principal"
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority
            />
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-lg">
                En Venta
              </span>
              <span
                className="text-white text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1"
                style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
              >
                <ShieldCheck className="h-3 w-3" />
                Certificada BRC
              </span>
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
              {i === 2 && (
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

        {/* Content */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title + Price */}
            <div className="animate-fade-in-up">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Casa Moderna en Bosques de las Lomas
              </h1>
              <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">Bosques de las Lomas, CDMX · C.P. 11700</span>
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
                  $8,500,000 MXN
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Publicado hace 10 horas
                </div>
              </div>
            </div>

            {/* Key Specs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: BedDouble, value: "4", label: "Recámaras" },
                { icon: Bath, value: "3.5", label: "Baños" },
                { icon: Ruler, value: "320", label: "m²" },
                { icon: Car, value: "2", label: "Estacionamientos" },
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
            <div
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: 'linear-gradient(135deg, hsl(221 83% 53% / 0.08), hsl(160 84% 39% / 0.08))' }}
            >
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
              >
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Propiedad Certificada BRC</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Documentación legal verificada por Notario Público. Certificado con sello digital verificable.
                </p>
              </div>
              <Button
                asChild
                size="sm"
                className="ml-auto shrink-0 border-0 text-white text-xs"
                style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
              >
                <Link href="/como-funciona">Ver certificado</Link>
              </Button>
            </div>

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
                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Espectacular residencia contemporánea ubicada en una de las
                    zonas más exclusivas de la Ciudad de México. Esta propiedad
                    combina diseño arquitectónico de vanguardia con acabados de la
                    más alta calidad, ofreciendo un estilo de vida inigualable.
                  </p>
                  <p>
                    La casa cuenta con amplios espacios iluminados naturalmente
                    gracias a sus ventanales de piso a techo. La planta baja
                    incluye una sala de estar con doble altura, comedor formal,
                    cocina gourmet equipada con electrodomésticos de línea
                    profesional, y un estudio privado con vista al jardín.
                  </p>
                  <p>
                    En la planta alta encontrará la suite principal con vestidor
                    y baño de lujo, tres recámaras adicionales cada una con baño
                    completo, y una terraza con vista panorámica a la ciudad. El
                    área exterior cuenta con jardín privado, alberca infinita y
                    zona de asador.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="caracteristicas" className="mt-6">
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
              </TabsContent>

              <TabsContent value="ubicacion" className="mt-6">
                <div className="overflow-hidden rounded-2xl border">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15062.541716168!2d-99.25!3d19.38!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d2015a0b5a2a7d%3A0x8f67e7cd94e4c8af!2sBosques%20de%20las%20Lomas!5e0!3m2!1ses-419!2smx"
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
            <div className="rounded-2xl border border-border/50 p-5">
              <h3 className="font-semibold text-sm mb-3">Información Notarial</h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Notario: Alejandro Ramírez Torres</p>
                  <p className="text-xs text-muted-foreground">Notaría #45, Ciudad de México</p>
                </div>
              </div>
            </div>
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
                      <Image
                        src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/FUNDADOR.jpg"
                        alt="Carlos Mendoza"
                        width={56}
                        height={56}
                        className="rounded-full object-cover h-14 w-14"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-400 border-2 border-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Carlos Mendoza</h3>
                      <p className="text-xs text-white/80">RE/MAX México</p>
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>+52 55 1234 5678</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>carlos.mendoza@remax.mx</span>
                  </div>
                  <Button
                    className="w-full mt-2 border-0 text-white"
                    style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Llamar ahora
                  </Button>
                </div>
              </div>

              {/* Contact Form */}
              <div className="rounded-2xl border border-border/50 p-5">
                <h3 className="font-semibold text-sm mb-4">Agenda una visita</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name" className="text-xs">Nombre</Label>
                    <Input id="contact-name" placeholder="Tu nombre completo" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email" className="text-xs">Email</Label>
                    <Input id="contact-email" type="email" placeholder="tu@email.com" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-phone" className="text-xs">Teléfono</Label>
                    <Input id="contact-phone" type="tel" placeholder="+52 55 0000 0000" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-message" className="text-xs">Mensaje</Label>
                    <Textarea
                      id="contact-message"
                      placeholder="Me interesa esta propiedad..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                  <Button
                    className="w-full border-0 text-white"
                    style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                  >
                    Enviar mensaje
                  </Button>
                  <p className="text-center text-[10px] text-muted-foreground">
                    Al contactar, aceptas nuestros{" "}
                    <Link href="#" className="underline hover:text-foreground">
                      términos de servicio
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Properties */}
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
                    <Image
                      src={prop.image}
                      alt={prop.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-2 right-2">
                      <span
                        className="text-white text-[10px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1"
                        style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        BRC
                      </span>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent pt-8 pb-3 px-4">
                      <p className="text-white font-bold">{prop.price}</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
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
                        <span>{prop.area} m²</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
