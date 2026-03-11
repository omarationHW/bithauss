import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const agents = [
  {
    name: "Ricardo Herrera",
    role: "Broker especializado",
    certId: "#J523215",
    experience: "5 años",
    sales: "36 ventas",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Broker1.webp",
  },
  {
    name: "Eduardo Ramírez",
    role: "Inversionista",
    certId: "#J52G961",
    experience: "3 años",
    sales: "15 ventas",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Broker2.webp",
  },
  {
    name: "María López",
    role: "Agente certificado",
    certId: "#J52H442",
    experience: "4 años",
    sales: "22 ventas",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Broker3.webp",
    blurred: true,
  },
];

const brokerCards = [
  {
    title: "Conviértete en Broker principal de BitHauss",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Brokerprincipal1.webp",
  },
  {
    title: "Conviértete en Broker profesional en BitHauss",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Brokerprincipal2.webp",
  },
];

export function AgentsSection() {
  return (
    <>
      {/* Vendedores BitHauss */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Left content */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Vendedores{" "}
                <span className="text-foreground">Bit</span>
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Hauss</span>
              </h2>
              <p className="mt-2 font-semibold text-foreground">
                ¿Quieres vender? Encuentra a nuestros brokers especializados
              </p>
              <p className="mt-3 text-muted-foreground text-sm">
                Te emparejamos con <span className="font-bold">seis agentes</span> en{" "}
                <span className="font-bold">Azcapotzalco, CDMX</span>.
              </p>
              <p className="mt-2 text-muted-foreground text-sm">
                Registra tu correo para ver un resumen y contactar con agentes
              </p>

              <Button className="mt-6 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-md shadow-accent/20">
                Contacta con agentes
              </Button>
            </div>

            {/* Right - Agent cards */}
            <div className="grid grid-cols-3 gap-4">
              {agents.map((agent) => (
                <div
                  key={agent.name}
                  className="text-center relative"
                >
                  {/* Card content */}
                  <div className={agent.blurred ? "blur-[2px]" : ""}>
                    {/* Avatar */}
                    <div className="relative mx-auto w-16 h-16 mb-3">
                      <div className="w-16 h-16 rounded-full overflow-hidden">
                        <Image
                          src={agent.image}
                          alt={agent.name}
                          width={64}
                          height={64}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <ShieldCheck className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>

                    <h3 className="font-semibold text-foreground text-sm">
                      {agent.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Certificado BRC: {agent.certId}
                    </p>

                    {/* Stats */}
                    <div className="mt-3 flex justify-center gap-4 text-xs">
                      <div>
                        <div className="text-muted-foreground">Experiencia</div>
                        <div className="font-semibold text-foreground">{agent.experience}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Año pasado</div>
                        <div className="font-semibold text-foreground">{agent.sales}</div>
                      </div>
                    </div>
                  </div>

                  {/* +4 overlay on blurred card (text only, no circle) */}
                  {agent.blurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-bold text-foreground text-2xl">+4</span>
                      <p className="text-sm font-semibold text-foreground">
                        Agentes más
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Únete como aliado */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-center mb-10">
            Únete como aliado de{" "}
            <span className="text-foreground">Bit</span>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Hauss</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {brokerCards.map((card) => (
              <div
                key={card.title}
                className="bg-card rounded-xl border border-border/40 overflow-hidden hover:shadow-lg transition-shadow duration-300"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-foreground text-lg">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Los portales tradicionales cobran de $20,000 a $80,000 MXN
                    por publicar 500 propiedades, con un jugador dominante
                    controlando el 70% del mercado. En BitHauss ofrecemos
                    precios justos con CRM integrado, 14 días de prueba gratis.
                  </p>
                  <Link
                    href="/auth/registro"
                    className="inline-block mt-4 text-sm font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent hover:opacity-80 transition-opacity"
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
  );
}
