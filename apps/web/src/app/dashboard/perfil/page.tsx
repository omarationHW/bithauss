"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [profile, setProfile] = useState(mockProfile);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    async function fetchUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email ?? "");
          if (user.user_metadata?.first_name) {
            setProfile((prev) => ({
              ...prev,
              firstName: user.user_metadata.first_name ?? prev.firstName,
              lastName: user.user_metadata.last_name ?? prev.lastName,
              email: user.email ?? prev.email,
            }));
          }
        }
      } catch {
        // Use mock data on error
      }
      setLoading(false);
    }
    fetchUser();
  }, []);

  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();

  function toggleEdit(section: string) {
    setEditingSection(editingSection === section ? null : section);
  }

  function handleChange(field: string, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
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
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* Gradient banner */}
        <div
          className="h-32 sm:h-40"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        />

        <div className="px-6 pb-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end -mt-12 sm:-mt-14">
            {/* Avatar */}
            <div className="relative">
              <div
                className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-2xl border-4 border-white shadow-lg text-3xl sm:text-4xl font-bold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                {initials}
              </div>
              <button className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-gray-500 transition-all duration-300 hover:text-gray-700 hover:shadow-lg">
                <Camera className="h-4 w-4" />
              </button>
            </div>

            {/* Name + role */}
            <div className="flex-1 pb-1">
              <h3
                className="text-xl font-bold text-gray-900 sm:text-2xl"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                {profile.firstName} {profile.lastName}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  }}
                >
                  <Award className="h-3 w-3" />
                  {profile.role}
                </span>
                <span className="text-sm text-gray-500">
                  {userEmail || profile.email}
                </span>
              </div>
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
