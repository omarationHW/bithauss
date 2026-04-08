import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@bithauss/types", "@bithauss/validators", "@bithauss/config"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:3001/api/v1/:path*",
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
