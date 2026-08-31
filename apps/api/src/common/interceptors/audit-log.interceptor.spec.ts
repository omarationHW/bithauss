import { stripQuery, clientIp } from './audit-log.interceptor';

describe('audit log helpers (BH-16)', () => {
  it('never records a query string', () => {
    // Query strings carry recovery tokens and email addresses.
    expect(stripQuery('/api/v1/verify/1?token=secret')).toBe('/api/v1/verify/1');
    expect(stripQuery('/api/v1/brc/expedientes')).toBe('/api/v1/brc/expedientes');
  });

  it('takes the proxy-written end of X-Forwarded-For, not the spoofable head', () => {
    expect(
      clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' } }),
    ).toBe('203.0.113.9');
  });

  it('strips the port Azure appends', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9:5000' } })).toBe(
      '203.0.113.9',
    );
  });

  it('falls back to the socket address', () => {
    expect(clientIp({ headers: {}, ip: '198.51.100.1' })).toBe('198.51.100.1');
    expect(clientIp({})).toBe('unknown');
  });
});
