import { describe, it, expect } from "vitest";
import {
  bestMembershipTier,
  calculateBrcPrice,
  findTariffBracket,
  grossUpForGateway,
  membershipDiscountFor,
  resolvePropertyValue,
  roundMoney,
  stripeFeeOn,
  toMxn,
} from "./brc-pricing";
import {
  IVA_RATE,
  STRIPE_MX_CARD_FIXED_MXN,
  STRIPE_MX_CARD_PCT,
  USD_TO_MXN_FALLBACK_RATE,
} from "@bithauss/config";

/* ------------------------------------------------------------------ */
/*  Tariff brackets — official 2026 table                              */
/* ------------------------------------------------------------------ */

describe("findTariffBracket", () => {
  const cases: Array<[number, number, string]> = [
    [1, 10_000, "HASTA_5M"],
    [4_999_999.99, 10_000, "HASTA_5M"],
    [5_000_000, 10_000, "HASTA_5M"], // inclusive upper bound
    [5_000_000.01, 15_000, "DE_5_10M"], // first peso above tips the bracket
    [7_500_000, 15_000, "DE_5_10M"],
    [10_000_000, 15_000, "DE_5_10M"],
    [10_000_000.01, 20_000, "DE_10_20M"],
    [20_000_000, 20_000, "DE_10_20M"],
    [20_000_000.01, 30_000, "DE_20_30M"],
    [30_000_000, 30_000, "DE_20_30M"],
    [30_000_000.01, 40_000, "DE_30_40M"],
    [40_000_000, 40_000, "DE_30_40M"],
    [40_000_000.01, 50_000, "MAS_40M"],
    [125_000_000, 50_000, "MAS_40M"],
  ];

  it.each(cases)("value %d → %d MXN (%s)", (value, amount, id) => {
    const bracket = findTariffBracket(value);
    expect(bracket.id).toBe(id);
    expect(bracket.amountMxn).toBe(amount);
  });

  it("quotes the cheapest bracket for a non-positive value", () => {
    expect(findTariffBracket(0).id).toBe("HASTA_5M");
    expect(findTariffBracket(Number.NaN).id).toBe("HASTA_5M");
  });
});

/* ------------------------------------------------------------------ */
/*  Property value resolution                                          */
/* ------------------------------------------------------------------ */

describe("resolvePropertyValue", () => {
  it("prefers price_sale over the legacy price column", () => {
    expect(resolvePropertyValue({ price: 1_000_000, price_sale: 8_000_000 })).toBe(
      8_000_000,
    );
  });

  it("falls back to price when price_sale is null", () => {
    expect(resolvePropertyValue({ price: 3_000_000, price_sale: null })).toBe(
      3_000_000,
    );
  });

  it("returns 0 for null, 0, negative and NaN", () => {
    expect(resolvePropertyValue({ price: null, price_sale: null })).toBe(0);
    expect(resolvePropertyValue({ price: 0 })).toBe(0);
    expect(resolvePropertyValue({ price: -5 })).toBe(0);
    expect(resolvePropertyValue({ price: Number.NaN })).toBe(0);
    expect(resolvePropertyValue({})).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Currency conversion                                                */
/* ------------------------------------------------------------------ */

describe("toMxn", () => {
  it("leaves MXN untouched", () => {
    expect(toMxn(5_000_000, "MXN")).toBe(5_000_000);
    expect(toMxn(5_000_000, null)).toBe(5_000_000);
  });

  it("converts USD with the configured rate", () => {
    expect(toMxn(100_000, "USD", 20)).toBe(2_000_000);
    expect(toMxn(100_000, "usd", 20)).toBe(2_000_000);
  });
});

describe("calculateBrcPrice · USD listings", () => {
  it("moves a USD listing into the right MXN bracket", () => {
    // 600,000 USD × 20 = 12 mdp → "De 10 a 20 mdp" → 20,000 MXN
    const result = calculateBrcPrice({
      price: 600_000,
      currency: "USD",
      usdToMxnRate: 20,
    });
    expect(result.propertyValueMxn).toBe(12_000_000);
    expect(result.base).toBe(20_000);
    expect(result.bracketId).toBe("DE_10_20M");
    expect(result.currency).toBe("MXN"); // always charged in pesos
  });

  it("uses the configured fallback rate when none is supplied", () => {
    const result = calculateBrcPrice({ price: 1_000_000, currency: "USD" });
    expect(result.propertyValueMxn).toBe(1_000_000 * USD_TO_MXN_FALLBACK_RATE);
  });

  it("would under-quote if the conversion were skipped", () => {
    // Same nominal number, different currency → different tariff.
    const mxn = calculateBrcPrice({ price: 600_000, currency: "MXN" });
    const usd = calculateBrcPrice({
      price: 600_000,
      currency: "USD",
      usdToMxnRate: 20,
    });
    expect(mxn.base).toBe(10_000);
    expect(usd.base).toBe(20_000);
  });
});

/* ------------------------------------------------------------------ */
/*  Membership discounts                                               */
/* ------------------------------------------------------------------ */

describe("membershipDiscountFor", () => {
  it.each([
    ["GOLD", 0.05],
    ["BLACK", 0.1],
    ["PLATINO", 0.15],
    ["BLUE", 0],
    ["START", 0],
    ["GROW", 0],
  ])("%s → %d", (tier, pct) => {
    expect(membershipDiscountFor(tier)).toBe(pct);
  });

  it("returns 0 for unknown or missing tiers", () => {
    expect(membershipDiscountFor(null)).toBe(0);
    expect(membershipDiscountFor(undefined)).toBe(0);
    expect(membershipDiscountFor("NO_EXISTE")).toBe(0);
  });
});

describe("calculateBrcPrice · discounts", () => {
  it.each([
    [0, 10_000, 0, 10_000],
    [0.05, 10_000, 500, 9_500],
    [0.1, 10_000, 1_000, 9_000],
    [0.15, 10_000, 1_500, 8_500],
  ])(
    "discount %d applies to the base only",
    (pct, base, discount, subtotal) => {
      const result = calculateBrcPrice({
        price: 4_000_000,
        membershipDiscountPct: pct,
      });
      expect(result.base).toBe(base);
      expect(result.discount).toBe(discount);
      expect(result.subtotal).toBe(subtotal);
      expect(result.iva).toBeCloseTo(subtotal * IVA_RATE, 2);
    },
  );

  it("clamps out-of-range discounts instead of producing negative money", () => {
    expect(
      calculateBrcPrice({ price: 1_000_000, membershipDiscountPct: -1 }).discount,
    ).toBe(0);
    const capped = calculateBrcPrice({
      price: 1_000_000,
      membershipDiscountPct: 5,
    });
    expect(capped.discount).toBe(10_000);
    expect(capped.subtotal).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  VAT + gateway gross-up                                             */
/* ------------------------------------------------------------------ */

describe("calculateBrcPrice · IVA and gateway fee", () => {
  it("computes the documented breakdown for the entry bracket", () => {
    const r = calculateBrcPrice({ price: 3_000_000 });
    expect(r.base).toBe(10_000);
    expect(r.subtotal).toBe(10_000);
    expect(r.iva).toBe(1_600);
    // (11600 + 3×1.16) / (1 − 0.036×1.16) rounded up to the cent
    expect(r.total).toBe(12_109.16);
    expect(r.gatewayFee).toBe(509.16);
  });

  it("charges more than subtotal + IVA — the fee is passed to the customer", () => {
    const r = calculateBrcPrice({ price: 45_000_000 });
    expect(r.gatewayFee).toBeGreaterThan(0);
    expect(r.total).toBeGreaterThan(r.subtotal + r.iva);
  });

  it.each([1, 4_999_999, 5_000_000, 6_000_000, 15_000_000, 25_000_000, 35_000_000, 90_000_000])(
    "gross-up invariant holds at %d: Stripe's cut never eats into the net",
    (price) => {
      for (const pct of [0, 0.05, 0.1, 0.15]) {
        const r = calculateBrcPrice({ price, membershipDiscountPct: pct });
        const net = r.total - stripeFeeOn(r.total);
        // BitHauss must be left with at least subtotal + IVA.
        expect(net).toBeGreaterThanOrEqual(r.subtotal + r.iva - 0.000001);
        // …and never overshoot by more than a rounding cent.
        expect(net).toBeLessThanOrEqual(r.subtotal + r.iva + 0.02);
      }
    },
  );

  it("applies VAT on the Stripe commission itself", () => {
    const r = calculateBrcPrice({ price: 3_000_000 });
    const withoutVatOnFee =
      (r.subtotal + r.iva + STRIPE_MX_CARD_FIXED_MXN) / (1 - STRIPE_MX_CARD_PCT);
    // Taxed commission is strictly more expensive than the raw rate.
    expect(r.total).toBeGreaterThan(withoutVatOnFee);
  });

  it("honours a custom VAT rate", () => {
    const r = calculateBrcPrice({ price: 3_000_000, ivaRate: 0.08 });
    expect(r.ivaRate).toBe(0.08);
    expect(r.iva).toBe(800);
  });

  it("keeps every amount rounded to cents", () => {
    const r = calculateBrcPrice({ price: 7_777_777, membershipDiscountPct: 0.15 });
    for (const amount of [r.base, r.discount, r.subtotal, r.iva, r.gatewayFee, r.total]) {
      expect(Number.isFinite(amount)).toBe(true);
      expect(Math.round(amount * 100)).toBeCloseTo(amount * 100, 6);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Missing / zero property value                                      */
/* ------------------------------------------------------------------ */

describe("calculateBrcPrice · missing property value", () => {
  it.each([
    [{ price: null, price_sale: null }],
    [{ price: 0 }],
    [{}],
  ])("flags %o as unusable and quotes the entry bracket", (input) => {
    const r = calculateBrcPrice(input);
    expect(r.hasValidPropertyValue).toBe(false);
    expect(r.propertyValueMxn).toBe(0);
    expect(r.base).toBe(10_000);
    expect(r.total).toBeGreaterThan(0);
  });

  it("flags a usable value as valid", () => {
    expect(calculateBrcPrice({ price: 1 }).hasValidPropertyValue).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Labels                                                             */
/* ------------------------------------------------------------------ */

describe("calculateBrcPrice · labels", () => {
  it("describes closed and open-ended brackets", () => {
    expect(calculateBrcPrice({ price: 3_000_000 }).valueRangeLabel).toContain(
      "Hasta",
    );
    expect(calculateBrcPrice({ price: 7_000_000 }).valueRangeLabel).toContain(
      "De ",
    );
    expect(calculateBrcPrice({ price: 90_000_000 }).valueRangeLabel).toContain(
      "Más de",
    );
    expect(calculateBrcPrice({ price: 7_000_000 }).tariffLabel).toBe(
      "Certificado BRC · De 5 a 10 mdp",
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Presentation plane — the commission is absorbed, never itemised    */
/* ------------------------------------------------------------------ */

const ALL_BRACKET_PRICES = [
  1, 4_999_999, 5_000_000, 5_000_000.01, 7_500_000, 10_000_000,
  10_000_000.01, 15_000_000, 20_000_000.01, 25_000_000, 30_000_000.01,
  35_000_000, 40_000_000, 40_000_000.01, 90_000_000,
];
const ALL_DISCOUNTS = [0, 0.05, 0.1, 0.15];

describe("calculateBrcPrice · display plane", () => {
  it("shows a subtotal that already contains the gateway commission", () => {
    const r = calculateBrcPrice({ price: 3_000_000 });
    expect(r.displaySubtotal).toBe(10_438.93);
    expect(r.displayIva).toBe(1_670.23);
    expect(r.total).toBe(12_109.16);
    // The customer's subtotal is the internal one plus the absorbed fee.
    expect(r.displaySubtotal).toBeGreaterThan(r.subtotal);
    expect(r.displaySubtotal - r.subtotal).toBeCloseTo(
      r.gatewayFee - (r.displayIva - r.iva),
      2,
    );
  });

  it.each(ALL_BRACKET_PRICES)(
    "displaySubtotal + displayIva === total at %d, for every discount",
    (price) => {
      for (const pct of ALL_DISCOUNTS) {
        const r = calculateBrcPrice({ price, membershipDiscountPct: pct });
        // Exact to the cent: the visible lines must reconcile on screen, or
        // the hidden commission could be recovered by subtraction.
        expect(Math.round((r.displaySubtotal + r.displayIva) * 100)).toBe(
          Math.round(r.total * 100),
        );
        // The commission is absorbed into the service price, never added
        // as a separate concept.
        expect(r.displaySubtotal).toBeGreaterThan(r.subtotal);
      }
    },
  );

  it.each(ALL_BRACKET_PRICES)(
    "displayed IVA is the displayed subtotal × the VAT rate at %d",
    (price) => {
      for (const pct of ALL_DISCOUNTS) {
        const r = calculateBrcPrice({ price, membershipDiscountPct: pct });
        // Within a cent: displayIva is taken as the remainder so the total
        // adds up exactly, which can differ from the product by rounding.
        expect(Math.abs(r.displayIva - r.displaySubtotal * r.ivaRate)).toBeLessThanOrEqual(
          0.01,
        );
      }
    },
  );

  it("keeps the discounted lines consistent: base − discount = subtotal", () => {
    for (const pct of [0.05, 0.1, 0.15]) {
      const r = calculateBrcPrice({ price: 25_000_000, membershipDiscountPct: pct });
      expect(Math.round((r.displayBase - r.displayDiscount) * 100)).toBe(
        Math.round(r.displaySubtotal * 100),
      );
      // The displayed discount keeps the advertised percentage.
      expect(r.displayDiscount / r.displayBase).toBeCloseTo(pct, 4);
      // …and is grossed up like everything else.
      expect(r.displayDiscount).toBeGreaterThan(r.discount);
    }
  });

  it("collapses base and subtotal when there is no discount", () => {
    const r = calculateBrcPrice({ price: 3_000_000 });
    expect(r.displayDiscount).toBe(0);
    expect(r.displayBase).toBe(r.displaySubtotal);
  });

  it("does not change the charged total", () => {
    // The display plane is a re-cut of the same money, never a re-price.
    for (const price of ALL_BRACKET_PRICES) {
      const r = calculateBrcPrice({ price });
      expect(r.total).toBe(grossUpForGateway(roundMoney(r.subtotal + r.iva)));
    }
  });

  it("survives a 100% discount without dividing by zero", () => {
    const r = calculateBrcPrice({ price: 3_000_000, membershipDiscountPct: 1 });
    expect(r.subtotal).toBe(0);
    expect(Number.isFinite(r.displaySubtotal)).toBe(true);
    expect(Math.round((r.displaySubtotal + r.displayIva) * 100)).toBe(
      Math.round(r.total * 100),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Mejor nivel entre membresías acumuladas (A6)                       */
/* ------------------------------------------------------------------ */

describe("bestMembershipTier", () => {
  it("elige el nivel con MAYOR descuento, no el primero de la lista", () => {
    // A6: sólo PLATINO acumula, así que un cliente PLATINO puede tener varias
    // filas ACTIVA. Tomar la primera cotizaba el descuento de la acumulada.
    expect(bestMembershipTier(["GOLD", "PLATINO"])).toBe("PLATINO");
    expect(bestMembershipTier(["PLATINO", "GOLD"])).toBe("PLATINO");
    expect(bestMembershipTier(["START", "BLACK", "BLUE"])).toBe("BLACK");
  });

  it("ignora nulos y niveles retirados del MVP", () => {
    expect(bestMembershipTier([null, undefined, ""])).toBeNull();
    expect(bestMembershipTier(["PREMIUM", "GOLD"])).toBe("GOLD");
  });

  it("sin membresías devuelve null y por tanto precio de lista", () => {
    expect(bestMembershipTier([])).toBeNull();
    expect(membershipDiscountFor(bestMembershipTier([]))).toBe(0);
  });

  it("un único nivel sin descuento sigue siendo el nivel del cliente", () => {
    expect(bestMembershipTier(["BLUE"])).toBe("BLUE");
  });
});
