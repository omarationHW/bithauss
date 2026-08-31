import { scrubSentryEvent, scrubValue, REDACTED } from './sentry-scrub';

describe('scrubSentryEvent (BH-17)', () => {
  it('drops the request body, cookies and env wholesale', () => {
    const event = scrubSentryEvent({
      request: {
        data: { curp: 'ABCD010101HDFXXX01', escritura: 'texto completo' },
        cookies: { 'sb-access-token': 'ey...' },
        env: { SUPABASE_SERVICE_ROLE_KEY: 'secret' },
      },
    });
    expect(event?.request?.data).toBeUndefined();
    expect(event?.request?.cookies).toBeUndefined();
    expect(event?.request?.env).toBeUndefined();
  });

  it('redacts sensitive headers but keeps the harmless ones', () => {
    const event = scrubSentryEvent({
      request: {
        headers: {
          authorization: 'Bearer ey...',
          cookie: 'sb-access-token=1',
          'user-agent': 'Mozilla/5.0',
        },
      },
    });
    expect(event?.request?.headers?.authorization).toBe(REDACTED);
    expect(event?.request?.headers?.cookie).toBe(REDACTED);
    expect(event?.request?.headers?.['user-agent']).toBe('Mozilla/5.0');
  });

  it('strips the query string, which routinely carries tokens', () => {
    const event = scrubSentryEvent({
      request: { url: 'https://bithauss.com/verify?token=abc&email=a@b.com' },
    });
    expect(event?.request?.url).toBe(`https://bithauss.com/verify?${REDACTED}`);
  });

  it('keeps only the user id', () => {
    const event = scrubSentryEvent({
      user: { id: 'u-1', email: 'a@b.com', ip_address: '1.2.3.4' },
    });
    expect(event?.user).toEqual({ id: 'u-1' });
  });

  it.each([
    'curp',
    'rfc',
    'escritura',
    'folio_real',
    'address_line',
    'telefono',
    'email',
    'client_secret',
    'stripe_customer',
    'customer_details',
    'service_role_key',
    'password',
  ])('redacts nested key %s at any depth', (key) => {
    const scrubbed = scrubValue({ a: { b: { [key]: 'sensitive' } } }) as {
      a: { b: Record<string, unknown> };
    };
    expect(scrubbed.a.b[key]).toBe(REDACTED);
  });

  it('leaves ordinary diagnostic data alone', () => {
    const scrubbed = scrubValue({ statusCode: 500, route: '/api/v1/brc' });
    expect(scrubbed).toEqual({ statusCode: 500, route: '/api/v1/brc' });
  });

  it('is safe on null and on deeply recursive input', () => {
    expect(scrubSentryEvent(null)).toBeNull();
    let deep: Record<string, unknown> = { curp: 'x' };
    for (let i = 0; i < 50; i++) deep = { nested: deep };
    expect(() => scrubValue(deep)).not.toThrow();
  });
});
