'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { logError } from '@/lib/log'

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const FALLBACK_IMAGE =
  'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.jpg'

/** Tabs are pure views over the same published set — no extra queries. */
const filterTabs = [
  'Propiedades Certificadas',
  'Lo más nuevo',
  'Más vistos',
  'Precios más bajos',
  'Propiedades de lujo',
] as const

type FilterTab = (typeof filterTabs)[number]

interface PropertyRow {
  id: string
  title: string | null
  address_line: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  price: number | null
  currency: string | null
  operation: string | null
  bedrooms: number | null
  bathrooms: number | null
  area_total: number | null
  featured_image_url: string | null
  brc_status: string | null
  accepts_crypto: boolean | null
  view_count: number | null
  created_at: string | null
}

interface FeaturedCard {
  id: string
  title: string
  price: string
  priceNumber: number
  bedrooms: number
  bathrooms: number
  area: number
  address: string
  image: string
  timeAgo: string
  isNew: boolean
  certified: boolean
  acceptsCrypto: boolean
  views: number
  createdAt: number
}

function formatPrice(
  price: number | null,
  currency: string | null,
  operation: string | null,
): string {
  if (price == null) return 'Precio a consultar'
  const formatted = price.toLocaleString('es-MX', { maximumFractionDigits: 0 })
  const suffix = operation === 'RENTA' ? ' / mes' : ''
  return `$${formatted} ${currency ?? 'MXN'}${suffix}`
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return 'Hace unos minutos'
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'Hora' : 'Horas'}`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days} ${days === 1 ? 'Día' : 'Días'}`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `Hace ${weeks} ${weeks === 1 ? 'Semana' : 'Semanas'}`
  const months = Math.floor(days / 30)
  return `Hace ${months} ${months === 1 ? 'Mes' : 'Meses'}`
}

function mapRow(p: PropertyRow): FeaturedCard {
  const line1 = [p.address_line, p.neighborhood].filter(Boolean).join(', ')
  const line2 = [p.city, p.state].filter(Boolean).join(', ')
  const created = p.created_at ? new Date(p.created_at).getTime() : 0
  return {
    id: p.id,
    title: p.title || 'Sin título',
    price: formatPrice(p.price, p.currency, p.operation),
    priceNumber: p.price ?? 0,
    bedrooms: p.bedrooms || 0,
    bathrooms: p.bathrooms || 0,
    area: p.area_total || 0,
    address: [line1, line2].filter(Boolean).join('\n'),
    image: p.featured_image_url || FALLBACK_IMAGE,
    timeAgo: timeAgo(p.created_at),
    isNew: created > 0 && Date.now() - created <= 7 * 86_400_000,
    certified: p.brc_status === 'CERTIFICADO',
    acceptsCrypto: !!p.accepts_crypto,
    views: p.view_count ?? 0,
    createdAt: created,
  }
}

/** Newest first, but certified listings lead — that is the section's promise. */
function applyTab(list: FeaturedCard[], tab: FilterTab): FeaturedCard[] {
  const sorted = [...list]
  switch (tab) {
    case 'Propiedades Certificadas':
      return sorted
        .filter((p) => p.certified)
        .sort((a, b) => b.createdAt - a.createdAt)
    case 'Lo más nuevo':
      return sorted.sort((a, b) => b.createdAt - a.createdAt)
    case 'Más vistos':
      return sorted.sort((a, b) => b.views - a.views)
    case 'Precios más bajos':
      return sorted
        .filter((p) => p.priceNumber > 0)
        .sort((a, b) => a.priceNumber - b.priceNumber)
    case 'Propiedades de lujo':
      return sorted.sort((a, b) => b.priceNumber - a.priceNumber)
    default:
      return sorted
  }
}

const ITEMS_PER_PAGE = 4
/** Cap the carousel so a large catalogue does not build dozens of slides. */
const MAX_CARDS = 12

export function FeaturedProperties() {
  // Defaults to the newest listings: the certified set is still small, and
  // opening on a tab with one card makes the home page look broken. Each tab
  // stays strict about what it shows — only certified listings carry the BRC
  // badge — so nothing here overstates the catalogue.
  const [activeTab, setActiveTab] = useState<FilterTab>('Lo más nuevo')
  const [currentPage, setCurrentPage] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [all, setAll] = useState<FeaturedCard[]>([])
  const [loading, setLoading] = useState(true)

  // Published listings only — this section mirrors what /propiedades shows.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('properties')
        .select(
          'id, title, address_line, neighborhood, city, state, price, currency, operation, bedrooms, bathrooms, area_total, featured_image_url, brc_status, accepts_crypto, view_count, created_at',
        )
        .eq('status', 'PUBLICADO')
        .order('created_at', { ascending: false })
        .limit(60)

      if (cancelled) return
      if (error) {
        logError('featured properties fetch failed', error)
      } else {
        setAll(((data ?? []) as PropertyRow[]).map(mapRow))
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(
    () => applyTab(all, activeTab).slice(0, MAX_CARDS),
    [all, activeTab],
  )

  const totalPages = Math.max(1, Math.ceil(visible.length / ITEMS_PER_PAGE))

  // A shorter list (or a tab switch) can leave the carousel past its last page.
  useEffect(() => {
    setCurrentPage(0)
  }, [activeTab])

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => (prev + 1) % totalPages)
  }, [totalPages])

  useEffect(() => {
    if (!isAutoPlaying || totalPages <= 1) return
    const interval = setInterval(nextPage, 8000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, nextPage, totalPages])

  const handleDotClick = (i: number) => {
    setCurrentPage(i)
    setIsAutoPlaying(false)
    // Resume autoplay after 10 seconds of inactivity
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const pages = Array.from({ length: totalPages }, (_, idx) =>
    visible.slice(idx * ITEMS_PER_PAGE, (idx + 1) * ITEMS_PER_PAGE),
  )

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Propiedades Certificadas
          </h2>
          <p className="text-muted-foreground mt-3">
            Explora las mejores propiedades verificadas en las principales ciudades de México
          </p>
        </div>

        {/* Filter tabs */}
        <div className="scrollbar-hide mb-8 flex items-center gap-6 overflow-x-auto pb-2 sm:gap-8">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'border-b-2 pb-2 text-sm font-medium whitespace-nowrap transition-colors duration-200',
                activeTab === tab
                  ? 'text-foreground border-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
              <div
                key={i}
                className="bg-muted/40 h-[420px] animate-pulse rounded-xl"
              />
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="border-border/60 rounded-xl border border-dashed px-6 py-16 text-center">
            <Home className="text-muted-foreground/50 mx-auto h-8 w-8" />
            <p className="text-foreground mt-4 font-semibold">
              Aún no hay propiedades en esta categoría
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Explora el catálogo completo para ver todo lo publicado.
            </p>
          </div>
        )}

      {/* Property cards — horizontal slide between pages */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${currentPage * 100}%)` }}
          >
            {pages.map((pageProps, pageIdx) => (
              <div
                key={pageIdx}
                className="grid w-full shrink-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
              >
                {pageProps.map((property) => (
                  <Link
                    key={property.id}
                    href={`/propiedades/${property.id}`}
                    className="bg-card border-border/40 block overflow-hidden rounded-xl border transition-all duration-500 hover:shadow-lg"
                  >
                    {/* Time label */}
                    <div className="text-muted-foreground flex items-center gap-1.5 px-4 py-2.5 text-xs">
                      <Home className="h-3.5 w-3.5" />
                      <span>Agregado</span>
                      <span className="text-foreground font-semibold">
                        {property.timeAgo}
                      </span>
                    </div>

                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={property.image}
                        alt={property.title}
                        fill
                        placeholder="blur"
                        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzNnLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyMDIwMjAiLz48L3N2Zz4="
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                      />

                      {property.isNew && (
                        <span className="bg-primary absolute top-3 left-3 rounded px-2 py-0.5 text-[10px] font-semibold text-white">
                          Nuevo
                        </span>
                      )}

                      {/* BRC Shield */}
                      {property.certified && (
                        <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center">
                          <Image
                            src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/ICONO-DE-VERIFICACION.png"
                            alt="Verificado BRC"
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        </div>
                      )}

                      {/* Crypto badge overlay on image */}
                      {property.acceptsCrypto && (
                        <div
                          className={cn(
                            'absolute right-3 z-10 flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 shadow-md backdrop-blur-sm',
                            property.certified ? 'top-14' : 'top-3',
                          )}
                        >
                          <Image
                            src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Bitcoin-icono.png"
                            alt="Cripto"
                            width={14}
                            height={14}
                            className="object-contain"
                          />
                          <span className="text-[9px] font-bold tracking-wide text-amber-700 uppercase">
                            Cripto
                          </span>
                        </div>
                      )}

                      {/* Certificado BRC badge centered */}
                      {property.certified && (
                        <div className="absolute bottom-14 left-1/2 z-10 -translate-x-1/2">
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-black/80 px-4 py-1.5 backdrop-blur-sm">
                            <span className="from-primary to-accent bg-gradient-to-r bg-clip-text text-xs font-bold text-transparent">
                              Certificado BRC
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Price overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-3">
                        <div className="text-[10px] text-white/60">Precio</div>
                        <div className="text-lg font-bold text-white">
                          {property.price}
                        </div>
                      </div>
                    </div>

                    {/* Card content */}
                    <div className="p-4">
                      <h3 className="text-foreground line-clamp-2 text-sm leading-tight font-semibold">
                        {property.title}
                      </h3>

                      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {property.bedrooms > 0 && (
                          <span>● {property.bedrooms} recámaras</span>
                        )}
                        {property.bathrooms > 0 && (
                          <span>● {property.bathrooms} baños</span>
                        )}
                        {property.area > 0 && <span>● {property.area} m²</span>}
                      </div>

                      <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed whitespace-pre-line">
                        {property.address}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Pagination dots */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => handleDotClick(i)}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-colors duration-200',
                currentPage === i
                  ? 'bg-primary'
                  : 'bg-muted-foreground/20 hover:bg-muted-foreground/40',
              )}
            />
          ))}
        </div>

        {/* View all button */}
        <div className="mt-8 text-center">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="group border-border/60 hover:from-primary hover:to-accent gap-2 px-8 transition-all duration-300 hover:border-transparent hover:bg-gradient-to-r hover:text-white"
          >
            <Link href="/propiedades">
              Ver todas las propiedades
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>

        {/* Trust stats */}
        <div className="mx-auto mt-16 max-w-3xl text-center">
          <h3 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Confianza en nuestras propiedades Certificadas y en la Tecnología aplicada al Real
            Estate
          </h3>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            Solo <span className="text-foreground font-bold">Bit</span>
            <span className="from-primary to-accent bg-gradient-to-r bg-clip-text font-bold text-transparent">
              Hauss
            </span>{' '}
            te conecta directamente con propiedades con un sello digital verificable que garantiza
            la legitimidad de la propiedad.
          </p>
        </div>
      </div>
    </section>
  )
}
