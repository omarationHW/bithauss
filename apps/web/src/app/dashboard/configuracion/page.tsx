"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "../_context/user-context";
import {
  Bell,
  Shield,
  AlertTriangle,
  Key,
  ArrowLeft,
  Trash2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Toggle Component                                                   */
/* ------------------------------------------------------------------ */

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 focus:outline-none ${
        enabled ? "" : "bg-gray-200"
      }`}
      style={
        enabled
          ? {
              background:
                "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
            }
          : undefined
      }
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-300 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}


/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ConfiguracionPage() {
  const { logout } = useUser();
  const [, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [notifications, setNotifications] = useState({
    leads: true,
    brcUpdates: true,
    messages: true,
    marketing: false,
  });


  // Load saved preferences
  useEffect(() => {
    async function loadPrefs() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.user_metadata?.preferences) {
        const prefs = authUser.user_metadata.preferences;
        if (prefs.notifications) setNotifications(prefs.notifications);
      }
    }
    loadPrefs();
  }, []);

  // Save preferences
  const savePreferences = useCallback(async (prefs: Record<string, unknown>) => {
    setSaving(true);
    const supabase = createClient();
    await supabase.auth.updateUser({
      data: {
        preferences: prefs,
      },
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  function toggleNotification(key: keyof typeof notifications) {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    savePreferences({ notifications: updated });
  }


  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "¿Estás seguro de que deseas eliminar tu cuenta? Esta acción eliminará permanentemente tu cuenta, propiedades, leads y todos los datos asociados. Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    const confirmText = window.prompt(
      'Escribe "ELIMINAR" para confirmar la eliminación de tu cuenta:'
    );
    if (confirmText !== "ELIMINAR") return;

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
        await fetch(`${apiBase}/api/v1/profiles/me`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }

      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      await logout();
    }
  }

  async function handleChangePassword() {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser?.email) {
      await supabase.auth.resetPasswordForEmail(authUser.email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      alert("Se ha enviado un enlace para cambiar tu contraseña a tu correo electrónico.");
    }
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
          Configuracion
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Administra tus preferencias y configuración de cuenta.
        </p>
        {saved && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-600 animate-fade-in-up">
            ✓ Guardado
          </span>
        )}
      </div>

      {/* ============================================================ */}
      {/*  Notificaciones                                              */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
            }}
          >
            <Bell
              className="h-5 w-5"
              style={{ color: "hsl(221 83% 53%)" }}
            />
          </div>
          <div>
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Notificaciones
            </h3>
            <p className="text-sm text-gray-500">
              Controla que notificaciones recibes por email.
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {[
            {
              key: "leads" as const,
              label: "Nuevos Leads",
              description:
                "Recibe un email cuando un lead se interese en tu propiedad.",
            },
            {
              key: "brcUpdates" as const,
              label: "Actualizaciones BRC",
              description:
                "Notificaciones sobre el estado de tus expedientes BRC.",
            },
            {
              key: "messages" as const,
              label: "Mensajes",
              description:
                "Recibe notificaciones cuando te envien un mensaje directo.",
            },
            {
              key: "marketing" as const,
              label: "Promociones y Marketing",
              description:
                "Ofertas especiales, novedades y consejos para brokers.",
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between px-6 py-4"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {item.description}
                </p>
              </div>
              <Toggle
                enabled={notifications[item.key]}
                onToggle={() => toggleNotification(item.key)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Seguridad                                                   */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53% / 0.1), hsl(160 84% 39% / 0.1))",
            }}
          >
            <Shield
              className="h-5 w-5"
              style={{ color: "hsl(221 83% 53%)" }}
            />
          </div>
          <div>
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Seguridad
            </h3>
            <p className="text-sm text-gray-500">
              Protege tu cuenta con opciones de seguridad avanzadas.
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Change password */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Cambiar Contrasena
                </p>
                <p className="mt-0.5 text-sm text-gray-500">
                  Actualiza tu contrasena de acceso.
                </p>
              </div>
            </div>
            <button
              onClick={handleChangePassword}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm"
            >
              Cambiar
            </button>
          </div>


        </div>
      </div>

      {/* ============================================================ */}
      {/*  Zona de Peligro                                             */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-red-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-red-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3
              className="text-lg font-bold text-red-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Zona de Peligro
            </h3>
            <p className="text-sm text-red-500">
              Acciones irreversibles en tu cuenta.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Eliminar Cuenta
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              Esta accion eliminara permanentemente tu cuenta, propiedades, leads
              y todos los datos asociados. Esta accion no se puede deshacer.
            </p>
          </div>
          <button
            onClick={handleDeleteAccount}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-red-700 hover:shadow-lg"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar Cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
