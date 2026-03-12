import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

const agents = [
  {
    name: 'Ricardo Herrera',
    role: 'Broker especializado',
    certId: '#J523215',
    experience: '5 años',
    sales: '36 ventas',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Broker1.webp',
  },
  {
    name: 'Eduardo Ramírez',
    role: 'Inversionista',
    certId: '#J52G961',
    experience: '3 años',
    sales: '15 ventas',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Broker2.webp',
  },
  {
    name: 'María López',
    role: 'Agente certificado',
    certId: '#J52H442',
    experience: '4 años',
    sales: '22 ventas',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Broker3.webp',
    blurred: true,
  },
]

const brokerCards = [
  {
    title: 'Conviértete en Broker principal de BitHauss',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Brokerprincipal1.webp',
  },
  {
    title: 'Conviértete en Broker profesional en BitHauss',
    image: 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Brokerprincipal2.webp',
  },
]

export function AgentsSection() {
  return (
    <>
      {/* Vendedores BitHauss */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
            {/* Left content */}
            <div>
              <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                Vendedores <span className="text-foreground">Bit</span>
                <span className="from-primary to-accent bg-gradient-to-r bg-clip-text text-transparent">
                  Hauss
                </span>
              </h2>
              <p className="text-foreground mt-2 font-semibold">
                ¿Quieres vender? Encuentra a nuestros brokers especializados
              </p>
              <p className="text-muted-foreground mt-3 text-sm">
                Te emparejamos con <span className="font-bold">seis agentes</span> en{' '}
                <span className="font-bold">la entidad de tu interés.</span>.
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Registra tu correo para ver un resumen y contactar con agentes
              </p>

              <Button className="from-primary to-accent shadow-accent/20 mt-6 bg-gradient-to-r text-white shadow-md hover:opacity-90">
                Contacta con agentes
              </Button>
            </div>

            {/* Right - Agent cards */}
            <div className="grid grid-cols-3 gap-4">
              {agents.map((agent) => (
                <div key={agent.name} className="relative text-center">
                  {/* Card content */}
                  <div className={agent.blurred ? 'blur-[2px]' : ''}>
                    {/* Avatar */}
                    <div className="relative mx-auto mb-3 h-16 w-16">
                      <div className="h-16 w-16 overflow-hidden rounded-full">
                        <Image
                          src={agent.image}
                          alt={agent.name}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="bg-primary absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full">
                        <ShieldCheck className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>

                    <h3 className="text-foreground text-sm font-semibold">{agent.name}</h3>
                    <p className="text-muted-foreground text-xs">{agent.role}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Certificado BRC: {agent.certId}
                    </p>

                    {/* Stats */}
                    <div className="mt-3 flex justify-center gap-4 text-xs">
                      <div>
                        <div className="text-muted-foreground">Experiencia</div>
                        <div className="text-foreground font-semibold">{agent.experience}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Año pasado</div>
                        <div className="text-foreground font-semibold">{agent.sales}</div>
                      </div>
                    </div>
                  </div>

                  {/* +4 overlay on blurred card (text only, no circle) */}
                  {agent.blurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-foreground text-2xl font-bold">+4</span>
                      <p className="text-foreground text-sm font-semibold">Agentes más</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Únete como aliado */}
      <section className="bg-secondary/30 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-foreground mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Únete como aliado de <span className="text-foreground">Bit</span>
            <span className="from-primary to-accent bg-gradient-to-r bg-clip-text text-transparent">
              Hauss
            </span>
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {brokerCards.map((card) => (
              <div
                key={card.title}
                className="bg-card border-border/40 overflow-hidden rounded-xl border transition-shadow duration-300 hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzNnLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyMDIwMjAiLz48L3N2Zz4="
                    className="object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-foreground text-lg font-bold">{card.title}</h3>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                    Los portales tradicionales cobran de $20,000 a $80,000 MXN por publicar 500
                    propiedades, con un jugador dominante controlando el 70% del mercado. En
                    BitHauss ofrecemos precios justos con CRM integrado, 14 días de prueba gratis.
                  </p>
                  <Link
                    href="/auth/registro"
                    className="from-primary to-accent mt-4 inline-block bg-gradient-to-r bg-clip-text text-sm font-semibold text-transparent transition-opacity hover:opacity-80"
                  >
                    Más información
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
