import * as Sentry from "@sentry/nextjs";

// Client-side DSN must be public (baked into the browser bundle).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}
