import type { NextConfig } from "next";
import path from "path";
import bundleAnalyzer from "@next/bundle-analyzer";

// Keep tracing and workspace-root detection scoped to the repo root so
// Next.js doesn't try to walk up into the parent directory looking for a
// shared lockfile when the user has multiple lockfiles on their machine.
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
};

// Bundle analyzer: run with `npm run analyze`
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
export default withBundleAnalyzer(nextConfig);
