"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPanel } from "../_components/auth-panel";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message === "Invalid login credentials") {
          setError("Correo electrónico o contraseña incorrectos.");
        } else if (signInError.message === "Email not confirmed") {
          setError("Tu correo electrónico aún no ha sido confirmado. Revisa tu bandeja de entrada.");
        } else if (signInError.message.includes("rate limit")) {
          setError("Demasiados intentos. Por favor espera unos minutos antes de intentar de nuevo.");
        } else {
          setError("Ocurrió un error al iniciar sesión. Inténtalo de nuevo.");
        }
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "facebook" | "apple") => {
    setError(null);
    setSocialLoading(provider);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) {
        setError("No se pudo conectar con el proveedor. Inténtalo de nuevo.");
      }
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <>
      <AuthPanel image="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Iniciar-sesion.jpg" />
      <div className="flex w-full flex-1 items-center justify-center overflow-y-auto lg:w-[40%]">
        <main className="flex w-full max-w-md flex-col px-8 py-10">
      {/* Logo */}
      <div className="mb-8 flex justify-center">
        <Image
          src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss.png"
          alt="BitHauss"
          width={180}
          height={50}
        />
      </div>

      {/* Welcome text */}
      <p className="mb-1 text-center text-sm text-muted-foreground">
        Encantado de verte otra vez
      </p>

      {/* Error message */}
      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Inicia Sesión</Label>
          <Input
            id="email"
            type="text"
            placeholder="Correo electrónico o numero telefónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Ingresa tu contraseña"
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
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Links row */}
        <div className="flex items-center justify-between text-xs">
          <Link
            href="#"
            className="text-primary hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
          <Link
            href="/auth/registro"
            className="text-primary hover:underline"
          >
            ¿Nuevo en BitHauss? <span className="font-semibold">Regístrate</span>
          </Link>
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Recordarme</span>
          <button
            type="button"
            role="switch"
            aria-checked={rememberMe}
            onClick={() => setRememberMe(!rememberMe)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              rememberMe ? "bg-accent" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                rememberMe ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Login button */}
        <Button
          type="submit"
          className="w-full border-0 text-white"
          size="lg"
          disabled={loading}
          style={{
            background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            "Iniciar sesión"
          )}
        </Button>
      </form>

      {/* Social login */}
      <div className="mt-6 space-y-3">
        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          size="lg"
          disabled={socialLoading !== null}
          onClick={() => handleSocialLogin("google")}
        >
          {socialLoading === "google" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Continuar con Google
        </Button>

        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          size="lg"
          disabled={socialLoading !== null}
          onClick={() => handleSocialLogin("facebook")}
        >
          {socialLoading === "facebook" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          )}
          Continuar con Facebook
        </Button>

        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          size="lg"
          disabled={socialLoading !== null}
          onClick={() => handleSocialLogin("apple")}
        >
          {socialLoading === "apple" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
          )}
          Continuar con Apple
        </Button>
      </div>

      {/* Terms */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Al iniciar sesión acepto los{" "}
        <Link href="#" className="text-primary hover:underline">
          Términos y Condiciones
        </Link>{" "}
        de BitHauss
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
