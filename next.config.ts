import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Deployed on Vercel (see docs/deploy-vercel.md), which builds and serves
  // Next natively — no output override, port, or server bundle config needed.
  // Pin the workspace root so a stray lockfile in a parent folder can't
  // confuse Turbopack about where the project starts.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  // v1: reads are dynamic (no cacheComponents). Read-caching (cacheComponents +
  // updateTag, or a KV store) is the first scale lever once git-API traffic grows
  // or outage resilience is needed. See docs/plans/2026-06-26-001-...-plan.md.
};

export default nextConfig;
