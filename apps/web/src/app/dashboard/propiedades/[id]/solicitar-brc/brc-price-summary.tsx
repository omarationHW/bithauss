"use client";

/**
 * Payment summary for the BRC request screen.
 *
 * Presentational on purpose: it takes an already-computed breakdown so it can
 * be unit-tested without Supabase, routing or the user context. The page owns
 * the data fetching; this component owns the money layout, the pay CTA and
 * the legal notice that must sit directly under it.
 *
 * IMPORTANT — it renders ONLY the presentation plane of the breakdown
 * (`displayBase`, `displayDiscount`, `displaySubtotal`, `displayIva`,
 * `total`). The payment-gateway commission is absorbed into the service price
 * by client decision and must never appear as a line, a label or a tooltip.
 * `breakdown.base`, `.subtotal`, `.iva` and above all `.gatewayFee` are
 * accounting figures: rendering any of them would expose the fee by
 * subtraction. VAT stays visible — it is a tax and belongs on the receipt.
 */

import { Loader2, Info, CreditCard, AlertCircle } from "lucide-react";
import { BRC_PAYMENT_NO_REFUND_NOTICE } from "@bithauss/config";
import { formatMoney, type BrcPriceBreakdown } from "@/lib/brc-pricing";

const LEGAL_NOTICE_ID = "brc-payment-legal-notice";

export interface BrcPriceSummaryProps {
  breakdown: BrcPriceBreakdown;
  /** Listing price as captured on the property (may be USD). */
  propertyValue: number;
  /** Listing currency, used to explain where the tariff came from. */
  propertyCurrency: string;
  /** Membership tier that produced the discount, for the discount row label. */
  membershipTier?: string | null;
  /** False when the Stripe env vars are missing — degrades the CTA. */
  stripeConfigured: boolean;
  /** Payment/submission in flight. */
  submitting?: boolean;
  /** Extra reason to block the CTA (e.g. another action running). */
  disabled?: boolean;
  onPay: () => void;
  /** Where "contáctanos" points while online payment is unavailable. */
  contactHref?: string;
}

function Row({
  label,
  value,
  hint,
  emphasis = false,
  negative = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p
          className={`text-sm ${emphasis ? "font-semibold text-gray-900" : "text-gray-700"}`}
        >
          {label}
        </p>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
      <p
        className={`shrink-0 tabular-nums ${
          emphasis
            ? "text-sm font-semibold text-gray-900"
            : negative
              ? "text-sm font-medium text-emerald-700"
              : "text-sm text-gray-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function BrcPriceSummary({
  breakdown,
  propertyValue,
  propertyCurrency,
  membershipTier,
  stripeConfigured,
  submitting = false,
  disabled = false,
  onPay,
  contactHref = "mailto:contacto@bithauss.com",
}: BrcPriceSummaryProps) {
  const ivaLabel = `IVA (${Math.round(breakdown.ivaRate * 100)}%)`;
  const hasDiscount = breakdown.displayDiscount > 0;
  const discountLabel = membershipTier
    ? `Descuento membresía ${membershipTier} (${Math.round(breakdown.membershipDiscountPct * 100)}%)`
    : `Descuento membresía (${Math.round(breakdown.membershipDiscountPct * 100)}%)`;

  const showConversion =
    propertyCurrency?.toUpperCase() === "USD" && propertyValue > 0;

  const ctaDisabled = !stripeConfigured || submitting || disabled;

  return (
    <section
      aria-labelledby="brc-price-summary-title"
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <h3
        id="brc-price-summary-title"
        className="text-lg font-bold text-gray-900"
        style={{ fontFamily: "Barlow, Inter, sans-serif" }}
      >
        Costo de la certificación
      </h3>

      {/* Where the tariff comes from, so the price is never a black box. */}
      <p className="mt-1 text-sm text-gray-600">
        {breakdown.tariffLabel}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Rango aplicado: <span className="font-medium">{breakdown.valueRangeLabel}</span>
        {" · "}
        Valor de la propiedad:{" "}
        <span className="font-medium">
          {formatMoney(propertyValue, propertyCurrency || "MXN")} {propertyCurrency || "MXN"}
        </span>
        {showConversion && (
          <>
            {" "}
            (equivalente a {formatMoney(breakdown.propertyValueMxn)} MXN)
          </>
        )}
      </p>

      {!breakdown.hasValidPropertyValue && (
        <div
          role="note"
          className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-900">
            La propiedad no tiene un precio de venta registrado, por lo que se
            muestra la tarifa mínima. Actualiza el precio para calcular el costo
            exacto.
          </p>
        </div>
      )}

      {/* ---- Breakdown (presentation plane only) ---- */}
      {/* Without a discount there is a single service line, so the list price
          and the subtotal would be the same number twice; with one, both are
          shown so the discount has something to subtract from. Either way the
          visible lines add up exactly to the total. */}
      <div className="mt-4 divide-y divide-gray-100 rounded-xl bg-gray-50 px-4 py-1">
        {hasDiscount ? (
          <>
            <Row
              label="Certificación BRC"
              value={formatMoney(breakdown.displayBase, "MXN", { cents: true })}
            />
            <Row
              label={discountLabel}
              value={`− ${formatMoney(breakdown.displayDiscount, "MXN", { cents: true })}`}
              negative
            />
            <Row
              label="Subtotal"
              value={formatMoney(breakdown.displaySubtotal, "MXN", { cents: true })}
              emphasis
            />
          </>
        ) : (
          <Row
            label="Certificación BRC"
            value={formatMoney(breakdown.displaySubtotal, "MXN", { cents: true })}
            emphasis
          />
        )}
        <Row
          label={ivaLabel}
          value={formatMoney(breakdown.displayIva, "MXN", { cents: true })}
        />
      </div>

      {/* ---- Total ---- */}
      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Total a pagar</p>
          <p className="text-xs text-gray-600">Pago único, en {breakdown.currency}</p>
        </div>
        <p
          className="text-2xl font-bold tabular-nums"
          style={{ color: "hsl(221 83% 45%)" }}
          data-testid="brc-total"
        >
          {formatMoney(breakdown.total, breakdown.currency, { cents: true })}
        </p>
      </div>

      {/* ---- Pay CTA ---- */}
      <div className="mt-5">
        <button
          type="button"
          onClick={onPay}
          disabled={ctaDisabled}
          aria-describedby={LEGAL_NOTICE_ID}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
          style={{
            background:
              "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
          }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Pagar y solicitar certificación
            </>
          )}
        </button>

        {!stripeConfigured && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Pago en línea en configuración; contáctanos para completar tu pago.{" "}
              <a
                href={contactHref}
                className="font-semibold underline underline-offset-2"
              >
                Escríbenos
              </a>{" "}
              y te ayudamos a cerrar tu solicitud. Puedes seguir guardando tu
              expediente mientras tanto.
            </span>
          </p>
        )}

        {/* Legal notice — verbatim, reviewed by legal. Must stay directly
            below the pay button and stay readable (AA contrast). */}
        <p
          id={LEGAL_NOTICE_ID}
          className="mt-4 text-xs leading-relaxed text-gray-700"
        >
          {BRC_PAYMENT_NO_REFUND_NOTICE}
        </p>
      </div>
    </section>
  );
}
