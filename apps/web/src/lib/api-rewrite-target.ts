/**
 * Validation for the `/api/v1/*` rewrite destination (BH-08).
 *
 * `next@15.5.18` carries a published SSRF in the rewrite handling, and this
 * app is one of the configurations that makes it reachable: `next.config.ts`
 * rewrites `/api/v1/:path*` to an absolute external URL, so the Next server
 * makes an outbound request on behalf of whoever called it. On Azure App
 * Service the interesting destination is the Instance Metadata Service at
 * 169.254.169.254, which hands out managed-identity tokens.
 *
 * Upgrading Next is the real fix (tracked as a dependency task). Until then
 * the exposure is bounded here: the destination is not whatever `API_URL`
 * happens to contain, it is one of a small, explicit set of hosts, and the
 * build fails loudly rather than silently proxying somewhere unexpected.
 */

export const DEFAULT_API_HOST = "bithauss-api.azurewebsites.net";

/** Hosts we are willing to proxy to in production. */
export const PRODUCTION_ALLOWED_HOSTS = [DEFAULT_API_HOST] as const;

/** Additionally allowed while developing. */
export const DEV_ALLOWED_HOSTS = ["localhost", "127.0.0.1"] as const;

export class InvalidRewriteTargetError extends Error {
  constructor(message: string) {
    super(
      `Destino de rewrite inválido para /api/v1/*: ${message}. ` +
        `Ajusta API_URL o añade el host a API_REWRITE_ALLOWED_HOSTS (ver docs/SECURITY.md, BH-08).`,
    );
    this.name = "InvalidRewriteTargetError";
  }
}

/**
 * Addresses that must never be a proxy destination even if someone adds them
 * to the allowlist by mistake: cloud metadata endpoints and loopback/link-local
 * ranges are the whole point of an SSRF.
 */
const BLOCKED_HOSTS = new Set([
  "169.254.169.254", // AWS/Azure/GCP IMDS
  "metadata.google.internal",
  "metadata.azure.com",
  "100.100.200.200", // Alibaba metadata
  "[::1]",
  "::1",
]);

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export interface ResolveOptions {
  /** Raw `API_URL` (or equivalent) from the environment. */
  apiUrl?: string;
  /** True when building/running for production. */
  isProduction: boolean;
  /** Comma-separated extra hosts, from `API_REWRITE_ALLOWED_HOSTS`. */
  extraHosts?: string;
}

export function allowedHosts(opts: ResolveOptions): Set<string> {
  const hosts = new Set<string>(PRODUCTION_ALLOWED_HOSTS);
  if (!opts.isProduction) {
    for (const h of DEV_ALLOWED_HOSTS) hosts.add(h);
  }
  for (const raw of (opts.extraHosts ?? "").split(",")) {
    const host = raw.trim().toLowerCase();
    if (host) hosts.add(host);
  }
  return hosts;
}

/**
 * Returns the origin (scheme + host [+ port]) to rewrite to, or throws.
 * Never returns a value carrying a path, query, credentials or fragment —
 * those are the parts an attacker uses to steer the outbound request.
 */
export function resolveApiRewriteTarget(opts: ResolveOptions): string {
  const fallback = opts.isProduction
    ? `https://${DEFAULT_API_HOST}`
    : "http://localhost:3001";
  const raw = (opts.apiUrl ?? "").trim() || fallback;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidRewriteTargetError(`"${raw}" no es una URL absoluta`);
  }

  if (url.username || url.password) {
    throw new InvalidRewriteTargetError("no se permiten credenciales en la URL");
  }
  if (url.search || url.hash) {
    throw new InvalidRewriteTargetError(
      "no se permite query string ni fragmento",
    );
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new InvalidRewriteTargetError(
      `no se permite una ruta en el destino ("${url.pathname}")`,
    );
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(host)) {
    throw new InvalidRewriteTargetError(
      `"${host}" es un endpoint de metadatos de nube`,
    );
  }

  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";

  if (opts.isProduction) {
    if (url.protocol !== "https:") {
      throw new InvalidRewriteTargetError(
        "en producción el destino debe ser https",
      );
    }
    if (isPrivateIpv4(host) || isLocal) {
      throw new InvalidRewriteTargetError(
        `"${host}" es una dirección privada o de loopback`,
      );
    }
  } else if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new InvalidRewriteTargetError(`protocolo no soportado (${url.protocol})`);
  }

  if (!allowedHosts(opts).has(host)) {
    throw new InvalidRewriteTargetError(`el host "${host}" no está en la allowlist`);
  }

  return url.port
    ? `${url.protocol}//${host}:${url.port}`
    : `${url.protocol}//${host}`;
}
