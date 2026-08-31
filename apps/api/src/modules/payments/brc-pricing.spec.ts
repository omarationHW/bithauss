import {
  calculateBrcPrice,
  findTariffBracket,
  membershipDiscountFor,
  stripeFeeOn,
  toClientBreakdown,
  toStripeMinorUnits,
} from './brc-pricing';

/**
 * These assertions intentionally duplicate
 * `apps/web/src/lib/brc-pricing.test.ts`: the API mirror must never drift
 * from the numbers the UI quotes.
 */

describe('brc-pricing (server mirror) · brackets', () => {
  it.each([
    [1, 10_000, 'HASTA_5M'],
    [5_000_000, 10_000, 'HASTA_5M'],
    [5_000_000.01, 15_000, 'DE_5_10M'],
    [10_000_000, 15_000, 'DE_5_10M'],
    [10_000_000.01, 20_000, 'DE_10_20M'],
    [20_000_000, 20_000, 'DE_10_20M'],
    [20_000_000.01, 30_000, 'DE_20_30M'],
    [30_000_000, 30_000, 'DE_20_30M'],
    [30_000_000.01, 40_000, 'DE_30_40M'],
    [40_000_000, 40_000, 'DE_30_40M'],
    [40_000_000.01, 50_000, 'MAS_40M'],
  ])('value %d → %d MXN (%s)', (value, amount, id) => {
    const bracket = findTariffBracket(value as number);
    expect(bracket).toBeDefined();
    expect(bracket.id).toBe(id);
    expect(bracket.amountMxn).toBe(amount);
  });
});

describe('brc-pricing (server mirror) · totals', () => {
  it('matches the documented breakdown for the entry bracket', () => {
    const r = calculateBrcPrice({ price: 3_000_000 });
    expect(r.base).toBe(10_000);
    expect(r.iva).toBe(1_600);
    expect(r.total).toBe(12_109.16);
    expect(r.gatewayFee).toBe(509.16);
  });

  it.each([0, 0.05, 0.1, 0.15])(
    'keeps the net at or above subtotal + IVA with a %d discount',
    (pct) => {
      for (const price of [1, 5_000_000, 12_000_000, 45_000_000]) {
        const r = calculateBrcPrice({ price, membershipDiscountPct: pct });
        const net = r.total - stripeFeeOn(r.total);
        expect(net).toBeGreaterThanOrEqual(r.subtotal + r.iva - 0.000001);
      }
    },
  );

  it('reads discounts from the tier table', () => {
    expect(membershipDiscountFor('GOLD')).toBe(0.05);
    expect(membershipDiscountFor('BLACK')).toBe(0.1);
    expect(membershipDiscountFor('PLATINO')).toBe(0.15);
    expect(membershipDiscountFor('BLUE')).toBe(0);
    expect(membershipDiscountFor(null)).toBe(0);
  });

  it('converts USD listings before choosing a bracket', () => {
    const r = calculateBrcPrice({
      price_sale: 600_000,
      currency: 'USD',
      usdToMxnRate: 20,
    });
    expect(r.propertyValueMxn).toBe(12_000_000);
    expect(r.base).toBe(20_000);
  });

  it('flags a missing price and still quotes the entry bracket', () => {
    const r = calculateBrcPrice({ price: null, price_sale: null });
    expect(r.hasValidPropertyValue).toBe(false);
    expect(r.base).toBe(10_000);
  });
});

describe('toStripeMinorUnits', () => {
  it('converts pesos to integer centavos', () => {
    expect(toStripeMinorUnits(12_109.16)).toBe(1_210_916);
    expect(toStripeMinorUnits(0.1 + 0.2)).toBe(30); // no float drift
    expect(Number.isInteger(toStripeMinorUnits(9_999.995))).toBe(true);
  });
});

describe('brc-pricing (server mirror) · display plane', () => {
  it.each([1, 5_000_000.01, 12_000_000, 25_000_000, 45_000_000])(
    'visible lines add up to the total at %d, for every discount',
    (price) => {
      for (const pct of [0, 0.05, 0.1, 0.15]) {
        const r = calculateBrcPrice({ price, membershipDiscountPct: pct });
        expect(Math.round((r.displaySubtotal + r.displayIva) * 100)).toBe(
          Math.round(r.total * 100),
        );
        expect(r.displaySubtotal).toBeGreaterThan(r.subtotal);
      }
    },
  );

  it('matches the web module for the reference quote', () => {
    const r = calculateBrcPrice({ price: 3_000_000 });
    expect(r.displaySubtotal).toBe(10_438.93);
    expect(r.displayIva).toBe(1_670.23);
  });

  it('strips the accounting plane from the client projection', () => {
    const client = toClientBreakdown(calculateBrcPrice({ price: 3_000_000 }));
    // The commission must not be recoverable from an API response either.
    expect(client).not.toHaveProperty('gatewayFee');
    expect(client).not.toHaveProperty('base');
    expect(client).not.toHaveProperty('discount');
    expect(client).not.toHaveProperty('subtotal');
    expect(client).not.toHaveProperty('iva');
    expect(client.total).toBe(12_109.16);
    expect(client.displaySubtotal).toBe(10_438.93);
  });
});
