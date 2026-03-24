"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { User, Home, Briefcase, Building2, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPanel } from "../_components/auth-panel";
import { createClient } from "@/lib/supabase/client";

type Role = "comprador" | "vendedor" | "broker" | "inmobiliaria";

const roles: { id: Role; label: string; icon: React.ElementType }[] = [
  { id: "comprador", label: "Comprador", icon: User },
  { id: "vendedor", label: "Vendedor", icon: Home },
  { id: "broker", label: "Broker", icon: Briefcase },
  { id: "inmobiliaria", label: "Inmobiliaria", icon: Building2 },
];

export default function RegistroPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>("comprador");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError("Debes aceptar los términos de servicio y política de privacidad.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone,
            role: selectedRole.toUpperCase(),
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          setError("Este correo electrónico ya está registrado. Intenta iniciar sesión.");
        } else if (signUpError.message.includes("valid email")) {
          setError("Por favor ingresa un correo electrónico válido.");
        } else if (signUpError.message.includes("password")) {
          setError("La contraseña no cumple con los requisitos mínimos de seguridad.");
        } else if (signUpError.message.includes("rate limit")) {
          setError("Demasiados intentos. Por favor espera unos minutos.");
        } else {
          setError("Ocurrió un error al crear tu cuenta. Inténtalo de nuevo.");
        }
        return;
      }

      // Create profile in profiles table
      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: data.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
          role: selectedRole.toUpperCase(),
        });

        if (profileError) {
          console.error("Error creating profile:", profileError);
          // Don't block the user, the profile can be created later
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

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

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

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
              disabled={loading}
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
      <form onSubmit={handleRegistro} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              placeholder="Tu nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apellido">Apellido</Label>
            <Input
              id="apellido"
              placeholder="Tu apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-email">Correo electrónico</Label>
          <Input
            id="reg-email"
            type="email"
            placeholder="Tu correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input
            id="telefono"
            type="tel"
            placeholder="Tu número telefónico"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reg-password">Contraseña</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

      {/* Terms */}
      <label className="mt-5 flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          onClick={() => setAcceptedTerms(!acceptedTerms)}
          disabled={loading}
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
        type="submit"
        className="mt-5 w-full border-0 text-white"
        size="lg"
        disabled={loading}
        style={{
          background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
        }}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creando cuenta...
          </>
        ) : (
          "Crear cuenta"
        )}
      </Button>
      </form>

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
