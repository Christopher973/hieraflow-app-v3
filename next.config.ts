import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  transpilePackages: ["@balkangraph/orgchart.js"],
};

export default nextConfig;
