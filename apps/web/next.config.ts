import path from "node:path";
import type { NextConfig } from "next";

/*
 * Rewrites are resolved at build time and frozen in the routes manifest: the
 * image bakes API_URL (see apps/web/Dockerfile), setting it at runtime
 * changes nothing here.
 */
const apiUrl = process.env.API_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  /* Standalone server with a pruned node_modules, traced from the workspace root so hoisted dependencies are found. */
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /*
   * A signup link carries its token in the query string: never send the URL
   * to another origin, whatever the page links to later.
   */
  async headers() {
    return [
      { source: "/:path*", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      { source: "/inscription", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
