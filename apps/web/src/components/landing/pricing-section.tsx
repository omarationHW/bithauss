"use client";

import { useState } from "react";
import { Check, Clock3, Minus } from "lucide-react";

import {
  MEMBERSHIP_BENEFIT_ROWS,
  MEMBERSHIP_PERIODS,
  MEMBERSHIP_PERIOD_LABEL,
  MEMBERSHIP_TRIAL_DAYS,
  formatMembershipPrice,
  getPrepaidAnnualSavings,
  getPrepaidAnnualSavingsPct,
  listMembershipPlans,
  type MembershipPeriodKey,
  type MembershipPeriodPricing,
  type MembershipTierDefinition,
} from "@bithauss/config";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ElectricBorder } from "@/components/ui/electric-border";

/**
 * Membership pricing — the six real BitHauss tiers.
 *
 * Every figure comes from @bithauss/config (transcribed from the Módulo
 * Membresías PDF), never from literals typed here: the landing page and the
 * checkout must quote the same number or the client is being lied to.
 *
 * Prices are published WITHOUT IVA, exactly as the PDF does, and the page
 * says so next to every amount.
 */

const TIERS = listMembershipPlans();

/** Short labels for the period selector; the full ones are long for a pill. */
const PERIOD_TAB_LABEL: Record<MembershipPeriodKey, string> = {
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
  ANUAL_ANTICIPADO: "Anual · pago anticipado",
};

const BRAND_COLORS: [string, string] = ["hsl(221 83% 53%)", "hsl(160 84% 39%)"];
const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND_COLORS[0]}, ${BRAND_COLORS[1]})`;

/** "o un solo pago trimestral de…" */
const PERIOD_ADJECTIVE: Record<MembershipPeriodKey, string> = {
  TRIMESTRAL: "trimestral",
  SEMESTRAL: "semestral",
  ANUAL: "anual",
  ANUAL_ANTICIPADO: "anual",
};

/**
 * Lo que se ahorra pagando el periodo completo de una vez en lugar de las
 * mensualidades domiciliadas (el catálogo cobra más por el esquema mensual).
 */
function getInstalmentSavings(pricing: MembershipPeriodPricing): {
  amount: number;
  pct: number;
} {
  if (pricing.instalmentAmount === null || pricing.instalments === null) {
    return { amount: 0, pct: 0 };
  }
  const monthlyTotal = pricing.instalmentAmount * pricing.instalments;
  const amount = monthlyTotal - pricing.total;
  return { amount, pct: Math.round((amount / monthlyTotal) * 100) };
}

function benefitValue(
  tier: MembershipTierDefinition,
  key: (typeof MEMBERSHIP_BENEFIT_ROWS)[number]["key"],
): number | boolean {
  return tier[key];
}

export function PricingSection() {
  const [period, setPeriod] = useState<MembershipPeriodKey>("ANUAL");
  const isPrepaid = period === "ANUAL_ANTICIPADO";

  return (
    <section
      id="membresias"
      aria-labelledby="membresias-heading"
      className="bg-muted/30 px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* ── Encabezado ────────────────────────────────────── */}
        <div className="mb-10 text-center sm:mb-12">
          <h2
            id="membresias-heading"
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            Membresías{" "}
            <span className="relative inline-block">
              <span className="text-primary">BitHauss</span>
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 300 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1 8.5C50 2.5 100 1 150 3.5C200 6 250 2.5 299 8.5"
                  stroke="hsl(160 84% 39%)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-muted-foreground">
            Seis niveles pensados para escalar contigo. Elige la vigencia que
            más te convenga: {MEMBERSHIP_TRIAL_DAYS} días naturales de prueba,
            CRM inmobiliario incluido y certificación BRC con descuento desde el
            nivel GOLD.
          </p>
        </div>

        {/* ── Selector de vigencia ──────────────────────────── */}
        <div
          role="radiogroup"
          aria-label="Vigencia del plan"
          className="mx-auto mb-4 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/60 bg-white p-2 shadow-sm"
        >
          {MEMBERSHIP_PERIODS.map((option) => {
            const selected = option === period;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPeriod(option)}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300",
                  selected
                    ? "text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted",
                )}
                style={selected ? { background: BRAND_GRADIENT } : undefined}
              >
                {PERIOD_TAB_LABEL[option]}
              </button>
            );
          })}
        </div>

        <p className="mb-10 text-center text-sm text-muted-foreground">
          {isPrepaid ? (
            <span className="font-semibold text-accent">
              Precio especial por pagar el Plan Anual en una sola exhibición al
              contratar.
            </span>
          ) : (
            <>
              Un solo pago de contado o cargo domiciliado mensual a tarjeta de
              crédito/débito.
            </>
          )}{" "}
          Todos los precios son en pesos mexicanos <strong>más IVA</strong>.
        </p>

        {/* ── Tarjetas ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <TierCard key={tier.tier} tier={tier} period={period} />
          ))}
        </div>

        {/* ── Tabla comparativa ─────────────────────────────── */}
        <ComparisonTable period={period} />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Precios a julio 2024, expresados en MXN más IVA. Los rubros marcados
          como <em>próximamente</em> se encuentran en desarrollo y se liberarán
          sin costo adicional para las membresías que los incluyen.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Tarjeta de nivel                                                   */
/* ------------------------------------------------------------------ */

function TierCard({
  tier,
  period,
}: {
  tier: MembershipTierDefinition;
  period: MembershipPeriodKey;
}) {
  const pricing = tier.plans[period];
  const featured = tier.tier === "PLATINO";
  const savings = getPrepaidAnnualSavings(tier.tier);
  const instalmentSavings = getInstalmentSavings(pricing);

  const card = (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 sm:p-7",
        featured
          ? "border-transparent bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/80"
          : "border-border/50 bg-white hover:-translate-y-1 hover:shadow-lg",
      )}
    >

      <div className="mb-4">
        <h3
          className={cn(
            "text-xl font-bold",
            "text-foreground",
          )}
          style={{ fontFamily: "Barlow, Inter, sans-serif" }}
        >
          {tier.name}
        </h3>
        <p
          className={cn(
            "mt-1 text-sm",
            "text-muted-foreground",
          )}
        >
          {tier.description}
        </p>
      </div>

      {/* Precio: la mensualidad manda; el pago por periodo es la opción que conviene */}
      {pricing.instalmentAmount !== null ? (
        <>
          <div className="mb-1 flex items-baseline gap-1.5">
            <span
              data-testid={`price-monthly-${tier.tier}`}
              className={cn(
                "text-4xl font-bold tabular-nums",
                "text-foreground",
              )}
            >
              {formatMembershipPrice(pricing.instalmentAmount)}
            </span>
            <span
              className={cn(
                "text-base font-semibold",
                "text-foreground/80",
              )}
            >
              al mes
            </span>
          </div>
          <p
            className={cn(
              "mb-4 text-sm",
              "text-muted-foreground",
            )}
          >
            {pricing.instalments} mensualidades domiciliadas · MXN + IVA
          </p>

          <div
            className={cn(
              "mb-6 rounded-xl border px-3 py-2.5 text-sm",
              "border-emerald-200 bg-emerald-50 text-foreground",
            )}
          >
            <p>
              o un solo pago {PERIOD_ADJECTIVE[period]} de{" "}
              <strong
                data-testid={`price-${tier.tier}`}
                className="text-base tabular-nums"
              >
                {formatMembershipPrice(pricing.total)}
              </strong>
            </p>
            <p
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold",
                "bg-emerald-600 text-white",
              )}
            >
              Ahorras {formatMembershipPrice(instalmentSavings.amount)} (
              {instalmentSavings.pct}%) vs. pagar mes a mes
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="mb-1 flex items-baseline gap-1.5">
            <span
              data-testid={`price-${tier.tier}`}
              className={cn(
                "text-4xl font-bold tabular-nums",
                "text-foreground",
              )}
            >
              {formatMembershipPrice(pricing.total)}
            </span>
            <span
              className={cn(
                "text-sm",
                "text-muted-foreground",
              )}
            >
              MXN + IVA
            </span>
          </div>
          <p
            className={cn(
              "mb-4 text-sm",
              "text-muted-foreground",
            )}
          >
            Pago único al contratar · equivale a{" "}
            <strong className="tabular-nums">
              {formatMembershipPrice(Math.round(pricing.total / pricing.months))}
            </strong>{" "}
            al mes
          </p>

          <div
            className={cn(
              "mb-6 rounded-xl border px-3 py-2.5 text-sm",
              "border-emerald-200 bg-emerald-50 text-foreground",
            )}
          >
            Ahorras{" "}
            <strong className="tabular-nums">
              {formatMembershipPrice(savings)}
            </strong>{" "}
            ({getPrepaidAnnualSavingsPct(tier.tier)}%) contra el Plan Anual
          </div>
        </>
      )}

      {/* Beneficios */}
      <ul className="mb-8 space-y-3">
        <Benefit>
          Publica <strong>{tier.propertyLimit}</strong> propiedades
        </Benefit>
        <Benefit>
          <strong>{tier.crmSeats}</strong>{" "}
          {tier.crmSeats === 1 ? "cuenta" : "cuentas"} de acceso al CRM
          inmobiliario
        </Benefit>
        {tier.brcDiscountPct > 0 && (
          <Benefit>
            {tier.brcDiscountPct}% de descuento en la emisión de certificados
            BRC
          </Benefit>
        )}
        {tier.videoDiscountPct > 0 && (
          <Benefit soon>
            {tier.videoDiscountPct}% de descuento en videos de propiedades
          </Benefit>
        )}
        {tier.legalTickets > 0 && (
          <Benefit soon>
            {tier.legalTickets} tickets de consultas jurídicas (sólo con Plan
            Anual pagado por anticipado)
          </Benefit>
        )}
        {tier.certifiedProfessionalsNetwork && (
          <Benefit soon>
            Red de profesionales inmobiliarios certificados
          </Benefit>
        )}
        {tier.notaryNetwork && (
          <Benefit soon>
            Red de notarios con convenio
          </Benefit>
        )}
        {tier.legalFormsLibrary && (
          <Benefit soon>
            Biblioteca jurídica: formatos inmobiliarios
          </Benefit>
        )}
      </ul>

      <div className="mt-auto">
        {featured ? (
          <Button
            size="lg"
            className="w-full border-0 font-semibold text-white shadow-md hover:opacity-95"
            style={{ background: BRAND_GRADIENT }}
          >
            Contratar {tier.tier}
          </Button>
        ) : (
          <Button variant="outline" size="lg" className="w-full">
            Contratar {tier.tier}
          </Button>
        )}
      </div>
    </div>
  );

  // PLATINO: borde "eléctrico" animado con el degradado de marca (React Bits).
  if (featured) {
    return (
      <ElectricBorder colors={BRAND_COLORS} chaos={0.1} speed={0.9} borderRadius={16} className="h-full">
        {card}
      </ElectricBorder>
    );
  }
  return card;
}

function Benefit({
  children,
  soon = false,
}: {
  children: React.ReactNode;
  soon?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 shrink-0 rounded-full p-1",
          soon ? "bg-muted text-muted-foreground" : "bg-accent/15 text-accent",
        )}
      >
        {soon ? (
          <Clock3 className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
        )}
      </div>
      <span
        className={cn(
          "text-sm",
          soon ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {children}
        {soon && (
          <span className="ml-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wide opacity-80">
            · próximamente
          </span>
        )}
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabla comparativa                                                  */
/* ------------------------------------------------------------------ */

function ComparisonTable({ period }: { period: MembershipPeriodKey }) {
  const isPrepaid = period === "ANUAL_ANTICIPADO";
  return (
    <div className="mt-16">
      <h3
        className="mb-1 text-center text-2xl font-bold text-foreground"
        style={{ fontFamily: "Barlow, Inter, sans-serif" }}
      >
        Compara las membresías
      </h3>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        {MEMBERSHIP_PERIOD_LABEL[period]} · precios en MXN más IVA
      </p>

      {/*
        The table scrolls inside its own container: on a phone the page itself
        must never scroll sideways. tabindex + role make the scroll region
        reachable and announced for keyboard and screen-reader users.
      */}
      <div
        role="region"
        aria-label="Tabla comparativa de membresías"
        tabIndex={0}
        className="overflow-x-auto rounded-2xl border border-border/60 bg-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">
            Comparativa de precios y beneficios de las seis membresías BitHauss
            para el {MEMBERSHIP_PERIOD_LABEL[period]}.
          </caption>
          <thead>
            <tr className="bg-muted/50">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-semibold text-foreground"
              >
                Membresía
              </th>
              {TIERS.map((tier) => (
                <th
                  key={tier.tier}
                  scope="col"
                  className="px-4 py-3 text-center font-semibold text-foreground"
                >
                  {tier.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/60">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-semibold text-foreground"
              >
                {isPrepaid ? "Pago único al contratar" : "Mensualidad domiciliada"}
              </th>
              {TIERS.map((tier) => {
                const pricing = tier.plans[period];
                return (
                  <td
                    key={tier.tier}
                    data-testid={isPrepaid ? `table-price-${tier.tier}` : undefined}
                    className="px-4 py-3 text-center font-bold tabular-nums text-foreground"
                  >
                    {pricing.instalmentAmount !== null ? (
                      <>
                        {formatMembershipPrice(pricing.instalmentAmount)}
                        <span className="font-normal text-muted-foreground"> /mes</span>
                      </>
                    ) : (
                      formatMembershipPrice(pricing.total)
                    )}
                  </td>
                );
              })}
            </tr>

            {!isPrepaid && (
              <tr className="border-t border-border/60 bg-emerald-50/60">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-emerald-50/60 px-4 py-3 text-left font-medium text-foreground"
                >
                  Un solo pago {PERIOD_ADJECTIVE[period]}
                  <span className="block text-xs font-normal text-emerald-700">
                    Conviene: ahorras vs. mes a mes
                  </span>
                </th>
                {TIERS.map((tier) => {
                  const pricing = tier.plans[period];
                  const saving = getInstalmentSavings(pricing);
                  return (
                    <td
                      key={tier.tier}
                      data-testid={`table-price-${tier.tier}`}
                      className="px-4 py-3 text-center tabular-nums text-foreground"
                    >
                      <span className="font-bold">{formatMembershipPrice(pricing.total)}</span>
                      <span className="block text-xs font-semibold text-emerald-700">
                        −{formatMembershipPrice(saving.amount)} ({saving.pct}%)
                      </span>
                    </td>
                  );
                })}
              </tr>
            )}

            {MEMBERSHIP_BENEFIT_ROWS.map((row) => (
              <tr key={row.key} className="border-t border-border/60">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-medium text-foreground"
                >
                  {row.label}
                  {row.inDevelopment && (
                    <span className="ml-2 whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Próximamente
                    </span>
                  )}
                </th>
                {TIERS.map((tier) => (
                  <td key={tier.tier} className="px-4 py-3 text-center">
                    <BenefitCell
                      kind={row.kind}
                      value={benefitValue(tier, row.key)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BenefitCell({
  kind,
  value,
}: {
  kind: "number" | "percent" | "boolean";
  value: number | boolean;
}) {
  if (kind === "boolean") {
    return value ? (
      <>
        <Check
          className="mx-auto h-4 w-4 text-accent"
          strokeWidth={3}
          aria-hidden="true"
        />
        <span className="sr-only">Incluido</span>
      </>
    ) : (
      <>
        <Minus
          className="mx-auto h-4 w-4 text-muted-foreground/40"
          aria-hidden="true"
        />
        <span className="sr-only">No incluido</span>
      </>
    );
  }

  if (value === 0) {
    return (
      <>
        <Minus
          className="mx-auto h-4 w-4 text-muted-foreground/40"
          aria-hidden="true"
        />
        <span className="sr-only">No incluido</span>
      </>
    );
  }

  return (
    <span className="font-semibold tabular-nums text-foreground">
      {kind === "percent"
        ? `${value}%`
        : new Intl.NumberFormat("es-MX").format(value as number)}
    </span>
  );
}
