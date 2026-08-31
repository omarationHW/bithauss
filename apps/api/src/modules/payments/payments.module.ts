import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeClient } from './stripe.client';

/**
 * BRC payments (Stripe Checkout).
 *
 * NOT registered in `app.module.ts` yet — import it there when wiring:
 *
 *   imports: [ ..., PaymentsModule ]
 *
 * Two things must accompany that wiring:
 *
 * 1. `main.ts` must create the app with `{ rawBody: true }`. The webhook
 *    signature is computed over the exact bytes Stripe sent, so the parsed
 *    body is useless for verification.
 * 2. `/api/v1/payments/stripe/webhook` must be reachable by Stripe and should
 *    be excluded from the CSRF/throttler assumptions that apply to browser
 *    traffic (it is already `@Public()`).
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY                  — server-side API key
 *   STRIPE_WEBHOOK_SECRET              — endpoint signing secret (whsec_…)
 *   STRIPE_PUBLISHABLE_KEY             — public key (optional on the API)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — same key, exposed to the web app
 *
 * With `STRIPE_SECRET_KEY` missing the module still boots: checkout returns
 * 503 and the web UI degrades the pay button instead of breaking the flow.
 */
@Module({
  controllers: [PaymentsController],
  // SupabaseConfigService comes from the @Global AuthModule.
  providers: [PaymentsService, StripeClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
