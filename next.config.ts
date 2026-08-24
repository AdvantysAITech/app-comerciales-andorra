import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/**": ["./assets/plantillas/*.pdf"],
  },
};

export default nextConfig;