import { formatPrice, parseSearchArgs } from './assistant.prompt';

describe('parseSearchArgs', () => {
  it('keeps valid criteria and defaults limit/radius', () => {
    expect(
      parseSearchArgs(JSON.stringify({ type: 'oficina', operation: 'RENTA', area_min: 80, cerca_de: ' Puerto Cancún ' })),
    ).toEqual({
      criteria: { type: 'OFICINA', operation: 'RENTA', area_min: 80, limit: 5 },
      cercaDe: 'Puerto Cancún',
      radioKm: 3,
    });
  });

  it('drops out-of-enum, negative and non-numeric values', () => {
    const { criteria } = parseSearchArgs(
      JSON.stringify({ type: 'CASTILLO', operation: 'TRASPASO', price_max: -5, bedrooms_min: 'tres', limit: 99 }),
    );
    expect(criteria).toEqual({ limit: 10 });
  });

  it('clamps radio_km', () => {
    expect(parseSearchArgs(JSON.stringify({ radio_km: 900 })).radioKm).toBe(50);
    expect(parseSearchArgs(JSON.stringify({ radio_km: 0.1 })).radioKm).toBe(0.5);
  });

  it('survives malformed JSON', () => {
    expect(parseSearchArgs('{not json').criteria).toEqual({ limit: 5 });
    expect(parseSearchArgs(undefined).criteria).toEqual({ limit: 5 });
  });
});

describe('formatPrice', () => {
  it('formats with thousands separators and currency', () => {
    expect(formatPrice(4500000, 'MXN')).toBe('$4,500,000 MXN');
    expect(formatPrice(1200, 'USD')).toBe('$1,200 USD');
  });
  it('null price (hidden by the owner) is "a consultar"', () => {
    expect(formatPrice(null, 'MXN')).toBe('a consultar');
  });
});
