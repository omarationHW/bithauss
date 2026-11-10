import { GeocodingService, boundingBoxExtentKm } from './geocoding.service';
import { NOMINATIM_USER_AGENT } from './assistant.constants';

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

let fetchMock: jest.SpyInstance;
beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch');
});
afterEach(() => jest.restoreAllMocks());

describe('GeocodingService', () => {
  it('queries Nominatim restricted to Mexico with our User-Agent and a timeout', async () => {
    fetchMock.mockResolvedValueOnce(ok([{ lat: '21.16', lon: '-86.81' }]));
    const svc = new GeocodingService();

    await expect(svc.geocode('Puerto Cancún')).resolves.toEqual({ lat: 21.16, lng: -86.81 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('countrycodes=mx');
    expect(url).toContain(encodeURIComponent('Puerto Cancún'));
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(NOMINATIM_USER_AGENT);
    expect(init.signal).toBeDefined();
  });

  it('reports the place size from the bounding box', async () => {
    // Huixquilucan, as Nominatim returns it.
    fetchMock.mockResolvedValueOnce(
      ok([{ lat: '19.3701838', lon: '-99.3581568', boundingbox: ['19.3016020', '19.4388890', '-99.4041796', '-99.2393911'] }]),
    );
    const point = await new GeocodingService().geocode('Huixquilucan');
    expect(point?.extent_km).toBeGreaterThan(10);
    expect(point?.extent_km).toBeLessThan(13);
    expect(boundingBoxExtentKm(['1', '2', 'x', '4'])).toBeNull();
    expect(boundingBoxExtentKm(undefined)).toBeNull();
  });

  it('caches results (case-insensitive) including "not found"', async () => {
    fetchMock.mockResolvedValueOnce(ok([{ lat: '1', lon: '2' }])).mockResolvedValueOnce(ok([]));
    const svc = new GeocodingService();

    await svc.geocode('Polanco');
    await svc.geocode('polanco ');
    expect(await svc.geocode('Lugar Inexistente')).toBeNull();
    expect(await svc.geocode('lugar inexistente')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null (and does not cache) on network error or timeout', async () => {
    fetchMock
      .mockRejectedValueOnce(new DOMException('aborted', 'TimeoutError'))
      .mockResolvedValueOnce(ok([{ lat: '1', lon: '2' }]));
    const svc = new GeocodingService();

    expect(await svc.geocode('Roma Norte')).toBeNull();
    expect(await svc.geocode('Roma Norte')).toEqual({ lat: 1, lng: 2 });
  });

  it('returns null on HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 429 }));
    expect(await new GeocodingService().geocode('Condesa')).toBeNull();
  });
});
