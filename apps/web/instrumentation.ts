import { assertServerEnv } from "@/lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // BH-02: validate the deployment before serving a single request. In
    // production a missing secret throws here and the container fails to
    // start, which is loud; the alternative is every BRC certificate quietly
    // reporting NO_ENCONTRADO.
    //
    // `next build` also runs this hook with NODE_ENV=production while
    // prerendering, and runtime secrets are (correctly) not present on the
    // build machine — so the hard failure is scoped to an actual server boot.
    const isBuild = process.env.NEXT_PHASE === "phase-production-build";
    assertServerEnv({
      isProduction: !isBuild && process.env.NODE_ENV === "production",
    });
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) => {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  }
};
