"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  User,
  Home,
  Briefcase,
  Building2,
  Loader2,
  Eye,
  EyeOff,
  Scale,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import {
  resolveSignupRole,
  isRoleApplication,
  NOTARY_APPLICATION_NOTICE,
} from "@/lib/auth-roles";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_TOO_SHORT,
  SIGNUP_CHECK_YOUR_EMAIL,
  signupErrorMessage,
} from "@/lib/auth-messages";

type Role = "comprador" | "vendedor" | "broker" | "inmobiliaria" | "notario";

const roles: { id: Role; label: string; icon: React.ElementType }[] = [
  { id: "comprador", label: "Comprador", icon: User },
  { id: "vendedor", label: "Vendedor", icon: Home },
  { id: "broker", label: "Broker", icon: Briefcase },
  { id: "inmobiliaria", label: "Inmobiliaria", icon: Building2 },
  { id: "notario", label: "Notario", icon: Scale },
];

const MEXICAN_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
];

export default function RegistroPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>("comprador");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Common
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Person fields (comprador/vendedor/broker/notario)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Broker / Inmobiliaria extras
  const [companyName, setCompanyName] = useState(""); // inmobiliaria only
  const [rfc, setRfc] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");

  // Broker avatar (optional at signup)
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Notary
  const [notaryNumber, setNotaryNumber] = useState("");
  const [notaryState, setNotaryState] = useState("");

  const isBroker = selectedRole === "broker";
  const isInmobiliaria = selectedRole === "inmobiliaria";
  const isNotario = selectedRole === "notario";

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function clearAvatar() {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  async function uploadAvatar(userId: string): Promise<string | null> {
    if (!avatarFile) return null;
    const supabase = createClient();
    const ext = avatarFile.name.split(".").pop() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, avatarFile, { upsert: true });
    if (uploadError) {
      logError("Error uploading avatar at signup:", uploadError);
      return null;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    return publicUrl;
  }

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!acceptedTerms) {
      setError("Debes aceptar los términos de servicio y política de privacidad.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(PASSWORD_TOO_SHORT);
      return;
    }

    // Role-specific validation
    if (isInmobiliaria) {
      if (!companyName.trim()) {
        setError("El nombre de la empresa es obligatorio.");
        return;
      }
      if (!addressLine.trim()) {
        setError("La dirección de la empresa es obligatoria.");
        return;
      }
      if (!phone.trim()) {
        setError("El teléfono principal es obligatorio.");
        return;
      }
    } else if (isBroker) {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Nombre y apellido son obligatorios.");
        return;
      }
      if (!addressLine.trim()) {
        setError("La dirección es obligatoria.");
        return;
      }
      if (!phone.trim()) {
        setError("El teléfono principal es obligatorio.");
        return;
      }
    } else {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Nombre y apellido son obligatorios.");
        return;
      }
    }

    if (isNotario) {
      if (!notaryNumber.trim()) {
        setError("El número de notaría es obligatorio.");
        return;
      }
      if (!notaryState.trim()) {
        setError("El estado de la notaría es obligatorio.");
        return;
      }
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // For Inmobiliaria the company name is stored as profiles.first_name
      // so existing dashboards / "Hola, {first_name}" still render.
      const profileFirstName = isInmobiliaria ? companyName.trim() : firstName.trim();
      const profileLastName = isInmobiliaria ? null : lastName.trim();

      // BH-01: `user_metadata` is writable by the user at any time
      // (`auth.updateUser({ data: { role: 'ADMIN' } })`), so nothing that
      // grants authority may travel through it. We keep the *request* under a
      // distinct key that no guard or policy ever reads, purely so support can
      // see what the person asked for.
      const requestedRole = resolveSignupRole(selectedRole);
      const isPrivilegedRequest = isRoleApplication(selectedRole.toUpperCase());

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: profileFirstName,
            last_name: profileLastName ?? "",
            phone,
            signup_role_request: selectedRole.toUpperCase(),
          },
        },
      });

      if (signUpError) {
        // BH-21: an "already registered" answer turns this form into an
        // account-existence oracle. Present it as the ordinary success path;
        // Supabase emails the real owner of the address instead.
        const message = signupErrorMessage(signUpError.message);
        if (message === null) {
          setNotice(SIGNUP_CHECK_YOUR_EMAIL);
        } else {
          setError(message);
        }
        return;
      }

      if (!data.user) {
        setError("No se pudo crear la cuenta. Inténtalo de nuevo.");
        return;
      }

      const userId = data.user.id;

      // 1) Upload avatar (Broker, optional). Failure is non-blocking.
      const avatarUrl = isBroker ? await uploadAvatar(userId) : null;

      // 2) Insert profile row.
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        first_name: profileFirstName,
        last_name: profileLastName,
        phone: phone || null,
        secondary_phone: secondaryPhone || null,
        secondary_email: secondaryEmail || null,
        rfc: rfc || null,
        address_line: addressLine || null,
        avatar_url: avatarUrl,
        // Never the raw selection: a privileged pick becomes an application,
        // not a grant. RLS (031_security_rbac_hardening.sql) rejects the
        // privileged values anyway — this keeps the two layers in agreement
        // instead of relying on a database error the user would never
        // understand.
        role: requestedRole,
      });
      if (profileError) {
        logError("Error creating profile:", profileError);
        setError(
          "Creamos tu acceso pero no pudimos completar tu perfil. Inicia sesión e inténtalo de nuevo desde Configuración.",
        );
        return;
      }

      // 3) If Inmobiliaria, create company_profiles row and link via company_id.
      if (isInmobiliaria) {
        const { data: company, error: companyError } = await supabase
          .from("company_profiles")
          .insert({
            owner_id: userId,
            legal_name: companyName.trim(),
            trade_name: companyName.trim(),
            rfc: rfc || null,
            email,
            secondary_email: secondaryEmail || null,
            phone: phone || null,
            secondary_phone: secondaryPhone || null,
            address_line: addressLine || null,
          })
          .select("id")
          .single();

        if (companyError) {
          logError("Error creating company profile:", companyError);
        } else if (company) {
          await supabase
            .from("profiles")
            .update({ company_id: company.id })
            .eq("id", userId);
        }
      }

      // 4) Notary: this is an APPLICATION, not a role grant. The row lands
      //    with is_verified = false (column default) and an admin has to
      //    verify it before RolesGuard lets the account act as a notary.
      if (isNotario) {
        const { error: notaryError } = await supabase.from("notary_profiles").insert({
          profile_id: userId,
          notary_number: notaryNumber.trim(),
          notary_state: notaryState.trim(),
        });
        if (notaryError) logError("Error creating notary profile:", notaryError);
      }

      if (isPrivilegedRequest) {
        setNotice(NOTARY_APPLICATION_NOTICE);
        // Give the person a beat to read why they are not a notary yet.
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 4000);
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

  return (
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

      {/* Non-error notice (e.g. notary application received) */}
      {notice && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      )}

      {/* Role selector */}
      <div className="mb-6 grid grid-cols-3 sm:grid-cols-5 gap-3">
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

      <form onSubmit={handleRegistro} className="space-y-4">
        {/* ---- Identity ---- */}
        {isInmobiliaria ? (
          <div className="space-y-2">
            <Label htmlFor="empresa">Nombre completo de la empresa *</Label>
            <Input
              id="empresa"
              placeholder="Razón social / nombre comercial"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre {isBroker ? "*" : ""}</Label>
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
              <Label htmlFor="apellido">Apellido {isBroker ? "*" : ""}</Label>
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
        )}

        {/* ---- RFC (broker / inmobiliaria) ---- */}
        {(isBroker || isInmobiliaria) && (
          <div className="space-y-2">
            <Label htmlFor="rfc">
              RFC <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="rfc"
              placeholder="XAXX010101000"
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase().slice(0, 13))}
              disabled={loading}
              maxLength={13}
            />
          </div>
        )}

        {/* ---- Dirección (broker / inmobiliaria) ---- */}
        {(isBroker || isInmobiliaria) && (
          <div className="space-y-2">
            <Label htmlFor="direccion">
              Dirección {(isBroker || isInmobiliaria) ? "*" : ""}
            </Label>
            <Input
              id="direccion"
              placeholder="Calle, número, colonia, ciudad"
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              disabled={loading}
              required={isBroker || isInmobiliaria}
            />
          </div>
        )}

        {/* ---- Emails ---- */}
        <div className="space-y-2">
          <Label htmlFor="reg-email">
            {isBroker || isInmobiliaria ? "Correo principal *" : "Correo electrónico"}
          </Label>
          <Input
            id="reg-email"
            type="email"
            placeholder="Tu correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
          {(isBroker || isInmobiliaria) && (
            <p className="text-xs text-muted-foreground">
              Este será tu correo de inicio de sesión.
            </p>
          )}
        </div>

        {(isBroker || isInmobiliaria) && (
          <div className="space-y-2">
            <Label htmlFor="reg-email-2">
              Correo secundario{" "}
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="reg-email-2"
              type="email"
              placeholder="Correo adicional de contacto"
              value={secondaryEmail}
              onChange={(e) => setSecondaryEmail(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        {/* ---- Phones ---- */}
        <div className="space-y-2">
          <Label htmlFor="telefono">
            {isBroker || isInmobiliaria ? "Teléfono principal *" : "Teléfono"}
          </Label>
          <Input
            id="telefono"
            type="tel"
            placeholder="Tu número telefónico"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            required={isBroker || isInmobiliaria}
          />
        </div>

        {(isBroker || isInmobiliaria) && (
          <div className="space-y-2">
            <Label htmlFor="telefono-2">
              Teléfono secundario{" "}
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="telefono-2"
              type="tel"
              placeholder="Número adicional"
              value={secondaryPhone}
              onChange={(e) => setSecondaryPhone(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        {/* ---- Avatar (broker only) ---- */}
        {isBroker && (
          <div className="space-y-2">
            <Label>
              Foto de perfil{" "}
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-primary/20">
                  <Image
                    src={avatarPreview}
                    alt="Foto de perfil"
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <User className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {avatarPreview ? "Cambiar foto" : "Subir foto"}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarPick}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* ---- Password ---- */}
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
            <p className="text-xs text-muted-foreground">
              Mínimo {MIN_PASSWORD_LENGTH} caracteres.
            </p>
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

        {/* ---- Notary-specific ---- */}
        {isNotario && (
          <div className="space-y-4 mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <Scale className="h-4 w-4" />
              Solicitud de alta notarial
            </div>
            <p className="text-xs text-blue-700/80">
              El rol de Notario lo otorga BitHauss. Enviaremos tus datos a
              revisión: hasta que un administrador verifique tu número de
              notaría, tu cuenta operará con el perfil estándar.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="notary-number">Número de Notaría *</Label>
                <Input
                  id="notary-number"
                  placeholder="Ej: 45"
                  value={notaryNumber}
                  onChange={(e) => setNotaryNumber(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notary-state">Estado *</Label>
                <select
                  id="notary-state"
                  value={notaryState}
                  onChange={(e) => setNotaryState(e.target.value)}
                  disabled={loading}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar</option>
                  {MEXICAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Terms */}
        <label className="mt-5 flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => setAcceptedTerms(!acceptedTerms)}
            disabled={loading}
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              acceptedTerms ? "border-primary bg-primary text-white" : "border-border"
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
  );
}
