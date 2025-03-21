import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Deneysel özellikler (gerekirse)
  },
  distDir: '.next',
  // Output derleme hedefi - export yerine servera çeviriyorum
  output: undefined, // output tanımını kaldırarak varsayılan değere dönüyoruz
  compiler: {
    // Turbopack yerine webpack kullanmaya zorla
    reactRemoveProperties: { properties: ['^data-test$'] },
  },
};

export default nextConfig;
