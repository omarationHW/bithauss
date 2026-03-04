import { ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      {/* Left branding panel - hidden on mobile */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-primary via-blue-700 to-indigo-900 lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Decorative circles */}
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute left-1/4 top-1/4 h-40 w-40 rounded-full bg-white/5" />

        <div className="relative z-10 max-w-md space-y-6 px-12 text-center text-white">
          <div className="flex items-center justify-center gap-3">
            <ShieldCheck className="h-12 w-12" />
            <span className="text-4xl font-bold tracking-tight">BitHauss</span>
          </div>
          <p className="text-xl font-medium text-blue-100">
            Bienes Raices Certificados
          </p>
          <p className="text-sm leading-relaxed text-blue-200/80">
            La plataforma lider en Mexico para comprar, vender y rentar
            propiedades con certificacion blockchain. Transacciones seguras,
            documentacion verificada y la confianza que necesitas en cada
            operacion inmobiliaria.
          </p>
          <div className="mx-auto h-px w-16 bg-white/20" />
          <div className="flex items-center justify-center gap-8 text-xs text-blue-200/60">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">2,500+</p>
              <p>Propiedades</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">1,200+</p>
              <p>Brokers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">98%</p>
              <p>Satisfaccion</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex w-full flex-1 items-center justify-center lg:w-1/2">
        {children}
      </div>
    </div>
  );
}
