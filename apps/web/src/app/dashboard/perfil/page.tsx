"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  User,
  Mail,
  Phone,
  Building2,
  Award,
  Briefcase,
  MapPin,
  Camera,
  Pencil,
  Save,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "../_context/user-context";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Mock profile data (fallback)                                       */
/* ------------------------------------------------------------------ */

const mockProfile = {
  firstName: "Carlos",
  lastName: "Rodriguez Vega",
  email: "carlos@bithauss.com",
  phone: "+52 55 1234 5678",
  empresa: "BitHauss Inmobiliaria",
  licencia: "BNIF-2024-00892",
  especialidad: "Residencial Premium",
  calle: "Av. Paseo de la Reforma 250",
  colonia: "Juarez",
  ciudad: "Ciudad de Mexico",
  estado: "CDMX",
  cp: "06600",
  role: "Broker Certificado",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PerfilPage() {
  const { user: authUser, loading, updateUser } = useUser();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [profile, setProfile] = useState(mockProfile);

  // Notary profile state
  const [notaryProfile, setNotaryProfile] = useState<{
    notaria_numero: string;
    estado: string;
    verified: boolean;
  } | null>(null);
  const [loadingNotary, setLoadingNotary] = useState(false);

  useEffect(() => {
    if (authUser) {
      setProfile((prev) => ({
        ...prev,
        firstName: authUser.firstName || prev.firstName,
        lastName: authUser.lastName || prev.lastName,
        email: authUser.email || prev.email,
      }));
    }
  }, [authUser]);

  // Fetch notary profile if user is NOTARIO
  useEffect(() => {
    if (!authUser || authUser.role !== "NOTARIO") return;

    async function fetchNotaryProfile() {
      setLoadingNotary(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("notary_profiles")
          .select("notary_number, notary_state, is_verified")
          .eq("profile_id", authUser!.id)
          .single();

        if (!error && data) {
          setNotaryProfile({
            notaria_numero: data.notary_number ?? "",
            estado: data.notary_state ?? "",
            verified: data.is_verified ?? false,
          });
        }
      } catch {
        // ignore
      } finally {
        setLoadingNotary(false);
      }
    }

    fetchNotaryProfile();
  }, [authUser]);

  const userEmail = authUser?.email ?? "";
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authUser?.avatarUrl) setAvatarUrl(authUser.avatarUrl);
  }, [authUser]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const filePath = `${authUser.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", authUser.id);

      const newUrl = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newUrl);
      updateUser({ avatarUrl: newUrl });
    } catch (err) {
      console.error("Error uploading avatar:", err);
    }
    setUploadingAvatar(false);
  }

  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();

  function toggleEdit(section: string) {
    setEditingSection(editingSection === section ? null : section);
  }

  function handleChange(field: string, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  function handleNotaryChange(field: string, value: string) {
    setNotaryProfile((prev) =>
      prev ? { ...prev, [field]: value } : prev
    );
  }

  async function handleSaveNotary() {
    if (!authUser || !notaryProfile) return;
    try {
      const supabase = createClient();
      await supabase
        .from("notary_profiles")
        .update({
          notary_number: notaryProfile.notaria_numero,
          notary_state: notaryProfile.estado,
        })
        .eq("profile_id", authUser.id);
    } catch {
      // ignore
    }
    setEditingSection(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/*  Header                                                      */}
      {/* ============================================================ */}
      <div>
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Dashboard
        </Link>
        <h2
          className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Mi Perfil
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Administra tu informacion personal y profesional.
        </p>
      </div>

      {/* ============================================================ */}
      {/*  Profile Header Card                                         */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Avatar"
                width={80}
                height={80}
                className="h-20 w-20 rounded-full border-2 border-gray-100 shadow-sm object-cover"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gray-100 shadow-sm text-2xl font-bold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                {initials}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-gray-500 transition-all duration-300 hover:text-gray-700 hover:shadow-lg disabled:opacity-50"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Name + role + email */}
          <div className="min-w-0">
            <h3
              className="text-xl font-bold text-gray-900 sm:text-2xl truncate"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              {profile.firstName} {profile.lastName}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                <Award className="h-3 w-3" />
                {authUser?.role === "ADMIN" ? "Administrador" : authUser?.role === "BROKER" ? "Broker" : authUser?.role === "INMOBILIARIA" ? "Inmobiliaria" : authUser?.role === "NOTARIO" ? "Notario" : authUser?.role === "VENDEDOR" ? "Vendedor" : authUser?.role === "COMPRADOR" ? "Comprador" : profile.role}
              </span>
              <span className="text-sm text-gray-500 truncate">
                {userEmail || profile.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Informacion Personal                                        */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
              }}
            >
              <User className="h-5 w-5" style={{ color: "hsl(221 83% 53%)" }} />
            </div>
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Informacion Personal
            </h3>
          </div>
          <button
            onClick={() => toggleEdit("personal")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
          >
            {editingSection === "personal" ? (
              <>
                <Save className="h-3.5 w-3.5" />
                Guardar
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </>
            )}
          </button>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-gray-500">Nombre</Label>
            <Input
              value={profile.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              disabled={editingSection !== "personal"}
              className="rounded-xl border-gray-200 disabled:bg-gray-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">Apellido</Label>
            <Input
              value={profile.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              disabled={editingSection !== "personal"}
              className="rounded-xl border-gray-200 disabled:bg-gray-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">Telefono</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={profile.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                disabled={editingSection !== "personal"}
                className="rounded-xl border-gray-200 pl-10 disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={userEmail || profile.email}
                disabled
                className="rounded-xl border-gray-200 pl-10 disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Informacion Notarial (only for NOTARIO role)                */}
      {/* ============================================================ */}
      {authUser?.role === "NOTARIO" && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
                }}
              >
                <ShieldCheck
                  className="h-5 w-5"
                  style={{ color: "hsl(221 83% 53%)" }}
                />
              </div>
              <h3
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                Informacion Notarial
              </h3>
            </div>
            <button
              onClick={() => {
                if (editingSection === "notarial") {
                  handleSaveNotary();
                } else {
                  setEditingSection("notarial");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
            >
              {editingSection === "notarial" ? (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Guardar
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </>
              )}
            </button>
          </div>

          <div className="grid gap-5 p-6 sm:grid-cols-3">
            {loadingNotary ? (
              <div className="flex items-center justify-center py-6 sm:col-span-3">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : notaryProfile ? (
              <>
                <div className="space-y-2">
                  <Label className="text-gray-500">Numero de Notaria</Label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={notaryProfile.notaria_numero}
                      onChange={(e) =>
                        handleNotaryChange("notaria_numero", e.target.value)
                      }
                      disabled={editingSection !== "notarial"}
                      className="rounded-xl border-gray-200 pl-10 disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Estado</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={notaryProfile.estado}
                      onChange={(e) =>
                        handleNotaryChange("estado", e.target.value)
                      }
                      disabled={editingSection !== "notarial"}
                      className="rounded-xl border-gray-200 pl-10 disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500">Verificacion</Label>
                  <div className="flex items-center gap-2 pt-2">
                    {notaryProfile.verified ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4" />
                        Verificado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 border border-amber-200">
                        <Clock className="h-4 w-4" />
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="sm:col-span-3 text-center py-6">
                <p className="text-sm text-gray-400">
                  No se encontro informacion notarial. Contacta soporte para configurar tu perfil.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Informacion Profesional                                     */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
              }}
            >
              <Briefcase
                className="h-5 w-5"
                style={{ color: "hsl(221 83% 53%)" }}
              />
            </div>
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Informacion Profesional
            </h3>
          </div>
          <button
            onClick={() => toggleEdit("profesional")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
          >
            {editingSection === "profesional" ? (
              <>
                <Save className="h-3.5 w-3.5" />
                Guardar
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </>
            )}
          </button>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-gray-500">Empresa</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={profile.empresa}
                onChange={(e) => handleChange("empresa", e.target.value)}
                disabled={editingSection !== "profesional"}
                className="rounded-xl border-gray-200 pl-10 disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">Licencia</Label>
            <div className="relative">
              <Award className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={profile.licencia}
                onChange={(e) => handleChange("licencia", e.target.value)}
                disabled={editingSection !== "profesional"}
                className="rounded-xl border-gray-200 pl-10 disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">Especialidad</Label>
            <Input
              value={profile.especialidad}
              onChange={(e) => handleChange("especialidad", e.target.value)}
              disabled={editingSection !== "profesional"}
              className="rounded-xl border-gray-200 disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Direccion                                                   */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
              }}
            >
              <MapPin
                className="h-5 w-5"
                style={{ color: "hsl(221 83% 53%)" }}
              />
            </div>
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Direccion
            </h3>
          </div>
          <button
            onClick={() => toggleEdit("direccion")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
          >
            {editingSection === "direccion" ? (
              <>
                <Save className="h-3.5 w-3.5" />
                Guardar
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </>
            )}
          </button>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label className="text-gray-500">Calle</Label>
            <Input
              value={profile.calle}
              onChange={(e) => handleChange("calle", e.target.value)}
              disabled={editingSection !== "direccion"}
              className="rounded-xl border-gray-200 disabled:bg-gray-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">Colonia</Label>
            <Input
              value={profile.colonia}
              onChange={(e) => handleChange("colonia", e.target.value)}
              disabled={editingSection !== "direccion"}
              className="rounded-xl border-gray-200 disabled:bg-gray-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">Ciudad</Label>
            <Input
              value={profile.ciudad}
              onChange={(e) => handleChange("ciudad", e.target.value)}
              disabled={editingSection !== "direccion"}
              className="rounded-xl border-gray-200 disabled:bg-gray-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">Estado</Label>
            <Input
              value={profile.estado}
              onChange={(e) => handleChange("estado", e.target.value)}
              disabled={editingSection !== "direccion"}
              className="rounded-xl border-gray-200 disabled:bg-gray-50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500">Codigo Postal</Label>
            <Input
              value={profile.cp}
              onChange={(e) => handleChange("cp", e.target.value)}
              disabled={editingSection !== "direccion"}
              className="rounded-xl border-gray-200 disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
