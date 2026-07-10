import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
      // !! WARN !!
      // Dangerously allow production builds to successfully complete 
      // even if your project has type errors.
      ignoreBuildErrors: true,
    },
  /* config options here */
  reactCompiler: true,
  output: "standalone",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
