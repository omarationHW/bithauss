import { ShieldCheck, FileSearch, Scale, Award, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: FileSearch,
    title: "Solicitud",
    description:
      "El propietario o broker inicia el proceso de certificación registrando la propiedad en la plataforma.",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  {
    icon: Scale,
    title: "Verificación Documental",
    description:
      "Nuestro equipo jurídico valida escrituras, títulos de propiedad, y libertad de gravámenes.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  {
    icon: ShieldCheck,
    title: "Validación Notarial",
    description:
      "Notarios certificados verifican la autenticidad de los documentos y la identidad del propietario.",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
  },
  {
    icon: Award,
    title: "Certificado Digital",
    description:
      "Se emite el Certificado BRC con un sello digital verificable que garantiza la legitimidad de la propiedad.",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
];

export function BrcSection() {
  return (
    <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-secondary/30">
      <div className="mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent mb-6">
              <ShieldCheck className="h-4 w-4" />
              Certificación BRC
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Certificación BRC: Tu Garantía Contra el Fraude
            </h2>

            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Bienes Raíces Certificados (BRC) es nuestro sistema propietario de
              verificación que valida la autenticidad de cada propiedad,
              protegiendo compradores y vendedores.
            </p>

            {/* Fraud stat highlight */}
            <div className="mt-8 rounded-xl border border-destructive/20 bg-destructive/5 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-destructive/10 p-2 mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg">
                    $600M MXN en fraudes inmobiliarios
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cada año en México se pierden más de 600 millones de pesos
                    en fraudes inmobiliarios. BRC existe para eliminar este
                    problema.
                  </p>
                </div>
              </div>
            </div>

            <button className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Conoce más sobre BRC
              <span>&rarr;</span>
            </button>
          </div>

          {/* Right: certification process cards */}
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-7 top-8 bottom-8 w-px bg-border hidden sm:block" />

            <div className="space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative flex gap-5 group">
                    {/* Step number + icon */}
                    <div className="flex-shrink-0 relative z-10">
                      <div
                        className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110",
                          step.bgColor,
                          step.borderColor
                        )}
                      >
                        <Icon className={cn("h-6 w-6", step.color)} />
                      </div>
                    </div>

                    {/* Card content */}
                    <div className="flex-1 rounded-xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
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
