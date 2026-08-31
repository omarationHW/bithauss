import * as Sentry from "@sentry/nextjs";
import { scrubEventForSentry } from "@/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    // BH-17: request bodies, cookies and query strings never leave the
    // process. See apps/web/src/lib/sentry-scrub.ts for the rationale.
    sendDefaultPii: false,
    beforeSend: (event) => scrubEventForSentry(event),
    beforeSendTransaction: (event) => scrubEventForSentry(event),
  });
}
