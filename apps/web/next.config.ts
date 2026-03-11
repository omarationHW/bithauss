import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@bithauss/types", "@bithauss/validators", "@bithauss/config"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bithaussstorage.blob.core.windows.net",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
