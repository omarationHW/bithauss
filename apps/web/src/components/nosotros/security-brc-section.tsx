'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Lock, Link2, FileCheck } from 'lucide-react'
import { ShieldBrc } from '@/components/ui/shield-brc'

const features = [
  {
    icon: Lock,
    title: 'Cifrado bancario AES-256',
    description:
      'Todos tus datos viajan y se almacenan cifrados con el mismo estándar que usan los bancos. Nadie puede interceptarlos.',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
  {
    icon: Link2,
    title: 'Registro inmutable en Blockchain',
    description:
      'El Certificado BRC se graba en la Blockchain. Una vez emitido, es técnicamente imposible alterarlo.',
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
  {
    icon: FileCheck,
    title: 'Validación notarial digital',
    description:
      'Cada propiedad pasa por revisión de Notarios certificados antes de recibir su BRC. Un proceso legal con respaldo humano.',
    bg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-100',
  },
  {
    icon: ShieldBrc, title: 'Protección comprador y vendedor',
    description:
      'Verificamos identidad, documentos y estatus jurídico del inmueble antes de que firmes cualquier acuerdo.',
    bg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
]

const steps = [
  { step: '01', label: 'Solicitud', desc: 'El propietario registra la propiedad en la plataforma' },
  { step: '02', label: 'Verificación Documental', desc: 'Revisión legal apoyada con Inteligencia Artificial' },
  { step: '03', label: 'Validación Notarial', desc: 'Notarios certificados validan el estatus jurídico' },
  { step: '04', label: 'Certificado BRC', desc: 'Certificado digital inmutable emitido en Blockchain' },
]

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { setInView(true); observer.disconnect() } },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, inView }
}

export function SecurityBrcSection() {
  const header = useInView(0.2)
  const image = useInView(0.1)
  const cards = useInView(0.1)
  const stepsBlock = useInView(0.1)

  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8">

      {/* Decorative orbs — idénticos al CTA section */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-10 blur-3xl animate-float-slow"
        style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full opacity-8 blur-3xl animate-float-reverse"
        style={{ background: 'linear-gradient(135deg, hsl(160 84% 39%), hsl(221 83% 53%))' }}
      />

      <div className="relative mx-auto max-w-6xl">

        {/* Header — fade-in-up al entrar */}
        <div
          ref={header.ref}
          className={`text-center mb-14 transition-all duration-700 ${
            header.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span
            className="inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white mb-4"
            style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
          >
            Seguridad de nivel bancario
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mt-2">
            Tus datos y tu propiedad,{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              100% protegidos
            </span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Combinamos cifrado bancario, tecnología Blockchain y validación
            notarial para que cada transacción sea segura, transparente e inviolable.
          </p>
        </div>

        {/* Two-column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">

          {/* Left — imagen con float + pulse-glow en borde, slide-in-left */}
          <div
            ref={image.ref}
            className={`transition-all duration-700 delay-100 ${
              image.inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
            }`}
          >
            <div className="relative flex items-center justify-center rounded-2xl aspect-square max-w-md mx-auto w-full overflow-hidden
              border border-border/30 bg-gradient-to-br from-blue-50 to-emerald-50
              animate-pulse-glow"
            >
              {/* Orb interno flotando detrás de la imagen */}
              <div
                className="absolute inset-0 rounded-2xl opacity-20 animate-float-slower"
                style={{ background: 'radial-gradient(circle at 60% 40%, hsl(221 83% 53% / 0.4), transparent 60%)' }}
              />
              <Image
                src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/seguridad-brc-familia.png"
                alt="Familia protegida por BitHauss BRC"
                width={480}
                height={480}
                className="relative z-10 object-contain w-full h-full p-8 animate-float"
              />
            </div>
          </div>

          {/* Right — tarjetas con fade-in-up escalonado */}
          <div ref={cards.ref} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((feat, i) => {
              const Icon = feat.icon
              return (
                <div
                  key={feat.title}
                  className={`rounded-2xl ${feat.bg} p-5 border border-transparent
                    transition-all duration-500 hover:-translate-y-1 hover:shadow-md hover:border-border/30
                    ${cards.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                  style={{ transitionDelay: cards.inView ? `${i * 100}ms` : '0ms' }}
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${feat.iconBg} mb-3`}>
                    <Icon className={`h-5 w-5 ${feat.iconColor}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground leading-snug">
                    {feat.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pasos BRC — scale-in escalonado */}
        <div
          ref={stepsBlock.ref}
          className={`rounded-2xl px-8 py-8 border transition-all duration-700 ${
            stepsBlock.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{
            background: 'linear-gradient(135deg, hsl(221 83% 53% / 0.05), hsl(160 84% 39% / 0.05))',
            borderColor: 'hsl(221 83% 53% / 0.15)',
          }}
        >
          <p className="text-center text-sm font-semibold text-foreground mb-6">
            ¿Cómo funciona el Certificado BRC?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {steps.map((s, i) => (
              <div
                key={s.step}
                className={`relative transition-all duration-500 ${
                  stepsBlock.inView ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                style={{ transitionDelay: stepsBlock.inView ? `${i * 120}ms` : '0ms' }}
              >
                {/* Línea conectora */}
                {i < steps.length - 1 && (
                  <div className="absolute top-5 left-[calc(50%+20px)] right-[calc(-50%+20px)] hidden h-px bg-border/50 sm:block" />
                )}
                <div
                  className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
                  style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
                >
                  {s.step}
                </div>
                <p className="text-xs font-semibold text-foreground">{s.label}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/como-funciona"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))' }}
            >
              Ver cómo funciona →
            </Link>
          </div>
        </div>

      </div>
    </section>
  )
}
