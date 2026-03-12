import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Search,
  ShieldCheck,
  CheckCircle,
  Upload,
  Award,
  Handshake,
  FileText,
  ClipboardCheck,
  Scale,
  Shield,
  Cpu,
  DollarSign,
  Headphones,
  Ban,
  Users,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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
    icon: Search,
    title: 'Busca',
    description: 'Explora propiedades verificadas con filtros avanzados',
  },
  {
    icon: ShieldCheck,
    title: 'Verifica',
    description: 'Revisa el certificado BRC y la validacion notarial de cada propiedad',
  },
  {
    icon: CheckCircle,
    title: 'Compra Seguro',
    description: 'Realiza tu compra con total confianza y respaldo juridico',
  },
]

const sellerSteps = [
  {
    icon: Upload,
    title: 'Publica',
    description: 'Sube tu propiedad con fotos, descripcion y documentacion',
  },
  {
    icon: Award,
    title: 'Certifica',
    description: 'Solicita el certificado BRC para aumentar la confianza y visibilidad',
  },
  {
    icon: Handshake,
    title: 'Cierra Tratos',
    description: 'Recibe leads calificados y gestiona todo desde tu dashboard',
  },
]

const brcSteps = [
  {
    icon: FileText,
    title: 'Solicitud',
    description: 'El broker o vendedor solicita la certificacion BRC para su propiedad',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-indigo-500',
  },
  {
    icon: Upload,
    title: 'Carga de Documentos',
    description: 'Se suben escritura, identificacion oficial, comprobante predial y mas',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-indigo-500',
  },
  {
    icon: ClipboardCheck,
    title: 'Primera Revisión',
    description:
      'Nuestro equipo Legal efectúa la revisión documental del expediente.\nUsamos Inteligencia Artificial',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-orange-500',
  },
  {
    icon: Scale,
    title: 'Validacion Notarial',
    description:
      'Un Notario Público revisa a fondo la documentación legal y el status del Inmueble',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    gradientFrom: 'from-violet-500',
    gradientTo: 'to-purple-500',
  },
  {
    icon: Award,
    title: 'Certificado Digital',
    description: 'Se emite el Certificado BRC con sello digital verificable',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-teal-500',
  },
]

const benefits = [
  {
    icon: Shield,
    title: 'Seguridad Juridica',
    description: 'Validacion notarial de cada propiedad',
  },
  {
    icon: Cpu,
    title: 'Tecnologia de Punta',
    description: 'Plataforma moderna y rapida',
  },
  {
    icon: DollarSign,
    title: 'Precios Accesibles',
    description: 'Planes desde $499 MXN/mes',
  },
  {
    icon: Headphones,
    title: 'Soporte Dedicado',
    description: 'Equipo de soporte en espanol 24/7',
  },
  {
    icon: Ban,
    title: 'Sin Fraudes',
    description: 'Proteccion contra fraudes inmobiliarios',
  },
  {
    icon: Users,
    title: 'Notarios Públicos en México',
    description: 'Notarios certificados en todo Mexico',
  },
]

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function ComoFuncionaPage() {
  return (
    <main className="min-h-screen pt-[100px]">
      {/* ================================================================== */}
      {/*  1. Hero                                                           */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        {/* Background with brand gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #0F172A 0%, #142C5F 50%, #0F172A 100%)',
          }}
        />
        {/* Subtle pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Gradient glow accents */}
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Transparencia y Confianza
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            &iquest;Como Funciona{' '}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">BitHauss</span>
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
            </span>
            ?
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
            La plataforma mas segura para comprar, vender e invertir en bienes raices en Mexico
          </p>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  2. Para Compradores                                               */}
      {/* ================================================================== */}
      <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8 bg-secondary/30">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              Compradores
            </span>
            <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              Para Compradores
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
              Encuentra tu propiedad ideal con la seguridad que mereces
            </p>
          </div>

          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
            {buyerSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={step.title}
                  className="group relative flex flex-col items-center text-center"
                >
                  {/* Connector line */}
                  {index < buyerSteps.length - 1 && (
                    <div className="absolute top-12 left-[calc(50%+48px)] hidden h-0.5 w-[calc(100%-96px+3rem)] bg-gradient-to-r from-primary/40 to-primary/10 md:block" />
                  )}

                  <div className="relative z-10 mb-6">
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/10 group-hover:shadow-xl group-hover:shadow-primary/10">
                      <Icon className="text-primary h-10 w-10" />
                    </div>
                    <div className="absolute -top-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white shadow-lg shadow-primary/30">
                      {index + 1}
                    </div>
                  </div>

                  <h3 className="text-foreground mb-2 text-xl font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground max-w-xs leading-relaxed">
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  3. Para Brokers y Vendedores                                      */}
      {/* ================================================================== */}
      <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-block rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
              Brokers y Vendedores
            </span>
            <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              Para Brokers y Vendedores
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
              Publica, certifica y cierra tratos con herramientas profesionales
            </p>
          </div>

          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-12">
            {sellerSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={step.title}
                  className="group relative flex flex-col items-center text-center"
                >
                  {index < sellerSteps.length - 1 && (
                    <div className="absolute top-12 left-[calc(50%+48px)] hidden h-0.5 w-[calc(100%-96px+3rem)] bg-gradient-to-r from-accent/40 to-accent/10 md:block" />
                  )}

                  <div className="relative z-10 mb-6">
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-accent/20 bg-accent/5 transition-all duration-300 group-hover:scale-110 group-hover:bg-accent/10 group-hover:shadow-xl group-hover:shadow-accent/10">
                      <Icon className="text-accent h-10 w-10" />
                    </div>
                    <div className="absolute -top-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-teal-600 text-sm font-bold text-white shadow-lg shadow-accent/30">
                      {index + 1}
                    </div>
                  </div>

                  <h3 className="text-foreground mb-2 text-xl font-semibold">{step.title}</h3>
                  <p className="text-muted-foreground max-w-xs leading-relaxed">
                    {step.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  4. El Proceso BRC  — Dark section like landing CTA                */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #0F172A 0%, #142C5F 50%, #0F172A 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-96 w-96 rounded-full bg-accent/8 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-16 text-center sm:mb-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Certificacion BRC
            </span>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              El Proceso BRC
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/60">
              Conoce paso a paso como certificamos cada propiedad para garantizar tu tranquilidad
            </p>
          </div>

          {/* Vertical timeline */}
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute top-0 bottom-0 left-8 w-px bg-gradient-to-b from-blue-500/50 via-amber-500/50 via-violet-500/50 to-emerald-500/50 sm:left-10" />

            <div className="space-y-10 sm:space-y-12">
              {brcSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <div key={step.title} className="group relative flex gap-6 sm:gap-8">
                    {/* Left: icon node */}
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className={cn(
                          'flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl sm:h-20 sm:w-20',
                          step.bgColor,
                          step.borderColor,
                        )}
                      >
                        <Icon className={cn('h-7 w-7 sm:h-8 sm:w-8', step.color)} />
                      </div>
                    </div>

                    {/* Right: card content */}
                    <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-white/[0.08] group-hover:shadow-xl sm:p-6">
                      <div className="mb-3 flex items-center gap-3">
                        <span
                          className={cn(
                            'inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-sm',
                            step.gradientFrom,
                            step.gradientTo,
                          )}
                        >
                          {index + 1}
                        </span>
                        <h3 className="text-lg font-semibold text-white sm:text-xl">{step.title}</h3>
                      </div>
                      <p className="text-sm leading-relaxed text-white/60 sm:text-base whitespace-pre-line">
                        {step.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Final flourish */}
            <div className="relative z-10 mt-14 flex justify-center">
              <div className="inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-7 py-3.5 font-semibold text-emerald-400 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-emerald-500/15 hover:shadow-lg hover:shadow-emerald-500/10">
                <Award className="h-5 w-5" />
                Propiedad Certificada BRC
                <CheckCircle className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  5. Por que BitHauss — Benefits grid                               */}
      {/* ================================================================== */}
      <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8 bg-secondary/30">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              &iquest;Por que{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">BitHauss</span>
              ?
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
              Las razones por las que miles de profesionales confian en nosotros
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <div
                  key={benefit.title}
                  className="group rounded-2xl border border-border/50 bg-background p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/5 sm:p-8"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-foreground mb-2 text-lg font-semibold">{benefit.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/*  6. CTA                                                            */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #0F172A 0%, #142C5F 50%, #0F172A 100%)',
          }}
        />
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            &iquest;Listo para empezar?
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            Unete a la plataforma de bienes raices mas segura de Mexico. Tu proxima propiedad te
            esta esperando.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base border-0 bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:opacity-90 transition-all duration-300"
            >
              <Link href="/auth/register">
                Registrarse Gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 bg-transparent px-8 text-base border-white/20 text-white hover:bg-white/10 hover:text-white transition-all duration-300"
            >
              <Link href="/propiedades">Ver Propiedades</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-white/40">
            Sin tarjeta de credito requerida &middot; Configuracion en 5 minutos
          </p>
        </div>
      </section>
    </main>
  )
}
