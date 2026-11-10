import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';

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
    expect(await guard.track({ ip: '::1', headers: {} })).toBe('::1');
  });
});
