import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isIP } from 'node:net';
import { clientIp } from '../interceptors/audit-log.interceptor';

/**
 * Rate-limits by the visitor's real IP instead of the socket address.
 *
 * On Azure App Service every request reaches Node through the platform's
 * front end, so the socket address is the same for many visitors and they'd
 * share one rate-limit bucket. The front end appends the real client IP as the
 * LAST X-Forwarded-For entry (anything earlier is client-supplied and
 * spoofable), which is exactly what `clientIp()` reads.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return throttleKey(clientIp(req as { headers?: Record<string, unknown>; ip?: string }));
  }
}

/**
 * Canonical rate-limit bucket for an address.
 * - IPv4 and IPv4-mapped IPv6 (::ffff:1.2.3.4) → the plain IPv4.
 * - IPv6 → its /64 prefix. A single subscriber is usually handed a whole /64,
 *   so keying on the full address would let them rotate through billions of
 *   addresses to dodge the limit.
 * - Anything unparseable is returned as-is (lowercased).
 */
export function throttleKey(ip: string): string {
  const addr = ip.trim().toLowerCase();
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped?.[1]) return mapped[1];
  if (isIP(addr) !== 6) return addr;

  const hextets = expandIpv6(addr);
  return hextets ? `${hextets.slice(0, 4).join(':')}::/64` : addr;
}

/** "2001:db8::1" → ["2001","db8","0","0","0","0","0","1"]; null if malformed. */
function expandIpv6(addr: string): string[] | null {
  const noZone = addr.split('%')[0] ?? addr;
  const [head = '', tail] = noZone.split('::');
  const left = head ? head.split(':') : [];
  const right = tail !== undefined && tail !== '' ? tail.split(':') : [];
  // An embedded IPv4 tail (e.g. 64:ff9b::1.2.3.4) only affects the last 32 bits,
  // which the /64 prefix drops anyway — count it as two hextets.
  const width = (parts: string[]) => parts.reduce((n, p) => n + (p.includes('.') ? 2 : 1), 0);
  const missing = 8 - width(left) - width(right);
  if (tail === undefined ? missing !== 0 : missing < 0) return null;
  const full = [...left, ...Array<string>(tail === undefined ? 0 : missing).fill('0'), ...right];
  return full.map((h) => (h.includes('.') ? h : String(parseInt(h, 16).toString(16))));
}
