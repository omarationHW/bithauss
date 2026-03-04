import { ShieldCheck, FileSearch, Scale, Award, AlertTriangle, Copy, FileX, UserX, Users, Home, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

const fraudTypes = [
  {
    icon: Copy,
    title: "Duplicidad de Ventas",
    description: "Vender la misma propiedad a multiples compradores simultaneamente",
    color: "border-l-red-400",
  },
  {
    icon: FileX,
    title: "Documentacion Falsa",
    description: "Escrituras, titulos y documentos legales falsificados o alterados",
    color: "border-l-orange-400",
  },
  {
    icon: UserX,
    title: "Falta de Legitimidad",
    description: "El vendedor no tiene los derechos legales sobre la propiedad",
    color: "border-l-amber-400",
  },
  {
    icon: Users,
    title: "Vendedores Falsos",
    description: "Personas que se hacen pasar por propietarios legitimos",
    color: "border-l-rose-400",
  },
  {
    icon: Home,
    title: "Inmuebles Irregulares",
    description: "Propiedades con problemas legales, gravamenes o situacion irregular",
    color: "border-l-pink-400",
  },
  {
    icon: Banknote,
    title: "Anticipos y Desaparicion",
    description: "Recibir anticipos o enganches y desaparecer sin entregar el inmueble",
    color: "border-l-red-500",
  },
];

const steps = [
  {
    icon: FileSearch,
    title: "Solicitud",
    description:
      "El propietario o broker inicia el proceso de certificación registrando la propiedad en la plataforma.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    leftBorder: "border-l-blue-500",
  },
  {
    icon: Scale,
    title: "Verificación Documental",
    description:
      "Nuestro equipo jurídico valida escrituras, títulos de propiedad, y libertad de gravámenes.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    leftBorder: "border-l-amber-500",
  },
  {
    icon: ShieldCheck,
    title: "Validación Notarial",
    description:
      "Notarios certificados verifican la autenticidad de los documentos y la identidad del propietario.",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    leftBorder: "border-l-violet-500",
  },
  {
    icon: Award,
    title: "Certificado Digital",
    description:
      "Se emite el Certificado BRC con un sello digital verificable que garantiza la legitimidad de la propiedad.",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    leftBorder: "border-l-emerald-500",
  },
];

export function BrcSection() {
  return (
    <section className="relative py-20 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Gradient mesh background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 10% 20%, hsl(221 83% 53% / 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 90% 80%, hsl(160 84% 39% / 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, hsl(280 65% 60% / 0.03) 0%, transparent 40%),
            linear-gradient(180deg, hsl(210 40% 96% / 0.5) 0%, hsl(210 20% 98% / 0.3) 50%, hsl(210 40% 96% / 0.5) 100%)
          `,
        }}
      />

      {/* Subtle dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(221 83% 53% / 0.06) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Decorative shield/badge background shape */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          width="600"
          height="700"
          viewBox="0 0 600 700"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-[0.03]"
        >
          <path
            d="M300 20L550 120V350C550 500 440 620 300 680C160 620 50 500 50 350V120L300 20Z"
            stroke="hsl(221 83% 53%)"
            strokeWidth="2"
            fill="hsl(221 83% 53% / 0.02)"
          />
          <path
            d="M300 60L510 145V340C510 475 410 585 300 640C190 585 90 475 90 340V145L300 60Z"
            stroke="hsl(160 84% 39%)"
            strokeWidth="1"
            fill="none"
          />
          {/* Checkmark inside shield */}
          <path
            d="M220 340L280 400L380 280"
            stroke="hsl(160 84% 39%)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Floating decorative blurred circles */}
      <div
        className="absolute top-[5%] right-[5%] w-48 h-48 rounded-full animate-float-slow"
        style={{
          background: "radial-gradient(circle, hsl(160 84% 39% / 0.06) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />
      <div
        className="absolute bottom-[10%] left-[3%] w-64 h-64 rounded-full animate-float-slower"
        style={{
          background: "radial-gradient(circle, hsl(221 83% 53% / 0.05) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent mb-6 backdrop-blur-sm border border-accent/10">
              <ShieldCheck className="h-4 w-4" />
              Certificación BRC
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Certificación BRC: Tu Garantía Contra el{" "}
              <span className="relative inline-block">
                <span className="text-destructive">Fraude</span>
                <svg
                  className="absolute -bottom-1.5 left-0 w-full"
                  viewBox="0 0 180 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M1 7C30 2 60 1.5 90 3.5C120 5.5 150 2 179 7"
                    stroke="hsl(0 84% 60%)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h2>

            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              En Mexico existe el riesgo de caer en operaciones inmobiliarias
              fraudulentas. Bienes Raices Certificados (BRC) es el primer sistema
              de verificacion notarial digital que valida la autenticidad de cada
              propiedad, protegiendo a compradores y vendedores.
            </p>

            {/* Fraud stat highlight */}
            <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-5 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-destructive/10 p-2 mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg">
                    $600M MXN en fraudes inmobiliarios al ano
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Los procedimientos tradicionales para comprar y escriturar un
                    inmueble son tardados y vulnerables al fraude. BRC digitaliza
                    y certifica todo el proceso.
                  </p>
                </div>
              </div>
            </div>

            {/* Fraud types grid with colored left borders */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {fraudTypes.map((fraud) => {
                const Icon = fraud.icon;
                return (
                  <div
                    key={fraud.title}
                    className={cn(
                      "rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm p-3 transition-all duration-200 hover:shadow-md hover:border-border hover:-translate-y-0.5",
                      "border-l-[3px]",
                      fraud.color
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="h-4 w-4 text-destructive flex-shrink-0" />
                      <span className="text-xs font-semibold text-foreground leading-tight">
                        {fraud.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {fraud.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Fuente: El Economista, MVS Noticias Digital
            </p>

            <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
              Conoce más sobre BRC
              <span>&rarr;</span>
            </button>
          </div>

          {/* Right: certification process cards */}
          <div className="relative">
            {/* Connecting line with gradient */}
            <div
              className="absolute left-7 top-8 bottom-8 w-px hidden sm:block"
              style={{
                background: "linear-gradient(to bottom, hsl(221 83% 53% / 0.2), hsl(160 84% 39% / 0.3), hsl(160 84% 39% / 0.2))",
              }}
            />

            <div className="space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative flex gap-5 group">
                    {/* Step number + icon */}
                    <div className="flex-shrink-0 relative z-10">
                      <div
                        className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg",
                          step.bgColor,
                          step.borderColor
                        )}
                      >
                        <Icon className={cn("h-6 w-6", step.color)} />
                      </div>
                    </div>

                    {/* Card content with colored left border */}
                    <div
                      className={cn(
                        "flex-1 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 sm:p-5 shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:border-border group-hover:-translate-y-0.5",
                        "border-l-[3px]",
                        step.leftBorder
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs font-medium rounded-full px-2.5 py-0.5",
                            step.bgColor,
                            step.color
                          )}
                        >
                          Paso {index + 1}
                        </span>
                        <h3 className="font-semibold text-foreground">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
