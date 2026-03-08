import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/kieswijzergroningen",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
