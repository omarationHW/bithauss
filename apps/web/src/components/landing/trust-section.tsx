import { Star } from 'lucide-react'
import Image from 'next/image'

const testimonials = [
  {
    name: 'Carlos Mendoza',
    role: 'Broker Independiente',
    image: 'https://bithaussstorage.blob.core.windows.net/images/confinza1.webp',
    quote:
      'BitHauss transformó mi negocio. Mis clientes confían más cuando ven el sello BRC en mis propiedades. He cerrado un 40% más de ventas desde que empecé a usar la plataforma.',
  },
  {
    name: 'Ana Lucía Vargas',
    role: 'Directora de Inmobiliaria',
    image: 'https://bithaussstorage.blob.core.windows.net/images/confianza2.webp',
    quote:
      'Como inmobiliaria, la certificación BRC nos diferencia de la competencia. El CRM integrado y los leads calificados han sido un game-changer para nuestro equipo de 15 agentes.',
  },
  {
    name: 'Angela Ramírez',
    role: 'Compradora',
    image: 'https://bithaussstorage.blob.core.windows.net/images/confianza3.webp',
    quote:
      'Compré mi primera casa con total tranquilidad gracias al certificado BRC. Saber que la propiedad fue verificada legalmente me dio la confianza para hacer la inversión más grande de mi vida.',
  },
]

const partners = [
  { name: 'Notaría 45', src: 'https://bithaussstorage.blob.core.windows.net/images/Notaria45.webp' },
  { name: 'Colegio de Notarios', src: 'https://bithaussstorage.blob.core.windows.net/images/Colegiodenotarios.webp' },
  { name: 'AMPI', src: 'https://bithaussstorage.blob.core.windows.net/images/AMPI.webp' },
  { name: 'PROFECO', src: 'https://bithaussstorage.blob.core.windows.net/images/PROFECO.webp' },
  { name: 'CNBV', src: 'https://bithaussstorage.blob.core.windows.net/images/CNBV.webp' },
  { name: 'RAN', src: 'https://bithaussstorage.blob.core.windows.net/images/Logo_RAN.webp' },
]

export function TrustSection() {
  return (
    <section className="bg-secondary/30 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-12 text-center sm:mb-16">
          <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            La{' '}
            <span className="relative inline-block">
              <span className="text-primary">Confianza</span>
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 300 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 8.5C50 2.5 100 1 150 3.5C200 6 250 2.5 299 8.5"
                  stroke="hsl(160 84% 39%)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>{' '}
            de Miles de Profesionales
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
            Brokers, inmobiliarias y compradores confían en BitHauss para proteger sus transacciones
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="border-border/40 rounded-xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-8"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-foreground text-sm leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              {/* Separator + Author */}
              <div className="border-border/50 mt-6 flex items-center gap-3 border-t pt-6">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold">{testimonial.name}</p>
                  <p className="text-muted-foreground text-xs">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Partners marquee carousel */}
        <div className="mt-16 text-center sm:mt-20">
          <p className="text-muted-foreground mb-8 text-sm font-medium tracking-wider uppercase">
            Respaldado por
          </p>
          <div className="relative overflow-hidden">
            {/* Fade edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-secondary/30 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-secondary/30 to-transparent" />

            <div className="animate-marquee flex w-max gap-12 sm:gap-16">
              {[...partners, ...partners, ...partners].map((partner, i) => (
                <div
                  key={`${partner.name}-${i}`}
                  className="relative h-16 w-24 shrink-0 opacity-70 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 sm:h-20 sm:w-32"
                >
                  <Image
                    src={partner.src}
                    alt={partner.name}
                    fill
                    className="object-contain"
                    sizes="128px"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="border-border/30 mt-12 border-t" />
        </div>
      </div>
    </section>
  )
}
