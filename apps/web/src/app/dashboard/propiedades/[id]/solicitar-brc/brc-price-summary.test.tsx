import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrcPriceSummary } from "./brc-price-summary";
import { calculateBrcPrice } from "@/lib/brc-pricing";
import { BRC_PAYMENT_NO_REFUND_NOTICE } from "@bithauss/config";

/** The exact wording legal signed off on. Any drift must fail the build. */
const LEGAL_TEXT =
  "Una vez completada la transacción y autorizado el pago, el servicio de certificación inmobiliaria se considerará iniciado. Al tratarse de la prestación de un servicio digital de inicio inmediato al pago, el usuario renuncia a su derecho de desistimiento, por lo que no se realizarán reembolsos ni cancelaciones bajo ninguna circunstancia.";

function renderSummary(overrides: Partial<React.ComponentProps<typeof BrcPriceSummary>> = {}) {
  const breakdown = calculateBrcPrice({
    price: 7_500_000,
    currency: "MXN",
    membershipDiscountPct: 0,
  });
  const props = {
    breakdown,
    propertyValue: 7_500_000,
    propertyCurrency: "MXN",
    stripeConfigured: true,
    onPay: vi.fn(),
    ...overrides,
  };
  return { ...render(<BrcPriceSummary {...props} />), props };
}

describe("BrcPriceSummary · breakdown", () => {
  it("renders the customer-facing lines: service, IVA and total", () => {
    renderSummary();
    expect(screen.getByText("Certificación BRC")).toBeInTheDocument();
    expect(screen.getByText("IVA (16%)")).toBeInTheDocument();
    expect(screen.getByText("Total a pagar")).toBeInTheDocument();
  });

  it("NEVER mentions the payment-gateway commission", () => {
    const { container } = renderSummary();
    const text = container.textContent ?? "";
    // The fee is absorbed into the service price by client decision. Any of
    // these words appearing in the breakdown is a regression.
    expect(text).not.toMatch(/comisi[oó]n/i);
    expect(text).not.toMatch(/pasarela/i);
    expect(text).not.toMatch(/stripe/i);
    expect(text).not.toMatch(/procesamiento/i);
    expect(screen.queryByText(/Costo BRC \(base\)/)).not.toBeInTheDocument();
  });

  it("never prints the internal amounts that would reveal the fee", () => {
    const { container, props } = renderSummary();
    const text = container.textContent ?? "";
    const money = (n: number) =>
      new Intl.NumberFormat("es-MX", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    // 15,000.00 (base), 2,400.00 (internal IVA) and 636.68 (fee) must not
    // appear anywhere on screen.
    expect(text).not.toContain(money(props.breakdown.gatewayFee));
    expect(text).not.toContain(money(props.breakdown.iva));
  });

  it("shows lines that add up exactly to the total", () => {
    const { props } = renderSummary();
    const { displaySubtotal, displayIva, total } = props.breakdown;
    expect(Math.round((displaySubtotal + displayIva) * 100)).toBe(
      Math.round(total * 100),
    );
    // …and the visible subtotal already carries the commission.
    expect(displaySubtotal).toBeGreaterThan(props.breakdown.subtotal);
  });

  it("shows the applied bracket and the property value used", () => {
    renderSummary();
    expect(screen.getByText(/Certificado BRC · De 5 a 10 mdp/)).toBeInTheDocument();
    expect(screen.getByText(/Rango aplicado:/)).toBeInTheDocument();
    expect(screen.getByText(/\$5,000,000 a \$10,000,000 MXN/)).toBeInTheDocument();
    expect(screen.getByText(/\$7,500,000/)).toBeInTheDocument();
  });

  it("shows the charged total, which is above the internal subtotal + IVA", () => {
    const { props } = renderSummary();
    const total = screen.getByTestId("brc-total").textContent ?? "";
    const numeric = Number(total.replace(/[^0-9.]/g, ""));
    expect(numeric).toBeCloseTo(props.breakdown.total, 2);
    expect(numeric).toBeGreaterThan(
      props.breakdown.subtotal + props.breakdown.iva,
    );
  });

  it("hides the discount row when there is no membership discount", () => {
    renderSummary();
    expect(screen.queryByText(/Descuento membresía/)).not.toBeInTheDocument();
    expect(screen.queryByText("Subtotal")).not.toBeInTheDocument();
  });

  it("shows the discount row with the tier name when a discount applies", () => {
    const breakdown = calculateBrcPrice({
      price: 7_500_000,
      membershipDiscountPct: 0.1,
    });
    renderSummary({ breakdown, membershipTier: "BLACK" });
    expect(
      screen.getByText("Descuento membresía BLACK (10%)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    // The discounted lines still reconcile: base − discount = subtotal.
    expect(
      Math.round(
        (breakdown.displayBase - breakdown.displayDiscount) * 100,
      ),
    ).toBe(Math.round(breakdown.displaySubtotal * 100));
    // …and the discount shown is grossed up, not the raw internal one.
    expect(breakdown.displayDiscount).toBeGreaterThan(breakdown.discount);
  });

  it("keeps the commission hidden even with a discount applied", () => {
    const breakdown = calculateBrcPrice({
      price: 7_500_000,
      membershipDiscountPct: 0.15,
    });
    const { container } = renderSummary({ breakdown, membershipTier: "PLATINO" });
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/comisi[oó]n|pasarela|stripe/i);
  });

  it("explains the MXN equivalent for a USD listing", () => {
    const breakdown = calculateBrcPrice({
      price: 600_000,
      currency: "USD",
      usdToMxnRate: 20,
    });
    renderSummary({
      breakdown,
      propertyValue: 600_000,
      propertyCurrency: "USD",
    });
    expect(screen.getByText(/equivalente a/)).toBeInTheDocument();
    expect(screen.getByText(/\$12,000,000 MXN/)).toBeInTheDocument();
  });

  it("warns when the property has no usable price", () => {
    const breakdown = calculateBrcPrice({ price: 0 });
    renderSummary({ breakdown, propertyValue: 0 });
    expect(
      screen.getByText(/no tiene un precio de venta registrado/i),
    ).toBeInTheDocument();
  });
});

describe("BrcPriceSummary · legal notice", () => {
  it("renders the legal text verbatim", () => {
    renderSummary();
    expect(screen.getByText(LEGAL_TEXT)).toBeInTheDocument();
    // Guards the shared constant against edits too.
    expect(BRC_PAYMENT_NO_REFUND_NOTICE).toBe(LEGAL_TEXT);
  });

  it("places the notice after the pay button and links it via aria-describedby", () => {
    renderSummary();
    const button = screen.getByRole("button", {
      name: /Pagar y solicitar certificación/i,
    });
    const notice = screen.getByText(LEGAL_TEXT);
    expect(button.getAttribute("aria-describedby")).toBe(notice.id);
    // DOCUMENT_POSITION_FOLLOWING === 4: the notice comes after the button.
    expect(
      button.compareDocumentPosition(notice) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the notice visible even when Stripe is unavailable", () => {
    renderSummary({ stripeConfigured: false });
    expect(screen.getByText(LEGAL_TEXT)).toBeInTheDocument();
  });
});

describe("BrcPriceSummary · payment CTA", () => {
  it("calls onPay when Stripe is configured", async () => {
    const onPay = vi.fn();
    renderSummary({ onPay });
    await userEvent.click(
      screen.getByRole("button", { name: /Pagar y solicitar certificación/i }),
    );
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it("degrades gracefully when Stripe is not configured", async () => {
    const onPay = vi.fn();
    renderSummary({ stripeConfigured: false, onPay });

    const button = screen.getByRole("button", {
      name: /Pagar y solicitar certificación/i,
    });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(
        /Pago en línea en configuración; contáctanos para completar tu pago\./,
      ),
    ).toBeInTheDocument();

    await userEvent.click(button);
    expect(onPay).not.toHaveBeenCalled();
  });

  it("does not show the degraded notice when Stripe is configured", () => {
    renderSummary();
    expect(
      screen.queryByText(/Pago en línea en configuración/),
    ).not.toBeInTheDocument();
  });

  it("blocks the CTA while a submission is in flight", () => {
    renderSummary({ submitting: true });
    expect(screen.getByText("Procesando...")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("blocks the CTA while the draft is being saved", () => {
    renderSummary({ disabled: true });
    expect(
      screen.getByRole("button", { name: /Pagar y solicitar certificación/i }),
    ).toBeDisabled();
  });
});
