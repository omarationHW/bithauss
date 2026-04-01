import Image from "next/image";

export function AuthPanel({ image }: { image: string }) {
  return (
    <div className="relative hidden w-[60%] overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-between px-28 pt-36 pb-12">
      {/* Background image */}
      <Image
        src={image}
        alt="BitHauss"
        fill
        className="object-cover"
        priority
      />

      {/* Top gradient */}
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-black/60 to-transparent" />
      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Top content */}
      <div className="relative z-10 max-w-lg space-y-4 text-center text-white">
        <h1 className="text-3xl font-bold leading-tight">
          Bienes Raíces Certificados
        </h1>
        <p className="text-sm leading-relaxed text-white/80">
          La plataforma líder en México para comprar, vender y rentar
          propiedades con certificación blockchain. Transacciones seguras,
          documentación verificada y la confianza que necesitas en cada
          operación inmobiliaria.
        </p>
      </div>

      {/* Bottom stats */}
      <div className="relative z-10 flex items-center gap-12 text-white">
        <div className="text-center">
          <p className="text-3xl font-bold">2,500+</p>
          <p className="text-sm text-white/70">Propiedades</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold">1,200+</p>
          <p className="text-sm text-white/70">Brokers</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold">98%</p>
          <p className="text-sm text-white/70">Satisfacción</p>
        </div>
      </div>
    </div>
  );
}
