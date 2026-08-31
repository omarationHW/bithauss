"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Layers,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  MEMBERSHIP_PERIODS,
  MEMBERSHIP_PERIOD_LABEL,
  formatMembershipPrice,
  getPlan,
  listMembershipPlans,
  type MembershipPeriodKey,
  type MembershipTierKey,
} from "@bithauss/config";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { daysRemaining, type MembershipStatus } from "@/lib/membership";

/**
 * Admin · Membresías.
 *
 * Two things here are controls, not decoration:
 *
 *   · A5 — payment double verification. Recording a payment and authorising
 *     it are separate acts by separate people. The UI refuses to let the same
 *     admin do both, and stamps who confirmed and when.
 *   · A5 — cancelling for non-payment goes through the same two hands:
 *     request (suspends) then authorise (cancels).
 *
 * The subscription data is local state here; the actions map 1:1 onto
 * POST /api/v1/memberships/payments{,/confirm} and .../cancellations/*.
 */

/* ------------------------------------------------------------------ */
/*  Modelo                                                             */
/* ------------------------------------------------------------------ */

interface AdminSubscription {
  id: string;
  clientName: string;
  clientEmail: string;
  tier: MembershipTierKey;
  period: MembershipPeriodKey;
  status: MembershipStatus;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  parentSubscriptionId: string | null;
  /** A5 — first actor: who recorded the payment. */
  paymentRecordedBy: string | null;
  /** A5 — second actor: who authorised it. */
  paymentConfirmedBy: string | null;
  paymentConfirmedAt: string | null;
  cancellationRequestedBy: string | null;
  cancellationReason: string | null;
}

/** The signed-in admin. In production this comes from the session. */
const CURRENT_ADMIN = "Ana Ruiz";

const INITIAL_SUBSCRIPTIONS: AdminSubscription[] = [
  {
    id: "sub-1",
    clientName: "Inmobiliaria Torres",
    clientEmail: "contacto@torres.mx",
    tier: "PLATINO",
    period: "ANUAL_ANTICIPADO",
    status: "ACTIVA",
    currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    trialEndsAt: null,
    parentSubscriptionId: null,
    paymentRecordedBy: "Ana Ruiz",
    paymentConfirmedBy: "Luis Prado",
    paymentConfirmedAt: "2026-01-05T18:30:00.000Z",
    cancellationRequestedBy: null,
    cancellationReason: null,
  },
  {
    id: "sub-2",
    clientName: "Inmobiliaria Torres",
    clientEmail: "contacto@torres.mx",
    tier: "BLACK",
    period: "ANUAL",
    status: "ACTIVA",
    currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    trialEndsAt: null,
    parentSubscriptionId: "sub-1",
    paymentRecordedBy: "Ana Ruiz",
    paymentConfirmedBy: "Luis Prado",
    paymentConfirmedAt: "2026-01-05T18:35:00.000Z",
    cancellationRequestedBy: null,
    cancellationReason: null,
  },
  {
    id: "sub-3",
    clientName: "Carlos Mendoza",
    clientEmail: "carlos@brokermx.com",
    tier: "GOLD",
    period: "SEMESTRAL",
    status: "PENDIENTE_PAGO",
    currentPeriodEnd: "2026-09-15T00:00:00.000Z",
    trialEndsAt: null,
    parentSubscriptionId: null,
    paymentRecordedBy: "Ana Ruiz",
    paymentConfirmedBy: null,
    paymentConfirmedAt: null,
    cancellationRequestedBy: null,
    cancellationReason: null,
  },
  {
    id: "sub-4",
    clientName: "Sofía Morales",
    clientEmail: "sofia@casasmx.com",
    tier: "BLUE",
    period: "TRIMESTRAL",
    status: "PENDIENTE_PAGO",
    currentPeriodEnd: "2026-06-10T00:00:00.000Z",
    trialEndsAt: null,
    parentSubscriptionId: null,
    paymentRecordedBy: "Luis Prado",
    paymentConfirmedBy: null,
    paymentConfirmedAt: null,
    cancellationRequestedBy: null,
    cancellationReason: null,
  },
  {
    id: "sub-5",
    clientName: "Diego Navarro",
    clientEmail: "diego@navarro.mx",
    tier: "START",
    period: "TRIMESTRAL",
    status: "PRUEBA",
    currentPeriodEnd: "2026-03-08T00:00:00.000Z",
    trialEndsAt: "2026-03-08T00:00:00.000Z",
    parentSubscriptionId: null,
    paymentRecordedBy: null,
    paymentConfirmedBy: null,
    paymentConfirmedAt: null,
    cancellationRequestedBy: null,
    cancellationReason: null,
  },
  {
    id: "sub-6",
    clientName: "Luis Castillo",
    clientEmail: "luis@castillo.mx",
    tier: "GROW",
    period: "ANUAL",
    status: "SUSPENDIDA",
    currentPeriodEnd: "2026-05-01T00:00:00.000Z",
    trialEndsAt: null,
    parentSubscriptionId: null,
    paymentRecordedBy: "Ana Ruiz",
    paymentConfirmedBy: "Luis Prado",
    paymentConfirmedAt: "2025-05-02T10:00:00.000Z",
    cancellationRequestedBy: "Luis Prado",
    cancellationReason: "Falta de pago del cargo domiciliado de marzo.",
  },
];

const STATUS_STYLE: Record<MembershipStatus, string> = {
  PRUEBA: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  PENDIENTE_PAGO: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ACTIVA: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  SUSPENDIDA: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  CANCELADA: "bg-red-500/10 text-red-600 border-red-500/20",
  VENCIDA: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

const STATUS_LABEL: Record<MembershipStatus, string> = {
  PRUEBA: "En prueba",
  PENDIENTE_PAGO: "Pago por verificar",
  ACTIVA: "Activa",
  SUSPENDIDA: "Suspendida",
  CANCELADA: "Cancelada",
  VENCIDA: "Vencida",
};

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "—";
}

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */

export default function AdminMembresiasPage() {
  const [subscriptions, setSubscriptions] = useState(INITIAL_SUBSCRIPTIONS);
  const [tab, setTab] = useState("pendientes");
  const [notice, setNotice] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      pendientes: subscriptions.filter((s) => s.status === "PENDIENTE_PAGO").length,
      activas: subscriptions.filter((s) => s.status === "ACTIVA").length,
      prueba: subscriptions.filter((s) => s.status === "PRUEBA").length,
      cancelacion: subscriptions.filter(
        (s) => s.cancellationRequestedBy !== null && s.status !== "CANCELADA",
      ).length,
      todas: subscriptions.length,
    }),
    [subscriptions],
  );

  const filtered = useMemo(() => {
    switch (tab) {
      case "pendientes":
        return subscriptions.filter((s) => s.status === "PENDIENTE_PAGO");
      case "activas":
        return subscriptions.filter((s) => s.status === "ACTIVA");
      case "prueba":
        return subscriptions.filter((s) => s.status === "PRUEBA");
      case "cancelacion":
        return subscriptions.filter(
          (s) => s.cancellationRequestedBy !== null && s.status !== "CANCELADA",
        );
      default:
        return subscriptions;
    }
  }, [subscriptions, tab]);

  /**
   * A5 — second actor confirms the payment. Refused when the signed-in admin
   * is the one who recorded it: a single person must not be able to move money
   * and grant access.
   */
  function confirmPayment(id: string) {
    const target = subscriptions.find((s) => s.id === id);
    if (!target) return;

    if (target.paymentRecordedBy === CURRENT_ADMIN) {
      setNotice(
        `No puedes confirmar el pago de ${target.clientName}: tú lo registraste. La doble verificación exige un segundo administrador.`,
      );
      return;
    }

    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: "ACTIVA" as MembershipStatus,
              paymentConfirmedBy: CURRENT_ADMIN,
              paymentConfirmedAt: new Date().toISOString(),
            }
          : s,
      ),
    );
    setNotice(
      `Pago de ${target.clientName} confirmado por ${CURRENT_ADMIN}. Membresía activada.`,
    );
  }

  /** A5 — step 1 of the cancellation: suspends and records who asked. */
  function requestCancellation(id: string) {
    const target = subscriptions.find((s) => s.id === id);
    if (!target) return;

    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: "SUSPENDIDA" as MembershipStatus,
              cancellationRequestedBy: CURRENT_ADMIN,
              cancellationReason: "Falta de pago.",
            }
          : s,
      ),
    );
    setNotice(
      `Cancelación solicitada para ${target.clientName}. Requiere autorización de otro administrador.`,
    );
  }

  /** A5 — step 2: a different admin authorises the cancellation. */
  function confirmCancellation(id: string) {
    const target = subscriptions.find((s) => s.id === id);
    if (!target) return;

    if (target.cancellationRequestedBy === CURRENT_ADMIN) {
      setNotice(
        `No puedes autorizar la cancelación de ${target.clientName}: tú la solicitaste.`,
      );
      return;
    }

    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "CANCELADA" as MembershipStatus } : s,
      ),
    );
    setNotice(`Membresía de ${target.clientName} cancelada por ${CURRENT_ADMIN}.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Membresías y Suscripciones
        </h2>
        <p className="text-muted-foreground">
          Catálogo, estatus por cliente y doble verificación de pagos y
          cancelaciones.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{notice}</p>
        </div>
      )}

      {/* ── Indicadores ────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Clock3 className="h-5 w-5 text-amber-500" />}
          tone="bg-amber-500/10"
          label="Pagos por verificar"
          value={counts.pendientes}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          tone="bg-emerald-500/10"
          label="Membresías activas"
          value={counts.activas}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-500" />}
          tone="bg-blue-500/10"
          label="En prueba (7 días)"
          value={counts.prueba}
        />
        <StatCard
          icon={<Ban className="h-5 w-5 text-red-500" />}
          tone="bg-red-500/10"
          label="Cancelaciones por autorizar"
          value={counts.cancelacion}
        />
      </div>

      {/* ── Suscripciones ──────────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabTrigger value="pendientes" label="Pagos por verificar" count={counts.pendientes} />
          <TabTrigger value="activas" label="Activas" count={counts.activas} />
          <TabTrigger value="prueba" label="En prueba" count={counts.prueba} />
          <TabTrigger value="cancelacion" label="Cancelaciones" count={counts.cancelacion} />
          <TabTrigger value="todas" label="Todas" count={counts.todas} />
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <caption className="sr-only">
                    Suscripciones por estatus, con la doble verificación de pago
                    y de cancelación.
                  </caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                        Cliente
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                        Membresía
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                        Estatus
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                        Vigencia
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                        Verificación de pago
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          No hay suscripciones en este estatus.
                        </td>
                      </tr>
                    )}
                    {filtered.map((sub) => (
                      <SubscriptionRow
                        key={sub.id}
                        sub={sub}
                        onConfirmPayment={confirmPayment}
                        onRequestCancellation={requestCancellation}
                        onConfirmCancellation={confirmCancellation}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CatalogTable />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TabTrigger({
  value,
  label,
  count,
}: {
  value: string;
  label: string;
  count: number;
}) {
  return (
    <TabsTrigger value={value} className="gap-1.5">
      {label}
      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
        {count}
      </Badge>
    </TabsTrigger>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", tone)}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionRow({
  sub,
  onConfirmPayment,
  onRequestCancellation,
  onConfirmCancellation,
}: {
  sub: AdminSubscription;
  onConfirmPayment: (id: string) => void;
  onRequestCancellation: (id: string) => void;
  onConfirmCancellation: (id: string) => void;
}) {
  const def = getPlan(sub.tier);
  const left = daysRemaining(sub.currentPeriodEnd);
  const awaitingCancellation =
    sub.cancellationRequestedBy !== null && sub.status !== "CANCELADA";

  return (
    <tr data-testid={`row-${sub.id}`} className="border-b transition-colors last:border-0 hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{sub.clientName}</div>
        <div className="text-xs text-muted-foreground">{sub.clientEmail}</div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{def.name}</span>
          {sub.parentSubscriptionId && (
            <Badge
              variant="outline"
              className="gap-1 border-violet-500/20 bg-violet-500/10 text-[10px] text-violet-600"
            >
              <Layers className="h-3 w-3" aria-hidden="true" />
              Acumulada
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {MEMBERSHIP_PERIOD_LABEL[sub.period]} ·{" "}
          {formatMembershipPrice(def.plans[sub.period].total)} + IVA
        </div>
      </td>

      <td className="px-4 py-3">
        <Badge variant="outline" className={cn("text-[11px]", STATUS_STYLE[sub.status])}>
          {STATUS_LABEL[sub.status]}
        </Badge>
      </td>

      <td className="px-4 py-3 text-muted-foreground">
        <div>{formatDate(sub.currentPeriodEnd)}</div>
        <div className="text-xs">
          {left > 0 ? `${left} días restantes` : "Vencida"}
        </div>
      </td>

      {/* A5 — the audit trail is part of the table, not hidden in a modal. */}
      <td className="px-4 py-3 text-xs">
        <div className="text-muted-foreground">
          Registró: <span className="font-medium text-foreground">{sub.paymentRecordedBy ?? "—"}</span>
        </div>
        <div className="text-muted-foreground">
          Confirmó:{" "}
          {sub.paymentConfirmedBy ? (
            <span className="font-medium text-emerald-600">
              {sub.paymentConfirmedBy} · {formatDate(sub.paymentConfirmedAt)}
            </span>
          ) : (
            <span className="font-medium text-amber-600">Pendiente</span>
          )}
        </div>
        {awaitingCancellation && (
          <div className="mt-1 flex items-start gap-1 text-orange-600">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              Cancelación solicitada por {sub.cancellationRequestedBy}
              {sub.cancellationReason ? `: ${sub.cancellationReason}` : ""}
            </span>
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap justify-end gap-2">
          {sub.status === "PENDIENTE_PAGO" && (
            <Button
              size="sm"
              onClick={() => onConfirmPayment(sub.id)}
              className="gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Confirmar pago
            </Button>
          )}

          {awaitingCancellation && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onConfirmCancellation(sub.id)}
              className="gap-1.5"
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              Autorizar cancelación
            </Button>
          )}

          {sub.status === "ACTIVA" && !awaitingCancellation && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRequestCancellation(sub.id)}
            >
              Solicitar cancelación
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Catálogo (6 niveles × 4 planes)                                    */
/* ------------------------------------------------------------------ */

function CatalogTable() {
  const tiers = listMembershipPlans();

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col gap-1 p-6 pb-4">
          <h3
            className="text-lg font-bold"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            Catálogo de membresías
          </h3>
          <p className="text-sm text-muted-foreground">
            6 niveles × 4 planes = 24 combinaciones vendibles. Precios en MXN{" "}
            <strong>más IVA</strong>, según el Módulo Membresías vigente.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">
              Catálogo completo de precios por nivel y vigencia.
            </caption>
            <thead>
              <tr className="border-y bg-muted/50 text-left">
                <th scope="col" className="px-4 py-3 font-medium text-muted-foreground">
                  Nivel
                </th>
                {MEMBERSHIP_PERIODS.map((period) => (
                  <th
                    key={period}
                    scope="col"
                    className="px-4 py-3 text-right font-medium text-muted-foreground"
                  >
                    {MEMBERSHIP_PERIOD_LABEL[period]}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Propiedades
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Cuentas CRM
                </th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.tier} className="border-b last:border-0 hover:bg-muted/30">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {tier.name}
                  </th>
                  {MEMBERSHIP_PERIODS.map((period) => (
                    <td
                      key={period}
                      className="px-4 py-3 text-right tabular-nums"
                    >
                      {formatMembershipPrice(tier.plans[period].total)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {new Intl.NumberFormat("es-MX").format(tier.propertyLimit)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {tier.crmSeats}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
