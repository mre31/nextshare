import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Deneysel özellikler (gerekirse)
  },
  distDir: '.next',
  // Output derleme hedefi
  output: 'standalone',
};

export default nextConfig;
