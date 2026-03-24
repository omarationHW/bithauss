"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { User, Home, Briefcase, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPanel } from "../_components/auth-panel";

type Role = "comprador" | "vendedor" | "broker" | "inmobiliaria";

const roles: { id: Role; label: string; icon: React.ElementType }[] = [
  { id: "comprador", label: "Comprador", icon: User },
  { id: "vendedor", label: "Vendedor", icon: Home },
  { id: "broker", label: "Broker", icon: Briefcase },
  { id: "inmobiliaria", label: "Inmobiliaria", icon: Building2 },
];

export default function RegistroPage() {
  const [selectedRole, setSelectedRole] = useState<Role>("comprador");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  return (
    <>
      <AuthPanel image="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Registrarte.jpg" />
      <div className="flex w-full flex-1 items-center justify-center overflow-y-auto lg:w-[40%]">
        <main className="flex w-full max-w-md flex-col px-8 py-10">
      {/* Logo */}
      <div className="mb-6 flex justify-center">
        <Image
          src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss.png"
          alt="BitHauss"
          width={180}
          height={50}
        />
      </div>

      {/* Title */}
      <h2 className="mb-4 text-center text-lg font-semibold">Crea tu cuenta</h2>

      {/* Role selector */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {roles.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRole(role.id)}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-lg p-3 text-center transition-all",
                isSelected
                  ? "gradient-border bg-accent/5"
                  : "border-2 border-border hover:border-muted-foreground/30 hover:bg-muted/50"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span className="text-[10px] font-medium">{role.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Tu nombre" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apellido">Apellido</Label>
            <Input id="apellido" placeholder="Tu apellido" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-email">Correo electrónico</Label>
          <Input
            id="reg-email"
            type="email"
            placeholder="Tu correo electrónico"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            type="tel"
            placeholder="Tu número telefónico"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reg-password">Contraseña</Label>
            <Input
              id="reg-password"
              type="password"
              placeholder="Tu nombre"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Tu apellido"
            />
          </div>
        </div>
      </div>

      {/* Terms */}
      <label className="mt-5 flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          onClick={() => setAcceptedTerms(!acceptedTerms)}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            acceptedTerms
              ? "border-primary bg-primary text-white"
              : "border-border"
          )}
        >
          {acceptedTerms && (
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
        <span className="text-xs text-muted-foreground">
          Acepto los{" "}
          <Link href="#" className="text-primary hover:underline">
            términos de servicio y política de privacidad
          </Link>
        </span>
      </label>

      {/* Submit button */}
      <Button
        className="mt-5 w-full border-0 text-white"
        size="lg"
        style={{
          background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
        }}
      >
        Iniciar sesión
      </Button>

      {/* Login link */}
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Ya tienes cuenta?{" "}
        <Link
          href="/auth/login"
          className="font-medium text-primary hover:underline"
        >
          Inicia sesión
        </Link>
      </p>

      {/* Footer */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        © 2026 BitHauss
      </p>
        </main>
      </div>
    </>
  );
}
