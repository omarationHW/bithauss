import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();

const apiHost = "bithauss-api.azurewebsites.net";
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

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js dev/prod inline scripts
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.azurewebsites.net https://*.azurefd.net https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@bithauss/types", "@bithauss/validators", "@bithauss/config"],
  async rewrites() {
    const apiUrl =
      process.env.API_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://bithauss-api.azurewebsites.net"
        : "http://localhost:3001");
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
