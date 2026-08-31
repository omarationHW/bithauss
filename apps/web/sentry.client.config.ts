import * as Sentry from "@sentry/nextjs";
import { scrubEventForSentry } from "@/lib/sentry-scrub";

// Client-side DSN must be public (baked into the browser bundle).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    // BH-17: Session Replay recorded 100% of errored sessions. On
    // /dashboard/expedientes that means filming a notary reading a scanned
    // escritura — CURP, RFC, addresses and the document viewer itself — and
    // shipping it to a processor that is not declared in the privacy notice.
    // Replay stays off until the LFPDPPP paperwork exists; when it is turned
    // back on it must run with maskAllText + blockAllMedia.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: (event) => scrubEventForSentry(event),
    beforeSendTransaction: (event) => scrubEventForSentry(event),
  });
}
