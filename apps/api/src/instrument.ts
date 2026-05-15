/**
 * Sentry initialization. Imported once at the very top of main.ts so
 * that auto-instrumentation can patch HTTP / Express before any other
 * module loads. No-ops cleanly when SENTRY_DSN is not set, so dev and
 * demo deployments incur zero overhead.
 */
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0.1'),
  });

  console.log(`[Sentry] initialized (env=${process.env.NODE_ENV ?? 'development'})`);
}
