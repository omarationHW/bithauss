import 'reflect-metadata';

import { PropertiesService } from './properties.service';
import type { SupabaseConfigService } from '../../config/supabase.config';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

// Zócalo, CDMX
const CENTER = { lat: 19.4326, lng: -99.1332 };

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    title: 'Departamento en el Centro',
    type: 'DEPARTAMENTO',
    operation: 'VENTA',
    price: '3500000.00', // PostgREST returns numeric as string
    price_sale: null,
    price_rent: null,
    currency: 'MXN',
    show_price: true,
    show_address: true,
    area_built: '90.00',
    area_total: '100.00',
    bedrooms: 2,
    bathrooms: 1,
    parking_spaces: 1,
    neighborhood: 'Centro',
    city: 'Ciudad de México',
    state: 'CDMX',
    latitude: CENTER.lat,
    longitude: CENTER.lng,
    featured_image_url: 'https://cdn.example/foto.jpg',
    published_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

type Call = [string, ...unknown[]];

/**
 * Minimal PostgREST-shaped stub. Each query records its builder calls and
 * resolves (on `.limit()`) with the next canned response, so a test can play
 * out the relaxation sequence query by query.
 */
function makeSupabase(responses: Record<string, unknown>[][]) {
  const queries: Call[][] = [];
  const client = {
    from(table: string) {
      const calls: Call[] = [['from', table]];
      queries.push(calls);
      const index = queries.length - 1;
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'or', 'gte', 'lte', 'ilike', 'textSearch', 'order']) {
        builder[method] = (...args: unknown[]) => {
          calls.push([method, ...args]);
          return builder;
        };
      }
      builder.limit = async (n: number) => {
        calls.push(['limit', n]);
        return { data: responses[index] ?? [], error: null };
      };
      return builder;
    },
  };
  const config = { getAdminClient: () => client } as unknown as SupabaseConfigService;
  return { service: new PropertiesService(config), queries };
}

const callsOf = (calls: Call[], method: string) => calls.filter((c) => c[0] === method);

/** Indexed access that fails loudly (the repo uses noUncheckedIndexedAccess). */
function nth<T>(items: readonly T[], i: number): T {
  const item = items[i];
  if (item === undefined) throw new Error(`missing item ${i} of ${items.length}`);
  return item;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('PropertiesService.searchForAssistant', () => {
  it('siempre filtra status = PUBLICADO y pide columnas públicas acotadas', async () => {
    const { service, queries } = makeSupabase([[row()]]);
    await service.searchForAssistant({});

    const q = nth(queries, 0);
    expect(q).toContainEqual(['eq', 'status', 'PUBLICADO']);
    const [, columns, opts] = nth(callsOf(q, 'select'), 0);
    expect(opts).toBeUndefined(); // sin count: 'exact'
    for (const priv of ['owner_id', 'company_id', 'address_line', 'zip_code', 'brc_', 'email', 'phone', '*']) {
      expect(columns as string).not.toContain(priv);
    }
    expect(nth(callsOf(q, 'limit'), 0)[1]).toBe(50);
  });

  it('nunca devuelve campos privados aunque la fila los traiga', async () => {
    const leaky = row({ owner_id: 'u-1', company_id: 'c-1', address_line: 'Calle 1', brc_status: 'CERTIFICADO' });
    const { service } = makeSupabase([[leaky]]);
    const { hits } = await service.searchForAssistant({});

    expect(Object.keys(nth(hits, 0)).sort()).toEqual(
      [
        'id', 'title', 'type', 'operation', 'price', 'currency', 'area_m2', 'bedrooms',
        'bathrooms', 'parking_spaces', 'neighborhood', 'city', 'state', 'latitude',
        'longitude', 'distance_km', 'featured_image_url', 'url_path',
      ].sort(),
    );
    expect(nth(hits, 0).url_path).toBe('/propiedades/p-1');
    expect(nth(hits, 0).price).toBe(3_500_000);
  });

  it('respeta show_price y show_address del dueño', async () => {
    const { service } = makeSupabase([[row({ show_price: false, show_address: false })]]);
    const { hits } = await service.searchForAssistant({ near: { ...CENTER, radius_km: 2 } });
    expect(nth(hits, 0).price).toBeNull();
    expect(nth(hits, 0).latitude).toBeNull();
    expect(nth(hits, 0).longitude).toBeNull();
    expect(nth(hits, 0).distance_km).toBe(1); // aproximada, no exacta
  });

  it('el área usa area_built y cae a area_total cuando es null', async () => {
    const { service, queries } = makeSupabase([
      [row({ id: 'a', area_built: null, area_total: '120.5' }), row({ id: 'b' })],
    ]);
    const { hits } = await service.searchForAssistant({ area_min: 80, area_max: 130 });

    expect(nth(queries, 0)).toContainEqual([
      'or',
      'and(area_built.gte.80,area_built.lte.130),and(area_built.is.null,area_total.gte.80,area_total.lte.130)',
    ]);
    const a = hits.find((h) => h.id === 'a')!;
    expect(a.area_m2).toBe(120.5);
    expect(hits.find((h) => h.id === 'b')!.area_m2).toBe(90);
  });

  it('sin near, ordena por cercanía al área pedida', async () => {
    const { service } = makeSupabase([
      [
        row({ id: 'lejos', area_built: '200' }),
        row({ id: 'sin-area', area_built: null, area_total: null }),
        row({ id: 'cerca', area_built: '105' }),
      ],
    ]);
    const { hits } = await service.searchForAssistant({ area_min: 100 });
    expect(hits.map((h) => h.id)).toEqual(['cerca', 'lejos', 'sin-area']);
  });

  it('near: caja lat/lng en la consulta, radio exacto en JS y orden por distancia', async () => {
    const { service, queries } = makeSupabase([
      [
        row({ id: 'a-3km', latitude: CENTER.lat + 0.027, longitude: CENTER.lng }),
        row({ id: 'a-1km', latitude: CENTER.lat + 0.009, longitude: CENTER.lng }),
        // Esquina de la caja: dentro del rectángulo, fuera del círculo de 5 km.
        row({ id: 'esquina', latitude: CENTER.lat + 0.04, longitude: CENTER.lng + 0.042 }),
      ],
    ]);
    const { hits } = await service.searchForAssistant({ near: { ...CENTER, radius_km: 5 } });

    const or = callsOf(nth(queries, 0), 'or').map((c) => c[1] as string);
    expect(or).toHaveLength(1);
    expect(nth(or, 0)).toMatch(/^and\(latitude\.gte\.[\d.]+,latitude\.lte\.[\d.]+,longitude\.gte\.-[\d.]+,longitude\.lte\.-[\d.]+\)$/);
    expect(hits.map((h) => h.id)).toEqual(['a-1km', 'a-3km']);
    expect(nth(hits, 0).distance_km).toBeCloseTo(1, 0);
    // Con near, la ciudad no restringe las filas geolocalizadas.
    expect(callsOf(nth(queries, 0), 'ilike')).toHaveLength(0);
  });

  it('near + colonia: incluye sin coordenadas que coinciden en texto, después y sin distancia', async () => {
    const { service, queries } = makeSupabase([
      [
        row({ id: 'sin-coords', latitude: null, longitude: null }),
        row({ id: 'geo', latitude: CENTER.lat + 0.01 }),
      ],
    ]);
    const { hits } = await service.searchForAssistant({
      near: { ...CENTER, radius_km: 3 },
      neighborhood: 'Roma, Norte*)',
    });

    const or = nth(callsOf(nth(queries, 0), 'or'), 0)[1] as string;
    expect(or).toContain('and(or(latitude.is.null,longitude.is.null),neighborhood.ilike."*Roma Norte*")');
    expect(hits.map((h) => [h.id, h.distance_km === null])).toEqual([
      ['geo', false],
      ['sin-coords', true],
    ]);
  });

  it('relaja en orden acumulativo: área, radio, precio, palabras clave', async () => {
    const { service, queries } = makeSupabase([[], [], [], [], [row()]]);
    const result = await service.searchForAssistant({
      type: 'DEPARTAMENTO',
      operation: 'RENTA',
      area_min: 100,
      area_max: 100,
      near: { ...CENTER, radius_km: 2 },
      price_max: 20_000,
      keywords: 'vista al mar',
    });

    expect(queries).toHaveLength(5);
    expect(result.relaxed).toBe(true);
    expect(result.relaxed_fields).toEqual(['area', 'radius', 'price', 'keywords']);

    // Nunca se relaja tipo ni operación.
    for (const q of queries) {
      expect(q).toContainEqual(['eq', 'type', 'DEPARTAMENTO']);
      expect(q).toContainEqual(['in', 'operation', ['RENTA', 'VENTA_RENTA']]);
      expect(q).toContainEqual(['eq', 'status', 'PUBLICADO']);
    }
    const ors = (i: number) => callsOf(nth(queries, i), 'or').map((c) => c[1] as string);
    expect(nth(ors(0), 0)).toContain('area_built.gte.100,area_built.lte.100');
    expect(nth(ors(1), 0)).toContain('area_built.gte.80,area_built.lte.120');
    // Precio de renta con respaldo en `price`; +15% en el paso 3.
    expect(nth(ors(2), 1)).toBe('and(price_rent.lte.20000),and(price_rent.is.null,price.lte.20000)');
    expect(nth(ors(3), 1)).toBe('and(price_rent.lte.23000),and(price_rent.is.null,price.lte.23000)');
    // El radio se duplicó: la caja del paso 2 es más ancha.
    const latSpan = (s: string) => {
      const m = s.match(/latitude\.gte\.([\d.]+),latitude\.lte\.([\d.]+)/)!;
      return Number(m[2]) - Number(m[1]);
    };
    expect(latSpan(nth(ors(2), 2))).toBeCloseTo(2 * latSpan(nth(ors(1), 2)), 6);
    expect(callsOf(nth(queries, 3), 'textSearch')).toEqual([
      ['textSearch', 'search_vector', 'vista al mar', { type: 'websearch', config: 'spanish' }],
    ]);
    expect(callsOf(nth(queries, 4), 'textSearch')).toHaveLength(0);
  });

  it('último recurso: cualquier área, ordenada por la más parecida', async () => {
    const { service, queries } = makeSupabase([
      [],
      [],
      [row({ id: 'grande', area_built: '527' }), row({ id: 'mediana', area_built: '300' })],
    ]);
    const result = await service.searchForAssistant({ type: 'OFICINA', area_min: 100, area_max: 100 });

    expect(queries).toHaveLength(3);
    expect(result.relaxed_fields).toEqual(['area', 'area_any']);
    // Sin filtro de área en la última consulta, pero con tipo intacto.
    expect(callsOf(nth(queries, 2), 'or')).toHaveLength(0);
    expect(nth(queries, 2)).toContainEqual(['eq', 'type', 'OFICINA']);
    expect(result.hits.map((h) => h.id)).toEqual(['mediana', 'grande']);
  });

  it('se detiene en el primer resultado no vacío y salta pasos que no aplican', async () => {
    const { service, queries } = makeSupabase([[], [row()]]);
    const result = await service.searchForAssistant({ price_min: 1_000_000, keywords: 'alberca' });
    expect(queries).toHaveLength(2);
    expect(result.relaxed_fields).toEqual(['price']);
    expect(callsOf(nth(queries, 1), 'gte')).toContainEqual(['gte', 'price', 850_000]);
  });

  it('sin relajación cuando hay coincidencia exacta', async () => {
    const { service, queries } = makeSupabase([[row()]]);
    const result = await service.searchForAssistant({ area_min: 50 });
    expect(queries).toHaveLength(1);
    expect(result).toMatchObject({ relaxed: false, relaxed_fields: [] });
  });

  it('el radio relajado nunca pasa de 25 km', async () => {
    const { service, queries } = makeSupabase([[], []]);
    await service.searchForAssistant({ near: { ...CENTER, radius_km: 20 } });
    const span = (i: number) => {
      const [, lo, hi] = (nth(callsOf(nth(queries, i), 'or'), 0)[1] as string).match(
        /latitude\.gte\.([\d.]+),latitude\.lte\.([\d.]+)/,
      )!;
      return Number(hi) - Number(lo);
    };
    expect(span(1) / span(0)).toBeCloseTo(25 / 20, 6);
  });

  it('acota limit a 1..10, 5 por defecto', async () => {
    const many = Array.from({ length: 20 }, (_, i) => row({ id: `p-${i}` }));
    const count = async (limit?: number) => {
      const { service } = makeSupabase([many]);
      return (await service.searchForAssistant({ limit })).hits.length;
    };
    expect(await count()).toBe(5);
    expect(await count(0)).toBe(1);
    expect(await count(-3)).toBe(1);
    expect(await count(50)).toBe(10);
    expect(await count(7)).toBe(7);
  });

  it('sanea texto de ubicación y palabras clave', async () => {
    const { service, queries } = makeSupabase([[row()]]);
    await service.searchForAssistant({ city: 'Mérida%_,()', keywords: 'obra & gris | !' });
    expect(nth(queries, 0)).toContainEqual(['ilike', 'city', '%Mérida%']);
    expect(nth(callsOf(nth(queries, 0), 'textSearch'), 0)[2]).toBe('obra gris');
  });
});
