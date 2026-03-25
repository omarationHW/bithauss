"use client";

import {
  Crown,
  Sparkles,
  Check,
  CreditCard,
  Download,
  ArrowUpRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const currentPlanFeatures = [
  "Hasta 200 propiedades publicadas",
  "5 usuarios por cuenta",
  "Leads ilimitados",
  "Reportes avanzados",
  "Certificación BRC incluida",
  "Soporte prioritario por chat",
  "Integración con portales externos",
  "Marca personalizada en listados",
];

const usageStats = [
  {
    label: "Propiedades publicadas",
    used: 24,
    total: 200,
    unit: "propiedades",
  },
  { label: "Usuarios activos", used: 5, total: 5, unit: "usuarios" },
  { label: "Leads este mes", used: 156, total: -1, unit: "ilimitados" },
];

interface Plan {
  nombre: string;
  precio: string;
  periodo: string;
  descripcion: string;
  activo: boolean;
  destacado: boolean;
  features: string[];
  cta: string;
}

const plans: Plan[] = [
  {
    nombre: "Básico",
    precio: "$499",
    periodo: "/mes",
    descripcion: "Ideal para agentes independientes",
    activo: false,
    destacado: false,
    features: [
      "Hasta 20 propiedades",
      "1 usuario",
      "50 leads/mes",
      "Reportes básicos",
      "Soporte por email",
    ],
    cta: "Cambiar a Básico",
  },
  {
    nombre: "Broker Pro",
    precio: "$999",
    periodo: "/mes",
    descripcion: "Para brokers y equipos en crecimiento",
    activo: true,
    destacado: true,
    features: [
      "Hasta 200 propiedades",
      "5 usuarios",
      "Leads ilimitados",
      "Reportes avanzados",
      "Certificación BRC",
      "Soporte prioritario",
      "Integración portales",
      "Marca personalizada",
    ],
    cta: "Plan actual",
  },
  {
    nombre: "Premium",
    precio: "$2,499",
    periodo: "/mes",
    descripcion: "Para inmobiliarias y desarrolladores",
    activo: false,
    destacado: false,
    features: [
      "Propiedades ilimitadas",
      "Usuarios ilimitados",
      "Leads ilimitados",
      "Reportes personalizados",
      "Certificación BRC premium",
      "Soporte dedicado 24/7",
      "API completa",
      "Marca white-label",
      "Gerente de cuenta",
    ],
    cta: "Actualizar a Premium",
  },
];

const billingHistory = [
  {
    id: 1,
    fecha: "1 Mar 2026",
    concepto: "Membresía Broker Pro - Marzo 2026",
    monto: "$999.00 MXN",
    estado: "Pagado",
  },
  {
    id: 2,
    fecha: "1 Feb 2026",
    concepto: "Membresía Broker Pro - Febrero 2026",
    monto: "$999.00 MXN",
    estado: "Pagado",
  },
  {
    id: 3,
    fecha: "1 Ene 2026",
    concepto: "Membresía Broker Pro - Enero 2026",
    monto: "$999.00 MXN",
    estado: "Pagado",
  },
  {
    id: 4,
    fecha: "1 Dic 2025",
    concepto: "Membresía Broker Pro - Diciembre 2025",
    monto: "$999.00 MXN",
    estado: "Pagado",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MembresiaPage() {
  return (
    <div className="space-y-8">
      {/* ============================================================ */}
      {/*  Header                                                       */}
      {/* ============================================================ */}
      <div>
        <h2
          className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Mi Membresía
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Administra tu plan, uso y facturación.
        </p>
      </div>

      {/* ============================================================ */}
      {/*  Current Plan Card                                            */}
      {/* ============================================================ */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 shadow-sm sm:p-8"
        style={{
          background:
            "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute right-1/4 top-1/2 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Crown className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    className="text-xl font-bold text-white sm:text-2xl"
                    style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                  >
                    Plan Broker Pro
                  </h3>
                  <Sparkles className="h-5 w-5 text-yellow-300" />
                </div>
                <p className="mt-1 text-white/80">
                  <span className="text-3xl font-bold text-white">$999</span>
                  <span className="text-lg text-white/70">/mes</span>
                </p>
                <p className="mt-2 text-sm text-white/70">
                  Próxima renovación: 15 de Abril, 2026
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/30">
                Cancelar plan
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold transition-all duration-300 hover:shadow-lg" style={{ color: "hsl(221 83% 53%)" }}>
                Renovar Plan
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Features grid */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {currentPlanFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm text-white/90">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Usage Stats                                                  */}
      {/* ============================================================ */}
      <div className="grid gap-5 sm:grid-cols-3">
        {usageStats.map((stat) => {
          const percentage =
            stat.total === -1 ? 100 : (stat.used / stat.total) * 100;
          const isUnlimited = stat.total === -1;
          const isNearLimit = !isUnlimited && percentage >= 80;

          return (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className="absolute inset-x-0 top-0 h-1 opacity-80"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              />

              <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {isUnlimited ? (
                  <>
                    {stat.used}{" "}
                    <span className="text-sm font-medium text-gray-400">
                      ilimitados
                    </span>
                  </>
                ) : (
                  <>
                    {stat.used}
                    <span className="text-sm font-medium text-gray-400">
                      /{stat.total}
                    </span>
                  </>
                )}
              </p>

              {/* Progress bar */}
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                    background: isNearLimit
                      ? "hsl(0 72% 51%)"
                      : "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {isUnlimited
                  ? "Sin límite de uso"
                  : `${percentage.toFixed(0)}% utilizado`}
              </p>
            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/*  Plan Comparison Cards                                        */}
      {/* ============================================================ */}
      <div>
        <h3
          className="text-lg font-bold text-gray-900"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Comparar Planes
        </h3>
        <p className="mt-0.5 mb-6 text-sm text-gray-500">
          Elige el plan que mejor se adapte a tus necesidades.
        </p>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.nombre}
              className={`group relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                plan.destacado
                  ? "border-blue-200 ring-2 ring-blue-100"
                  : "border-gray-100"
              }`}
            >
              {plan.destacado && (
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                  }}
                />
              )}

              {plan.activo && (
                <span className="mb-4 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 border border-blue-200">
                  <Sparkles className="h-3 w-3" />
                  Plan actual
                </span>
              )}

              <h4
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "Barlow, Inter, sans-serif" }}
              >
                {plan.nombre}
              </h4>
              <p className="mt-1 text-sm text-gray-500">{plan.descripcion}</p>

              <div className="mt-4">
                <span className="text-3xl font-bold text-gray-900">
                  {plan.precio}
                </span>
                <span className="text-gray-400">{plan.periodo}</span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <div
                      className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: plan.destacado
                          ? "linear-gradient(135deg, hsl(221 83% 53% / 0.15), hsl(160 84% 39% / 0.15))"
                          : undefined,
                        backgroundColor: plan.destacado
                          ? undefined
                          : "rgb(243 244 246)",
                      }}
                    >
                      <Check
                        className="h-3 w-3"
                        style={{
                          color: plan.destacado
                            ? "hsl(221 83% 53%)"
                            : "rgb(107 114 128)",
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
                  plan.activo
                    ? "border border-gray-200 bg-gray-50 text-gray-400 cursor-default"
                    : plan.destacado
                    ? "text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                    : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:shadow-sm"
                }`}
                style={
                  !plan.activo && plan.destacado
                    ? {
                        background:
                          "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                      }
                    : undefined
                }
                disabled={plan.activo}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  Billing History                                              */}
      {/* ============================================================ */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3
              className="text-lg font-bold text-gray-900"
              style={{ fontFamily: "Barlow, Inter, sans-serif" }}
            >
              Historial de Facturación
            </h3>
            <p className="mt-0.5 text-sm text-gray-500">
              Tus últimos pagos y facturas
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all duration-300 hover:bg-gray-50 hover:shadow-sm">
            <CreditCard className="h-4 w-4" />
            Método de pago
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-gray-100 bg-gray-50/50 text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Fecha
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Concepto
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Monto
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {billingHistory.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-gray-100 transition-colors duration-200 hover:bg-gray-50/80"
                >
                  <td className="px-6 py-4 text-gray-500">{entry.fecha}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {entry.concepto}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {entry.monto}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                      {entry.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-300 hover:bg-gray-100"
                      style={{ color: "hsl(221 83% 53%)" }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Factura
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
