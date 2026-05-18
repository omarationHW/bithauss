import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  ArrowLeftRight,
  Bitcoin,
  Brain,
  Blocks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShieldBrc } from '@/components/ui/shield-brc'
import { SecurityBrcSection } from "@/components/nosotros/security-brc-section";

export const metadata: Metadata = {
  title: "Nosotros - BitHauss | Bienes Raices Certificados",
  description:
    "Conoce la mision, vision y equipo detras de BitHauss. Transformamos el mercado inmobiliario en Mexico eliminando el fraude con certificacion juridica digital.",
};

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const marketStats = [
  {
    value: "280.6",
    badge: "BILLONES USD",
    label: "Valor de bienes inmuebles en el mundo",
    bg: "bg-blue-50",
    badgeBg: "bg-blue-100 text-blue-700",
  },
  {
    value: "3.5x",
    badge: "PIB MUNDIAL",
    label: "Los bienes raíces como depósito de riqueza",
    bg: "bg-green-50",
    badgeBg: "bg-green-100 text-green-700",
  },
  {
    value: "80%",
    badge: "DE LEADS",
    label: "De compra se originan de portales inmobiliarios",
    bg: "bg-purple-50",
    badgeBg: "bg-purple-100 text-purple-700",
  },
  {
    value: "10%",
    badge: "DIGITALIZADAS",
    label: "De las propiedades en venta o renta en Mexico",
    bg: "bg-orange-50",
    badgeBg: "bg-orange-100 text-orange-700",
  },
];

const problemStats = [
  {
    value: "$600M",
    sub: "MXN",
    label: "Perdidas anuales por fraudes inmobiliarios en México",
  },
  {
    value: "35M",
    sub: "",
    label: "Propiedades en México, solo el 10% están digitalizadas",
  },
  {
    value: "8 DE 10",
    sub: "",
    label: "Operaciones inmobiliarias se inician en internet",
  },
  {
    value: "$20k-$80k",
    sub: "",
    label: "MXN cuesta publicar 500 propiedades en portales tradicionales",
  },
];

const solutions = [
  {
    icon: ShieldBrc, title: "Bienes Raices Certificados",
    description:
      "Creadores del concepto BRC para reducir fraudes inmobiliarios mediante validación notarial digital.",
    iconColor: "text-emerald-500",
    iconBg: "bg-gradient-to-br from-blue-50 to-emerald-50 ring-1 ring-blue-100",
    iconGradient: true,
  },
  {
    icon: Building2,
    title: "Portal Inmobiliario CRM",
    description:
      "Creación del primer portal inmobiliario con CRM integrado y precios accesibles en México.",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-100",
  },
  {
    icon: ArrowLeftRight,
    title: "Compraventa Digital",
    description:
      "Primer portal en integrar todo el proceso de compraventa inmobiliaria de manera digital.",
    iconColor: "text-violet-500",
    iconBg: "bg-violet-100",
  },
  {
    icon: Bitcoin,
    title: "Compra con Criptomonedas",
    description:
      "Portal inmobiliario que permite la compra de propiedades a distancia mediante criptomonedas.",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-100",
  },
  {
    icon: Brain,
    title: "Inteligencia Artificial",
    description:
      "Apps de IA para facilitar la búsqueda de inmuebles con recomendaciones inteligentes.",
    iconColor: "text-pink-500",
    iconBg: "bg-pink-100",
  },
  {
    icon: Blocks,
    title: "Inmuebles Tokenizados",
    description:
      "Portal que permite publicar y administrar inmuebles tokenizados para inversión fraccionada.",
    iconColor: "text-cyan-500",
    iconBg: "bg-cyan-100",
  },
];

const team = [
  {
    name: "Renato Torres",
    role: "Fundador",
    bio: "Visionario del sector inmobiliario con amplia experiencia en negocios y desarrollo estratégico",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/FUNDADOR.jpg",
  },
  {
    name: "Omar Rivera",
    role: "Co-Fundador",
    bio: "Emprendedor tech con 10+ años en desarrollo de plataformas digitales",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/FUNDADOR.jpg",
  },
  {
    name: "Oscar Rivera",
    role: "Co-Fundador",
    bio: "Especialista en tecnología y arquitectura de soluciones empresariales",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/FUNDADOR.jpg",
  },
];

const values = [
  {
    title: "Transparencia",
    description: "Cada paso del proceso es visible y verificable",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Transparencia.png",
    bg: "bg-green-50",
  },
  {
    title: "Seguridad",
    description: "La protección de tu patrimonio es nuestra prioridad",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Seguridad-Seccion2.png",
    bg: "bg-blue-50",
  },
  {
    title: "Innovación",
    description: "Tecnología al servicio del sector inmobiliario",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Innovacion.png",
    bg: "bg-yellow-50",
  },
  {
    title: "Accesibilidad",
    description: "Herramientas profesionales a precios justos",
    image: "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Accesibilidad.png",
    bg: "bg-purple-50",
  },
];

const platformStats = [
  { value: "2,500+", label: "Propiedades" },
  { value: "150+", label: "Notarios" },
  { value: "500+", label: "Brokers" },
  { value: "32", label: "Estados" },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function NosotrosPage() {
  return (
    <main className="min-h-screen">
      {/* ============================================================ */}
      {/*  1. Hero                                                     */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden min-h-[70vh] flex items-center justify-center">
        <Image
          src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Nosotros.jpg"
          alt="BitHauss - Transformando el mercado inmobiliario"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-blue-900/60" />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center text-white animate-fade-in-up">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Transformando el Mercado Inmobiliario en México
          </h1>

          <p className="mt-8 text-base sm:text-lg leading-relaxed text-white/90 max-w-3xl mx-auto">
            BitHauss es la primera plataforma en digitalizar todo el procedimiento
            de compraventa de inmuebles, permitiendo realizar operaciones a distancia.
            También, la primera en implementar el concepto BRC (Bienes Raíces Certificados)
            para evitar fraudes inmobiliarios.
          </p>
          <p className="mt-6 text-base sm:text-lg leading-relaxed text-white/80 max-w-3xl mx-auto">
            Somos el portal de acceso a la nueva era digital inmobiliaria, donde el
            cliente puede publicar inmuebles tradicionales, buscar propiedades
            certificadas, tokenizadas, o comprar propiedades con criptomonedas.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  2. Misión y Visión                                          */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
          Sobre nosotros
        </h2>
        <div className="mx-auto max-w-5xl grid md:grid-cols-2 gap-6">
          {/* Misión */}
          <div className="relative overflow-hidden rounded-2xl bg-blue-500 p-8 text-white min-h-[320px] flex flex-col justify-between transition-all duration-500 hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">Nuestra Misión</h3>
              <p className="text-white/90 leading-relaxed">
                Proteger el patrimonio de los mexicanos mediante tecnología y
                certificación jurídica, eliminando el fraude en transacciones
                inmobiliarias.
              </p>
            </div>
            <div className="flex justify-center mt-4">
              <Image
                src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Nuestra-Mision.png"
                alt="Nuestra Misión"
                width={180}
                height={180}
                className="object-contain"
              />
            </div>
          </div>

          {/* Visión */}
          <div className="relative overflow-hidden rounded-2xl bg-emerald-500 p-8 text-white min-h-[320px] flex flex-col justify-between transition-all duration-500 hover:shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-1">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">Nuestra Visión</h3>
              <p className="text-white/90 leading-relaxed">
                Ser la plataforma líder en Latinoamérica para bienes raíces
                certificados, donde cada propiedad cuenta con respaldo notarial
                verificable.
              </p>
            </div>
            <div className="flex justify-center mt-4">
              <Image
                src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Nuestra-Vision.png"
                alt="Nuestra Visión"
                width={240}
                height={240}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  3. Mercado en números                                       */}
      {/* ============================================================ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold">
              El mercado inmobiliario en{" "}
              <span className="text-primary">números</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Los bienes raíces son el depósito de riqueza mas importante del
              planeta y representan mas de 3.5 veces el PIB mundial
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {marketStats.map((stat) => (
              <div
                key={stat.label}
                className={`rounded-2xl p-6 ${stat.bg} transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
              >
                <span
                  className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase ${stat.badgeBg}`}
                >
                  {stat.badge}
                </span>
                <p className="text-5xl font-extrabold text-foreground mt-4">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Fuentes: Savills World Research, INEGI, El Economista
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  3b. Seguridad & Cómo funciona BRC                          */}
      {/* ============================================================ */}
      <SecurityBrcSection />

      {/* ============================================================ */}
      {/*  4. El Problema                                              */}
      {/* ============================================================ */}
      <section
        className="text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8"
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #142C5F 50%, #0F172A 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            El Problema
          </h2>

          {/* Main card with image */}
          <div className="relative rounded-2xl bg-white/5 mb-8 h-[340px]">
            <div className="grid md:grid-cols-2 h-full">
              <div className="p-8 sm:p-12 flex flex-col justify-center relative z-10">
                <h3 className="text-3xl sm:text-4xl font-bold leading-tight">
                  El fraude inmobiliario<br />
                  es una <span className="text-red-500">crisis real</span>
                </h3>
                <p className="mt-4 text-white/60">
                  Estas cifras muestran la magnitud del problema que estamos
                  resolviendo
                </p>
              </div>
              <div className="absolute right-8 -bottom-24">
                <Image
                  src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/El-fraude-inmobiliario-es-una-crisis-real.png"
                  alt="El fraude inmobiliario es una crisis real"
                  width={560}
                  height={400}
                  className="-scale-x-100"
                />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {problemStats.map((stat) => (
              <div
                key={stat.value}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all duration-300 hover:bg-white/10 hover:-translate-y-1 hover:border-white/20"
              >
                <p className="text-3xl sm:text-4xl font-extrabold" style={{ color: "#1660FF", fontFamily: "var(--font-barlow), sans-serif", textShadow: "0 2px 6px #2C416E" }}>
                  {stat.value}
                </p>
                {stat.sub && (
                  <p className="text-lg font-bold" style={{ color: "#1660FF", fontFamily: "var(--font-barlow), sans-serif" }}>{stat.sub}</p>
                )}
                <p className="text-sm text-white/50 mt-3 leading-relaxed">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  5. Soluciones                                               */}
      {/* ============================================================ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
              6 soluciones para un mercado inmobiliario moderno
            </h2>
            <p className="mt-4 text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Existen portales inmobiliarios donde un jugador dominante controla
              el 70% del mercado. Inmobiliarias y brokers independientes,
              inconformes por los precios altos y la falta de conectividad,
              buscan opciones más económicas y funcionales. En los demás rubros,
              la competencia de BitHauss es incipiente o no existe.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {solutions.map((solution) => {
              const Icon = solution.icon;
              const useGradient = "iconGradient" in solution && solution.iconGradient && Icon === ShieldBrc;
              return (
                <div
                  key={solution.title}
                  className="rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="mb-4 flex justify-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${solution.iconBg}`}>
                      {useGradient ? (
                        <ShieldBrc gradient className="h-6 w-6" strokeWidth={1.6} />
                      ) : (
                        <Icon className={`h-5 w-5 ${solution.iconColor}`} />
                      )}
                    </div>
                  </div>
                  <h3 className="text-center font-semibold mb-2">
                    {solution.title}
                  </h3>
                  <p className="text-center text-sm text-muted-foreground leading-relaxed">
                    {solution.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  6. Equipo                                                   */}
      {/* ============================================================ */}
      <section className="py-14 sm:py-18 px-4 sm:px-6 lg:px-8 bg-cyan-50/50">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">
              El equipo detrás de Bithauss
            </h2>
            <p className="mt-3 text-muted-foreground">
              Profesionales comprometidos con transformar el mercado inmobiliario
              en Mexico
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member) => (
              <div
                key={member.name}
                className="relative rounded-2xl overflow-hidden shadow-sm group transition-all duration-500 hover:shadow-xl hover:-translate-y-2"
              >
                {/* Photo - full size */}
                <Image
                  src={member.image}
                  alt={member.name}
                  width={400}
                  height={500}
                  className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
                />
                {/* Info overlay */}
                <div className="absolute bottom-0 inset-x-0 backdrop-blur-md bg-white/70 p-4 text-center transition-transform duration-500 lg:translate-y-12 lg:group-hover:translate-y-0">
                  <h3 className="text-lg font-bold text-foreground">{member.name}</h3>
                  <p
                    className="text-sm font-semibold mt-0.5"
                    style={{
                      background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {member.role}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {member.bio}
                  </p>
                  {/* Social icons */}
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <Link href="#" className="transition-transform duration-300 hover:scale-110">
                      <svg className="h-4 w-4" viewBox="0 0 24 24"><defs><linearGradient id="grad-fb" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="hsl(221 83% 53%)" /><stop offset="100%" stopColor="hsl(160 84% 39%)" /></linearGradient></defs><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="url(#grad-fb)" /></svg>
                    </Link>
                    <Link href="#" className="transition-transform duration-300 hover:scale-110">
                      <svg className="h-4 w-4" viewBox="0 0 24 24"><defs><linearGradient id="grad-ig" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="hsl(221 83% 53%)" /><stop offset="100%" stopColor="hsl(160 84% 39%)" /></linearGradient></defs><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" fill="url(#grad-ig)" /></svg>
                    </Link>
                    <Link href="#" className="transition-transform duration-300 hover:scale-110">
                      <svg className="h-4 w-4" viewBox="0 0 24 24"><defs><linearGradient id="grad-li" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="hsl(221 83% 53%)" /><stop offset="100%" stopColor="hsl(160 84% 39%)" /></linearGradient></defs><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="url(#grad-li)" /></svg>
                    </Link>
                    <Link href="#" className="transition-transform duration-300 hover:scale-110">
                      <svg className="h-4 w-4" viewBox="0 0 24 24"><defs><linearGradient id="grad-x" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="hsl(221 83% 53%)" /><stop offset="100%" stopColor="hsl(160 84% 39%)" /></linearGradient></defs><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="url(#grad-x)" /></svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  7. Valores / Principios                                     */}
      {/* ============================================================ */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">
            Los principios que nos guían
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {values.map((value) => (
              <div
                key={value.title}
                className={`relative overflow-hidden rounded-2xl ${value.bg} p-6 h-[160px] transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
              >
                <h3 className="text-2xl font-bold text-foreground">
                  {value.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
                  {value.description}
                </p>
                <div className="absolute bottom-0 right-0 translate-x-4 translate-y-4">
                  <Image
                    src={value.image}
                    alt={value.title}
                    width={200}
                    height={200}
                    className="object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  8. Números que nos respaldan — COMENTADO temporalmente      */}
      {/* ============================================================ */}
      {false && (
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
              Números que nos respaldan
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {platformStats.map((stat) => (
                <div key={stat.label} className="text-center transition-all duration-300 hover:scale-110">
                  <p
                    className="text-4xl sm:text-5xl font-bold"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/*  9. CTA                                                      */}
      {/* ============================================================ */}
      <section
        className="text-white py-20 sm:py-28 px-4 sm:px-6 lg:px-8 animate-gradient"
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #142C5F 25%, #0F172A 50%, #142C5F 75%, #0F172A 100%)",
          backgroundSize: "400% 400%",
        }}
      >
        <div className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-[hsl(222,47%,15%)] px-8 py-14 sm:px-14 text-center animate-fade-in-up">
            {/* Animated gradient orbs */}
            <div
              className="absolute top-0 right-0 w-64 h-64 opacity-20 rounded-full blur-3xl animate-float-slow"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            />
            <div
              className="absolute -bottom-10 -left-10 w-48 h-48 opacity-15 rounded-full blur-3xl animate-float-reverse"
              style={{
                background:
                  "linear-gradient(135deg, hsl(160 84% 39%), hsl(221 83% 53%))",
              }}
            />
            {/* Shimmer line */}
            <div className="absolute inset-0 animate-shimmer opacity-10"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              }}
            />

            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold">
                Únete a la Revolución Inmobiliaria
              </h2>
              <p className="mt-4 text-white/70 max-w-xl mx-auto">
                Se parte de la plataforma que esta cambiando la forma en que
                Mexico compra, vende e invierte en bienes raíces.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-8 border-0 text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  }}
                >
                  <Link href="/auth/registro">Crear cuenta</Link>
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="#">Contactar Ventas</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
