import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/kieswijzergroningen',
  images: { unoptimized: true },
};

export default nextConfig;
