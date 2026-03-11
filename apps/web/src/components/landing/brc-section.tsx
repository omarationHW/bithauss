import Image from "next/image";
import { UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  title: string;
  description: string;
  color: string;
  bgColor: string;
  keepOriginalColor?: boolean;
} & (
  | { image: string; icon?: never }
  | { icon: typeof UserCheck; image?: never }
);

const steps: Step[] = [
  {
    image: "https://bithaussstorage.blob.core.windows.net/images/Solicitud.webp",
    title: "Solicitud",
    description:
      "El propietario o broker inicia el proceso de certificación registrando la propiedad en la plataforma.",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    image: "https://bithaussstorage.blob.core.windows.net/images/Verificacion.webp",
    title: "Verificación Documental",
    description:
      "Nuestro equipo jurídico valida escrituras, títulos de propiedad, y libertad de gravámenes.",
    color: "text-teal-600",
    bgColor: "bg-teal-100",
  },
  {
    icon: UserCheck,
    title: "Validación Notarial",
    description:
      "Notarios certificados verifican la autenticidad de los documentos y la identidad del propietario.",
    color: "text-violet-600",
    bgColor: "bg-violet-100",
  },
  {
    image: "https://bithaussstorage.blob.core.windows.net/images/Certificado Digital.webp",
    title: "Certificado Digital",
    description:
      "Se emite el Certificado BRC con un sello digital verificable que garantiza la legitimidad de la propiedad.",
    color: "text-emerald-600",
    bgColor: "bg-white",
    keepOriginalColor: true,
  },
];

function StepIcon({ step, size = 32 }: { step: Step; size?: number }) {
  if (step.image) {
    return (
      <Image
        src={step.image}
        alt={step.title}
        width={size}
        height={size}
        className={cn("object-contain", !step.keepOriginalColor && "brightness-0")}
      />
    );
  }
  const Icon = step.icon!;
  return <Icon className={cn("h-7 w-7", step.color)} />;
}

export function BrcSection() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-secondary/80 to-secondary/40">
      <div className="mx-auto max-w-5xl">
        <div className="p-8 sm:p-12">
          {/* Title */}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground max-w-2xl">
            Introducimos Certificadores BRC : Tu Garantía Contra el{" "}
            <span className="relative inline-block text-destructive">
              Fraude
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

          {/* Description */}
          <p className="mt-4 text-base text-muted-foreground max-w-3xl leading-relaxed">
            En México existe el riesgo de caer en operaciones inmobiliarias
            fraudulentas. Bienes Raíces Certificados (BRC) es el primer sistema
            de verificación notarial digital que valida la autenticidad de cada
            propiedad, protegiendo a compradores y vendedores.
          </p>

          {/* Steps */}
          <div className="mt-10">
            {/* Icons + Arrows row (desktop) */}
            <div className="hidden lg:flex items-center">
              {steps.map((step, index) => (
                <div key={step.title} className="contents">
                  <div className="flex-1 flex justify-center">
                    <div
                      className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center",
                        step.bgColor
                      )}
                    >
                      <StepIcon step={step} size={34} />
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <svg
                      viewBox="0 0 80 16"
                      fill="none"
                      className="w-16 h-4 text-muted-foreground/30 flex-shrink-0 -mx-4"
                    >
                      <line
                        x1="0"
                        y1="8"
                        x2="64"
                        y2="8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                      />
                      <path
                        d="M62 3L70 8L62 13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {/* Text row (desktop) */}
            <div className="hidden lg:grid grid-cols-4 gap-4 mt-5">
              {steps.map((step) => (
                <div key={step.title} className="text-center px-2">
                  <h3 className={cn("font-semibold text-sm", step.color)}>
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Mobile layout */}
            <div className="flex flex-col gap-6 lg:hidden">
              {steps.map((step) => (
                <div key={step.title} className="flex items-start gap-4">
                  <div
                    className={cn(
                      "flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center",
                      step.bgColor
                    )}
                  >
                    <StepIcon step={step} size={34} />
                  </div>
                  <div>
                    <h3 className={cn("font-semibold text-sm", step.color)}>
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
