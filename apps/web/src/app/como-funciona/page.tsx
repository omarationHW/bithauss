import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShieldBrc } from '@/components/ui/shield-brc'
import { BrcExclusionNotice } from '@/components/ui/brc-exclusion-notice'

export const metadata: Metadata = {
  title: 'Como Funciona - BitHauss',
  description:
    'Descubre como funciona BitHauss: la plataforma mas segura para comprar, vender e invertir en bienes raices en Mexico con certificacion BRC.',
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

const buyerSteps = [
  {
    title: 'Busca',
    description: 'Explora propiedades verificadas con filtros avanzados',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Busca.png',
    bg: 'bg-gray-100',
  },
  {
    title: 'Verifica',
    description: 'Revisa el certificado BRC y la validación notarial de cada propiedad',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Verifica.png',
    bg: 'bg-gray-100',
  },
  {
    title: 'Compra con seguridad',
    description: 'Realiza tu compra con total confianza y respaldo jurídico',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/COMPRA-CON-SEGURIDAD.png',
    bg: 'bg-blue-600',
    textWhite: true,
    fullImage: true,
  },
]

const sellerSteps = [
  {
    title: 'Publica',
    description: 'Sube tu propiedad con fotos, descripción y documentación',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Publica.png',
    bg: 'bg-gray-100',
  },
  {
    title: 'Certifica',
    description: 'Solicita el certificado BRC para aumentar la confianza y visibilidad',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/CERTIFICA.png',
    bg: 'bg-gray-100',
  },
  {
    title: 'Cierra Tratos',
    description: 'Recibe leads calificados y gestiona todo desde tu dashboard',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/CIERRA-TRATOS.png',
    bg: 'bg-emerald-500',
    textWhite: true,
    fullImage: true,
  },
]

const brcSteps = [
  {
    step: 1,
    title: 'Solicitud',
    description: 'El broker o vendedor solicita la certificación BRC para su propiedad',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Solicitud.jpg',
    cta: 'Comienza tu solicitud',
    badgeColor: 'bg-blue-500',
  },
  {
    step: 2,
    title: 'Carga de Documentos',
    description: 'Se suben escritura, identificación oficial, comprobante predial y más',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Carga-De-Documentos.jpg',
    badgeGradient: 'linear-gradient(135deg, #1FC32D, #0DB582)',
  },
  {
    step: 3,
    title: 'Primera Revisión',
    description: 'Nuestro equipo Legal efectúa la revisión documental del expediente.\nUsamos Inteligencia Artificial',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Primera-Revision.jpg',
    badgeColor: 'bg-orange-500',
  },
  {
    step: 4,
    title: 'Validación Notarial',
    description: 'Un Notario Público revisa a fondo la documentación legal y el status del Inmueble',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Validacion-Notarial.jpg',
    badgeColor: 'bg-violet-500',
  },
  {
    step: 5,
    title: 'Certificado Digital',
    description: 'Se emite el Certificado BRC con sello digital verificable',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/ICONO-DE-VERIFICACION.png',
    cta: 'Certifica tu propiedad',
    badgeColor: 'bg-emerald-500',
    smallImage: true,
  },
]

const benefits = [
  {
    title: 'Seguridad Jurídica',
    description: 'Validación notarial de cada propiedad',
  },
  {
    title: 'Tecnología de Punta',
    description: 'Plataforma moderna y rápida',
  },
  {
    title: 'Precios Accesibles',
    description: 'Planes desde $499 MXN/mes',
  },
  {
    title: 'Soporte Dedicado',
    description: 'Equipo de soporte en español 24/7',
  },
  {
    title: 'Sin Fraudes',
    description: 'Protección contra fraudes inmobiliarios',
  },
  {
    title: 'Notarios Públicos en México',
    description: 'Notarios certificados en México',
  },
]

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function ComoFuncionaPage() {
  return (
    <main className="min-h-screen">
      {/* ================================================================== */}
      {/*  1. Hero                                                           */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden min-h-[65vh] flex items-end">
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, hsl(221 83% 53%) 0%, hsl(160 84% 39%) 100%)',
          }}
        />

        {/* Right image - full height */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 hidden md:block">
          <Image
            src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Hero.png"
            alt="BitHauss"
            fill
            className="object-contain object-right-bottom"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full pb-12 pt-36">
          {/* Left text */}
          <div className="text-white max-w-lg">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl leading-tight">
              ¿Cómo funciona BitHauss?
            </h1>
            <p className="mt-4 text-lg sm:text-xl leading-relaxed text-white/90">
              La plataforma más segura para comprar, vender e invertir en bienes raíces en México
            </p>
            <Button
              asChild
              className="mt-6 bg-white hover:bg-white/90"
            >
              <Link
                href="/auth/registro"
                style={{
                  background: 'white',
                  WebkitBackgroundClip: 'unset',
                }}
              >
                <span
                  className="font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Comienza tu verificación
                </span>
              </Link>
            </Button>

            {/* Mini features */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center mb-2">
                  {/* Circle 1 */}
                  <div className="relative h-12 w-12 rounded-full overflow-hidden">
                    <Image src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Casa1.jpg" alt="" fill className="object-cover" />
                    <div
                      className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                    >
                      <ShieldBrc className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  {/* Circle 2 */}
                  <div className="relative h-12 w-12 rounded-full overflow-hidden -ml-3">
                    <Image src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/casa2.jpg" alt="" fill className="object-cover" />
                    <div
                      className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                    >
                      <ShieldBrc className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  {/* Plus square */}
                  <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center -ml-2">
                    <span className="text-white text-lg font-light">+</span>
                  </div>
                </div>
                <p className="text-[10px] text-white/70 leading-snug text-justify">
                  Verificamos a fondo la documentación legal y el status del Inmueble
                </p>
              </div>
              <div>
                <div className="mb-2 h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                  <ShieldBrc className="h-10 w-10 text-white" />
                </div>
                <p className="text-[10px] text-white/70 leading-snug text-justify">
                  Emitimos el Certificado BRC con sello digital verificable ante notario
                </p>
              </div>
              <div>
                <div
                  className="mb-2 h-11 w-11 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #DBDBDB 100%)' }}
                >
                  <ArrowRight className="h-5 w-5 text-blue-600 rotate-[-90deg]" />
                </div>
                <p className="text-[10px] text-white/70 leading-snug text-justify">
                  Tu propiedad recibirá el mayor número de compradores
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  2. Para Compradores                                               */}
      {/* ================================================================== */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Para Compradores
            </h2>
            <p className="text-muted-foreground mt-3">
              Encuentra tu propiedad ideal con la seguridad que mereces
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {buyerSteps.map((step) => (
              <div
                key={step.title}
                className={`rounded-2xl overflow-hidden ${step.bg} ${step.textWhite ? 'text-white' : ''} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
              >
                <div className={`relative overflow-hidden ${step.fullImage ? 'h-60' : 'h-64'}`}>
                  <Image
                    src={step.image}
                    alt={step.title}
                    fill
                    className={step.fullImage ? "object-cover scale-110" : "object-contain p-0 scale-110"}
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className={`text-sm mt-1 leading-relaxed ${step.textWhite ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  3. Para Brokers y Vendedores                                      */}
      {/* ================================================================== */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Para Brokers y Vendedores
            </h2>
            <p className="text-muted-foreground mt-3">
              Publica, certifica y cierra tratos con herramientas profesionales
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sellerSteps.map((step) => (
              <div
                key={step.title}
                className={`rounded-2xl overflow-hidden ${step.bg} ${step.textWhite ? 'text-white' : ''} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
              >
                <div className={`relative overflow-hidden ${step.fullImage ? 'h-60' : 'h-52'}`}>
                  <Image
                    src={step.image}
                    alt={step.title}
                    fill
                    className={step.fullImage ? "object-cover scale-110" : "object-contain p-2"}
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className={`text-sm mt-1 leading-relaxed ${step.textWhite ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  4. El Proceso BRC                                                 */}
      {/* ================================================================== */}
      <section
        className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
        style={{
          background: 'linear-gradient(135deg, hsl(221 83% 53% / 0.04) 0%, hsl(160 84% 39% / 0.04) 100%)',
        }}
      >
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <span
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
            >
              <ShieldBrc className="h-4 w-4" />
              Certificación BRC
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              El Proceso BRC
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Conoce paso a paso como certificamos cada propiedad para garantizar tu tranquilidad
            </p>
          </div>

          <BrcExclusionNotice className="mb-8 max-w-3xl mx-auto" />

          <div className="space-y-6">
            {brcSteps.map((step, index) => {
              const isOdd = index % 2 !== 0
              return (
                <div
                  key={step.title}
                  className="rounded-2xl bg-gradient-to-r from-blue-50/50 to-green-50/30 border border-border/30 overflow-hidden transition-all duration-300 hover:shadow-lg"
                >
                  <div className={`grid md:grid-cols-2 gap-6 p-6 ${isOdd ? '' : ''}`}>
                    {/* Text side */}
                    <div className={`flex flex-col justify-center ${isOdd ? 'md:order-2' : ''}`}>
                      <span
                        className={`inline-flex items-center gap-1.5 w-fit rounded-full px-3 py-1 text-xs font-bold text-white ${step.badgeColor || ''}`}
                        style={step.badgeGradient ? { background: step.badgeGradient } : undefined}
                      >
                        <span className="text-[10px]">✦</span> Paso {step.step}
                      </span>
                      <h3 className="mt-3 text-xl font-bold sm:text-2xl">{step.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {step.description}
                      </p>
                      {step.cta && (
                        <Button
                          asChild
                          size="sm"
                          className="mt-4 w-fit border-0 text-white"
                          style={{
                            background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))',
                          }}
                        >
                          <Link href="/auth/registro">{step.cta}</Link>
                        </Button>
                      )}
                    </div>

                    {/* Image side */}
                    <div className={`relative h-48 sm:h-56 rounded-xl overflow-hidden ${isOdd ? 'md:order-1' : ''} ${step.smallImage ? 'flex items-center justify-center' : ''}`}>
                      <Image
                        src={step.image}
                        alt={step.title}
                        {...(step.smallImage ? { width: 210, height: 210 } : { fill: true })}
                        className={step.smallImage ? "object-contain" : "object-cover"}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  5. Por qué BitHauss                                               */}
      {/* ================================================================== */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              ¿Por qué{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">BitHauss</span>
              ?
            </h2>
            <p className="text-muted-foreground mt-3">
              Las razones por las que los profesionales confían en nosotros
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-3 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldBrc className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  6. CTA                                                            */}
      {/* ================================================================== */}
      <section className="px-4 pt-16 sm:px-6 sm:pt-20 lg:px-8 pb-0 mb-[-120px] relative z-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl bg-gray-50 overflow-hidden shadow-lg">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-8 sm:p-12 flex flex-col justify-center">
                <h2 className="text-2xl sm:text-3xl font-bold">
                  ¿Listo para empezar?
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  Únete a la plataforma de bienes raíces más segura de México. Tu
                  próxima propiedad te está esperando.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="border-0 text-white"
                    style={{
                      background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))',
                    }}
                  >
                    <Link href="/auth/registro">
                      Registrarse Gratis
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>

                  <Button asChild variant="outline">
                    <Link href="#">Agendar Demo</Link>
                  </Button>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  Sin tarjeta de crédito requerida · Configuración en 5 minutos
                </p>
              </div>

              <div className="relative min-h-[300px] hidden md:block">
                <Image
                  src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Listo-para-empezar.jpg"
                  alt="Listo para empezar"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
