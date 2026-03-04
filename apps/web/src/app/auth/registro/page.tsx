"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  User,
  Home,
  Briefcase,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Role = "comprador" | "vendedor" | "broker" | "inmobiliaria";

const roles: { id: Role; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: "comprador",
    label: "Comprador",
    icon: User,
    description: "Busco propiedades",
  },
  {
    id: "vendedor",
    label: "Vendedor",
    icon: Home,
    description: "Vendo mi propiedad",
  },
  {
    id: "broker",
    label: "Broker",
    icon: Briefcase,
    description: "Asesor inmobiliario",
  },
  {
    id: "inmobiliaria",
    label: "Inmobiliaria",
    icon: Building2,
    description: "Empresa inmobiliaria",
  },
];

export default function RegistroPage() {
  const [selectedRole, setSelectedRole] = useState<Role>("comprador");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const showCompanyField =
    selectedRole === "broker" || selectedRole === "inmobiliaria";

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-4 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight">BitHauss</span>
          </div>
          <div>
            <CardTitle className="text-xl">Crea tu cuenta</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Unete a la plataforma de bienes raices certificados
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Role selector */}
          <div>
            <Label className="mb-3 block text-sm font-semibold">
              Tipo de cuenta
            </Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {roles.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="text-xs font-medium">{role.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Label htmlFor="reg-email">Correo electronico</Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="tu@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Telefono</Label>
              <Input
                id="telefono"
                type="tel"
                placeholder="+52 55 0000 0000"
              />
            </div>

            {/* Company field - conditional */}
            {showCompanyField && (
              <div className="space-y-2">
                <Label htmlFor="empresa">Nombre de empresa</Label>
                <Input
                  id="empresa"
                  placeholder={
                    selectedRole === "broker"
                      ? "Nombre de tu agencia"
                      : "Nombre de la inmobiliaria"
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reg-password">Contrasena</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="Min. 8 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contrasena</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repite tu contrasena"
                />
              </div>
            </div>
          </div>

          {/* Terms checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="mt-0.5">
              <button
                type="button"
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
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
            </div>
            <span className="text-sm text-muted-foreground">
              Acepto los{" "}
              <Link href="#" className="text-primary hover:underline">
                terminos de servicio
              </Link>{" "}
              y{" "}
              <Link href="#" className="text-primary hover:underline">
                politica de privacidad
              </Link>
            </span>
          </label>

          <Button className="w-full" size="lg">
            Crear Cuenta
          </Button>

          {/* Login link */}
          <p className="text-center text-sm text-muted-foreground">
            Ya tienes cuenta?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-primary hover:underline"
            >
              Inicia sesion
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
