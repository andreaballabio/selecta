import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-expect-error: eslint key removed from NextConfig type in Next.js 16 but still works at runtime
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig;
