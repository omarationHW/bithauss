import { ClientIpThrottlerGuard, throttleKey } from './client-ip-throttler.guard';

/** getTracker is protected; expose it for the test. */
class TestableGuard extends ClientIpThrottlerGuard {
  track(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

describe('ClientIpThrottlerGuard', () => {
  const guard = Object.create(TestableGuard.prototype) as TestableGuard;

  it('buckets visitors by the real client IP, not the shared App Service socket', async () => {
    const shared = '169.254.129.1';
    const a = await guard.track({ ip: shared, headers: { 'x-forwarded-for': '203.0.113.9:51000' } });
    const b = await guard.track({ ip: shared, headers: { 'x-forwarded-for': '198.51.100.7:52000' } });
    expect(a).toBe('203.0.113.9');
    expect(b).toBe('198.51.100.7');
  });

  it('a client-supplied X-Forwarded-For prefix cannot pick its own bucket', async () => {
    const t = await guard.track({ headers: { 'x-forwarded-for': '1.1.1.1, 203.0.113.9:51000' } });
    expect(t).toBe('203.0.113.9');
  });

  it('falls back to the socket address without the header (local dev)', async () => {
    expect(await guard.track({ ip: '127.0.0.1', headers: {} })).toBe('127.0.0.1');
  });

  it('rotating addresses inside one IPv6 /64 still hits the same bucket', async () => {
    const a = await guard.track({ headers: { 'x-forwarded-for': '[2001:db8:abcd:12::1]:5000' } });
    const b = await guard.track({ headers: { 'x-forwarded-for': '[2001:DB8:ABCD:0012:ffff:1234:5678:9abc]:5001' } });
    const other = await guard.track({ headers: { 'x-forwarded-for': '[2001:db8:abcd:13::1]:5000' } });
    expect(a).toBe('2001:db8:abcd:12::/64');
    expect(b).toBe(a);
    expect(other).not.toBe(a);
  });
});

describe('throttleKey', () => {
  it('maps IPv4-mapped IPv6 to plain IPv4', () => {
    expect(throttleKey('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(throttleKey('203.0.113.9')).toBe('203.0.113.9');
  });

  it('collapses IPv6 to its /64 in canonical form', () => {
    expect(throttleKey('::1')).toBe('0:0:0:0::/64');
    expect(throttleKey('2001:db8::')).toBe('2001:db8:0:0::/64');
    expect(throttleKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(throttleKey('64:ff9b::1.2.3.4')).toBe('64:ff9b:0:0::/64');
  });

  it('leaves unparseable values alone', () => {
    expect(throttleKey('unknown')).toBe('unknown');
  });
});
