import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bithauss/types", "@bithauss/validators", "@bithauss/config"],
};

export default nextConfig;
