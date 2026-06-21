import type { NextConfig } from "next";

const nextConfig: NextConfig = {
 images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
      },
      {
        protocol: "https",
        hostname: "flagcdn.com"
      }
    ],
  },
};

export default nextConfig;
