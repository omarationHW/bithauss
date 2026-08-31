import type { NextConfig } from "next";
import {
  resolveApiRewriteTarget,
  DEFAULT_API_HOST,
} from "./src/lib/api-rewrite-target";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();

const apiHost = DEFAULT_API_HOST;
const isDev = process.env.NODE_ENV !== "production";

const connectSrc = [
  "'self'",
  `https://${apiHost}`,
  `https://${supabaseHost}`,
  `wss://${supabaseHost}`,
  ...(isDev ? ["http://localhost:3001", "ws://localhost:3000"] : []),
]
  .filter(Boolean)
  .join(" ");

// BH-11: 'unsafe-eval' is only needed by the dev-mode React refresh runtime;
// a production build never evals. Dropping it in production removes the whole
// class of `eval`/`Function` gadgets an injected string could reach for.
// 'unsafe-inline' stays for now — Next 15 emits inline bootstrap scripts and
// removing it requires per-request nonces from the middleware (fase 1).
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  // i.ytimg.com / i.vimeocdn.com serve the video facade thumbnails, which is
  // what lets the ficha show a YouTube/Vimeo preview WITHOUT loading their
  // player script on every visit.
  "img-src 'self' data: blob: https://*.azurewebsites.net https://*.azurefd.net https://*.supabase.co https://*.tile.openstreetmap.org https://i.ytimg.com https://i.vimeocdn.com",
  // Property videos are served from Supabase Storage; blob: covers the local
  // preview shown while a file is still uploading. Without this directive the
  // default-src 'self' fallback would block every <video>.
  `media-src 'self' blob: data: https://*.supabase.co${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  // The video facade injects the provider iframe only after a click.
  "frame-src 'self' blob: https://www.openstreetmap.org https://www.google.com https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // A document that never legitimately embeds a plugin or worker from
  // elsewhere should say so; both are common XSS escalation paths.
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Isolates the browsing context so a cross-origin opener cannot reach into
  // this window (and vice versa) — cheap defence for the certificate pages,
  // which are meant to be opened from links people receive.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@bithauss/types", "@bithauss/validators", "@bithauss/config"],
  async rewrites() {
    // BH-08: the destination is validated against a strict allowlist instead
    // of being whatever API_URL contains. See src/lib/api-rewrite-target.ts.
    const apiUrl = resolveApiRewriteTarget({
      apiUrl: process.env.API_URL,
      isProduction: process.env.NODE_ENV === "production",
      extraHosts: process.env.API_REWRITE_ALLOWED_HOSTS,
    });
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bithaussstorage.blob.core.windows.net",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "bithauss-images-fpdpe5auefacdweh.z03.azurefd.net",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
