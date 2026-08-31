import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Thin Stripe REST client.
 *
 * The official `stripe` SDK is deliberately NOT a dependency: the whole
 * surface we need is two endpoints plus webhook signature verification, and
 * keeping it dependency-free avoids dragging a large package (and its
 * transitive tree) into the API image. Every network call lives in this file
 * so the service layer can be unit-tested with a stub.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY      — sk_live_… / sk_test_…  (server only)
 *   STRIPE_WEBHOOK_SECRET  — whsec_…               (server only)
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
/** Pinned so Stripe cannot change response shapes underneath us. */
const STRIPE_API_VERSION = '2024-06-20';

export interface StripeCheckoutLineItem {
  name: string;
  description?: string;
  /** Integer minor units (centavos). */
  unitAmount: number;
  currency: string;
  quantity: number;
}

export interface CreateCheckoutSessionParams {
  lineItem: StripeCheckoutLineItem;
  successUrl: string;
  cancelUrl: string;
  clientReferenceId: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  /** Stripe idempotency key — safe to retry the same checkout creation. */
  idempotencyKey?: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  payment_intent?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  status?: string | null;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
}

export interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
}

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeSignatureError';
  }
}

export class StripeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'StripeApiError';
  }
}

/**
 * Encodes a nested object the way Stripe's form API expects, e.g.
 * `{ line_items: [{ price_data: { currency: 'mxn' } }] }` becomes
 * `line_items[0][price_data][currency]=mxn`.
 */
export function encodeStripeForm(
  input: Record<string, unknown>,
  prefix = '',
  out: string[] = [],
): string {
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const path = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item !== null && typeof item === 'object') {
          encodeStripeForm(item as Record<string, unknown>, `${path}[${index}]`, out);
        } else {
          out.push(
            `${encodeURIComponent(`${path}[${index}]`)}=${encodeURIComponent(String(item))}`,
          );
        }
      });
    } else if (typeof value === 'object') {
      encodeStripeForm(value as Record<string, unknown>, path, out);
    } else {
      out.push(`${encodeURIComponent(path)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out.join('&');
}

/**
 * Verifies the `Stripe-Signature` header.
 *
 * Stripe signs `${timestamp}.${rawBody}` with HMAC-SHA256 using the endpoint
 * secret and sends it as `t=<ts>,v1=<hex>` (several `v1` entries while a
 * secret is being rotated). Three things must hold or the request is a
 * forgery / replay:
 *   1. the header parses and carries a timestamp,
 *   2. at least one v1 digest matches — compared in constant time so the
 *      endpoint cannot be used as a signature oracle,
 *   3. the timestamp is within tolerance, which is what stops an attacker
 *      from replaying a captured (correctly signed) payload later.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  opts: { toleranceSeconds?: number; nowSeconds?: number } = {},
): StripeEvent {
  const tolerance = opts.toleranceSeconds ?? 300;
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!secret) {
    throw new StripeSignatureError('STRIPE_WEBHOOK_SECRET is not configured');
  }
  if (!signatureHeader) {
    throw new StripeSignatureError('Missing Stripe-Signature header');
  }

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't' && value) timestamp = Number(value);
    if (key === 'v1' && value) signatures.push(value);
  }

  if (timestamp === null || !Number.isFinite(timestamp)) {
    throw new StripeSignatureError('Malformed Stripe-Signature header');
  }
  if (signatures.length === 0) {
    throw new StripeSignatureError('No v1 signature found in header');
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const matches = signatures.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, 'utf8');
    // timingSafeEqual throws on length mismatch, so guard first. Length is
    // not secret (it is always 64 hex chars for a real signature).
    if (candidateBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(candidateBuf, expectedBuf);
  });

  if (!matches) {
    throw new StripeSignatureError('Signature mismatch');
  }

  // Replay protection: reject anything older (or further in the future) than
  // the tolerance window, even when the signature itself is valid.
  if (Math.abs(now - timestamp) > tolerance) {
    throw new StripeSignatureError('Timestamp outside the tolerance window');
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    throw new StripeSignatureError('Webhook payload is not valid JSON');
  }
  if (!event?.id || !event?.type) {
    throw new StripeSignatureError('Webhook payload is missing id/type');
  }
  return event;
}

@Injectable()
export class StripeClient {
  private readonly logger = new Logger(StripeClient.name);

  constructor(private readonly config: ConfigService) {}

  private get secretKey(): string {
    return this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
  }

  private get webhookSecret(): string {
    return this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  /** False when the env vars are missing — callers must degrade, not crash. */
  isConfigured(): boolean {
    return Boolean(this.secretKey);
  }

  isWebhookConfigured(): boolean {
    return Boolean(this.webhookSecret);
  }

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: encodeStripeForm(body),
    });

    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        (json as { error?: { message?: string } })?.error?.message ??
        `Stripe request failed with ${response.status}`;
      this.logger.error(`Stripe ${path} failed: ${message}`);
      throw new StripeApiError(message, response.status, json);
    }
    return json as T;
  }

  /**
   * Creates a hosted Checkout Session. `unitAmount` is trusted only because
   * the service computes it server-side; nothing here comes from the client.
   */
  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<StripeCheckoutSession> {
    const body: Record<string, unknown> = {
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.clientReferenceId,
      customer_email: params.customerEmail,
      line_items: [
        {
          quantity: params.lineItem.quantity,
          price_data: {
            currency: params.lineItem.currency.toLowerCase(),
            unit_amount: params.lineItem.unitAmount,
            product_data: {
              name: params.lineItem.name,
              description: params.lineItem.description,
            },
          },
        },
      ],
      metadata: params.metadata,
      // Mirrored onto the PaymentIntent so a refund/dispute can be traced
      // back to the expediente without another lookup.
      payment_intent_data: { metadata: params.metadata },
    };

    return this.request<StripeCheckoutSession>(
      '/checkout/sessions',
      body,
      params.idempotencyKey,
    );
  }

  /**
   * Expires a Checkout Session so it can no longer be paid.
   *
   * Needed because a session outlives the quote that produced it: without
   * this, re-pricing a property would leave the old, cheaper session payable
   * (BH-28). Returns false instead of throwing — the webhook still refuses a
   * stale session, so a failed expiry degrades to "caught later", not to a
   * blocked re-quote.
   */
  async expireCheckoutSession(sessionId: string): Promise<boolean> {
    try {
      await this.request(`/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, {});
      return true;
    } catch (err) {
      // Already expired/completed sessions answer 400 — nothing to do.
      this.logger.warn(
        `Could not expire checkout session ${sessionId}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
      return false;
    }
  }

  /** Verifies a webhook payload against the configured endpoint secret. */
  constructEvent(rawBody: string, signatureHeader: string | undefined): StripeEvent {
    return verifyStripeSignature(rawBody, signatureHeader, this.webhookSecret);
  }
}
