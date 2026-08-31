"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Check,
  Clock3,
  Crown,
  Info,
  Layers,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import {
  MEMBERSHIP_PERIOD_LABEL,
  MEMBERSHIP_TRIAL_DAYS,
  formatMembershipPrice,
  getPlan,
  type MembershipTierKey,
} from "@bithauss/config";

import {
  availableUpgradeTiers,
  computeEntitlements,
  daysRemaining,
  isRenewalDue,
  isTrialActive,
  legalTicketsAvailable,
  quotaState,
  trialDaysRemaining,
  type MembershipHolding,
  type UsageSnapshot,
} from "@/lib/membership";

const BRAND_GRADIENT =
  "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))";

export interface MembresiaViewProps {
  holdings: MembershipHolding[];
  usage: UsageSnapshot;
  /** Injectable for tests; production always passes the real clock. */
  now?: Date;
}

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateFormatter.format(new Date(iso));
}

/**
 * "Mi membresía" — what the client actually bought and how much of it is left.
 *
 * Pure presentation over `@/lib/membership`: every number on screen (limits,
 * discounts, stacked totals, trial countdown) comes from the same entitlement
 * functions the API enforces with, so the dashboard can never promise more
 * than the server will allow.
 */
export function MembresiaView({
  holdings,
  usage,
  now = new Date(),
}: MembresiaViewProps) {
  const entitlements = computeEntitlements(holdings, now);

  const primary =
    holdings.find((h) => !h.parentSubscriptionId) ?? holdings[0] ?? null;
  const stacked = holdings.filter((h) => h.parentSubscriptionId);

  const onTrial = primary ? isTrialActive(primary, now) : false;
  const trialLeft = primary ? trialDaysRemaining(primary, now) : 0;
  const termLeft = primary ? daysRemaining(primary.currentPeriodEnd, now) : 0;
  const renewalDue = primary ? isRenewalDue(primary, now) : false;
  const awaitingPayment = primary?.status === "PENDIENTE_PAGO";

  const properties = quotaState(usage.publishedProperties, entitlements.propertyLimit);
  const seats = quotaState(usage.crmSeatsUsed, entitlements.crmSeats);
  const ticketsLeft = legalTicketsAvailable(entitlements, usage.legalTicketsUsed);

  return (
    <div className="space-y-8">
      <header>
        <h2
          className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Mi Membresía
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Tu plan, tu consumo y tus beneficios vigentes.
        </p>
      </header>

      {/* ── Avisos ─────────────────────────────────────────── */}

      {onTrial && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4"
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">
              Estás en tu periodo de prueba: te{" "}
              {trialLeft === 1 ? "queda 1 día" : `quedan ${trialLeft} días`} de{" "}
              {MEMBERSHIP_TRIAL_DAYS}.
            </p>
            <p className="mt-0.5 text-blue-800">
              Incluye {entitlements.crmSeats} cuenta de CRM,{" "}
              {entitlements.propertyLimit} propiedades y 1 cuenta de formación
              inmobiliaria. Al terminar la prueba se cobrará el plan
              seleccionado a tu tarjeta registrada, salvo que canceles antes del{" "}
              {formatDate(primary?.trialEndsAt)}.
            </p>
          </div>
        </div>
      )}

      {awaitingPayment && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
        >
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Tu pago está en verificación.</p>
            <p className="mt-0.5 text-amber-800">
              Por seguridad, todo pago se confirma con doble verificación antes
              de habilitar el acceso. Te avisaremos en cuanto quede autorizado.
            </p>
          </div>
        </div>
      )}

      {renewalDue && !onTrial && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"
        >
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-sm text-amber-900">
            <span className="font-semibold">
              Tu membresía vence en {termLeft} {termLeft === 1 ? "día" : "días"}
            </span>{" "}
            ({formatDate(primary?.currentPeriodEnd)}). Renueva para no perder tus
            publicaciones ni tus cuentas de CRM.
          </p>
        </div>
      )}

      {/* ── Membresía actual ───────────────────────────────── */}

      {primary ? (
        <section
          aria-label="Membresía actual"
          className="relative overflow-hidden rounded-2xl p-6 shadow-sm sm:p-8"
          style={{ background: BRAND_GRADIENT }}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Crown className="h-7 w-7 text-white" aria-hidden="true" />
              </div>
              <div>
                <h3
                  className="text-xl font-bold text-white sm:text-2xl"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  Membresía {getPlan(primary.tier).name}
                </h3>
                <p className="mt-1 text-white/80">
                  {MEMBERSHIP_PERIOD_LABEL[primary.period]} ·{" "}
                  <span className="font-semibold text-white">
                    {formatMembershipPrice(
                      getPlan(primary.tier).plans[primary.period].total,
                    )}
                  </span>{" "}
                  <span className="text-white/70">MXN + IVA</span>
                </p>
                <p className="mt-2 text-sm text-white/70">
                  Vigencia hasta el {formatDate(primary.currentPeriodEnd)} ·{" "}
                  {termLeft} {termLeft === 1 ? "día restante" : "días restantes"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                {statusLabel(primary.status)}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold transition-all duration-300 hover:shadow-lg"
                style={{ color: "hsl(221 83% 53%)" }}
              >
                Renovar plan
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {stacked.length > 0 && (
            <div className="relative mt-6 rounded-xl bg-white/15 p-4 text-sm text-white">
              <p className="flex items-center gap-2 font-semibold">
                <Layers className="h-4 w-4" aria-hidden="true" />
                Membresías acumuladas
              </p>
              <p className="mt-1 text-white/85">
                {stacked
                  .map((h) => getPlan(h.tier).name)
                  .join(" + ")}{" "}
                sumadas a tu PLATINO: {entitlements.propertyLimit} propiedades y{" "}
                {entitlements.crmSeats} cuentas de CRM en total.
              </p>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <h3 className="text-lg font-bold text-gray-900">
            Aún no tienes una membresía activa
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Contrata una membresía para publicar propiedades y usar el CRM
            inmobiliario, o prueba BitHauss {MEMBERSHIP_TRIAL_DAYS} días con una
            tarjeta registrada.
          </p>
        </section>
      )}

      {/* ── Consumo ────────────────────────────────────────── */}

      <section aria-label="Consumo de tu membresía" className="grid gap-5 sm:grid-cols-3">
        <UsageCard
          icon={<Crown className="h-4 w-4" aria-hidden="true" />}
          label="Propiedades publicadas"
          used={properties.used}
          limit={properties.limit}
          percent={properties.percentUsed}
          warn={properties.isNearLimit}
          testId="usage-properties"
        />
        <UsageCard
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
          label="Cuentas de acceso al CRM"
          used={seats.used}
          limit={seats.limit}
          percent={seats.percentUsed}
          warn={seats.isNearLimit}
          testId="usage-crm"
        />
        <UsageCard
          icon={<Scale className="h-4 w-4" aria-hidden="true" />}
          label="Tickets jurídicos disponibles"
          used={usage.legalTicketsUsed}
          limit={entitlements.legalTicketsGranted}
          percent={
            quotaState(usage.legalTicketsUsed, entitlements.legalTicketsGranted)
              .percentUsed
          }
          warn={ticketsLeft === 0 && entitlements.legalTicketsGranted > 0}
          testId="usage-tickets"
          note={
            entitlements.legalTicketsGranted === 0
              ? "Aplican sólo en BLACK y PLATINO pagando por anticipado el Plan Anual."
              : `Te quedan ${ticketsLeft}.`
          }
        />
      </section>

      {properties.isAtLimit && entitlements.propertyLimit > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-sm text-red-900">
            Alcanzaste el límite de {entitlements.propertyLimit} propiedades de
            tu membresía. Haz upgrade de nivel
            {entitlements.contributingTiers.includes("PLATINO")
              ? " o acumula una membresía adicional"
              : ""}{" "}
            para seguir publicando.
          </p>
        </div>
      )}

      {/* ── Descuentos vigentes ────────────────────────────── */}

      <section
        aria-label="Descuentos vigentes"
        className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <h3
          className="text-lg font-bold text-gray-900"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Descuentos vigentes
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <DiscountRow
            label="Emisión de certificados BRC"
            pct={entitlements.brcDiscountPct}
            testId="discount-brc"
          />
          <DiscountRow
            label="Videos de propiedades"
            pct={entitlements.videoDiscountPct}
            soon
            testId="discount-video"
          />
        </div>
        <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
          <PerkRow
            enabled={entitlements.hasCertifiedProfessionalsNetwork}
            label="Red de profesionales certificados"
          />
          <PerkRow
            enabled={entitlements.hasNotaryNetwork}
            label="Red de notarios con convenio"
          />
          <PerkRow
            enabled={entitlements.hasLegalFormsLibrary}
            label="Formatos inmobiliarios"
          />
        </div>
      </section>

      {/* ── Camino de upgrade ──────────────────────────────── */}

      {primary && <UpgradePath current={primary.tier} />}
    </div>
  );
}

function statusLabel(status: MembershipHolding["status"]): string {
  switch (status) {
    case "PRUEBA":
      return "En prueba";
    case "PENDIENTE_PAGO":
      return "Pago en verificación";
    case "ACTIVA":
      return "Activa";
    case "SUSPENDIDA":
      return "Suspendida";
    case "CANCELADA":
      return "Cancelada";
    case "VENCIDA":
      return "Vencida";
  }
}

function UsageCard({
  icon,
  label,
  used,
  limit,
  percent,
  warn,
  note,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
  percent: number;
  warn: boolean;
  note?: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-80"
        style={{ background: BRAND_GRADIENT }}
      />
      <p className="flex items-center gap-2 text-sm font-medium text-gray-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
        {new Intl.NumberFormat("es-MX").format(used)}
        <span className="text-sm font-medium text-gray-400">
          /{new Intl.NumberFormat("es-MX").format(limit)}
        </span>
      </p>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            background: warn ? "hsl(0 72% 51%)" : BRAND_GRADIENT,
          }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {note ?? `${percent}% utilizado`}
      </p>
    </div>
  );
}

function DiscountRow({
  label,
  pct,
  soon = false,
  testId,
}: {
  label: string;
  pct: number;
  soon?: boolean;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3"
    >
      <span className="text-sm text-gray-700">
        {label}
        {soon && (
          <span className="ml-2 rounded-md bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
            Próximamente
          </span>
        )}
      </span>
      <span className="text-lg font-bold tabular-nums text-gray-900">
        {pct > 0 ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

function PerkRow({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2">
      {enabled ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <Clock3 className="h-4 w-4 text-gray-300" aria-hidden="true" />
      )}
      <span className={enabled ? "text-gray-700" : "text-gray-400"}>
        {label}
      </span>
      <span className="sr-only">{enabled ? "incluido" : "no incluido"}</span>
    </span>
  );
}

/**
 * A6 — the only path between plans is upwards. The downgrade rule is stated
 * explicitly instead of just hiding the lower tiers: a client who cannot find
 * the "bajar de plan" button will call support, and support will say this.
 */
function UpgradePath({ current }: { current: MembershipTierKey }) {
  const upgrades = availableUpgradeTiers(current);
  const currentDef = getPlan(current);

  return (
    <section aria-label="Cambiar de membresía" className="space-y-4">
      <div>
        <h3
          className="text-lg font-bold text-gray-900"
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          Sube de nivel
        </h3>
        <p className="mt-0.5 text-sm text-gray-500">
          El upgrade se aplica una vez confirmado el pago con doble
          verificación.
        </p>
      </div>

      {upgrades.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upgrades.map((tier) => {
            const def = getPlan(tier);
            return (
              <div
                key={tier}
                data-testid={`upgrade-${tier}`}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <h4 className="text-base font-bold text-gray-900">
                  {def.name}
                </h4>
                <p className="mt-1 text-sm text-gray-500">
                  {def.propertyLimit} propiedades · {def.crmSeats} cuentas CRM
                </p>
                <p className="mt-3 text-xl font-bold tabular-nums text-gray-900">
                  {formatMembershipPrice(def.plans.ANUAL_ANTICIPADO.total)}
                  <span className="ml-1 text-xs font-medium text-gray-400">
                    anual anticipado + IVA
                  </span>
                </p>
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5"
                  style={{ background: BRAND_GRADIENT }}
                >
                  Subir a {tier}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-600">
          Ya cuentas con {currentDef.name}, el nivel más alto. Puedes contratar
          membresías adicionales para acumular propiedades y beneficios.
        </p>
      )}

      <div
        role="note"
        className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4"
      >
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">
            No es posible bajar de nivel de membresía.
          </span>{" "}
          Si necesitas un nivel menor, deberás cancelar el contrato vigente y
          abrir uno nuevo. El upgrade, en cambio, sí está disponible en
          cualquier momento.
        </p>
      </div>
    </section>
  );
}
