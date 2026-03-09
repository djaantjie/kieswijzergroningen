import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  // basePath alleen in productie (GitHub Pages), niet lokaal
  basePath: isProd ? "/kieswijzergroningen" : "",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
