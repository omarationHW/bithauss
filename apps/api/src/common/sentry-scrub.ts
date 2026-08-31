/**
 * Sentry payload scrubbing (BH-17).
 *
 * BitHauss moves escrituras, INE scans and OCR output containing CURP/RFC. A
 * stack trace is fine to ship to a US-based processor; the request body that
 * produced it is a LFPDPPP transfer of personal data with no declared purpose.
 * `beforeSend` is the only place that can guarantee those never leave the
 * process, because any code path may end up in an exception context.
 *
 * The list is deliberately broad and keyed on substrings: a false positive
 * costs a redacted debugging field, a false negative costs a data breach.
 */

export const REDACTED = '[Filtrado]';

/** Keys whose value is dropped wherever they appear, at any depth. */
export const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|set-cookie|password|passwd|secret|token|api[_-]?key|apikey|session|jwt|bearer|curp|rfc|escritura|folio[_-]?real|address|direccion|telefono|phone|email|correo|card|pan|cvv|client_secret|stripe|customer_details|service_role|anon_key|signature)/i;

/** Top-level request members that are removed outright. */
const DROPPED_REQUEST_KEYS = ['data', 'cookies', 'env'] as const;

const MAX_DEPTH = 6;

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return REDACTED;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED
      : scrubValue(v, depth + 1);
  }
  return out;
}

/** Strips the query string, which routinely carries tokens and emails. */
export function scrubUrl(url: unknown): unknown {
  if (typeof url !== 'string') return url;
  const q = url.indexOf('?');
  return q === -1 ? url : `${url.slice(0, q)}?${REDACTED}`;
}

export interface ScrubbableEvent {
  request?: {
    data?: unknown;
    cookies?: unknown;
    env?: unknown;
    headers?: Record<string, unknown>;
    query_string?: unknown;
    url?: unknown;
  };
  user?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * Mutates and returns the event with every known PII carrier removed.
 * Safe to call on `null` (Sentry passes it in odd edge cases).
 */
export function scrubSentryEvent<T extends ScrubbableEvent | null>(event: T): T {
  if (!event) return event;

  if (event.request) {
    for (const key of DROPPED_REQUEST_KEYS) {
      if (key in event.request) delete (event.request as Record<string, unknown>)[key];
    }
    if (event.request.headers) {
      event.request.headers = scrubValue(event.request.headers) as Record<
        string,
        unknown
      >;
    }
    if (event.request.query_string !== undefined) {
      event.request.query_string = REDACTED;
    }
    if (event.request.url !== undefined) {
      event.request.url = scrubUrl(event.request.url);
    }
  }

  // Keep the user id (needed to correlate an incident) and drop the rest.
  if (event.user) {
    const id = event.user.id;
    event.user = id === undefined ? {} : { id };
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as Record<string, unknown>;
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b) => {
      const copy = { ...b };
      if (copy.data) copy.data = scrubValue(copy.data);
      return copy;
    });
  }

  return event;
}

/**
 * Same as `scrubSentryEvent`, typed for Sentry's own `beforeSend` /
 * `beforeSendTransaction` signatures. Those take a closed `ErrorEvent` /
 * `TransactionEvent` that does not structurally match `ScrubbableEvent`, so
 * the cast is funnelled through one place instead of being repeated (and
 * possibly widened) in every init file.
 */
export function scrubEventForSentry<T>(event: T): T {
  return scrubSentryEvent(event as unknown as ScrubbableEvent) as unknown as T;
}
