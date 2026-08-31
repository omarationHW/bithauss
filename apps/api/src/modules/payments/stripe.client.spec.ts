import { createHmac } from 'node:crypto';
import {
  encodeStripeForm,
  verifyStripeSignature,
  StripeSignatureError,
} from './stripe.client';

const SECRET = 'whsec_test_secret';

function sign(
  payload: string,
  timestamp: number,
  secret: string = SECRET,
): string {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

const EVENT = JSON.stringify({
  id: 'evt_123',
  type: 'checkout.session.completed',
  created: 1_700_000_000,
  data: { object: { id: 'cs_123', metadata: { payment_id: 'pay_1' } } },
});

describe('verifyStripeSignature', () => {
  const now = 1_700_000_000;

  it('accepts a valid signature and returns the parsed event', () => {
    const event = verifyStripeSignature(EVENT, sign(EVENT, now), SECRET, {
      nowSeconds: now,
    });
    expect(event.id).toBe('evt_123');
    expect(event.type).toBe('checkout.session.completed');
  });

  it('accepts a valid signature at the edge of the tolerance window', () => {
    const header = sign(EVENT, now - 300);
    expect(
      verifyStripeSignature(EVENT, header, SECRET, { nowSeconds: now }).id,
    ).toBe('evt_123');
  });

  it('accepts one of several v1 signatures (secret rotation)', () => {
    const good = sign(EVENT, now).split('v1=')[1];
    const header = `t=${now},v1=${'0'.repeat(64)},v1=${good}`;
    expect(
      verifyStripeSignature(EVENT, header, SECRET, { nowSeconds: now }).id,
    ).toBe('evt_123');
  });

  it('rejects an invalid signature', () => {
    const header = `t=${now},v1=${'a'.repeat(64)}`;
    expect(() =>
      verifyStripeSignature(EVENT, header, SECRET, { nowSeconds: now }),
    ).toThrow(StripeSignatureError);
  });

  it('rejects a signature made with the wrong secret', () => {
    const header = sign(EVENT, now, 'whsec_wrong');
    expect(() =>
      verifyStripeSignature(EVENT, header, SECRET, { nowSeconds: now }),
    ).toThrow(/mismatch/i);
  });

  it('rejects a tampered payload signed for the original body', () => {
    const header = sign(EVENT, now);
    const tampered = EVENT.replace('pay_1', 'pay_evil');
    expect(() =>
      verifyStripeSignature(tampered, header, SECRET, { nowSeconds: now }),
    ).toThrow(StripeSignatureError);
  });

  it('rejects an old timestamp even when the signature is valid (replay)', () => {
    const header = sign(EVENT, now - 3_600);
    expect(() =>
      verifyStripeSignature(EVENT, header, SECRET, { nowSeconds: now }),
    ).toThrow(/tolerance/i);
  });

  it('rejects a timestamp too far in the future', () => {
    const header = sign(EVENT, now + 3_600);
    expect(() =>
      verifyStripeSignature(EVENT, header, SECRET, { nowSeconds: now }),
    ).toThrow(/tolerance/i);
  });

  it('rejects a missing header, a malformed header and a missing secret', () => {
    expect(() => verifyStripeSignature(EVENT, undefined, SECRET)).toThrow(
      /Missing Stripe-Signature/,
    );
    expect(() =>
      verifyStripeSignature(EVENT, 'not-a-signature', SECRET),
    ).toThrow(/Malformed|No v1/);
    expect(() => verifyStripeSignature(EVENT, `t=${now}`, SECRET)).toThrow(
      /No v1 signature/,
    );
    expect(() => verifyStripeSignature(EVENT, sign(EVENT, now), '')).toThrow(
      /not configured/,
    );
  });

  it('rejects a correctly signed body that is not a Stripe event', () => {
    const payload = JSON.stringify({ hello: 'world' });
    expect(() =>
      verifyStripeSignature(payload, sign(payload, now), SECRET, {
        nowSeconds: now,
      }),
    ).toThrow(/missing id\/type/);

    const notJson = 'plain text';
    expect(() =>
      verifyStripeSignature(notJson, sign(notJson, now), SECRET, {
        nowSeconds: now,
      }),
    ).toThrow(/valid JSON/);
  });
});

describe('encodeStripeForm', () => {
  it('flattens nested objects and arrays the way Stripe expects', () => {
    const body = encodeStripeForm({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'mxn',
            unit_amount: 1_210_916,
            product_data: { name: 'Certificado BRC' },
          },
        },
      ],
      metadata: { payment_id: 'pay_1' },
    });

    expect(body).toContain('mode=payment');
    expect(body).toContain('line_items%5B0%5D%5Bquantity%5D=1');
    expect(body).toContain(
      'line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=1210916',
    );
    expect(body).toContain('metadata%5Bpayment_id%5D=pay_1');
  });

  it('drops null and undefined instead of sending the string "null"', () => {
    expect(encodeStripeForm({ a: 1, b: null, c: undefined })).toBe('a=1');
  });
});
