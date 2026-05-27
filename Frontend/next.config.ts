import type { NextConfig } from "next";
import path from "path";
import bundleAnalyzer from "@next/bundle-analyzer";

// Keep tracing and workspace-root detection scoped to the Frontend folder.
// This avoids dev warnings when multiple lockfiles exist on the machine.
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
};

// Bundle analyzer: run with `npm run analyze`
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
export default withBundleAnalyzer(nextConfig);
